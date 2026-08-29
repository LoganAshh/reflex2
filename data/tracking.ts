import type {
  CycleHistoryEntry,
  CycleReview,
  GoalHistoryEntry,
  Habit,
  HabitPeriod,
  LogEntry,
  TrackingConfirmation,
} from "./types";
import {
  calculateNextReductionGoal,
  evaluateGoalCycle,
  normalizeGoalAmount,
} from "./goals";
import { startOfLocalDay } from "./baselines";

function addLocalDays(timestamp: number, days: number) {
  const date = new Date(startOfLocalDay(timestamp));
  date.setDate(date.getDate() + days);
  return date.getTime();
}

function startOfLocalWeek(timestamp: number) {
  const date = new Date(startOfLocalDay(timestamp));
  const daysSinceMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - daysSinceMonday);
  return date.getTime();
}

export function getPreviousCycleBounds(period: HabitPeriod, now = Date.now()) {
  const today = startOfLocalDay(now);

  if (period === "day") {
    return { startAt: addLocalDays(today, -1), endAtExclusive: today };
  }

  if (period === "week") {
    const currentWeekStart = startOfLocalWeek(today);
    return {
      startAt: addLocalDays(currentWeekStart, -7),
      endAtExclusive: currentWeekStart,
    };
  }

  const anchor = startOfLocalDay(new Date(2024, 0, 1).getTime());
  const elapsedDays = Math.floor((today - anchor) / (24 * 60 * 60 * 1000));
  const currentBlockStart = addLocalDays(
    anchor,
    Math.floor(elapsedDays / 28) * 28,
  );
  return {
    startAt: addLocalDays(currentBlockStart, -28),
    endAtExclusive: currentBlockStart,
  };
}

export function isInfrequentWeeklyHabit(habit: Habit) {
  const baseline = habit.calibratedBaseline ?? habit.estimatedBaseline;
  if (baseline == null) return false;
  const weekly = normalizeGoalAmount(baseline, habit.baselinePeriod, "week");
  return weekly <= 2;
}

function confirmationMatches(
  confirmation: TrackingConfirmation,
  habitId: number,
  period: TrackingConfirmation["period"],
  periodStart: number,
) {
  return (
    confirmation.habitId === habitId &&
    confirmation.period === period &&
    confirmation.periodStart === periodStart &&
    confirmation.status !== "not_yet"
  );
}

function confirmedDailyStarts(
  habitId: number,
  startAt: number,
  endAtExclusive: number,
  confirmations: TrackingConfirmation[],
) {
  return new Set(
    confirmations
      .filter(
        (confirmation) =>
          confirmation.habitId === habitId &&
          confirmation.period === "day" &&
          confirmation.periodStart >= startAt &&
          confirmation.periodStart < endAtExclusive &&
          confirmation.status !== "not_yet",
      )
      .map((confirmation) => confirmation.periodStart),
  );
}

function goalForCycle(
  habit: Habit,
  history: GoalHistoryEntry[],
  endAtExclusive: number,
) {
  const changedAfterCycle = history.some(
    (item) => item.habitId === habit.id && item.createdAt >= endAtExclusive,
  );
  const entry = history
    .filter(
      (item) => item.habitId === habit.id && item.createdAt < endAtExclusive,
    )
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  if (entry) {
    return {
      amount: normalizeGoalAmount(
        entry.amount,
        entry.period,
        habit.currentGoalPeriod,
      ),
      changedAfterCycle,
    };
  }

  return {
    amount: habit.currentGoal,
    changedAfterCycle,
  };
}

function trackingStartForHabit(
  habit: Habit,
  logs: LogEntry[],
  confirmations: TrackingConfirmation[],
) {
  const starts = [
    habit.rebaselineStartedAt,
    habit.calibrationStartedAt,
    ...logs
      .filter((log) => log.habitId === habit.id)
      .map((log) => log.createdAt),
    ...confirmations
      .filter(
        (confirmation) =>
          confirmation.habitId === habit.id &&
          confirmation.status !== "not_yet",
      )
      .map((confirmation) => confirmation.periodStart),
  ].filter((value): value is number => value != null && Number.isFinite(value));

  return starts.length > 0 ? startOfLocalDay(Math.min(...starts)) : null;
}

