import { useMemo, useState } from "react";
import { View, Text, FlatList, ScrollView, Pressable } from "react-native";
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

type TabKey = "Overall" | string;

export default function AnalyticsScreen() {
  const { logs } = useData();
  const [activeTab, setActiveTab] = useState<TabKey>("Overall");

  // Build tabs (Overall + unique habit names)
  const habitTabs = useMemo(() => {
    const set = new Set<string>();
    for (const l of logs) {
      const h = (l.habitName ?? "").trim();
      if (h) set.add(h);
    }
    return [
      "Overall",
      ...Array.from(set).sort((a, b) => a.localeCompare(b)),
    ] as TabKey[];
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (activeTab === "Overall") return logs;
    return logs.filter((l) => (l.habitName ?? "").trim() === activeTab);
  }, [logs, activeTab]);

  const data = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeekMs(now);

    const weekLogs = filteredLogs.filter((l) => l.createdAt >= weekStart);

    const resistDays = new Set<string>();
    for (const l of filteredLogs) {
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
      const cue = (l.cueName ?? "").trim();
      if (cue) cueCounts.set(cue, (cueCounts.get(cue) ?? 0) + 1);

      const loc = (l.locationName ?? "").trim();
      if (loc) locCounts.set(loc, (locCounts.get(loc) ?? 0) + 1);

      const habit = (l.habitName ?? "").trim();
      if (habit) habitCounts.set(habit, (habitCounts.get(habit) ?? 0) + 1);
    }

    return {
      topCues: topN(cueCounts, 3),
      topLocations: topN(locCounts, 3),
      topHabits: topN(habitCounts, 3),
      weekLogsPreview: weekLogs.slice(0, 10),
    };
  }, [filteredLogs]);

  const Tabs = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mt-4"
      contentContainerStyle={{ paddingRight: 24 }}
    >
      <View className="flex-row gap-2">
        {habitTabs.map((t) => {
          const selected = t === activeTab;
          return (
            <Pressable
              key={t}
              onPress={() => setActiveTab(t)}
              className={`rounded-full border px-4 py-2 ${
                selected
                  ? "border-gray-900 bg-gray-900"
                  : "border-gray-200 bg-white"
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  selected ? "text-white" : "text-gray-900"
                }`}
                numberOfLines={1}
              >
                {t}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
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

  const patternTitle =
    activeTab === "Overall"
      ? "Weekly patterns"
      : `Weekly patterns — ${activeTab}`;

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

      <Tabs />

      <View className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-5">
        <Text className="text-base font-semibold text-gray-900">
          {patternTitle}
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
            <Text className="text-gray-700">
              {activeTab === "Overall"
                ? "No logs this week yet."
                : `No logs for “${activeTab}” this week yet.`}
            </Text>
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
