import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
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

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function getPercentIncrease(current: number, previous: number) {
  if (current <= previous) return null;
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export default function HomeScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const { logs, profileName, profilePhotoUri } = useData();

  const [selectedHabit, setSelectedHabit] = useState<string | null>(null);

  const isFirstVisit = logs.length === 0;

  const habitOptions = useMemo(() => {
    const set = new Set<string>();
    for (const l of logs) {
      const name = (l.habitName ?? "").trim();
      if (name) set.add(name);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [logs]);

  const stats = useMemo(() => {
    const logsForStats =
      selectedHabit == null
        ? logs
        : logs.filter((l) => l.habitName === selectedHabit);

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

    const resistDays = new Set<string>();
    for (const l of logsForStats) {
      if (l.didResist === 1) {
        resistDays.add(dayKey(new Date(l.createdAt)));
      }
    }

    const hasResistOnDay = (d: Date) => resistDays.has(dayKey(d));

    let currentStreak = 0;
    {
      const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      while (hasResistOnDay(cursor)) {
        currentStreak++;
        cursor.setDate(cursor.getDate() - 1);
      }
    }

    const yesterday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 1,
    );

    let previousCurrentStreak = 0;
    {
      const cursor = new Date(
        yesterday.getFullYear(),
        yesterday.getMonth(),
        yesterday.getDate(),
      );
      while (hasResistOnDay(cursor)) {
        previousCurrentStreak++;
        cursor.setDate(cursor.getDate() - 1);
      }
    }

    const resistDates = Array.from(resistDays)
      .map((k) => {
        const [y, m, d] = k.split("-").map(Number);
        return new Date(y, m - 1, d).getTime();
      })
      .sort((a, b) => a - b);

    let bestStreak = 0;
    let run = 0;
    const oneDay = 24 * 60 * 60 * 1000;

    for (let i = 0; i < resistDates.length; i++) {
      if (i === 0) run = 1;
      else run = resistDates[i] - resistDates[i - 1] === oneDay ? run + 1 : 1;
      bestStreak = Math.max(bestStreak, run);
    }

    let previousBestStreak = 0;
    let previousRun = 0;
    const resistDatesBeforeToday = resistDates.filter((t) => t < todayStart);

    for (let i = 0; i < resistDatesBeforeToday.length; i++) {
      if (i === 0) previousRun = 1;
      else
        previousRun =
          resistDatesBeforeToday[i] - resistDatesBeforeToday[i - 1] === oneDay
            ? previousRun + 1
            : 1;
      previousBestStreak = Math.max(previousBestStreak, previousRun);
    }

    return {
      todayLogs,
      weekLogs,
      todayResists,
      weekResists,
      currentStreak,
      bestStreak,
      previousTodayLogs,
      previousWeekLogs,
      previousTodayResists,
      previousWeekResists,
      previousCurrentStreak,
      previousBestStreak,
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
    <View className="flex-1 bg-white px-6 pt-10">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-4">
          <Text className="mt-1 text-3xl font-bold text-gray-900">
            {logs.length === 0
              ? `Welcome, ${profileName}`
              : `Welcome back, ${profileName}`}
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
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

        <View className="mt-3 flex-row gap-3">
          <Card
            label="Current streak"
            value={`${stats.currentStreak}`}
            sub="Days with ≥1 resist"
            percentIncrease={getPercentIncrease(
              stats.currentStreak,
              stats.previousCurrentStreak,
            )}
          />
          <Card
            label="Best streak"
            value={`${stats.bestStreak}`}
            sub="Days with ≥1 resist"
            percentIncrease={getPercentIncrease(
              stats.bestStreak,
              stats.previousBestStreak,
            )}
          />
        </View>

        <Text className="mt-4 text-sm text-gray-600">
          {stats.todayLogs === 0
            ? "Quick check-in takes 10 seconds. Do one now."
            : "Nice! Keep the momentum going."}
        </Text>
      </View>
    </View>
  );
}