function periodDays(period: HabitPeriod) {
  return period === "28_days" ? 28 : period === "week" ? 7 : 1;
}

function roundQuantity(value: number) {
  return Math.round(value * 100) / 100;
}

function reviewCycle(
  habit: Habit,
  logs: LogEntry[],
  confirmations: TrackingConfirmation[],
  goalHistory: GoalHistoryEntry[],
  startAt: number,
  endAtExclusive: number,
  previousActual: number | null,
): CycleReview {
  const period = habit.currentGoalPeriod;
  const trackingStart = trackingStartForHabit(habit, logs, confirmations);
  const eligible = trackingStart != null && trackingStart <= startAt;
  const periodConfirmation = confirmations.some((confirmation) =>
    confirmationMatches(confirmation, habit.id, period, startAt),
  );
  const dailyStarts = confirmedDailyStarts(
    habit.id,
    startAt,
    endAtExclusive,
    confirmations,
  );

  let confirmedCount = 0;
  let requiredConfirmations = 1;
  let complete = false;
  let usesWholePeriod = false;

  if (period === "day") {
    confirmedCount = periodConfirmation ? 1 : 0;
    complete = confirmedCount === 1;
    usesWholePeriod = complete;
  } else if (period === "week") {
    confirmedCount = dailyStarts.size;
    requiredConfirmations = 6;
    complete = confirmedCount >= requiredConfirmations;
  } else if (periodConfirmation) {
    confirmedCount = 1;
    complete = true;
    usesWholePeriod = true;
  } else {
    confirmedCount = dailyStarts.size;
    requiredConfirmations = 24;
    complete = confirmedCount >= requiredConfirmations;
  }

  complete = complete && eligible;
  const allCycleLogs = logs.filter(
    (log) =>
      log.habitId === habit.id &&
      log.createdAt >= startAt &&
      log.createdAt < endAtExclusive,
  );
  const countedLogs = usesWholePeriod
    ? allCycleLogs
    : allCycleLogs.filter((log) =>
        dailyStarts.has(startOfLocalDay(log.createdAt)),
      );
  const confirmedQuantity = countedLogs.reduce(
    (sum, log) => sum + (log.didResist === 1 ? 0 : Math.max(0, log.count ?? 1)),
    0,
  );
  // A complete review may intentionally omit one weekly day (or four monthly
  // days). Compare like with like by projecting only confirmed days to the full
  // goal period instead of silently treating missing days as zero.
  const actualQuantity = !complete
    ? null
    : usesWholePeriod
      ? confirmedQuantity
      : roundQuantity(
          (confirmedQuantity / confirmedCount) * periodDays(period),
        );
  const resistedUrges = countedLogs.filter((log) => log.didResist === 1).length;
  const activityLogs = countedLogs.filter((log) => log.didResist !== 1).length;
  const baselineSource = habit.calibratedBaseline ?? habit.estimatedBaseline;
  const baselineSourceLabel =
    habit.calibratedBaseline != null
      ? "calibrated"
      : habit.estimatedBaseline != null
        ? "estimated"
        : "unavailable";
  const baseline =
    baselineSource == null
      ? null
      : normalizeGoalAmount(
          baselineSource,
          habit.baselinePeriod,
          habit.currentGoalPeriod,
        );
  const cycleGoal = goalForCycle(habit, goalHistory, endAtExclusive);
  const currentGoal = cycleGoal.amount;
  const result =
    complete &&
    actualQuantity != null &&
    baseline != null &&
    currentGoal != null
      ? evaluateGoalCycle({
          complete: true,
          actual: actualQuantity,
          currentGoal,
          baseline,
          previousActual,
        })
      : "incomplete_data";
  const reductionFromBaseline =
    actualQuantity == null || baseline == null
      ? null
      : baseline - actualQuantity;
  const stepDistance =
    baseline != null && currentGoal != null ? baseline - currentGoal : 0;
  const stepProgressPercent =
    reductionFromBaseline == null || stepDistance <= 0
      ? null
      : Math.max(
          0,
          Math.min(
            100,
            Math.round((reductionFromBaseline / stepDistance) * 100),
          ),
        );
  const finalTarget =
    habit.finalTarget == null
      ? null
      : normalizeGoalAmount(
          habit.finalTarget,
          habit.goalPeriod,
          habit.currentGoalPeriod,
        );
  const recommendedGoal =
    result === "goal_achieved" &&
    currentGoal != null &&
    finalTarget != null &&
    !cycleGoal.changedAfterCycle
      ? calculateNextReductionGoal(
          currentGoal,
          finalTarget,
          habit.measurementType,
        )
      : currentGoal;

  return {
    habitId: habit.id,
    startAt,
    endAtExclusive,
    period,
    eligible,
    complete,
    confirmedCount,
    requiredConfirmations,
    actualQuantity,
    baseline,
    baselineSource: baselineSourceLabel,
    currentGoal,
    reductionFromBaseline,
    stepProgressPercent,
    resistedUrges,
    activityLogs,
    result,
    recommendedGoal,
    goalAlreadyAdvanced: cycleGoal.changedAfterCycle,
  };
}

