import { useMemo } from "react";
import { View, Text, FlatList, ScrollView } from "react-native";
import { useData, type LogEntry } from "../data/DataContext";

function startOfDayMs(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function startOfWeekMs(d: Date) {
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

    const weekLogs = logs.filter((l) => l.createdAt >= weekStart);

    const resistDays = new Set<string>();
    for (const l of logs) {
      if (l.didResist === 1) resistDays.add(dayKey(l.createdAt));
    }

    const topN = (pairs: Map<string, number>, n: number) =>
      Array.from(pairs.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([name, count]) => ({ name, count }));

    const cueCounts = new Map<string, number>();
    const locCounts = new Map<string, number>();
    const habitCounts = new Map<string, number>();

    for (const l of weekLogs) {
      if (l.cueName)
        cueCounts.set(l.cueName, (cueCounts.get(l.cueName) ?? 0) + 1);
      if (l.locationName)
        locCounts.set(l.locationName, (locCounts.get(l.locationName) ?? 0) + 1);
      if (l.habitName)
        habitCounts.set(l.habitName, (habitCounts.get(l.habitName) ?? 0) + 1);
    }

    return {
      topCues: topN(cueCounts, 3),
      topLocations: topN(locCounts, 3),
      topHabits: topN(habitCounts, 3),
      weekLogsPreview: weekLogs.slice(0, 10),
    };
  }, [logs]);

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

  return (
    <ScrollView
      className="flex-1 bg-white px-6 pt-10"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 24 }}
    >
      <Text className="text-3xl font-bold text-gray-900">Analytics</Text>
      <Text className="mt-2 text-gray-600">
        Look for patterns, not perfection.
      </Text>

      <View className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
        <Text className="text-base font-semibold text-gray-900">
          Weekly patterns
        </Text>

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
