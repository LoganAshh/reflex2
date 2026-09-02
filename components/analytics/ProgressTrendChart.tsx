import { useEffect, useMemo, useRef, useState } from "react";
import type { GestureResponderEvent, LayoutChangeEvent } from "react-native";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type {
  CycleHistoryEntry,
  GoalCycleResult,
  Habit,
  HabitPeriod,
  LogEntry,
} from "../../data/types";
import { normalizeGoalAmount } from "../../data/goals";

type RangeKey = "4W" | "3M" | "6M" | "All";

type TrendPoint = {
  id: string;
  timestamp: number;
  value: number;
  priorValue: number | null;
  actual: number | null;
  goal: number | null;
  period: HabitPeriod | null;
  unit: string;
  resistedUrges: number;
  result: GoalCycleResult | null;
  rangeLabel: string;
  cycleDays: number;
  provisional: boolean;
};

const RANGE_OPTIONS: Array<{ key: RangeKey; days: number | null }> = [
  { key: "4W", days: 28 },
  { key: "3M", days: 90 },
  { key: "6M", days: 180 },
  { key: "All", days: null },
];

const PLOT_HEIGHT = 168;
const PLOT_PADDING_LEFT = 42;
const PLOT_PADDING_RIGHT = 14;
const PLOT_PADDING_Y = 14;

function periodDays(period: HabitPeriod) {
  if (period === "week") return 7;
  if (period === "28_days") return 28;
  return 1;
}

function periodName(period: HabitPeriod | null) {
  if (period === "week") return "week";
  if (period === "28_days") return "28 days";
  return "day";
}

function completedPeriodName(period: HabitPeriod) {
  if (period === "week") return "weeks";
  if (period === "28_days") return "months";
  return "days";
}

function formatNumber(value: number) {
  if (Number.isInteger(value)) return `${value}`;
  return value.toFixed(1);
}

function formatAxisNumber(value: number) {
  const absolute = Math.abs(value);
  let formatted: string;
  if (absolute >= 1000) {
    formatted = `${Number((value / 1000).toFixed(1))}k`;
  } else {
    formatted = formatNumber(Number(value.toFixed(1)));
  }
  return formatted;
}

function niceAxisStep(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const fraction = value / magnitude;
  const niceFraction =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return niceFraction * magnitude;
}

function axisBounds(values: number[], floorAtZero: boolean) {
  if (values.length === 0) return { min: 0, max: 1 };
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const rawRange = rawMax - rawMin || Math.max(1, Math.abs(rawMax) * 0.2);
  const step = niceAxisStep(rawRange / 4);
  let min = Math.floor(rawMin / step) * step;
  let max = Math.ceil(rawMax / step) * step;
  if (floorAtZero) min = Math.max(0, min);
  if (min === max) max = min + step;
  return { min, max };
}

function formatAxisDate(timestamp: number, includeYear: boolean) {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "2-digit" as const } : {}),
  });
}

function unitForValue(unit: string, value: number) {
  if (value !== 1) return unit;
  if (unit === "times") return "time";
  if (unit === "minutes") return "minute";
  return unit;
}

function formatCycleRange(startAt: number, endAtExclusive: number) {
  const start = new Date(startAt);
  const end = new Date(endAtExclusive);
  end.setDate(end.getDate() - 1);
  const startText = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const endText = end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return startText === endText ? startText : `${startText}–${endText}`;
}

function startOfLocalWeek(timestamp: number) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  const daysSinceMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - daysSinceMonday);
  return date.getTime();
}

function resultLabel(result: GoalCycleResult | null) {
  if (result === "goal_achieved") return "Current goal achieved";
  if (result === "improved_but_missed") return "Improved from the prior cycle";
  if (result === "held_below_baseline") return "Still below the starting level";
  if (result === "dramatically_exceeded") return "A difficult cycle";
  if (result === "returned_to_previous_level") return "Near the previous level";
  return null;
}