export function cycleHistoryId(
  habitId: number,
  period: HabitPeriod,
  startAt: number,
) {
  return `${habitId}:${period}:${startAt}`;
}

export function getCompletedCycleHistory(
  habit: Habit,
  logs: LogEntry[],
  confirmations: TrackingConfirmation[],
  goalHistory: GoalHistoryEntry[],
  now = Date.now(),
): CycleHistoryEntry[] {
  const trackingStart = trackingStartForHabit(habit, logs, confirmations);
  if (trackingStart == null) return [];

  const latest = getPreviousCycleBounds(habit.currentGoalPeriod, now);
  const days = periodDays(habit.currentGoalPeriod);
  const bounds: Array<{ startAt: number; endAtExclusive: number }> = [];
  for (
    let startAt = latest.startAt, endAtExclusive = latest.endAtExclusive;
    endAtExclusive > trackingStart;
    startAt = addLocalDays(startAt, -days),
      endAtExclusive = addLocalDays(endAtExclusive, -days)
  ) {
    bounds.unshift({ startAt, endAtExclusive });
  }

  const completed: CycleHistoryEntry[] = [];
  let previousActual: number | null = null;
  for (const bound of bounds) {
    const review = reviewCycle(
      habit,
      logs,
      confirmations,
      goalHistory,
      bound.startAt,
      bound.endAtExclusive,
      previousActual,
    );
    if (!review.complete || review.actualQuantity == null) continue;
    completed.push({
      ...review,
      id: cycleHistoryId(habit.id, habit.currentGoalPeriod, bound.startAt),
    });
    previousActual = review.actualQuantity;
  }
  return completed;
}

export function getLatestCycleReview(
  habit: Habit,
  logs: LogEntry[],
  confirmations: TrackingConfirmation[],
  goalHistory: GoalHistoryEntry[],
  now = Date.now(),
): CycleReview {
  const period = habit.currentGoalPeriod;
  let { startAt, endAtExclusive } = getPreviousCycleBounds(period, now);
  if (period === "day") {
    const latestConfirmedDay = confirmations
      .filter(
        (confirmation) =>
          confirmation.habitId === habit.id &&
          confirmation.period === "day" &&
          confirmation.status !== "not_yet" &&
          confirmation.periodStart < startOfLocalDay(now),
      )
      .sort((a, b) => b.periodStart - a.periodStart)[0];
    if (latestConfirmedDay) {
      startAt = latestConfirmedDay.periodStart;
      endAtExclusive = addLocalDays(startAt, 1);
    }
  }
  const previousActual =
    getCompletedCycleHistory(
      habit,
      logs,
      confirmations,
      goalHistory,
      startAt,
    ).at(-1)?.actualQuantity ?? null;
  return reviewCycle(
    habit,
    logs,
    confirmations,
    goalHistory,
    startAt,
    endAtExclusive,
    previousActual,
  );
}
