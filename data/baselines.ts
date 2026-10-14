import type {
  BaselineSummary,
  Habit,
  HabitPeriod,
  LogEntry,
  TrackingConfirmation,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export const CALIBRATION_RULES: Record<
  HabitPeriod,
  {
    elapsedDays: number;
    observedDays: number;
    recentDays: number;
    recentObservedDays: number;
  }
> = {
  day: {
    elapsedDays: 7,
    observedDays: 6,
    recentDays: 7,
    recentObservedDays: 3,
  },
  week: {
    elapsedDays: 14,
    observedDays: 10,
    recentDays: 28,
    recentObservedDays: 7,
  },
  "28_days": {
    elapsedDays: 28,
    observedDays: 21,
    recentDays: 56,
    recentObservedDays: 14,
  },
};

export function daysInPeriod(period: HabitPeriod) {
  if (period === "week") return 7;
  if (period === "28_days") return 28;
  return 1;
}

export function startOfLocalDay(timestamp: number) {
  const date = new Date(timestamp);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

function addLocalDays(timestamp: number, days: number) {
  const date = new Date(startOfLocalDay(timestamp));
  date.setDate(date.getDate() + days);
  return date.getTime();
}

function localCalendarDayDifference(startAt: number, endAt: number) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const startUtc = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.floor((endUtc - startUtc) / DAY_MS);
}

function observedActivity(
  logs: LogEntry[],
  startAt: number,
  endAtExclusive: number,
  confirmations: TrackingConfirmation[] = [],
  habitId?: number,
) {
  const relevant = logs.filter(
    (log) => log.createdAt >= startAt && log.createdAt < endAtExclusive,
  );
  const observedDaySet = new Set(
    relevant.map((log) => startOfLocalDay(log.createdAt)),
  );
  for (const confirmation of confirmations) {
    if (
      confirmation.period === "day" &&
      confirmation.status !== "not_yet" &&
      (habitId == null || confirmation.habitId === habitId) &&
      confirmation.periodStart >= startAt &&
      confirmation.periodStart < endAtExclusive
    ) {
      observedDaySet.add(confirmation.periodStart);
    }
  }
  const quantity = relevant.reduce(
    (sum, log) => sum + (log.didResist === 1 ? 0 : Math.max(0, log.count ?? 1)),
    0,
  );
  return { observedDays: observedDaySet.size, quantity };
}

export function calculateLevel(
  logs: LogEntry[],
  period: HabitPeriod,
  startAt: number,
  endAtExclusive: number,
  confirmations: TrackingConfirmation[] = [],
  habitId?: number,
) {
  const { observedDays, quantity } = observedActivity(
    logs,
    startAt,
    endAtExclusive,
    confirmations,
    habitId,
  );
  if (observedDays === 0) return null;
  return (quantity / observedDays) * daysInPeriod(period);
}

/**
 * Gives the live dashboard a provisional recent level without making users
 * finish a review first. Elapsed days count as known zero-activity days unless
 * the user explicitly marked them as unknown. Formal baseline and cycle math
 * continues to use confirmed days through the functions below.
 */
export function getProvisionalRecentLevel(
  habit: Habit,
  allLogs: LogEntry[],
  now = Date.now(),
  confirmations: TrackingConfirmation[] = [],
  windowDays = 14,
) {
  const today = startOfLocalDay(now);
  const windowStart = addLocalDays(today, -windowDays);
  const habitLogs = allLogs.filter((log) => log.habitId === habit.id);
  const firstLogAt = habitLogs.reduce<number | null>(
    (first, log) =>
      first == null ? log.createdAt : Math.min(first, log.createdAt),
    null,
  );
  const trackingStartedAt =
    habit.rebaselineStartedAt ?? habit.calibrationStartedAt ?? firstLogAt;
  if (trackingStartedAt == null) return null;

  const rangeStart = Math.max(windowStart, startOfLocalDay(trackingStartedAt));
  if (rangeStart >= today) return null;

  const recentLogs = habitLogs.filter(
    (log) => log.createdAt >= rangeStart && log.createdAt < today,
  );
  const daysWithLogs = new Set(
    recentLogs.map((log) => startOfLocalDay(log.createdAt)),
  );
  const latestStatusByDay = new Map<number, TrackingConfirmation>();

  for (const confirmation of confirmations) {
    if (
      confirmation.habitId !== habit.id ||
      confirmation.period !== "day" ||
      confirmation.periodStart < rangeStart ||
      confirmation.periodStart >= today
    ) {
      continue;
    }
    const existing = latestStatusByDay.get(confirmation.periodStart);
    if (!existing || confirmation.updatedAt >= existing.updatedAt) {
      latestStatusByDay.set(confirmation.periodStart, confirmation);
    }
  }

  let observedDays = 0;
  for (let dayStart = rangeStart; dayStart < today; ) {
    const explicitlyUnknown =
      latestStatusByDay.get(dayStart)?.status === "not_yet";
    if (daysWithLogs.has(dayStart) || !explicitlyUnknown) observedDays += 1;
    dayStart = addLocalDays(dayStart, 1);
  }

  const requiredObservedDays =
    CALIBRATION_RULES[habit.baselinePeriod].recentObservedDays;
  if (observedDays < requiredObservedDays) return null;

  const quantity = recentLogs.reduce(
    (total, log) =>
      total + (log.didResist === 1 ? 0 : Math.max(0, log.count ?? 1)),
    0,
  );
  return (quantity / observedDays) * daysInPeriod(habit.baselinePeriod);
}

export function getBaselineSummary(
  habit: Habit,
  allLogs: LogEntry[],
  now = Date.now(),
  confirmations: TrackingConfirmation[] = [],
): BaselineSummary {
  const logs = allLogs.filter((log) => log.habitId === habit.id);
  const rule = CALIBRATION_RULES[habit.baselinePeriod];
  const today = startOfLocalDay(now);
  const tomorrow = addLocalDays(today, 1);
  const recentStart = addLocalDays(today, -(rule.recentDays - 1));
  const recentObservation = observedActivity(
    logs,
    recentStart,
    tomorrow,
    confirmations,
    habit.id,
  );
  const recent =
    recentObservation.observedDays < rule.recentObservedDays
      ? null
      : (recentObservation.quantity / recentObservation.observedDays) *
        daysInPeriod(habit.baselinePeriod);

  const observedDayStarts = Array.from(
    new Set([
      ...logs.map((log) => startOfLocalDay(log.createdAt)),
      ...confirmations
        .filter(
          (confirmation) =>
            confirmation.habitId === habit.id &&
            confirmation.period === "day" &&
            confirmation.status !== "not_yet",
        )
        .map((confirmation) => confirmation.periodStart),
    ]),
  ).sort((a, b) => a - b);
  let freshStartIndex = 0;
  for (let index = 1; index < observedDayStarts.length; index += 1) {
    if (
      localCalendarDayDifference(
        observedDayStarts[index - 1],
        observedDayStarts[index],
      ) > rule.recentDays
    ) {
      freshStartIndex = index;
    }
  }
  const lastObservedDay = observedDayStarts.at(-1) ?? null;
  const gapIsStillOpen =
    lastObservedDay != null &&
    localCalendarDayDifference(lastObservedDay, today) > rule.recentDays;
  const freshObservedDays = gapIsStillOpen
    ? 0
    : observedDayStarts.length - freshStartIndex;
  const returningFromGap =
    observedDayStarts.length > 0 &&
    (gapIsStillOpen ||
      (freshStartIndex > 0 && freshObservedDays < rule.recentObservedDays));
  const priorPeriodEndDay = gapIsStillOpen
    ? lastObservedDay
    : freshStartIndex > 0
      ? observedDayStarts[freshStartIndex - 1]
      : null;
  const priorObservation =
    returningFromGap && priorPeriodEndDay != null
      ? observedActivity(
          logs,
          addLocalDays(priorPeriodEndDay, -(rule.recentDays - 1)),
          addLocalDays(priorPeriodEndDay, 1),
          confirmations,
          habit.id,
        )
      : null;
  const priorRecent =
    priorObservation != null &&
    priorObservation.observedDays >= rule.recentObservedDays
      ? (priorObservation.quantity / priorObservation.observedDays) *
        daysInPeriod(habit.baselinePeriod)
      : null;

  const firstLogAt = logs.reduce<number | null>(
    (first, log) =>
      first == null ? log.createdAt : Math.min(first, log.createdAt),
    null,
  );
  const startedAt =
    habit.rebaselineStartedAt ?? habit.calibrationStartedAt ?? firstLogAt;
  const calibrationStart =
    startedAt == null ? null : startOfLocalDay(startedAt);
  const elapsedDays =
    calibrationStart == null
      ? 0
      : Math.max(1, localCalendarDayDifference(calibrationStart, today) + 1);
  const calibrationEnd =
    habit.rebaselineStartedAt != null || habit.calibratedAt == null
      ? tomorrow
      : habit.calibratedAt + 1;
  const calibrationObservation =
    calibrationStart == null
      ? { observedDays: 0, quantity: 0 }
      : observedActivity(
          logs,
          calibrationStart,
          calibrationEnd,
          confirmations,
          habit.id,
        );

  return {
    status:
      habit.rebaselineStartedAt != null
        ? "collecting"
        : habit.calibratedBaseline != null
          ? "calibrated"
          : calibrationStart == null
            ? "not_started"
            : "collecting",
    estimated: habit.estimatedBaseline,
    calibrated: habit.calibratedBaseline,
    recent,
    priorRecent,
    returningFromGap,
    period: habit.baselinePeriod,
    observedDays: calibrationObservation.observedDays,
    requiredObservedDays: rule.observedDays,
    elapsedDays,
    requiredElapsedDays: rule.elapsedDays,
  };
}

export function getCalibrationCandidate(
  habit: Habit,
  logs: LogEntry[],
  now = Date.now(),
  confirmations: TrackingConfirmation[] = [],
) {
  if (habit.calibratedBaseline != null && habit.rebaselineStartedAt == null) {
    return null;
  }
  const summary = getBaselineSummary(habit, logs, now, confirmations);
  if (
    summary.status !== "collecting" ||
    summary.elapsedDays < summary.requiredElapsedDays ||
    summary.observedDays < summary.requiredObservedDays
  ) {
    return null;
  }
  const startedAt =
    habit.rebaselineStartedAt ??
    habit.calibrationStartedAt ??
    Math.min(
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
    );
  const value = calculateLevel(
    logs.filter((log) => log.habitId === habit.id),
    habit.baselinePeriod,
    startOfLocalDay(startedAt),
    addLocalDays(startOfLocalDay(now), 1),
    confirmations,
    habit.id,
  );
  return value == null ? null : Math.round(value * 10) / 10;
}
