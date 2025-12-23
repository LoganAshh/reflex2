import { useMemo } from "react";
import { View, Text, FlatList, ScrollView } from "react-native";
import { useData, type LogEntry } from "../data/DataContext";

function startOfDayMs(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function startOfWeekMs(d: Date) {
  // Monday start
  const day = d.getDay(); // 0=Sun, 1=Mon
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() - diffToMonday
  );
  return startOfDayMs(monday);
}

function dayKey(ms: number) {
  const dt = new Date(ms);
  return `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;
}

export default function AnalyticsScreen() {
  const { logs } = useData();

  const data = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeekMs(now);
    const todayStart = startOfDayMs(now);

    const weekLogs = logs.filter((l) => l.createdAt >= weekStart);
    const todayLogs = logs.filter(
      (l) =>
        l.createdAt >= todayStart &&
        l.createdAt < todayStart + 24 * 60 * 60 * 1000
    );

    const weekCheckins = weekLogs.length;
    const todayCheckins = todayLogs.length;

    const weekWins = weekLogs.reduce(
      (acc, l) => acc + (l.didResist === 1 ? 1 : 0),
      0
    );

    // Streaks based on "days with >= 1 resist"
    const resistDays = new Set<string>();
    for (const l of logs) {
      if (l.didResist !== 1) continue;
      resistDays.add(dayKey(l.createdAt));
    }

    const hasResistOn = (d: Date) => resistDays.has(dayKey(d.getTime()));

    // current streak (ending today)
    let currentStreak = 0;
    {
      const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      while (hasResistOn(cursor)) {
        currentStreak += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
    }

    // best streak across history
    const resistDayDates = Array.from(resistDays).map((k) => {
      const [y, m, d] = k.split("-").map(Number);
      return new Date(y, m - 1, d).getTime();
    });
    resistDayDates.sort((a, b) => a - b);

    let bestStreak = 0;
    let run = 0;
    for (let i = 0; i < resistDayDates.length; i++) {
      if (i === 0) run = 1;
      else {
        const prev = resistDayDates[i - 1];
        const curr = resistDayDates[i];
        run = curr - prev === 24 * 60 * 60 * 1000 ? run + 1 : 1;
      }
      if (run > bestStreak) bestStreak = run;
    }

    const topN = (pairs: Map<string, number>, n: number) =>
      Array.from(pairs.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([name, count]) => ({ name, count }));

    // Top cues + locations this week
    const cueCounts = new Map<string, number>();
    const locCounts = new Map<string, number>();
    const habitCounts = new Map<string, number>();

    for (const l of weekLogs) {
      const cue = (l.cueName ?? "").trim();
      if (cue) cueCounts.set(cue, (cueCounts.get(cue) ?? 0) + 1);

      const loc = (l.locationName ?? "").trim();
      if (loc) locCounts.set(loc, (locCounts.get(loc) ?? 0) + 1);

      const habit = (l.habitName ?? "").trim();
      if (habit) habitCounts.set(habit, (habitCounts.get(habit) ?? 0) + 1);
    }

    return {
      todayCheckins,
      weekCheckins,
      weekWins,
      currentStreak,
      bestStreak,
      topCues: topN(cueCounts, 3),
      topLocations: topN(locCounts, 3),
      topHabits: topN(habitCounts, 3),
      weekLogsPreview: weekLogs.slice(0, 10),
    };
  }, [logs]);

  const StatCard = ({
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

  const ListBlock = ({
    title,
    items,
    empty,
  }: {
    title: string;
    items: { name: string; count: number }[];
    empty: string;
  }) => (
    <View className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
      <Text className="text-base font-semibold text-gray-900">{title}</Text>

      {items.length === 0 ? (
        <Text className="mt-2 text-sm text-gray-600">{empty}</Text>
      ) : (
        <View className="mt-3">
          {items.map((x, idx) => (
            <View
              key={`${x.name}-${idx}`}
              className="mb-2 flex-row items-center justify-between rounded-xl bg-gray-50 px-3 py-2"
            >
              <Text className="text-sm font-semibold text-gray-900">
                {x.name}
              </Text>
              <Text className="text-sm font-semibold text-gray-700">
                {x.count}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderMiniLog = ({ item }: { item: LogEntry }) => {
    const t = new Date(item.createdAt).toLocaleString();
    const win = item.didResist === 1;

    return (
      <View className="mb-2 rounded-2xl border border-gray-200 bg-white p-3">
        <Text className="text-xs text-gray-500">{t}</Text>
        <Text className="mt-1 text-sm font-semibold text-gray-900">
          {item.habitName}
        </Text>
        <Text className="mt-1 text-xs text-gray-500" numberOfLines={1}>
          {[
            item.cueName ? `Cue: ${item.cueName}` : null,
            item.locationName ? `Loc: ${item.locationName}` : null,
          ]
            .filter(Boolean)
            .join(" • ")}
        </Text>
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-xs text-gray-500">Intensity</Text>
          <Text className="text-xs font-semibold text-gray-900">
            {item.intensity}/10
          </Text>
        </View>
        <Text className="mt-2 text-xs font-semibold text-gray-700">
          {win ? "Win logged ✅" : "Check-in logged ✅"}
        </Text>
      </View>
    );
  };

  const streakHeadline =
    data.currentStreak > 0
      ? `${data.currentStreak}-day streak 🔥`
      : "Start a streak today";

  const streakSub =
    data.currentStreak > 0
      ? "Days in a row with at least one win"
      : "One win today kicks it off";

  return (
    <ScrollView
      className="flex-1 bg-white px-6 pt-10"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 24 }}
    >
      <Text className="text-3xl font-bold text-gray-900">Analytics</Text>
      <Text className="mt-2 text-gray-600">
        Look for patterns, celebrate momentum.
      </Text>

      <View className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
        <Text className="text-base font-semibold text-gray-900">This week</Text>

        <View className="mt-4 flex-row gap-3">
          <StatCard
            label="Today’s check-ins"
            value={`${data.todayCheckins}`}
            sub="Consistency matters"
          />
          <StatCard
            label="Week check-ins"
            value={`${data.weekCheckins}`}
            sub="You showed up"
          />
        </View>

        <View className="mt-3 flex-row gap-3">
          <StatCard
            label="Week wins"
            value={`${data.weekWins}`}
            sub="Each win counts"
          />
          <StatCard
            label="Best streak"
            value={`${data.bestStreak}`}
            sub="Days with ≥1 win"
          />
        </View>

        <View className="mt-3 rounded-2xl border border-gray-200 bg-white p-4">
          <Text className="text-xs font-semibold text-gray-500">Streak</Text>
          <Text className="mt-2 text-base font-semibold text-gray-900">
            {streakHeadline}
          </Text>
          <Text className="mt-1 text-xs text-gray-500">{streakSub}</Text>
        </View>

        <ListBlock
          title="Top triggers to plan for"
          items={data.topCues}
          empty="Add cues in your logs to see patterns."
        />

        <ListBlock
          title="Top locations"
          items={data.topLocations}
          empty="Add locations in your logs to see patterns."
        />

        <ListBlock
          title="Habit momentum"
          items={data.topHabits}
          empty="Log a few check-ins and this will populate."
        />
      </View>

      <View className="mt-6">
        <Text className="text-xl font-bold text-gray-900">Recent (week)</Text>
        <Text className="mt-1 text-sm text-gray-500">Last 10 check-ins</Text>

        {data.weekLogsPreview.length === 0 ? (
          <View className="mt-4 rounded-2xl border border-gray-200 bg-white p-5">
            <Text className="text-gray-700">No logs this week yet.</Text>
          </View>
        ) : (
          <FlatList
            className="mt-4"
            data={data.weekLogsPreview}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderMiniLog}
            scrollEnabled={false}
          />
        )}
      </View>
    </ScrollView>
  );
}
