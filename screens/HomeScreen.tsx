import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { RouteProp } from "@react-navigation/native";
import type { RootTabParamList } from "../App";
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

type Nav = BottomTabNavigationProp<RootTabParamList, "Home">;
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
    const todayStart = startOfDayMs(now);
    const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

    const weekStart = startOfWeekMs(now);
    const previousWeekStart = weekStart - 7 * 24 * 60 * 60 * 1000;

    const todaysLogs = logsForStats.filter(
      (l) => l.createdAt >= todayStart && l.createdAt < tomorrowStart,
    );

    const yesterdaysLogs = logsForStats.filter(
      (l) => l.createdAt >= yesterdayStart && l.createdAt < todayStart,
    );

    const weekLogsArr = logsForStats.filter((l) => l.createdAt >= weekStart);
    const previousWeekLogsArr = logsForStats.filter(
      (l) => l.createdAt >= previousWeekStart && l.createdAt < weekStart,
    );

    const todayLogs = todaysLogs.length;
    const previousTodayLogs = yesterdaysLogs.length;

    const todayResists = todaysLogs.reduce(
      (acc, l) => acc + (l.didResist === 1 ? 1 : 0),
      0,
    );
    const previousTodayResists = yesterdaysLogs.reduce(
      (acc, l) => acc + (l.didResist === 1 ? 1 : 0),
      0,
    );

    const weekLogs = weekLogsArr.length;
    const previousWeekLogs = previousWeekLogsArr.length;

    const weekResists = weekLogsArr.reduce(
      (acc, l) => acc + (l.didResist === 1 ? 1 : 0),
      0,
    );
    const previousWeekResists = previousWeekLogsArr.reduce(
      (acc, l) => acc + (l.didResist === 1 ? 1 : 0),
      0,
    );

    const weekResistRate =
      weekLogs > 0 ? Math.round((weekResists / weekLogs) * 100) : 0;
    const previousWeekResistRate =
      previousWeekLogs > 0
        ? Math.round((previousWeekResists / previousWeekLogs) * 100)
        : 0;

    const todayResistRate =
      todayLogs > 0 ? Math.round((todayResists / todayLogs) * 100) : 0;
    const previousTodayResistRate =
      previousTodayLogs > 0
        ? Math.round((previousTodayResists / previousTodayLogs) * 100)
        : 0;

    const allTimeLogs = logsForStats.length;
    const allTimeResists = logsForStats.reduce(
      (acc, l) => acc + (l.didResist === 1 ? 1 : 0),
      0,
    );
    const allTimeResistRate =
      allTimeLogs > 0 ? Math.round((allTimeResists / allTimeLogs) * 100) : 0;

    const logsBeforeToday = logsForStats.filter(
      (l) => l.createdAt < todayStart,
    );

    const previousAllTimeLogs = logsBeforeToday.length;
    const previousAllTimeResists = logsBeforeToday.reduce(
      (acc, l) => acc + (l.didResist === 1 ? 1 : 0),
      0,
    );
    const previousAllTimeResistRate =
      previousAllTimeLogs > 0
        ? Math.round((previousAllTimeResists / previousAllTimeLogs) * 100)
        : 0;

    const daysSinceGiveIn = getDaysSinceGiveIn(logsForStats, todayStart);
    const previousDaysSinceGiveIn = getDaysSinceGiveIn(
      logsBeforeToday,
      yesterdayStart,
    );

    const historicalBestCleanStreakDays = getBestCleanStreakDays(logsForStats);
    const previousHistoricalBestCleanStreakDays =
      getBestCleanStreakDays(logsBeforeToday);

    const bestCleanStreakDays = Math.max(
      historicalBestCleanStreakDays,
      daysSinceGiveIn,
    );

    const previousBestCleanStreakDays = Math.max(
      previousHistoricalBestCleanStreakDays,
      previousDaysSinceGiveIn,
    );

    return {
      todayLogs,
      weekLogs,
      todayResists,
      weekResists,
      previousTodayLogs,
      previousWeekLogs,
      previousTodayResists,
      previousWeekResists,
      weekResistRate,
      previousWeekResistRate,
      todayResistRate,
      previousTodayResistRate,
      allTimeResistRate,
      previousAllTimeResistRate,
      daysSinceGiveIn,
      previousDaysSinceGiveIn,
      bestCleanStreakDays,
      previousBestCleanStreakDays,
    };
  }, [logs, selectedHabitId]);

  const positiveFeedbackTitle = useMemo(() => {
    if (stats.todayLogs === 0) return "What you’re doing well";
    if (stats.todayResists > 0) return "You’re building control";
    if (stats.weekResists > 0) return "You’re staying aware";
    return "You’re showing up";
  }, [stats.todayLogs, stats.todayResists, stats.weekResists]);

  const positiveFeedbackText = useMemo(() => {
    if (stats.todayLogs === 0 && stats.weekLogs === 0) {
      return "Nice work! You’re here and checking your progress. That already means you’re paying attention instead of ignoring the habit.";
    }

    if (stats.todayLogs === 0) {
      return "Good job! You’ve logged this week, which means you’re building awareness. One quick check-in today keeps that pattern going.";
    }

    if (stats.todayResists > 0) {
      return `Great job! You resisted ${stats.todayResists} ${
        stats.todayResists === 1 ? "urge" : "urges"
      } today. That means you paused, noticed the urge, and chose not to automatically give in.`;
    }

    if (stats.weekResists > 0) {
      return `Keep going! You’ve resisted ${stats.weekResists} ${
        stats.weekResists === 1 ? "urge" : "urges"
      } this week. Even when today is hard, you’ve already proven you can interrupt the pattern.`;
    }

    return "Nice work! You checked in today. That means you caught the moment and recorded it instead of letting it pass unnoticed.";
  }, [stats.todayLogs, stats.todayResists, stats.weekLogs, stats.weekResists]);

  const StatTile = ({
    label,
    value,
    icon,
    percentIncrease,
    accentColor = "#16A34A",
  }: {
    label: string;
    value: string;
    icon: keyof typeof Ionicons.glyphMap;
    percentIncrease?: number | null;
    accentColor?: string;
  }) => (
    <View className="flex-1 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
      <View className="flex-row items-start justify-between">
        <View className="h-10 w-10 items-center justify-center rounded-3xl border border-gray-200 bg-white">
          <Ionicons name={icon} size={21} color="#000000" />
        </View>

        {percentIncrease != null ? (
          <View
            className="rounded-full px-2 py-1"
            style={{ backgroundColor: accentColor }}
          >
            <Text className="text-xs font-black text-white">
              ↑ {percentIncrease}%
            </Text>
          </View>
        ) : null}
      </View>

      <Text className="mt-4 text-3xl font-black text-black">{value}</Text>
      <Text className="mt-1 text-xs font-black uppercase tracking-wide text-gray-500">
        {label}
      </Text>
    </View>
  );

  const StreakCard = ({
    label,
    value,
    sub,
    icon,
    percentIncrease,
    accentColor = "#16A34A",
  }: {
    label: string;
    value: string;
    sub: string;
    icon: keyof typeof Ionicons.glyphMap;
    percentIncrease?: number | null;
    accentColor?: string;
  }) => (
    <View className="flex-1 rounded-3xl border border-gray-200 bg-gray-50 p-4">
      <View className="flex-row items-center justify-between">
        <View className="h-11 w-11 items-center justify-center rounded-3xl border border-gray-200 bg-white">
          <Ionicons name={icon} size={23} color="#000000" />
        </View>

        {percentIncrease != null ? (
          <View
            className="rounded-full px-2 py-1"
            style={{ backgroundColor: accentColor }}
          >
            <Text className="text-xs font-black text-white">
              ↑ {percentIncrease}%
            </Text>
          </View>
        ) : null}
      </View>

      <Text className="mt-4 text-3xl font-black text-black">{value}</Text>
      <Text className="mt-1 text-sm font-black text-black">{label}</Text>
      <Text className="mt-1 text-xs font-semibold text-gray-500">{sub}</Text>
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
      className="mr-2 rounded-full border px-4 py-2.5"
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
      }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-4">
          <Text className="text-sm font-black uppercase tracking-widest text-green-600">
            Reflex
          </Text>

          <Text className="mt-1 text-3xl font-black text-black">
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
        <View className="mt-6 rounded-[32px] border border-gray-200 bg-gray-50 p-5 shadow-sm">
          <View className="items-center">
            <View className="h-16 w-16 items-center justify-center rounded-full border border-gray-200 bg-white">
              <Ionicons name="create" size={30} color="#000000" />
            </View>

            <Text className="mt-5 text-center text-2xl font-black text-black">
              No logs yet.
            </Text>

            <Text className="mt-2 text-center text-base font-bold leading-6 text-gray-500">
              Every time you get the urge to do the habit, log it here. Start by
              logging one urge.
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
          </View>
        </View>
      ) : (
        <>
          <View className="mt-6 flex-row gap-3">
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                navigation.navigate("Log");
              }}
              className="flex-1 rounded-3xl bg-green-600 px-5 py-4 shadow-sm"
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
              className="rounded-3xl border border-gray-200 bg-gray-50 px-5 py-4 shadow-sm"
            >
              <Ionicons name="bag-handle" size={24} color="#000000" />
            </Pressable>
          </View>

          <View className="mt-6 rounded-[32px] border border-gray-200 bg-gray-50 p-5 shadow-sm">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xl font-black text-black">Dashboard</Text>
                <Text className="mt-1 text-sm font-bold text-gray-500">
                  Pick a habit to focus the stats.
                </Text>
              </View>

              <View
                className="h-12 w-12 items-center justify-center rounded-3xl border bg-white"
                style={{ borderColor: "#E5E7EB" }}
              >
                <Ionicons
                  name="stats-chart"
                  size={24}
                  color={activeHabitColor}
                />
              </View>
            </View>

            <ScrollView
              ref={habitChipsScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mt-5"
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

            <View className="mt-5 flex-row gap-3">
              <StatTile
                accentColor={activeHabitColor}
                label="Logs today"
                value={`${stats.todayLogs}`}
                icon="create"
                percentIncrease={getPercentIncrease(
                  stats.todayLogs,
                  stats.previousTodayLogs,
                )}
              />

              <StatTile
                accentColor={activeHabitColor}
                label="This week"
                value={`${stats.weekLogs}`}
                icon="calendar"
                percentIncrease={getPercentIncrease(
                  stats.weekLogs,
                  stats.previousWeekLogs,
                )}
              />
            </View>

            <View className="mt-3 flex-row gap-3">
              <StatTile
                accentColor={activeHabitColor}
                label="Resists today"
                value={`${stats.todayResists}`}
                icon="shield-checkmark"
                percentIncrease={getPercentIncrease(
                  stats.todayResists,
                  stats.previousTodayResists,
                )}
              />

              <StatTile
                accentColor={activeHabitColor}
                label="Week resists"
                value={`${stats.weekResists}`}
                icon="trophy"
                percentIncrease={getPercentIncrease(
                  stats.weekResists,
                  stats.previousWeekResists,
                )}
              />
            </View>

            {selectedHabitId === null ? (
              <View className="mt-3 flex-row gap-3">
                <StreakCard
                  accentColor={activeHabitColor}
                  label="Today rate"
                  value={`${stats.todayResistRate}%`}
                  sub="Resistance today"
                  icon="pulse"
                  percentIncrease={getPercentIncrease(
                    stats.todayResistRate,
                    stats.previousTodayResistRate,
                  )}
                />

                <StreakCard
                  accentColor={activeHabitColor}
                  label="Week rate"
                  value={`${stats.weekResistRate}%`}
                  sub="Resistance this week"
                  icon="ribbon"
                  percentIncrease={getPercentIncrease(
                    stats.weekResistRate,
                    stats.previousWeekResistRate,
                  )}
                />
              </View>
            ) : (
              <View className="mt-3 flex-row gap-3">
                <StreakCard
                  accentColor={activeHabitColor}
                  label="Current streak"
                  value={`${stats.daysSinceGiveIn}`}
                  sub="Days since giving in"
                  icon="flame"
                  percentIncrease={getPercentIncrease(
                    stats.daysSinceGiveIn,
                    stats.previousDaysSinceGiveIn,
                  )}
                />

                <StreakCard
                  accentColor={activeHabitColor}
                  label="Best streak"
                  value={`${stats.bestCleanStreakDays}`}
                  sub="Your record"
                  icon="medal"
                  percentIncrease={getPercentIncrease(
                    stats.bestCleanStreakDays,
                    stats.previousBestCleanStreakDays,
                  )}
                />
              </View>
            )}

            <View className="mt-5 rounded-3xl border border-gray-200 bg-white p-4">
              <View className="flex-row items-center">
                <View
                  className="h-10 w-10 items-center justify-center rounded-3xl border bg-white"
                  style={{ borderColor: "#E5E7EB" }}
                >
                  <Ionicons name="bulb" size={22} color={activeHabitColor} />
                </View>

                <View className="ml-3 flex-1">
                  <Text className="text-sm font-black text-black">
                    {positiveFeedbackTitle}
                  </Text>

                  <Text className="mt-1 text-sm font-semibold leading-5 text-gray-500">
                    {positiveFeedbackText}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}
