import { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { RootTabParamList } from "../App";
import { useData } from "../data/DataContext";

function startOfDayMs(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function startOfWeekMs(d: Date) {
  // Week starts Monday (common for habit tracking). Change if you want Sunday.
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() - diffToMonday
  );
  return startOfDayMs(monday);
}

export default function HomeScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const { logs } = useData();

  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDayMs(now);
    const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;
    const weekStart = startOfWeekMs(now);

    // Today’s check-ins
    const todaysLogs = logs.filter(
      (l) => l.createdAt >= todayStart && l.createdAt < tomorrowStart
    );
    const todayCheckins = todaysLogs.length;

    // This week’s check-ins
    const weekLogs = logs.filter((l) => l.createdAt >= weekStart);
    const weekCheckins = weekLogs.length;

    // Resists this week (count, no rate)
    const weekResists = weekLogs.reduce(
      (acc, l) => acc + (l.didResist === 1 ? 1 : 0),
      0
    );

    // Build a map: dayKey -> hadResist
    const resistDays = new Set<string>();
    for (const l of logs) {
      if (l.didResist !== 1) continue;
      const dt = new Date(l.createdAt);
      const key = `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;
      resistDays.add(key);
    }

    // Current streak: consecutive days ending today where day had >=1 resist
    const hasResistOnDay = (d: Date) => {
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      return resistDays.has(key);
    };

    let currentStreak = 0;
    {
      const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      while (hasResistOnDay(cursor)) {
        currentStreak += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
    }

    // Best streak: longest run of consecutive resist-days across all time
    // Approach: sort unique resist-days by date and scan.
    const resistDayDates = Array.from(resistDays).map((k) => {
      const [y, m, d] = k.split("-").map((x) => Number(x));
      return new Date(y, m - 1, d).getTime();
    });
    resistDayDates.sort((a, b) => a - b);

    let bestStreak = 0;
    let run = 0;
    for (let i = 0; i < resistDayDates.length; i++) {
      if (i === 0) {
        run = 1;
      } else {
        const prev = resistDayDates[i - 1];
        const curr = resistDayDates[i];
        const oneDay = 24 * 60 * 60 * 1000;
        run = curr - prev === oneDay ? run + 1 : 1;
      }
      if (run > bestStreak) bestStreak = run;
    }

    // Top cue (insight)
    const cueCounts = new Map<string, number>();
    for (const l of logs) {
      const cue = (l.cueName ?? "").trim();
      if (!cue) continue;
      cueCounts.set(cue, (cueCounts.get(cue) ?? 0) + 1);
    }

    let topCue: string | null = null;
    let topCueCount = 0;
    for (const [cue, count] of cueCounts.entries()) {
      if (count > topCueCount) {
        topCue = cue;
        topCueCount = count;
      }
    }

    return {
      todayCheckins,
      weekCheckins,
      weekResists,
      currentStreak,
      bestStreak,
      topCue,
      topCueCount,
    };
  }, [logs]);

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

  const streakHeadline =
    stats.currentStreak > 0
      ? `${stats.currentStreak}-day streak 🔥`
      : "Start a streak today";

  const streakSub =
    stats.currentStreak > 0
      ? "Days in a row with at least one resist"
      : "One resist today kicks it off";

  return (
    <View className="flex-1 bg-white px-6 pt-10">
      <Text className="text-3xl font-bold text-gray-900">Home</Text>
      <Text className="mt-2 text-gray-600">
        Small wins. Consistent progress.
      </Text>

      {/* Primary actions */}
      <Pressable
        onPress={() => navigation.navigate("Log")}
        className="mt-6 w-full rounded-2xl bg-green-600 px-5 py-4"
      >
        <Text className="text-center text-lg font-semibold text-white">
          Log a Check-In
        </Text>
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate("Shop")}
        className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-5 py-4"
      >
        <Text className="text-center text-base font-semibold text-gray-900">
          Browse Replacement Actions
        </Text>
      </Pressable>

      {/* Dashboard */}
      <View className="mt-6 w-full rounded-2xl border border-gray-200 bg-gray-50 p-5">
        <Text className="text-base font-semibold text-gray-900">Dashboard</Text>
        <Text className="mt-1 text-sm text-gray-600">
          Focus on consistency — you’re building the skill.
        </Text>

        <View className="mt-4 flex-row gap-3">
          <Card
            label="Today’s check-ins"
            value={`${stats.todayCheckins}`}
            sub="Awareness is a win"
          />
          <Card
            label="This week"
            value={`${stats.weekCheckins}`}
            sub="Total check-ins"
          />
        </View>

        <View className="mt-3 flex-row gap-3">
          <Card
            label="Resists this week"
            value={`${stats.weekResists}`}
            sub="Count your wins"
          />
          <Card
            label="Best streak"
            value={`${stats.bestStreak}`}
            sub="Days with ≥1 resist"
          />
        </View>

        <View className="mt-3 flex-row gap-3">
          <View className="flex-1 rounded-2xl border border-gray-200 bg-white p-4">
            <Text className="text-xs font-semibold text-gray-500">Streak</Text>
            <Text className="mt-2 text-base font-semibold text-gray-900">
              {streakHeadline}
            </Text>
            <Text className="mt-1 text-xs text-gray-500">{streakSub}</Text>
          </View>

          <View className="flex-1 rounded-2xl border border-gray-200 bg-white p-4">
            <Text className="text-xs font-semibold text-gray-500">
              Top trigger to plan for
            </Text>
            <Text className="mt-2 text-base font-semibold text-gray-900">
              {stats.topCue ? stats.topCue : "—"}
            </Text>
            <Text className="mt-1 text-xs text-gray-500">
              {stats.topCue
                ? `${stats.topCueCount} time(s)`
                : "Log cues to spot patterns"}
            </Text>
          </View>
        </View>

        <Text className="mt-4 text-sm text-gray-600">
          {stats.todayCheckins === 0
            ? "Quick check-in takes 10 seconds. Do one now."
            : "Nice. Keep the momentum going."}
        </Text>
      </View>
    </View>
  );
}