function individualPoints(habit: Habit, cycles: CycleHistoryEntry[]) {
  const relevant = cycles
    .filter(
      (cycle) => cycle.habitId === habit.id && cycle.actualQuantity != null,
    )
    .sort((a, b) => a.startAt - b.startAt);

  return relevant.map<TrendPoint>((cycle, index) => {
    const actual = normalizeGoalAmount(
      cycle.actualQuantity ?? 0,
      cycle.period,
      habit.currentGoalPeriod,
    );
    const priorCycle = relevant[index - 1];
    const priorValue = priorCycle
      ? normalizeGoalAmount(
          priorCycle.actualQuantity ?? 0,
          priorCycle.period,
          habit.currentGoalPeriod,
        )
      : null;
    return {
      id: cycle.id,
      timestamp: cycle.endAtExclusive - 1,
      value: actual,
      priorValue,
      actual,
      goal:
        cycle.currentGoal == null
          ? null
          : normalizeGoalAmount(
              cycle.currentGoal,
              cycle.period,
              habit.currentGoalPeriod,
            ),
      period: habit.currentGoalPeriod,
      unit: habit.unit.trim() || "times",
      resistedUrges: cycle.resistedUrges,
      result: cycle.result,
      rangeLabel: formatCycleRange(cycle.startAt, cycle.endAtExclusive),
      cycleDays: periodDays(cycle.period),
      provisional: false,
    };
  });
}

function overallPoints(cycles: CycleHistoryEntry[]) {
  const weeks = new Map<
    number,
    Map<number, { levels: number[]; resisted: number }>
  >();

  for (const cycle of cycles) {
    if (
      cycle.actualQuantity == null ||
      cycle.baseline == null ||
      cycle.baseline <= 0
    ) {
      continue;
    }
    const week = startOfLocalWeek(cycle.endAtExclusive - 1);
    const habits = weeks.get(week) ?? new Map();
    const habit = habits.get(cycle.habitId) ?? {
      levels: [],
      resisted: 0,
    };
    habit.levels.push((cycle.actualQuantity / cycle.baseline) * 100);
    habit.resisted += cycle.resistedUrges;
    habits.set(cycle.habitId, habit);
    weeks.set(week, habits);
  }

  const raw = Array.from(weeks.entries())
    .sort(([a], [b]) => a - b)
    .map(([week, habits]) => {
      const habitAverages = Array.from(habits.values()).map(
        (habit) =>
          habit.levels.reduce((sum, value) => sum + value, 0) /
          habit.levels.length,
      );
      const value =
        habitAverages.reduce((sum, amount) => sum + amount, 0) /
        habitAverages.length;
      const resistedUrges = Array.from(habits.values()).reduce(
        (sum, habit) => sum + habit.resisted,
        0,
      );
      return { week, value, resistedUrges };
    });

  return raw.map<TrendPoint>((point, index) => ({
    id: `overall:${point.week}`,
    timestamp: point.week,
    value: point.value,
    priorValue: raw[index - 1]?.value ?? null,
    actual: null,
    goal: null,
    period: null,
    unit: "%",
    resistedUrges: point.resistedUrges,
    result: null,
    rangeLabel: `Week of ${new Date(point.week).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })}`,
    cycleDays: 7,
    provisional: false,
  }));
}

