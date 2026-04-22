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

export default function HomeScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const { logs, profileName, profilePhotoUri } = useData();

  const [selectedHabit, setSelectedHabit] = useState<string | null>(null);
  const displayName = useMemo(() => getFirstName(profileName), [profileName]);

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

    const streakLogs = [...logsForStats].sort(
      (a, b) => a.createdAt - b.createdAt,
    );

    let bestStreak = 0;
    let runningStreak = 0;

    for (const log of streakLogs) {
      if (log.didResist === 1) {
        runningStreak += 1;
        if (runningStreak > bestStreak) bestStreak = runningStreak;
      } else {
        runningStreak = 0;
      }
    }

    let currentStreak = 0;
    for (let i = streakLogs.length - 1; i >= 0; i--) {
      if (streakLogs[i].didResist === 1) currentStreak += 1;
      else break;
    }

    const streakLogsBeforeToday = streakLogs.filter(
      (l) => l.createdAt < todayStart,
    );

    let previousBestStreak = 0;
    let previousRunningStreak = 0;

    for (const log of streakLogsBeforeToday) {
      if (log.didResist === 1) {
        previousRunningStreak += 1;
        if (previousRunningStreak > previousBestStreak) {
          previousBestStreak = previousRunningStreak;
        }
      } else {
        previousRunningStreak = 0;
      }
    }

    let previousCurrentStreak = 0;
    for (let i = streakLogsBeforeToday.length - 1; i >= 0; i--) {
      if (streakLogsBeforeToday[i].didResist === 1) previousCurrentStreak += 1;
      else break;
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
            percentIncrease={getPercentIncrease(
              stats.currentStreak,
              stats.previousCurrentStreak,
            )}
          />
          <Card
            label="Best streak"
            value={`${stats.bestStreak}`}
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
