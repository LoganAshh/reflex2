import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, Image } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { RouteProp } from "@react-navigation/native";
import type { RootTabParamList } from "../App";
import { useData } from "../data/DataContext";
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
  const { logs, profileName, profilePhotoUri } = useData();

  const [selectedHabit, setSelectedHabit] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const habitChipsScrollRef = useRef<ScrollView | null>(null);
  const handledResetTokenRef = useRef<number | null>(null);

  const displayName = useMemo(() => getFirstName(profileName), [profileName]);

  useEffect(() => {
    const resetToken = route.params?.resetToken;
    if (!resetToken) return;
    if (handledResetTokenRef.current === resetToken) return;

    handledResetTokenRef.current = resetToken;
    setSelectedHabit(null);

    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      habitChipsScrollRef.current?.scrollTo({ x: 0, animated: true });
    });
  }, [route.params?.resetToken]);

  const habitOptions = useMemo(() => {
    const counts = new Map<string, number>();

    for (const log of logs) {
      const name = (log.habitName ?? "").trim();
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }

    return Array.from(counts.keys()).sort((a, b) => {
      const aCount = counts.get(a) ?? 0;
      const bCount = counts.get(b) ?? 0;

      if (aCount !== bCount) {
        return bCount - aCount;
      }

      return a.localeCompare(b);
    });
  }, [logs]);

  const stats = useMemo(() => {
    const logsForStats =
      selectedHabit == null
        ? logs
        : logs.filter((l) => (l.habitName ?? "").trim() === selectedHabit);

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

    const bestCleanStreakDays = getBestCleanStreakDays(logsForStats);
    const previousBestCleanStreakDays = getBestCleanStreakDays(logsBeforeToday);

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
  }, [logs, selectedHabit]);

  const Card = ({
    label,
    value,
    sub,
    percentIncrease,
  }: {
    label: string;
    value: string;
    sub?: string;
    percentIncrease?: number | null;
  }) => (
    <View className="flex-1 rounded-2xl border border-gray-200 bg-white p-4">
      <Text className="text-xs font-semibold text-gray-500">{label}</Text>

      <View className="mt-2 flex-row items-center">
        <Text className="text-2xl font-bold text-gray-900">{value}</Text>

        {percentIncrease != null ? (
          <View className="ml-2 flex-row items-center">
            <Text className="text-sm font-semibold text-green-600">↑</Text>
            <Text className="ml-1 text-sm font-semibold text-green-600">
              {percentIncrease}%
            </Text>
          </View>
        ) : null}
      </View>

      {sub ? <Text className="mt-1 text-xs text-gray-500">{sub}</Text> : null}
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
      className={[
        "mr-2 rounded-full border px-4 py-2",
        selected ? "border-gray-900 bg-gray-900" : "border-gray-200 bg-white",
      ].join(" ")}
    >
      <Text
        className={[
          "text-sm font-semibold",
          selected ? "text-white" : "text-gray-900",
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
        paddingHorizontal: 24,
        paddingTop: 40,
        paddingBottom: 24,
      }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-4">
          <Text className="mt-1 text-3xl font-bold text-gray-900">
            {logs.length === 0
              ? `Welcome, ${displayName}`
              : `Welcome back, ${displayName}`}
          </Text>
        </View>

        {profilePhotoUri ? (
          <Image
            source={{ uri: profilePhotoUri }}
            className="h-14 w-14 rounded-full"
            resizeMode="cover"
          />
        ) : (
          <View className="h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <Text className="text-xs font-semibold text-gray-500">Profile</Text>
          </View>
        )}
      </View>

      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          navigation.navigate("Log");
        }}
        className="mt-6 w-full rounded-2xl bg-green-600 px-5 py-4"
      >
        <Text className="text-center text-lg font-semibold text-white">
          Log a Check-In
        </Text>
      </Pressable>

      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          navigation.navigate("Shop");
        }}
        className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-5 py-4"
      >
        <Text className="text-center text-base font-semibold text-gray-900">
          Browse Replacement Actions
        </Text>
      </Pressable>

      <View className="mt-6 w-full rounded-2xl border border-gray-200 bg-gray-50 p-5">
        <Text className="text-base font-semibold text-gray-900">Dashboard</Text>

        <ScrollView
          ref={habitChipsScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-4"
        >
          <Chip
            label="Overall"
            selected={selectedHabit === null}
            onPress={() => {
              Haptics.selectionAsync();
              setSelectedHabit(null);
            }}
          />

          {habitOptions.map((h) => (
            <Chip
              key={h}
              label={h}
              selected={selectedHabit === h}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedHabit(h);
              }}
            />
          ))}
        </ScrollView>

        <View className="mt-4 flex-row gap-3">
          <Card
            label="Logs today"
            value={`${stats.todayLogs}`}
            percentIncrease={getPercentIncrease(
              stats.todayLogs,
              stats.previousTodayLogs,
            )}
          />
          <Card
            label="Logs this week"
            value={`${stats.weekLogs}`}
            percentIncrease={getPercentIncrease(
              stats.weekLogs,
              stats.previousWeekLogs,
            )}
          />
        </View>

        <View className="mt-3 flex-row gap-3">
          <Card
            label="Resists today"
            value={`${stats.todayResists}`}
            percentIncrease={getPercentIncrease(
              stats.todayResists,
              stats.previousTodayResists,
            )}
          />
          <Card
            label="Resists this week"
            value={`${stats.weekResists}`}
            percentIncrease={getPercentIncrease(
              stats.weekResists,
              stats.previousWeekResists,
            )}
          />
        </View>

        {selectedHabit === null ? (
          <View className="mt-3 flex-row gap-3">
            <Card
              label="Resist rate today"
              value={`${stats.todayResistRate}%`}
              percentIncrease={getPercentIncrease(
                stats.todayResistRate,
                stats.previousTodayResistRate,
              )}
            />
            <Card
              label="Resist rate all time"
              value={`${stats.allTimeResistRate}%`}
              percentIncrease={getPercentIncrease(
                stats.allTimeResistRate,
                stats.previousAllTimeResistRate,
              )}
            />
          </View>
        ) : (
          <View className="mt-3 flex-row gap-3">
            <Card
              label="Current streak"
              value={`${stats.daysSinceGiveIn}`}
              percentIncrease={getPercentIncrease(
                stats.daysSinceGiveIn,
                stats.previousDaysSinceGiveIn,
              )}
            />
            <Card
              label="Best streak"
              value={`${stats.bestCleanStreakDays}`}
              percentIncrease={getPercentIncrease(
                stats.bestCleanStreakDays,
                stats.previousBestCleanStreakDays,
              )}
            />
          </View>
        )}

        <Text className="mt-4 text-sm text-gray-600">
          {stats.todayLogs === 0
            ? "Quick check-in takes 10 seconds. Do one now."
            : "Nice! Keep the momentum going."}
        </Text>
      </View>
    </ScrollView>
  );
}