function startOfLocalDay(timestamp: number) {
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

function provisionalActivityPoints(habit: Habit, logs: LogEntry[]) {
  const habitLogs = logs.filter((log) => log.habitId === habit.id);
  const trackingStarts = [
    habit.rebaselineStartedAt,
    habit.calibrationStartedAt,
    ...habitLogs.map((log) => log.createdAt),
  ].filter((value): value is number => value != null && Number.isFinite(value));
  if (trackingStarts.length === 0) return [];

  const now = Date.now();
  const today = startOfLocalDay(now);
  const trackingStart = startOfLocalDay(Math.min(...trackingStarts));
  const unit = habit.unit.trim() || "times";
  const bucketPeriod: HabitPeriod =
    habit.currentGoalPeriod === "week" ? "day" : "week";
  const earliest =
    bucketPeriod === "day"
      ? addLocalDays(today, -27)
      : addLocalDays(today, -111);
  let bucketStart = Math.max(trackingStart, earliest);
  if (bucketPeriod === "week") bucketStart = startOfLocalWeek(bucketStart);

  const raw: Array<{
    startAt: number;
    endAtExclusive: number;
    timestamp: number;
    quantity: number;
    resisted: number;
  }> = [];
  const bucketDays = periodDays(bucketPeriod);
  for (
    let startAt = bucketStart;
    startAt <= today;
    startAt = addLocalDays(startAt, bucketDays)
  ) {
    const fullEnd = addLocalDays(startAt, bucketDays);
    const observedEndExclusive = Math.min(fullEnd, now + 1);
    const displayEndExclusive = Math.min(fullEnd, addLocalDays(today, 1));
    const bucketLogs = habitLogs.filter(
      (log) => log.createdAt >= startAt && log.createdAt < observedEndExclusive,
    );
    raw.push({
      startAt,
      endAtExclusive: displayEndExclusive,
      timestamp: observedEndExclusive - 1,
      quantity: bucketLogs.reduce(
        (sum, log) =>
          sum + (log.didResist === 1 ? 0 : Math.max(0, log.count ?? 1)),
        0,
      ),
      resisted: bucketLogs.filter((log) => log.didResist === 1).length,
    });
  }

  return raw.map<TrendPoint>((bucket, index) => ({
    id: `provisional:${habit.id}:${bucketPeriod}:${bucket.startAt}`,
    timestamp: bucket.timestamp,
    value: bucket.quantity,
    priorValue: raw[index - 1]?.quantity ?? null,
    actual: bucket.quantity,
    goal: null,
    period: bucketPeriod,
    unit,
    resistedUrges: bucket.resisted,
    result: null,
    rangeLabel: formatCycleRange(bucket.startAt, bucket.endAtExclusive),
    cycleDays: bucketDays,
    provisional: true,
  }));
}

function Line({
  x1,
  y1,
  x2,
  y2,
  color,
  dashed = false,
  opacity = 1,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  dashed?: boolean;
  opacity?: number;
}) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const angle = `${Math.atan2(y2 - y1, x2 - x1)}rad`;
  const dashWidth = 5;
  const dashGap = 4;
  const dashCount = Math.ceil(length / (dashWidth + dashGap));
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: (x1 + x2) / 2 - length / 2,
        top: (y1 + y2) / 2 - 1,
        width: length,
        height: 2,
        backgroundColor: dashed ? "transparent" : color,
        opacity,
        transform: [{ rotate: angle }],
      }}
    >
      {dashed
        ? Array.from({ length: dashCount }, (_, index) => (
            <View
              key={index}
              style={{
                position: "absolute",
                left: index * (dashWidth + dashGap),
                width: Math.min(
                  dashWidth,
                  length - index * (dashWidth + dashGap),
                ),
                height: 1,
                backgroundColor: color,
                opacity: 0.42,
              }}
            />
          ))
        : null}
    </View>
  );
}

