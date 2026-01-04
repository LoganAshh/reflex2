import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
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
    d.getDate() - diffToMonday
  );
  return startOfDayMs(monday);
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export default function HomeScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const { logs } = useData();

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
    const weekStart = startOfWeekMs(now);

    const todaysLogs = logsForStats.filter(
      (l) => l.createdAt >= todayStart && l.createdAt < tomorrowStart
    );

    const todayLogs = todaysLogs.length;
    const todayResists = todaysLogs.reduce(
      (acc, l) => acc + (l.didResist === 1 ? 1 : 0),
      0
    );

    const weekLogsArr = logsForStats.filter((l) => l.createdAt >= weekStart);
    const weekLogs = weekLogsArr.length;
    const weekResists = weekLogsArr.reduce(
      (acc, l) => acc + (l.didResist === 1 ? 1 : 0),
      0
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

    return {
      todayLogs,
      weekLogs,
      todayResists,
      weekResists,
      currentStreak,
      bestStreak,
    };
  }, [logs, selectedHabit]);

  const Card = ({
    label,
    value,
    sub,
  }: {
    label: string;
    value: string;
    sub?: string;
  }) => (
    <View className="flex-1 rounded-2xl border border-gray-200 bg-white p-4">
      <Text className="text-xs font-semibold text-gray-500">{label}</Text>
      <Text className="mt-2 text-2xl font-bold text-gray-900">{value}</Text>
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
      <Text className="text-3xl font-bold text-gray-900">
        {isFirstVisit ? "Welcome!" : "Welcome back!"}
      </Text>

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
          <Card label="Logs today" value={`${stats.todayLogs}`} />
          <Card label="Logs this week" value={`${stats.weekLogs}`} />
        </View>

        <View className="mt-3 flex-row gap-3">
          <Card label="Resists today" value={`${stats.todayResists}`} />
          <Card label="Resists this week" value={`${stats.weekResists}`} />
        </View>

        <View className="mt-3 flex-row gap-3">
          <Card
            label="Current streak"
            value={`${stats.currentStreak}`}
            sub="Days with ≥1 resist"
          />
          <Card
            label="Best streak"
            value={`${stats.bestStreak}`}
            sub="Days with ≥1 resist"
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
