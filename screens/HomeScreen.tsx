import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, Image } from "react-native";
import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { RootStackParamList, RootTabParamList } from "../App";
import { useData, type Habit } from "../data/DataContext";
import * as Haptics from "expo-haptics";

function startOfDayMs(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function startOfWeekMs(d: Date) {
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() - diffToMonday,
  );
  return startOfDayMs(monday);
}

function getPercentIncrease(current: number, previous: number) {
  if (current <= previous) return null;
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function getFirstName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0];
}

function formatAverage(value: number) {
  if (Number.isInteger(value)) return `${value}`;
  return value.toFixed(1);
}

function applyFrequencyOrdering<T extends { id: number }>(
  items: T[],
  frequencyCounts: Map<number, number>,
) {
  if (items.length === 0) return items;

  const originalRank = new Map<number, number>();
  items.forEach((item, index) => {
    originalRank.set(item.id, index);
  });

  return [...items].sort((a, b) => {
    const aCount = frequencyCounts.get(a.id) ?? 0;
    const bCount = frequencyCounts.get(b.id) ?? 0;

    if (aCount !== bCount) {
      return bCount - aCount;
    }

    return (originalRank.get(a.id) ?? 0) - (originalRank.get(b.id) ?? 0);
  });
}

function getDaysSinceGiveIn(
  logs: { createdAt: number; didResist: number }[],
  referenceDayMs: number,
) {
  if (logs.length === 0) return 0;

  const sortedLogs = [...logs].sort((a, b) => a.createdAt - b.createdAt);
  const giveInLogs = sortedLogs.filter((l) => l.didResist !== 1);
  const lastGiveIn = giveInLogs[giveInLogs.length - 1] ?? null;

  if (lastGiveIn) {
    return Math.floor(
      (referenceDayMs - startOfDayMs(new Date(lastGiveIn.createdAt))) /
        (24 * 60 * 60 * 1000),
    );
  }

  return (
    Math.floor(
      (referenceDayMs - startOfDayMs(new Date(sortedLogs[0].createdAt))) /
        (24 * 60 * 60 * 1000),
    ) + 1
  );
}

function getBestCleanStreakDays(
  logs: { createdAt: number; didResist: number }[],
) {
  if (logs.length === 0) return 0;

  const sortedLogs = [...logs].sort((a, b) => a.createdAt - b.createdAt);

  const giveInDaySet = new Set(
    sortedLogs
      .filter((l) => l.didResist !== 1)
      .map((l) => startOfDayMs(new Date(l.createdAt))),
  );

  const firstDay = startOfDayMs(new Date(sortedLogs[0].createdAt));
  const lastDay = startOfDayMs(
    new Date(sortedLogs[sortedLogs.length - 1].createdAt),
  );

  let best = 0;
  let current = 0;

  for (let day = firstDay; day <= lastDay; day += 24 * 60 * 60 * 1000) {
    if (giveInDaySet.has(day)) {
      current = 0;
    } else {
      current += 1;
      if (current > best) best = current;
    }
  }

  return best;
}

function getAverageCleanStreakDays(
  logs: { createdAt: number; didResist: number }[],
  startDayMs: number | null,
  endDayMs: number,
) {
  if (startDayMs == null || startDayMs >= endDayMs) return 0;

  const dayMs = 24 * 60 * 60 * 1000;
  const giveInDaySet = new Set(
    logs
      .filter((l) => l.didResist !== 1)
      .map((l) => startOfDayMs(new Date(l.createdAt))),
  );

  const streaks: number[] = [];
  let current = 0;

  for (let day = startDayMs; day < endDayMs; day += dayMs) {
    if (giveInDaySet.has(day)) {
      if (current > 0) {
        streaks.push(current);
      }
      current = 0;
    } else {
      current += 1;
    }
  }

  if (current > 0) {
    streaks.push(current);
  }

  if (streaks.length === 0) return 0;

  return streaks.reduce((acc, value) => acc + value, 0) / streaks.length;
}

function getCleanDaysCount(
  logs: { createdAt: number; didResist: number }[],
  startDayMs: number | null,
  endDayMs: number,
) {
  if (startDayMs == null || startDayMs >= endDayMs) return 0;

  const dayMs = 24 * 60 * 60 * 1000;
  const giveInDaySet = new Set(
    logs
      .filter((l) => l.didResist !== 1)
      .map((l) => startOfDayMs(new Date(l.createdAt))),
  );

  let cleanDays = 0;

  for (let day = startDayMs; day < endDayMs; day += dayMs) {
    if (!giveInDaySet.has(day)) {
      cleanDays += 1;
    }
  }

  return cleanDays;
}

