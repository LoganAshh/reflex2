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
  maxConnectionDays: number;
};

const RANGE_OPTIONS: Array<{ key: RangeKey; days: number | null }> = [
  { key: "4W", days: 28 },
  { key: "3M", days: 90 },
  { key: "6M", days: 180 },
  { key: "All", days: null },
];

const PLOT_HEIGHT = 168;
const PLOT_PADDING_X = 14;
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

function formatNumber(value: number) {
  if (Number.isInteger(value)) return `${value}`;
  return value.toFixed(1);
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
      maxConnectionDays: periodDays(cycle.period) * 1.6,
    };
  });
}

function overallPoints(cycles: CycleHistoryEntry[]) {
  const weeks = new Map<
    number,
    Map<number, { reductions: number[]; resisted: number }>
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
      reductions: [],
      resisted: 0,
    };
    habit.reductions.push(
      ((cycle.baseline - cycle.actualQuantity) / cycle.baseline) * 100,
    );
    habit.resisted += cycle.resistedUrges;
    habits.set(cycle.habitId, habit);
    weeks.set(week, habits);
  }

  const raw = Array.from(weeks.entries())
    .sort(([a], [b]) => a - b)
    .map(([week, habits]) => {
      const habitAverages = Array.from(habits.values()).map(
        (habit) =>
          habit.reductions.reduce((sum, value) => sum + value, 0) /
          habit.reductions.length,
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
    maxConnectionDays: 7 * 1.6,
  }));
}

function Line({
  x1,
  y1,
  x2,
  y2,
  color,
  dashed = false,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  dashed?: boolean;
}) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const angle = `${Math.atan2(y2 - y1, x2 - x1)}rad`;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: (x1 + x2) / 2 - length / 2,
        top: (y1 + y2) / 2 - 1,
        width: length,
        height: dashed ? 1 : 2,
        backgroundColor: color,
        opacity: dashed ? 0.45 : 1,
        transform: [{ rotate: angle }],
      }}
    />
  );
}

