import type {
  CycleHistoryEntry,
  GoalCycleResult,
  HabitMeasurementType,
  HabitPeriod,
} from "./types";

export function daysInGoalPeriod(period: HabitPeriod) {
  if (period === "week") return 7;
  if (period === "28_days") return 28;
  return 1;
}

export function normalizeGoalAmount(
  amount: number,
  fromPeriod: HabitPeriod,
  toPeriod: HabitPeriod,
) {
  return (amount / daysInGoalPeriod(fromPeriod)) * daysInGoalPeriod(toPeriod);
}

function roundStep(value: number, measurementType: HabitMeasurementType) {
  if (measurementType === "minutes" && value >= 10) {
    return Math.round(value / 5) * 5;
  }
  return Math.round(value);
}

export function calculateNextReductionGoal(
  current: number,
  finalTarget: number,
  measurementType: HabitMeasurementType,
) {
  if (current <= finalTarget) return finalTarget;
  const remaining = current - finalTarget;
  let next = roundStep(current - remaining * 0.1, measurementType);
  const minimumStep = measurementType === "minutes" && remaining >= 5 ? 5 : 1;
  if (next >= current) next = current - minimumStep;
  return Math.max(finalTarget, next);
}

export function calculateInitialCurrentGoal(
  baseline: number,
  baselinePeriod: HabitPeriod,
  finalTarget: number,
  goalPeriod: HabitPeriod,
  measurementType: HabitMeasurementType,
) {
  const normalizedBaseline = normalizeGoalAmount(
    baseline,
    baselinePeriod,
    goalPeriod,
  );
  return calculateNextReductionGoal(
    normalizedBaseline,
    finalTarget,
    measurementType,
  );
}

export function calculateEasierGoal(
  current: number,
  baseline: number,
  finalTarget: number,
  measurementType: HabitMeasurementType,
) {
  const ceiling = Math.max(baseline, current);
  if (current >= ceiling) return current;
  const distance = ceiling - current;
  let easier = roundStep(
    current + Math.max(1, distance * 0.1),
    measurementType,
  );
  if (measurementType === "minutes" && distance >= 5 && easier <= current) {
    easier = current + 5;
  }
  return Math.max(finalTarget, Math.min(ceiling, easier));
}

export function calculateRecoveryGoal(
  current: number,
  baseline: number,
  finalTarget: number,
  measurementType: HabitMeasurementType,
  previousGoals: number[],
) {
  const priorStep = previousGoals.find(
    (goal) => goal > current && goal < baseline && goal >= finalTarget,
  );
  if (priorStep != null) return priorStep;

  const calculated = calculateEasierGoal(
    current,
    baseline,
    finalTarget,
    measurementType,
  );
  const minimumStep =
    measurementType === "minutes" && baseline - current >= 5 ? 5 : 1;
  const belowBaseline = Math.min(calculated, baseline - minimumStep);
  return belowBaseline > current ? belowBaseline : current;
}

export function evaluateGoalCycle(input: {
  complete: boolean;
  actual: number;
  currentGoal: number;
  baseline: number;
  previousActual?: number | null;
}): GoalCycleResult {
  if (!input.complete) return "incomplete_data";
  if (input.actual <= input.currentGoal) return "goal_achieved";
  if (input.actual > Math.max(input.currentGoal * 1.5, input.baseline * 1.25)) {
    return "dramatically_exceeded";
  }
  if (input.previousActual != null && input.actual < input.previousActual) {
    return "improved_but_missed";
  }
  if (input.actual < input.baseline) return "held_below_baseline";
  return "returned_to_previous_level";
}

export function isDifficultCycle(result: GoalCycleResult) {
  return (
    result === "returned_to_previous_level" ||
    result === "dramatically_exceeded"
  );
}

export function consecutiveDifficultCycles(
  cycles: Pick<CycleHistoryEntry, "result">[],
) {
  let count = 0;
  for (let index = cycles.length - 1; index >= 0; index -= 1) {
    if (!isDifficultCycle(cycles[index].result)) break;
    count += 1;
  }
  return count;
}

export function consecutiveDifficultCyclesForGoal(
  cycles: Pick<CycleHistoryEntry, "result" | "currentGoal">[],
  currentGoal: number,
) {
  let count = 0;
  for (let index = cycles.length - 1; index >= 0; index -= 1) {
    const cycle = cycles[index];
    if (
      !isDifficultCycle(cycle.result) ||
      cycle.currentGoal == null ||
      Math.abs(cycle.currentGoal - currentGoal) > 0.0001
    ) {
      break;
    }
    count += 1;
  }
  return count;
}

export function goalChangeExplanation(
  current: number,
  next: number,
  finalTarget: number,
) {
  const remaining = Math.max(0, current - finalTarget);
  const change = Math.max(0, current - next);
  const format = (value: number) =>
    Number.isInteger(value) ? `${value}` : value.toFixed(1);
  return `This step lowers the goal by ${format(change)} while moving about 10% of the remaining ${format(remaining)} toward the long-term goal.`;
}
