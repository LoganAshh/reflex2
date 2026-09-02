const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getCalibrationCandidate,
  startOfLocalDay,
} = require("../.test-build/baselines.js");
const {
  calculateRecoveryGoal,
  consecutiveDifficultCycles,
  consecutiveDifficultCyclesForGoal,
  evaluateGoalCycle,
  normalizeGoalAmount,
} = require("../.test-build/goals.js");
const {
  getCompletedCycleHistory,
  getLatestCycleReview,
} = require("../.test-build/tracking.js");

function day(year, month, date) {
  return new Date(year, month - 1, date).getTime();
}

function addDays(timestamp, count) {
  const result = new Date(timestamp);
  result.setDate(result.getDate() + count);
  return result.getTime();
}

function habit(overrides = {}) {
  return {
    id: 1,
    name: "Test habit",
    isCustom: 1,
    hidden: 0,
    color: "#16A34A",
    icon: "ellipse",
    measurementType: "times",
    unit: "times",
    estimatedBaseline: 14,
    calibratedBaseline: null,
    calibrationStartedAt: day(2026, 8, 3),
    calibratedAt: null,
    rebaselineStartedAt: null,
    baselinePeriod: "week",
    finalTarget: 0,
    goalPeriod: "week",
    currentGoal: 8,
    currentGoalPeriod: "week",
    pendingGoal: null,
    pendingGoalPeriod: "week",
    pendingGoalReason: null,
    ...overrides,
  };
}

function confirmation(periodStart, status = "everything_logged") {
  return {
    id: periodStart,
    habitId: 1,
    period: "day",
    periodStart: startOfLocalDay(periodStart),
    status,
    updatedAt: periodStart,
  };
}

function log(createdAt, count) {
  return {
    id: createdAt,
    habitId: 1,
    habitName: "Test habit",
    cueId: null,
    cueName: null,
    cueIds: [],
    cueNames: [],
    locationId: null,
    locationName: null,
    intensity: null,
    count,
    didResist: 0,
    notes: null,
    createdAt,
    selectedActionId: null,
    selectedActionTitle: null,
  };
}

test("period conversion keeps the same daily rate", () => {
  assert.equal(normalizeGoalAmount(2, "day", "week"), 14);
  assert.equal(normalizeGoalAmount(8, "week", "28_days"), 32);
});

test("baseline calibration waits for enough elapsed and observed days", () => {
  const start = day(2026, 8, 3);
  const confirmations = Array.from({ length: 6 }, (_, index) =>
    confirmation(addDays(start, index)),
  );
  const logs = confirmations.map((item) => log(item.periodStart + 12_000, 2));
  const candidate = getCalibrationCandidate(
    habit({ baselinePeriod: "day", estimatedBaseline: 3 }),
    logs,
    addDays(start, 6),
    confirmations,
  );
  assert.equal(candidate, 2);
  assert.equal(
    getCalibrationCandidate(
      habit({ baselinePeriod: "day", estimatedBaseline: 3 }),
      logs,
      addDays(start, 5),
      confirmations,
    ),
    null,
  );
});

test("six confirmed days are projected to a seven-day amount", () => {
  const start = day(2026, 8, 10);
  const confirmations = Array.from({ length: 6 }, (_, index) =>
    confirmation(addDays(start, index)),
  );
  const logs = confirmations.map((item) => log(item.periodStart + 12_000, 2));
  const review = getLatestCycleReview(
    habit({ currentGoal: 13 }),
    logs,
    confirmations,
    [],
    day(2026, 8, 17),
  );
  assert.equal(review.complete, true);
  assert.equal(review.actualQuantity, 14);
  assert.notEqual(review.result, "goal_achieved");
});

test("previous completed amount enables improved-but-missed", () => {
  const firstStart = day(2026, 8, 3);
  const confirmations = Array.from({ length: 14 }, (_, index) =>
    confirmation(addDays(firstStart, index)),
  );
  const logs = [
    log(firstStart + 12_000, 12),
    log(addDays(firstStart, 7) + 12_000, 10),
  ];
  const cycles = getCompletedCycleHistory(
    habit(),
    logs,
    confirmations,
    [],
    day(2026, 8, 17),
  );
  assert.equal(cycles.length, 2);
  assert.equal(cycles[1].result, "improved_but_missed");
  assert.equal(
    cycles[0].id,
    getCompletedCycleHistory(
      habit(),
      logs,
      confirmations,
      [],
      day(2026, 8, 17),
    )[0].id,
  );
});

test("changing a reviewed day invalidates an otherwise complete cycle", () => {
  const start = day(2026, 8, 10);
  const confirmations = Array.from({ length: 6 }, (_, index) =>
    confirmation(addDays(start, index)),
  );
  assert.equal(
    getCompletedCycleHistory(habit(), [], confirmations, [], day(2026, 8, 17))
      .length,
    1,
  );
  const edited = confirmations.map((item, index) =>
    index === 0 ? { ...item, status: "not_yet" } : item,
  );
  assert.equal(
    getCompletedCycleHistory(habit(), [], edited, [], day(2026, 8, 17)).length,
    0,
  );
});

test("goal results and recovery streaks reset after improvement", () => {
  assert.equal(
    evaluateGoalCycle({
      complete: true,
      actual: 7,
      currentGoal: 8,
      baseline: 14,
    }),
    "goal_achieved",
  );
  assert.equal(
    evaluateGoalCycle({
      complete: true,
      actual: 20,
      currentGoal: 8,
      baseline: 14,
    }),
    "dramatically_exceeded",
  );
  assert.equal(
    consecutiveDifficultCycles([
      { result: "dramatically_exceeded" },
      { result: "returned_to_previous_level" },
    ]),
    2,
  );
  assert.equal(
    consecutiveDifficultCycles([
      { result: "dramatically_exceeded" },
      { result: "goal_achieved" },
    ]),
    0,
  );
});

test("recovery restores one prior goal step without returning to baseline", () => {
  assert.equal(calculateRecoveryGoal(6, 10, 0, "times", [6, 8, 9]), 8);
  assert.equal(calculateRecoveryGoal(9, 10, 0, "times", [9, 10]), 9);
});

test("a goal change resets the difficult-cycle count", () => {
  assert.equal(
    consecutiveDifficultCyclesForGoal(
      [
        { result: "dramatically_exceeded", currentGoal: 8 },
        { result: "returned_to_previous_level", currentGoal: 7 },
      ],
      7,
    ),
    1,
  );
  assert.equal(
    consecutiveDifficultCyclesForGoal(
      [
        { result: "dramatically_exceeded", currentGoal: 7 },
        { result: "returned_to_previous_level", currentGoal: 7 },
      ],
      7,
    ),
    2,
  );
});
