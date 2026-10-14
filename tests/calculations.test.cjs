const test = require("node:test");
const assert = require("node:assert/strict");
const {
  CALIBRATION_RULES,
  getCalibrationCandidate,
  getBaselineSummary,
  getProvisionalRecentLevel,
  startOfLocalDay,
} = require("../.test-build/baselines.js");
const {
  calculateInitialCurrentGoal,
  calculateRecoveryGoal,
  consecutiveDifficultCycles,
  consecutiveDifficultCyclesForGoal,
  evaluateGoalCycle,
  normalizeGoalAmount,
} = require("../.test-build/goals.js");
const {
  getCompletedCycleHistory,
  getLatestCycleReview,
  getRecordedHabitQuantity,
} = require("../.test-build/tracking.js");
const {
  decodeLocalDateTime,
  encodeLocalDateTime,
} = require("../.test-build/localTime.js");
const {
  convertDurationInput,
  durationInputToMinutes,
  preferredDurationInput,
} = require("../.test-build/durationInput.js");

test("hour inputs are stored as minutes and reopen in a friendly unit", () => {
  assert.equal(durationInputToMinutes(1.5, "hours"), 90);
  assert.equal(convertDurationInput("90", "minutes", "hours"), "1.5");
  assert.equal(convertDurationInput("1.5", "hours", "minutes"), "90");
  assert.deepEqual(preferredDurationInput(90), {
    unit: "hours",
    value: "1.5",
  });
  assert.deepEqual(preferredDurationInput(45), {
    unit: "minutes",
    value: "45",
  });
});

test("saved local date and time survive a timezone change", () => {
  const originalTimezone = process.env.TZ;

  try {
    process.env.TZ = "America/Phoenix";
    const original = new Date(2026, 7, 28, 22, 15, 0, 0).getTime();
    const savedLocalTime = encodeLocalDateTime(original);
    const originalDayStart = new Date(2026, 7, 28, 0, 0, 0, 0).getTime();
    const savedLocalDayStart = encodeLocalDateTime(originalDayStart);

    process.env.TZ = "America/Chicago";
    const restored = new Date(decodeLocalDateTime(savedLocalTime));
    const restoredDayStart = new Date(decodeLocalDateTime(savedLocalDayStart));

    assert.equal(restored.getFullYear(), 2026);
    assert.equal(restored.getMonth(), 7);
    assert.equal(restored.getDate(), 28);
    assert.equal(restored.getHours(), 22);
    assert.equal(restored.getMinutes(), 15);
    assert.equal(restoredDayStart.getFullYear(), 2026);
    assert.equal(restoredDayStart.getMonth(), 7);
    assert.equal(restoredDayStart.getDate(), 28);
    assert.equal(restoredDayStart.getHours(), 0);
  } finally {
    if (originalTimezone == null) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});

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

test("one shared habit frequency preserves every plan rate", () => {
  const weeklyPlan = {
    startingAmount: 14,
    currentGoal: 10,
    longTermGoal: 4,
  };
  const dailyPlan = Object.fromEntries(
    Object.entries(weeklyPlan).map(([key, amount]) => [
      key,
      normalizeGoalAmount(amount, "week", "day"),
    ]),
  );

  assert.equal(dailyPlan.startingAmount, 2);
  assert.equal(dailyPlan.currentGoal, 10 / 7);
  assert.equal(dailyPlan.longTermGoal, 4 / 7);
});

test("a calculated starting amount produces a fresh initial step goal", () => {
  assert.equal(calculateInitialCurrentGoal(10, "week", 0, "week", "times"), 9);
  assert.equal(calculateInitialCurrentGoal(20, "week", 0, "week", "times"), 18);
});

test("calibration timing balances faster feedback with enough known days", () => {
  assert.deepEqual(CALIBRATION_RULES.day, {
    elapsedDays: 7,
    observedDays: 6,
    recentDays: 7,
    recentObservedDays: 3,
  });
  assert.deepEqual(CALIBRATION_RULES.week, {
    elapsedDays: 14,
    observedDays: 10,
    recentDays: 28,
    recentObservedDays: 7,
  });
  assert.deepEqual(CALIBRATION_RULES["28_days"], {
    elapsedDays: 28,
    observedDays: 21,
    recentDays: 56,
    recentObservedDays: 14,
  });
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

test("live monthly average uses provisional no-activity days before review", () => {
  const start = day(2026, 8, 1);
  const monthlyHabit = habit({
    baselinePeriod: "28_days",
    calibrationStartedAt: start,
  });
  const oneLog = [log(addDays(start, 4) + 12_000, 3)];
  const now = addDays(start, 14);

  assert.equal(getProvisionalRecentLevel(monthlyHabit, oneLog, now, []), 6);
  assert.equal(getBaselineSummary(monthlyHabit, oneLog, now, []).recent, null);
});

test("live monthly average excludes days marked forgot or unsure", () => {
  const start = day(2026, 8, 1);
  const monthlyHabit = habit({
    baselinePeriod: "28_days",
    calibrationStartedAt: start,
  });
  const unknownDay = confirmation(addDays(start, 2), "not_yet");

  assert.equal(
    getProvisionalRecentLevel(
      monthlyHabit,
      [log(addDays(start, 4) + 12_000, 3)],
      addDays(start, 14),
      [unknownDay],
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

test("the graph can show the recorded total instead of the projected result", () => {
  const start = day(2026, 8, 10);
  const confirmations = Array.from({ length: 6 }, (_, index) =>
    confirmation(addDays(start, index)),
  );
  const logs = [
    log(addDays(start, 1) + 12_000, 1),
    log(addDays(start, 3) + 12_000, 2),
  ];
  const cycle = getCompletedCycleHistory(
    habit(),
    logs,
    confirmations,
    [],
    day(2026, 8, 17),
  )[0];

  assert.equal(cycle.actualQuantity, 3.5);
  assert.equal(
    getRecordedHabitQuantity(logs, 1, cycle.startAt, cycle.endAtExclusive),
    3,
  );
});

test("a submitted weekly review does not count unknown days as confirmed", () => {
  const start = day(2026, 8, 10);
  const confirmations = [
    ...Array.from({ length: 5 }, (_, index) =>
      confirmation(addDays(start, index)),
    ),
    {
      ...confirmation(start),
      id: start + 1,
      period: "week",
      status: "everything_logged",
    },
  ];
  const review = getLatestCycleReview(
    habit(),
    [],
    confirmations,
    [],
    day(2026, 8, 17),
  );
  assert.equal(review.confirmedCount, 5);
  assert.equal(review.complete, false);
  assert.equal(review.actualQuantity, null);
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