function darkenHex(color: string, amount = 0.28) {
  const match = color.match(/^#([0-9a-f]{6})$/i);
  if (!match) return color;
  const value = Number.parseInt(match[1], 16);
  const channel = (shift: number) =>
    Math.max(0, Math.round(((value >> shift) & 255) * (1 - amount)));
  return `#${[channel(16), channel(8), channel(0)]
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("")}`;
}

function GoalLegendItem({
  color,
  dashed,
  label,
}: {
  color: string;
  dashed?: boolean;
  label: string;
}) {
  return (
    <View className="flex-row items-center">
      <View className="mr-1.5 h-2 w-6 justify-center overflow-hidden">
        {dashed ? (
          <View className="flex-row justify-between">
            {[0, 1, 2].map((index) => (
              <View
                key={index}
                className="h-0.5 w-1.5 rounded-full"
                style={{ backgroundColor: color }}
              />
            ))}
          </View>
        ) : (
          <View
            className="h-0.5 w-full rounded-full"
            style={{ backgroundColor: color }}
          />
        )}
      </View>
      <Text className="text-[10px] font-black text-gray-500">{label}</Text>
    </View>
  );
}

export function ProgressTrendChart({
  habit,
  cycles,
  logs,
  accentColor,
}: {
  habit: Habit | null;
  cycles: CycleHistoryEntry[];
  logs: LogEntry[];
  accentColor: string;
}) {
  const [range, setRange] = useState<RangeKey>("4W");
  const [width, setWidth] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const lastHapticId = useRef<string | null>(null);
  const manuallySelectedRange = useRef(false);

  const completedHabitCycleCount = habit
    ? cycles.filter((cycle) => cycle.habitId === habit.id).length
    : 0;
  const usingProvisionalPoints =
    habit != null &&
    habit.currentGoalPeriod !== "day" &&
    completedHabitCycleCount < 4;
  const allPoints = useMemo(() => {
    if (!habit) return overallPoints(cycles);
    if (usingProvisionalPoints) return provisionalActivityPoints(habit, logs);
    return individualPoints(habit, cycles);
  }, [cycles, habit, logs, usingProvisionalPoints]);
  const suggestedRange = useMemo<RangeKey>(() => {
    if (usingProvisionalPoints) return "4W";
    if (habit?.currentGoalPeriod === "28_days" && allPoints.length >= 4) {
      return "3M";
    }
    if (allPoints.length < 5) return "4W";
    const first = allPoints[0]?.timestamp;
    const last = allPoints.at(-1)?.timestamp;
    if (first == null || last == null) return "4W";
    return last - first >= 28 * 24 * 60 * 60 * 1000 ? "3M" : "4W";
  }, [allPoints, habit?.currentGoalPeriod, usingProvisionalPoints]);

  useEffect(() => {
    if (!manuallySelectedRange.current) {
      setRange(suggestedRange);
    }
  }, [suggestedRange]);

  const points = useMemo(() => {
    const days = RANGE_OPTIONS.find((option) => option.key === range)?.days;
    if (days == null) return allPoints;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return allPoints.filter((point) => point.timestamp >= cutoff);
  }, [allPoints, range]);

  useEffect(() => {
    if (points.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!points.some((point) => point.id === selectedId)) {
      setSelectedId(points.at(-1)?.id ?? null);
    }
  }, [points, selectedId]);

  const selected =
    points.find((point) => point.id === selectedId) ?? points.at(-1) ?? null;
  const currentGoal = usingProvisionalPoints
    ? null
    : (habit?.currentGoal ?? null);
  const longTermGoal =
    usingProvisionalPoints || habit?.finalTarget == null
      ? null
      : normalizeGoalAmount(
          habit.finalTarget,
          habit.goalPeriod,
          habit.currentGoalPeriod,
        );
  const showLongTermGoal =
    longTermGoal != null &&
    (currentGoal == null || Math.abs(longTermGoal - currentGoal) > 0.0001);
  const longTermColor = darkenHex(accentColor);
  const scaleValues = [
    ...points.map((point) => point.value),
    ...(currentGoal == null ? [] : [currentGoal]),
    ...(!showLongTermGoal || longTermGoal == null ? [] : [longTermGoal]),
  ];
  const { min: minValue, max: maxValue } = axisBounds(
    scaleValues,
    habit != null,
  );

  const plotWidth = Math.max(1, width - PLOT_PADDING_LEFT - PLOT_PADDING_RIGHT);
  const plotHeight = PLOT_HEIGHT - PLOT_PADDING_Y * 2;
  const minTime = points[0]?.timestamp ?? 0;
  const maxTime = points.at(-1)?.timestamp ?? minTime;
  const coordinates = points.map((point, index) => ({
    point,
    x:
      points.length === 1 || maxTime === minTime
        ? PLOT_PADDING_LEFT + plotWidth / 2
        : PLOT_PADDING_LEFT +
          ((point.timestamp - minTime) / (maxTime - minTime)) * plotWidth,
    y:
      PLOT_PADDING_Y +
      ((maxValue - point.value) / (maxValue - minValue)) * plotHeight,
    index,
  }));
  const selectedCoordinate = coordinates.find(
    (coordinate) => coordinate.point.id === selected?.id,
  );

  const selectNearest = (event: GestureResponderEvent) => {
    if (coordinates.length === 0) return;
    const x = event.nativeEvent.locationX;
    const nearest = coordinates.reduce((best, current) =>
      Math.abs(current.x - x) < Math.abs(best.x - x) ? current : best,
    );
    if (nearest.point.id === selectedId) return;
    setSelectedId(nearest.point.id);
    if (lastHapticId.current !== nearest.point.id) {
      lastHapticId.current = nearest.point.id;
      Haptics.selectionAsync().catch(() => {});
    }
  };

  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  const delta =
    selected?.priorValue == null ? null : selected.value - selected.priorValue;
  const result = selected ? resultLabel(selected.result) : null;
  const yAxisRatios = [0, 0.25, 0.5, 0.75, 1];
  const xAxisDates =
    minTime === maxTime
      ? minTime > 0
        ? [minTime]
        : []
      : Array.from(
          { length: 4 },
          (_, index) => minTime + ((maxTime - minTime) * index) / 3,
        );
  const includeYearOnXAxis = maxTime - minTime > 365 * 24 * 60 * 60 * 1000;

  return (
    <View className="mt-3 rounded-3xl border border-gray-200 bg-gray-50 p-3 shadow-sm">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-base font-black text-black">
            Progress over time
          </Text>
          <Text className="mt-0.5 text-xs font-semibold text-gray-500">
            {habit && usingProvisionalPoints
              ? `${habit.currentGoalPeriod === "week" ? "Daily" : "Weekly"} activity · Lower is better`
              : habit
                ? `Completed ${completedPeriodName(habit.currentGoalPeriod)} · Lower is better`
                : "Overall activity score · Lower is better"}
          </Text>
        </View>
        <View className="h-9 w-9 items-center justify-center rounded-2xl border border-gray-200 bg-white">
          <Ionicons name="trending-up" size={19} color={accentColor} />
        </View>
      </View>

      <View className="mt-3 flex-row gap-2">
        {RANGE_OPTIONS.map((option) => {
          const active = option.key === range;
          return (
            <Pressable
              key={option.key}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                manuallySelectedRange.current = true;
                setRange(option.key);
              }}
              className="flex-1 rounded-full border px-2 py-1.5"
              style={{
                borderColor: active ? accentColor : "#E5E7EB",
                backgroundColor: active ? accentColor : "#FFFFFF",
              }}
            >
              <Text
                className={`text-center text-xs font-black ${active ? "text-white" : "text-black"}`}
              >
                {option.key}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {habit && (currentGoal != null || showLongTermGoal) ? (
        <View className="mt-3 flex-row flex-wrap items-center gap-x-4 gap-y-2 px-1">
          {currentGoal != null ? (
            <GoalLegendItem color={accentColor} label="Current goal" />
          ) : null}
          {showLongTermGoal && longTermGoal != null ? (
            <GoalLegendItem
              color={longTermColor}
              dashed
              label="Long-term goal"
            />
          ) : null}
        </View>
      ) : null}

      {points.length === 0 ? (
        <View className="mt-3 h-40 items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-5">
          <Ionicons name="analytics-outline" size={28} color="#9CA3AF" />
          <Text className="mt-2 text-center text-sm font-black text-gray-700">
            Your progress graph is building
          </Text>
          <Text className="mt-1 text-center text-xs font-semibold leading-4 text-gray-500">
            Completed tracking cycles will appear here.
          </Text>
        </View>
      ) : (
        <>
          <View
            className="mt-3 overflow-hidden rounded-2xl border border-gray-200 bg-white"
            style={{ height: PLOT_HEIGHT }}
            onLayout={onLayout}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={selectNearest}
            onResponderMove={selectNearest}
          >
            {yAxisRatios.map((ratio) => (
              <View
                key={`label:${ratio}`}
                pointerEvents="none"
                className="absolute justify-center"
                style={{
                  left: 2,
                  top: PLOT_PADDING_Y + plotHeight * ratio - 7,
                  width: PLOT_PADDING_LEFT - 9,
                  height: 14,
                }}
              >
                <Text className="text-right text-[9px] font-bold text-gray-400">
                  {formatAxisNumber(maxValue - (maxValue - minValue) * ratio)}
                </Text>
              </View>
            ))}

            {[0.25, 0.5, 0.75].map((ratio) => (
              <View
                key={ratio}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: PLOT_PADDING_LEFT,
                  right: PLOT_PADDING_RIGHT,
                  top: PLOT_PADDING_Y + plotHeight * ratio,
                  height: 1,
                  backgroundColor: "#F3F4F6",
                }}
              />
            ))}

            {habit && currentGoal != null && width > 0 ? (
              <Line
                x1={PLOT_PADDING_LEFT}
                y1={
                  PLOT_PADDING_Y +
                  ((maxValue - currentGoal) / (maxValue - minValue)) *
                    plotHeight
                }
                x2={width - PLOT_PADDING_RIGHT}
                y2={
                  PLOT_PADDING_Y +
                  ((maxValue - currentGoal) / (maxValue - minValue)) *
                    plotHeight
                }
                color={accentColor}
                opacity={0.35}
              />
            ) : null}

            {habit && showLongTermGoal && longTermGoal != null && width > 0 ? (
              <Line
                x1={PLOT_PADDING_LEFT}
                y1={
                  PLOT_PADDING_Y +
                  ((maxValue - longTermGoal) / (maxValue - minValue)) *
                    plotHeight
                }
                x2={width - PLOT_PADDING_RIGHT}
                y2={
                  PLOT_PADDING_Y +
                  ((maxValue - longTermGoal) / (maxValue - minValue)) *
                    plotHeight
                }
                color={longTermColor}
                dashed
              />
            ) : null}

            {width > 0
              ? coordinates.slice(1).map((coordinate, index) => {
                  const previous = coordinates[index];
                  const gapDays =
                    (coordinate.point.timestamp - previous.point.timestamp) /
                    (24 * 60 * 60 * 1000);
                  const expectedDays = Math.max(
                    previous.point.cycleDays,
                    coordinate.point.cycleDays,
                  );
                  if (gapDays > expectedDays * 2.5) {
                    return null;
                  }
                  const crossesMissingCycle = gapDays > expectedDays * 1.5;
                  return (
                    <Line
                      key={`${previous.point.id}:${coordinate.point.id}`}
                      x1={previous.x}
                      y1={previous.y}
                      x2={coordinate.x}
                      y2={coordinate.y}
                      color={accentColor}
                      dashed={crossesMissingCycle}
                    />
                  );
                })
              : null}

            {width > 0
              ? coordinates.map((coordinate) => {
                  const active = coordinate.point.id === selected?.id;
                  const pointGoal = coordinate.point.goal;
                  const meetsCurrentGoal =
                    habit != null &&
                    pointGoal != null &&
                    coordinate.point.value <= pointGoal;
                  const meetsLongTermGoal =
                    habit != null &&
                    longTermGoal != null &&
                    coordinate.point.value <= longTermGoal;
                  const dotColor = meetsLongTermGoal
                    ? longTermColor
                    : accentColor;
                  const dotSize = meetsLongTermGoal
                    ? active
                      ? 18
                      : 14
                    : active
                      ? 14
                      : 10;
                  return (
                    <View
                      key={coordinate.point.id}
                      pointerEvents="none"
                      className="absolute items-center justify-center rounded-full bg-white"
                      style={{
                        left: coordinate.x - dotSize / 2,
                        top: coordinate.y - dotSize / 2,
                        width: dotSize,
                        height: dotSize,
                        borderWidth: active ? 3 : 2,
                        borderColor: dotColor,
                        backgroundColor: meetsCurrentGoal
                          ? dotColor
                          : "#FFFFFF",
                        opacity: habit != null && !meetsCurrentGoal ? 0.55 : 1,
                      }}
                    >
                      {meetsLongTermGoal ? (
                        <Ionicons
                          name="checkmark"
                          size={active ? 10 : 8}
                          color="#FFFFFF"
                        />
                      ) : null}
                    </View>
                  );
                })
              : null}

            {selectedCoordinate ? (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: selectedCoordinate.x,
                  top: PLOT_PADDING_Y,
                  bottom: PLOT_PADDING_Y,
                  width: 1,
                  backgroundColor: accentColor,
                  opacity: 0.25,
                }}
              />
            ) : null}
          </View>

          <View
            className={`mt-2 flex-row ${xAxisDates.length === 1 ? "justify-center" : "justify-between"}`}
            style={{
              marginLeft: PLOT_PADDING_LEFT,
              marginRight: PLOT_PADDING_RIGHT,
            }}
          >
            {xAxisDates.map((timestamp, index) => (
              <Text
                key={`${timestamp}:${index}`}
                className="text-[9px] font-bold text-gray-400"
              >
                {formatAxisDate(timestamp, includeYearOnXAxis)}
              </Text>
            ))}
          </View>
          <Text className="mt-1 text-center text-[10px] font-bold text-gray-400">
            Tap or drag to inspect
          </Text>

          {selected ? (
            <View className="mt-3 rounded-2xl border border-gray-200 bg-white p-3">
              <Text className="text-xs font-black uppercase tracking-wide text-gray-500">
                {selected.rangeLabel}
              </Text>
              <Text className="mt-1 text-xl font-black text-black">
                {habit && selected.actual != null
                  ? `${formatNumber(selected.actual)} ${unitForValue(selected.unit, selected.actual)} per ${periodName(selected.period)}`
                  : `Overall score: ${formatNumber(selected.value)}`}
              </Text>
              {habit == null ? (
                <Text className="mt-1 text-xs font-semibold text-gray-600">
                  You started at 100
                </Text>
              ) : null}
              {habit && selected.goal != null ? (
                <Text className="mt-1 text-xs font-semibold text-gray-600">
                  Goal then: {formatNumber(selected.goal)}{" "}
                  {unitForValue(selected.unit, selected.goal)} per{" "}
                  {periodName(selected.period)}
                </Text>
              ) : null}
              {delta != null ? (
                <Text
                  className="mt-1 text-xs font-black"
                  style={{
                    color: habit
                      ? delta <= 0
                        ? "#15803D"
                        : "#6B7280"
                      : delta <= 0
                        ? "#15803D"
                        : "#6B7280",
                  }}
                >
                  {habit
                    ? delta < 0
                      ? `${formatNumber(Math.abs(delta))} fewer than the previous cycle`
                      : delta > 0
                        ? `${formatNumber(delta)} more than the previous cycle`
                        : "Same as the previous cycle"
                    : delta < 0
                      ? `Down ${formatNumber(Math.abs(delta))} points from last week`
                      : delta > 0
                        ? `Up ${formatNumber(delta)} points from last week`
                        : "Same as last week"}
                </Text>
              ) : null}
              {result ? (
                <Text className="mt-1 text-xs font-semibold text-gray-600">
                  {result}
                </Text>
              ) : null}
              {selected.provisional ? (
                <Text className="mt-1 text-xs font-semibold text-gray-500">
                  {`Your completed-${habit?.currentGoalPeriod === "week" ? "week" : "month"} trend is still building. This activity is not used for goal results yet.`}
                </Text>
              ) : null}
              {selected.resistedUrges > 0 ? (
                <Text className="mt-1 text-xs font-semibold text-gray-600">
                  {selected.resistedUrges} resisted{" "}
                  {selected.resistedUrges === 1 ? "urge" : "urges"}
                </Text>
              ) : null}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}