type TabNav = BottomTabNavigationProp<RootTabParamList, "Home">;
type StackNav = NativeStackNavigationProp<RootStackParamList>;
type Nav = TabNav & StackNav;
type HomeRoute = RouteProp<RootTabParamList, "Home">;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<HomeRoute>();
  const { logs, habits, profileName, profilePhotoUri } = useData();

  const [selectedHabitId, setSelectedHabitId] = useState<number | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const habitChipsScrollRef = useRef<ScrollView | null>(null);
  const handledResetTokenRef = useRef<number | null>(null);

  const displayName = useMemo(() => getFirstName(profileName), [profileName]);
  const isBrandNew = logs.length === 0;

  const activeHabitColor = useMemo(() => {
    if (selectedHabitId == null) return "#16A34A";
    return (
      habits.find((habit) => habit.id === selectedHabitId)?.color ?? "#16A34A"
    );
  }, [habits, selectedHabitId]);

  const activeHabitUnit = useMemo(() => {
    if (selectedHabitId == null) return "habit activities";
    return (
      habits.find((habit) => habit.id === selectedHabitId)?.unit?.trim() ||
      "times"
    );
  }, [habits, selectedHabitId]);

  useEffect(() => {
    const resetToken = route.params?.resetToken;
    if (!resetToken) return;
    if (handledResetTokenRef.current === resetToken) return;

    handledResetTokenRef.current = resetToken;
    setSelectedHabitId(null);

    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      habitChipsScrollRef.current?.scrollTo({ x: 0, animated: true });
    });
  }, [route.params?.resetToken]);

  const habitFrequencyCounts = useMemo(() => {
    const activeHabitIds = new Set(habits.map((h) => h.id));
    const counts = new Map<number, number>();

    for (const log of logs) {
      if (!activeHabitIds.has(log.habitId)) continue;
      counts.set(log.habitId, (counts.get(log.habitId) ?? 0) + 1);
    }

    return counts;
  }, [logs, habits]);

  const habitOptions = useMemo(() => {
    const loggedHabits = habits.filter(
      (habit) => (habitFrequencyCounts.get(habit.id) ?? 0) > 0,
    );

    return applyFrequencyOrdering(loggedHabits, habitFrequencyCounts);
  }, [habits, habitFrequencyCounts]);

  useEffect(() => {
    if (selectedHabitId == null) return;

    const stillExists = habitOptions.some(
      (habit) => habit.id === selectedHabitId,
    );
    if (!stillExists) {
      setSelectedHabitId(null);
    }
  }, [habitOptions, selectedHabitId]);

  const stats = useMemo(() => {
    const logsForStats =
      selectedHabitId == null
        ? logs
        : logs.filter((l) => l.habitId === selectedHabitId);

    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const todayStart = startOfDayMs(now);
    const tomorrowStart = todayStart + dayMs;

    const weekStart = startOfWeekMs(now);
    const daysSoFarThisWeek = Math.floor((todayStart - weekStart) / dayMs) + 1;

    const sortedLogsForStats = [...logsForStats].sort(
      (a, b) => a.createdAt - b.createdAt,
    );

    const firstLogDay =
      sortedLogsForStats.length > 0
        ? startOfDayMs(new Date(sortedLogsForStats[0].createdAt))
        : null;

    const todaysLogs = logsForStats.filter(
      (l) => l.createdAt >= todayStart && l.createdAt < tomorrowStart,
    );

    const weekLogsArr = logsForStats.filter((l) => l.createdAt >= weekStart);

    const todayLogs = todaysLogs.length;

    const todayResists = todaysLogs.reduce(
      (acc, l) => acc + (l.didResist === 1 ? 1 : 0),
      0,
    );

    const weekLogs = weekLogsArr.length;

    const weekResists = weekLogsArr.reduce(
      (acc, l) => acc + (l.didResist === 1 ? 1 : 0),
      0,
    );

    const weekResistRate =
      weekLogs > 0 ? Math.round((weekResists / weekLogs) * 100) : 0;

    const todayResistRate =
      todayLogs > 0 ? Math.round((todayResists / todayLogs) * 100) : 0;

    const logsBeforeToday = logsForStats.filter(
      (l) => l.createdAt < todayStart,
    );

    const daysSinceGiveIn = getDaysSinceGiveIn(logsForStats, todayStart);

    const historicalBestCleanStreakDays = getBestCleanStreakDays(logsForStats);
    const bestCleanStreakDays = Math.max(
      historicalBestCleanStreakDays,
      daysSinceGiveIn,
    );

    const todayGiveIns = todaysLogs.reduce(
      (total, log) =>
        total + (log.didResist === 1 ? 0 : Math.max(0, log.count ?? 1)),
      0,
    );
    const twoWeeksAgoStart = todayStart - 14 * dayMs;

    const firstLogBeforeToday = logsBeforeToday.reduce<number | null>(
      (earliest, log) => {
        const logDay = startOfDayMs(new Date(log.createdAt));
        if (earliest == null) return logDay;
        return Math.min(earliest, logDay);
      },
      null,
    );

    const hasTwoWeeksOfData =
      firstLogBeforeToday != null && firstLogBeforeToday <= twoWeeksAgoStart;

    const comparisonStart = hasTwoWeeksOfData
      ? twoWeeksAgoStart
      : firstLogBeforeToday;

    const comparisonDays = comparisonStart
      ? Math.max(1, Math.round((todayStart - comparisonStart) / dayMs))
      : 0;

    const comparisonLogs = comparisonStart
      ? logsForStats.filter(
          (l) => l.createdAt >= comparisonStart && l.createdAt < todayStart,
        )
      : [];

    const comparisonTotalLogs = comparisonLogs.length;
    const comparisonTotalResists = comparisonLogs.reduce(
      (acc, l) => acc + (l.didResist === 1 ? 1 : 0),
      0,
    );
    const comparisonTotalGiveIns = comparisonLogs.reduce(
      (total, log) =>
        total + (log.didResist === 1 ? 0 : Math.max(0, log.count ?? 1)),
      0,
    );

    const averageLogs =
      comparisonDays > 0 ? comparisonTotalLogs / comparisonDays : 0;
    const averageResists =
      comparisonDays > 0 ? comparisonTotalResists / comparisonDays : 0;
    const averageGiveIns =
      comparisonDays > 0 ? comparisonTotalGiveIns / comparisonDays : 0;
    const averageWeekToDateLogs = averageLogs * daysSoFarThisWeek;
    const averageWeekToDateResists = averageResists * daysSoFarThisWeek;
    const averageCleanStreakDays = getAverageCleanStreakDays(
      comparisonLogs,
      comparisonStart,
      todayStart,
    );

    const cleanDaysStart =
      firstLogDay == null ? weekStart : Math.max(weekStart, firstLogDay);

    const cleanDaysLogs = logsForStats.filter(
      (l) => l.createdAt >= cleanDaysStart && l.createdAt < tomorrowStart,
    );

    const cleanDaysGiveInDaySet = new Set(
      cleanDaysLogs
        .filter((l) => l.didResist !== 1)
        .map((l) => startOfDayMs(new Date(l.createdAt))),
    );

    let cleanDaysThisWeek = 0;
    let daysCountedForCleanDays = 0;

    if (firstLogDay != null) {
      for (let day = cleanDaysStart; day <= todayStart; day += dayMs) {
        daysCountedForCleanDays += 1;

        if (!cleanDaysGiveInDaySet.has(day)) {
          cleanDaysThisWeek += 1;
        }
      }
    }

    const comparisonCleanDays = getCleanDaysCount(
      comparisonLogs,
      comparisonStart,
      todayStart,
    );
    const averageCleanDays =
      comparisonDays > 0 ? comparisonCleanDays / comparisonDays : 0;
    const averageCleanDaysThisWeek = averageCleanDays * daysCountedForCleanDays;

    return {
      todayLogs,
      weekLogs,
      todayResists,
      weekResists,
      todayGiveIns,
      averageLogs,
      averageResists,
      averageGiveIns,
      averageWeekToDateLogs,
      averageWeekToDateResists,
      averageCleanStreakDays,
      averageCleanDaysThisWeek,
      comparisonDays,
      weekResistRate,
      todayResistRate,
      daysSinceGiveIn,
      bestCleanStreakDays,
      cleanDaysThisWeek,
    };
  }, [logs, selectedHabitId]);

  const positiveFeedback = useMemo(() => {
    const averageGiveInsText = formatAverage(stats.averageGiveIns);
    const todayActivityUnit =
      stats.todayGiveIns === 1
        ? activeHabitUnit === "times"
          ? "time"
          : activeHabitUnit === "minutes"
            ? "minute"
            : activeHabitUnit === "habit activities"
              ? "habit activity"
              : activeHabitUnit
        : activeHabitUnit;
    const averageResistsText = formatAverage(stats.averageResists);
    const averageLogsText = formatAverage(stats.averageLogs);
    const comparisonText =
      stats.comparisonDays >= 14
        ? "the past 2 weeks"
        : stats.comparisonDays > 0
          ? `${stats.comparisonDays} ${
              stats.comparisonDays === 1 ? "day" : "days"
            } before today`
          : "your previous days";

    if (stats.todayGiveIns === 0) {
      if (stats.todayLogs > 0) {
        return {
          title: "You Stayed on Track",
          text: `Excellent work! You logged ${stats.todayLogs} ${
            stats.todayLogs === 1 ? "urge" : "urges"
          } today with no habit activity, below your usual ${averageGiveInsText} per day from ${comparisonText}.`,
        };
      }

      return {
        title: "You Stayed on Track",
        text: `Excellent work! You have no habit activity today, compared with your usual ${averageGiveInsText} per day from ${comparisonText}.`,
      };
    }

    if (stats.todayGiveIns > 0 && stats.todayGiveIns < stats.averageGiveIns) {
      return {
        title: "Less Habit Activity Than Usual",
        text: `Great job! You logged ${stats.todayGiveIns} ${todayActivityUnit} today, below your usual ${averageGiveInsText} per day from ${comparisonText}.`,
      };
    }

    if (
      stats.todayGiveIns > stats.averageGiveIns &&
      stats.todayResists > stats.averageResists
    ) {
      return {
        title: "You Resisted More than Usual",
        text: `Strong effort! You resisted ${stats.todayResists} ${
          stats.todayResists === 1 ? "urge" : "urges"
        } today, above your usual ${averageResistsText} per day from ${comparisonText}.`,
      };
    }

    if (
      stats.todayResists < stats.averageResists &&
      stats.todayLogs > stats.averageLogs
    ) {
      return {
        title: "You Were More Aware than Usual",
        text: `Good awareness! You logged ${stats.todayLogs} ${
          stats.todayLogs === 1 ? "time" : "times"
        } today, above your usual ${averageLogsText} per day from ${comparisonText}.`,
      };
    }

    if (stats.todayResists > 1) {
      return {
        title: "You Resisted",
        text: `Solid progress! You resisted ${stats.todayResists} urges today. Every resist interrupts the pattern.`,
      };
    }

    if (stats.todayLogs > 1) {
      return {
        title: "You Were Aware",
        text: `Nice follow-through! You checked in ${stats.todayLogs} times today and kept the habit visible.`,
      };
    }

    return {
      title: "You Stayed Engaged",
      text: "You showed up! You noticed the moment instead of ignoring it.",
    };
  }, [
    stats.averageGiveIns,
    stats.averageLogs,
    stats.averageResists,
    stats.comparisonDays,
    stats.todayGiveIns,
    activeHabitUnit,
    stats.todayLogs,
    stats.todayResists,
  ]);

  const StatTile = ({
    label,
    value,
    icon,
    sub,
    percentIncrease,
    accentColor = "#16A34A",
  }: {
    label: string;
    value: string;
    icon: keyof typeof Ionicons.glyphMap;
    sub?: string;
    percentIncrease?: number | null;
    accentColor?: string;
  }) => (
    <View className="flex-1 rounded-3xl border border-gray-200 bg-white p-3 shadow-sm">
      <View className="flex-row items-start justify-between">
        <View className="h-9 w-9 items-center justify-center rounded-3xl border border-gray-200 bg-white">
          <Ionicons name={icon} size={19} color="#000000" />
        </View>

        {percentIncrease != null ? (
          <View
            className="rounded-full px-2 py-0.5"
            style={{ backgroundColor: accentColor }}
          >
            <Text className="text-[11px] font-black text-white">
              ↑ {percentIncrease}%
            </Text>
          </View>
        ) : null}
      </View>

      <Text className="mt-3 text-2xl font-black text-black">{value}</Text>
      <Text className="mt-0.5 text-[11px] font-black uppercase tracking-wide text-gray-500">
        {label}
      </Text>

      {sub ? (
        <Text className="mt-0.5 text-[11px] font-semibold text-gray-500">
          {sub}
        </Text>
      ) : null}
    </View>
  );

  const Chip = ({
    label,
    selected,
    onPress,
  }: {
    label: string;
    selected: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      className="mr-2 rounded-full border px-3.5 py-2"
      style={{
        borderColor: selected ? activeHabitColor : "#E5E7EB",
        backgroundColor: selected ? activeHabitColor : "#FFFFFF",
      }}
    >
      <Text
        className={[
          "text-sm font-black",
          selected ? "text-white" : "text-black",
        ].join(" ")}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <ScrollView
      ref={scrollViewRef}
      className="flex-1 bg-white"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: 42,
        paddingBottom: 28,
        flexGrow: 1,
      }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-4">
          <Text className="text-sm font-black uppercase tracking-widest text-green-600">
            Reflex
          </Text>

          <Text
            className="mt-1 text-3xl font-black leading-9 text-black"
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
          >
            {isBrandNew
              ? `Welcome, ${displayName}`
              : `Welcome back, ${displayName}`}
          </Text>
        </View>

        {profilePhotoUri ? (
          <View className="rounded-full border-4 border-green-600 bg-white shadow-sm">
            <Image
              source={{ uri: profilePhotoUri }}
              className="h-16 w-16 rounded-full"
              resizeMode="cover"
            />
          </View>
        ) : (
          <View className="h-16 w-16 items-center justify-center rounded-full border-4 border-green-600 bg-white shadow-sm">
            <Ionicons name="person" size={27} color="#000000" />
          </View>
        )}
      </View>

      {isBrandNew ? (
        <View className="flex-1 justify-center">
          <View className="rounded-[32px] border border-gray-200 bg-gray-50 p-5 shadow-sm">
            <View className="items-center">
              <View className="h-16 w-16 items-center justify-center rounded-full border border-gray-200 bg-white">
                <Ionicons name="create" size={30} color="#000000" />
              </View>

              <Text className="mt-5 text-center text-2xl font-black text-black">
                No logs yet.
              </Text>

              <Text className="mt-2 text-center text-base font-bold leading-6 text-gray-500">
                Every time you get the urge to do the habit, log it here. Start
                by logging one urge.
              </Text>

              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  navigation.navigate("Log");
                }}
                className="mt-6 w-full rounded-3xl bg-green-600 px-5 py-4 shadow-sm"
              >
                <View className="flex-row items-center justify-center">
                  <Ionicons name="add-circle" size={22} color="#FFFFFF" />
                  <Text className="ml-2 text-center text-base font-black text-white">
                    Log your first urge
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("Shop");
                }}
                className="mt-3 w-full rounded-3xl border border-gray-200 bg-white px-5 py-4 shadow-sm"
              >
                <View className="flex-row items-center justify-center">
                  <Ionicons name="bag-handle" size={22} color="#000000" />
                  <Text className="ml-2 text-center text-base font-black text-black">
                    Pick backup actions
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        <>
          <View className="mt-5 flex-row gap-3">
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                navigation.navigate("Log");
              }}
              className="flex-1 rounded-3xl bg-green-600 px-5 py-3.5 shadow-sm"
            >
              <View className="flex-row items-center justify-center">
                <Ionicons name="add-circle" size={22} color="#FFFFFF" />
                <Text className="ml-2 text-center text-base font-black text-white">
                  Log Check-In
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                navigation.navigate("Shop");
              }}
              className="rounded-3xl border border-gray-200 bg-gray-50 px-5 py-3.5 shadow-sm"
            >
              <Ionicons name="bag-handle" size={24} color="#000000" />
            </Pressable>
          </View>

          <View className="mt-5 rounded-[28px] border border-gray-200 bg-gray-50 p-4 shadow-sm">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-lg font-black text-black">Dashboard</Text>
                <Text className="mt-0.5 text-xs font-bold text-gray-500">
                  Pick a habit to focus the stats.
                </Text>
              </View>

              <View className="flex-row items-center gap-2">
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    navigation.navigate("ManageList", { type: "habits" });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Manage habits"
                  accessibilityHint="Opens the habit editor"
                  hitSlop={6}
                  className="h-10 w-10 items-center justify-center rounded-3xl border border-gray-200 bg-white"
                >
                  <FontAwesome5
                    name="pencil-alt"
                    size={19}
                    color="#111827"
                    solid
                  />
                </Pressable>
              </View>
            </View>

            <ScrollView
              ref={habitChipsScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mt-4"
            >
              <Chip
                label="Overall"
                selected={selectedHabitId === null}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedHabitId(null);
                }}
              />

              {habitOptions.map((habit: Habit) => (
                <Chip
                  key={habit.id}
                  label={habit.name}
                  selected={selectedHabitId === habit.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedHabitId(habit.id);
                  }}
                />
              ))}
            </ScrollView>

            <View className="mt-4 rounded-3xl border border-gray-200 bg-white p-3 shadow-sm">
              <View className="flex-row items-center">
                <View
                  className="h-9 w-9 items-center justify-center rounded-3xl border bg-white"
                  style={{ borderColor: "#E5E7EB" }}
                >
                  <Ionicons name="bulb" size={20} color={activeHabitColor} />
                </View>

                <View className="ml-3 flex-1">
                  <Text className="text-sm font-black text-black">
                    {positiveFeedback.title}
                  </Text>

                  <Text className="mt-0.5 text-xs font-semibold leading-4 text-gray-500">
                    {positiveFeedback.text}
                  </Text>
                </View>
              </View>
            </View>

            {selectedHabitId === null ? (
              <>
                <View className="mt-4 flex-row gap-3">
                  <StatTile
                    accentColor={activeHabitColor}
                    label="Resists today"
                    value={`${stats.todayResists}`}
                    icon="shield-checkmark"
                    percentIncrease={getPercentIncrease(
                      stats.todayResists,
                      stats.averageResists,
                    )}
                  />

                  <StatTile
                    accentColor={activeHabitColor}
                    label="Logs today"
                    value={`${stats.todayLogs}`}
                    icon="create"
                    percentIncrease={getPercentIncrease(
                      stats.todayLogs,
                      stats.averageLogs,
                    )}
                  />
                </View>

                <View className="mt-3 flex-row gap-3">
                  <StatTile
                    accentColor={activeHabitColor}
                    label="Resists this week"
                    value={`${stats.weekResists}`}
                    icon="trophy"
                    percentIncrease={getPercentIncrease(
                      stats.weekResists,
                      stats.averageWeekToDateResists,
                    )}
                  />

                  <StatTile
                    accentColor={activeHabitColor}
                    label="Logs this week"
                    value={`${stats.weekLogs}`}
                    icon="calendar"
                    percentIncrease={getPercentIncrease(
                      stats.weekLogs,
                      stats.averageWeekToDateLogs,
                    )}
                  />
                </View>
              </>
            ) : (
              <>
                <View className="mt-4 flex-row gap-3">
                  <StatTile
                    accentColor={activeHabitColor}
                    label="Resists today"
                    value={`${stats.todayResists}`}
                    icon="shield-checkmark"
                    percentIncrease={getPercentIncrease(
                      stats.todayResists,
                      stats.averageResists,
                    )}
                  />

                  <StatTile
                    accentColor={activeHabitColor}
                    label="Logs today"
                    value={`${stats.todayLogs}`}
                    icon="create"
                    percentIncrease={getPercentIncrease(
                      stats.todayLogs,
                      stats.averageLogs,
                    )}
                  />
                </View>

                <View className="mt-3 flex-row gap-3">
                  <StatTile
                    accentColor={activeHabitColor}
                    label="Clean days"
                    value={`${stats.cleanDaysThisWeek}`}
                    sub="This Week"
                    icon="sunny"
                    percentIncrease={getPercentIncrease(
                      stats.cleanDaysThisWeek,
                      stats.averageCleanDaysThisWeek,
                    )}
                  />

                  <StatTile
                    accentColor={activeHabitColor}
                    label="Streak"
                    value={`${stats.daysSinceGiveIn}`}
                    sub={`Best: ${stats.bestCleanStreakDays} ${
                      stats.bestCleanStreakDays === 1 ? "day" : "days"
                    }`}
                    icon="flame"
                    percentIncrease={getPercentIncrease(
                      stats.daysSinceGiveIn,
                      stats.averageCleanStreakDays,
                    )}
                  />
                </View>
              </>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}