export function ProgressTrendChart({
  habit,
  cycles,
  accentColor,
}: {
  habit: Habit | null;
  cycles: CycleHistoryEntry[];
  accentColor: string;
}) {
  const [range, setRange] = useState<RangeKey>("3M");
  const [width, setWidth] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const lastHapticId = useRef<string | null>(null);

  const allPoints = useMemo(
    () => (habit ? individualPoints(habit, cycles) : overallPoints(cycles)),
    [cycles, habit],
  );
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
  const currentGoal = habit?.currentGoal ?? null;
  const scaleValues = [
    ...points.map((point) => point.value),
    ...(currentGoal == null ? [] : [currentGoal]),
  ];
  let minValue = scaleValues.length ? Math.min(...scaleValues) : 0;
  let maxValue = scaleValues.length ? Math.max(...scaleValues) : 1;
  if (minValue === maxValue) {
    minValue -= Math.max(1, Math.abs(minValue) * 0.1);
    maxValue += Math.max(1, Math.abs(maxValue) * 0.1);
  } else {
    const padding = (maxValue - minValue) * 0.12;
    minValue -= padding;
    maxValue += padding;
  }

  const plotWidth = Math.max(1, width - PLOT_PADDING_X * 2);
  const plotHeight = PLOT_HEIGHT - PLOT_PADDING_Y * 2;
  const minTime = points[0]?.timestamp ?? 0;
  const maxTime = points.at(-1)?.timestamp ?? minTime;
  const coordinates = points.map((point, index) => ({
    point,
    x:
      points.length === 1 || maxTime === minTime
        ? PLOT_PADDING_X + plotWidth / 2
        : PLOT_PADDING_X +
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

  return (
    <View className="mt-3 rounded-3xl border border-gray-200 bg-gray-50 p-3 shadow-sm">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-base font-black text-black">
            Progress over time
          </Text>
          <Text className="mt-0.5 text-xs font-semibold text-gray-500">
            {habit
              ? `Your completed ${periodName(habit.currentGoalPeriod)} cycles · Lower is better`
              : "Average reduction from each habit’s baseline · Higher is better"}
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
            {[0.25, 0.5, 0.75].map((ratio) => (
              <View
                key={ratio}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: PLOT_PADDING_X,
                  right: PLOT_PADDING_X,
                  top: PLOT_PADDING_Y + plotHeight * ratio,
                  height: 1,
                  backgroundColor: "#F3F4F6",
                }}
              />
            ))}

            {habit && currentGoal != null && width > 0 ? (
              <>
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: PLOT_PADDING_X,
                    right: PLOT_PADDING_X,
                    top:
                      PLOT_PADDING_Y +
                      ((maxValue - currentGoal) / (maxValue - minValue)) *
                        plotHeight,
                    height: 1,
                    backgroundColor: accentColor,
                    opacity: 0.35,
                  }}
                />
                <Text
                  pointerEvents="none"
                  className="absolute right-2 bg-white px-1 text-[9px] font-black"
                  style={{
                    color: accentColor,
                    top:
                      PLOT_PADDING_Y +
                      ((maxValue - currentGoal) / (maxValue - minValue)) *
                        plotHeight -
                      12,
                  }}
                >
                  Current goal
                </Text>
              </>
            ) : null}

            {width > 0
              ? coordinates.slice(1).map((coordinate, index) => {
                  const previous = coordinates[index];
                  const gapDays =
                    (coordinate.point.timestamp - previous.point.timestamp) /
                    (24 * 60 * 60 * 1000);
                  if (
                    gapDays >
                    Math.max(
                      previous.point.maxConnectionDays,
                      coordinate.point.maxConnectionDays,
                    )
                  ) {
                    return null;
                  }
                  return (
                    <Line
                      key={`${previous.point.id}:${coordinate.point.id}`}
                      x1={previous.x}
                      y1={previous.y}
                      x2={coordinate.x}
                      y2={coordinate.y}
                      color={accentColor}
                    />
                  );
                })
              : null}

            {width > 0
              ? coordinates.map((coordinate) => {
                  const active = coordinate.point.id === selected?.id;
                  return (
                    <View
                      key={coordinate.point.id}
                      pointerEvents="none"
                      className="absolute items-center justify-center rounded-full bg-white"
                      style={{
                        left: coordinate.x - (active ? 7 : 5),
                        top: coordinate.y - (active ? 7 : 5),
                        width: active ? 14 : 10,
                        height: active ? 14 : 10,
                        borderWidth: active ? 3 : 2,
                        borderColor: accentColor,
                      }}
                    />
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

          <View className="mt-2 flex-row justify-between px-1">
            <Text className="text-[10px] font-bold text-gray-400">
              {new Date(points[0].timestamp).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </Text>
            <Text className="text-[10px] font-bold text-gray-400">
              Tap or drag to inspect
            </Text>
            <Text className="text-[10px] font-bold text-gray-400">
              {new Date(points.at(-1)?.timestamp ?? 0).toLocaleDateString(
                undefined,
                { month: "short", day: "numeric" },
              )}
            </Text>
          </View>

          {selected ? (
            <View className="mt-3 rounded-2xl border border-gray-200 bg-white p-3">
              <Text className="text-xs font-black uppercase tracking-wide text-gray-500">
                {selected.rangeLabel}
              </Text>
              <Text className="mt-1 text-xl font-black text-black">
                {habit && selected.actual != null
                  ? `${formatNumber(selected.actual)} ${unitForValue(selected.unit, selected.actual)} per ${periodName(selected.period)}`
                  : selected.value >= 0
                    ? `${formatNumber(selected.value)}% below baseline`
                    : `${formatNumber(Math.abs(selected.value))}% above baseline`}
              </Text>
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
                      : delta >= 0
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
                    : delta > 0
                      ? `${formatNumber(delta)} percentage points better than the prior week`
                      : delta < 0
                        ? `${formatNumber(Math.abs(delta))} percentage points below the prior week`
                        : "Same as the prior week"}
                </Text>
              ) : null}
              {result ? (
                <Text className="mt-1 text-xs font-semibold text-gray-600">
                  {result}
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
