import { useMemo, useState } from "react";
import { View, Text, FlatList, ScrollView, Pressable } from "react-native";
import { useData, type LogEntry } from "../data/DataContext";

function startOfWeekMs(d: Date) {
  const day = d.getDay(); // 0=Sun
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() - diffToMonday
  );
  return new Date(
    monday.getFullYear(),
    monday.getMonth(),
    monday.getDate()
  ).getTime();
}

function startOfMonthMs(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

function endOfMonthMs(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
}

function dayKey(ms: number) {
  const dt = new Date(ms);
  return `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;
}

type TabKey = "Overall" | string;

type CalendarCell = {
  key: string;
  label: string;
  count: number | null;
  isToday: boolean;
};

export default function AnalyticsScreen() {
  const { logs } = useData();
  const [activeTab, setActiveTab] = useState<TabKey>("Overall");

  // Month navigation (0 = current month)
  const [monthOffset, setMonthOffset] = useState(0);

  // ---------- Tabs ----------
  const habitTabs = useMemo(() => {
    const set = new Set<string>();
    for (const l of logs) {
      const h = (l.habitName ?? "").trim();
      if (h) set.add(h);
    }
    return ["Overall", ...Array.from(set).sort()] as TabKey[];
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (activeTab === "Overall") return logs;
    return logs.filter((l) => (l.habitName ?? "").trim() === activeTab);
  }, [logs, activeTab]);

  // ---------- Calendar (gave in counts) ----------
  const calendar = useMemo(() => {
    const base = new Date();
    const shown = new Date(
      base.getFullYear(),
      base.getMonth() + monthOffset,
      1
    );

    const monthStart = startOfMonthMs(shown);
    const monthEnd = endOfMonthMs(shown);

    // counts for days in shown month where user "gave in" (didResist === 0)
    const giveInCounts = new Map<string, number>();
    for (const l of filteredLogs) {
      if (l.createdAt < monthStart || l.createdAt >= monthEnd) continue;
      if (l.didResist === 1) continue;
      const k = dayKey(l.createdAt);
      giveInCounts.set(k, (giveInCounts.get(k) ?? 0) + 1);
    }

    const firstDay = new Date(shown.getFullYear(), shown.getMonth(), 1);
    const daysInMonth = new Date(
      shown.getFullYear(),
      shown.getMonth() + 1,
      0
    ).getDate();

    // Monday=0 ... Sunday=6 offset
    const jsDay = firstDay.getDay(); // 0=Sun
    const mondayIndex = (jsDay + 6) % 7;

    const cells: CalendarCell[] = [];
    for (let i = 0; i < mondayIndex; i++) {
      cells.push({
        key: `blank-${shown.getFullYear()}-${shown.getMonth()}-${i}`,
        label: "",
        count: null,
        isToday: false,
      });
    }

    const today = new Date();
    const todayKeyStr = dayKey(today.getTime());

    for (let d = 1; d <= daysInMonth; d++) {
      const ms = new Date(shown.getFullYear(), shown.getMonth(), d).getTime();
      const k = dayKey(ms);
      cells.push({
        key: k,
        label: String(d),
        count: giveInCounts.get(k) ?? 0,
        isToday: k === todayKeyStr,
      });
    }

    while (cells.length % 7 !== 0) {
      cells.push({
        key: `blank-end-${shown.getFullYear()}-${shown.getMonth()}-${cells.length}`,
        label: "",
        count: null,
        isToday: false,
      });
    }

    const weeks: CalendarCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }

    const monthLabel = shown.toLocaleString(undefined, {
      month: "long",
      year: "numeric",
    });

    return { weeks, monthLabel };
  }, [filteredLogs, monthOffset]);

  // ---------- Weekly analytics ----------
  const data = useMemo(() => {
    const weekStart = startOfWeekMs(new Date());
    const weekLogs = filteredLogs.filter((l) => l.createdAt >= weekStart);

    const topN = (m: Map<string, number>) =>
      Array.from(m.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count }));

    const cueCounts = new Map<string, number>();
    const locCounts = new Map<string, number>();
    const habitCounts = new Map<string, number>();

    for (const l of weekLogs) {
      const cue = (l.cueName ?? "").trim();
      const loc = (l.locationName ?? "").trim();
      const habit = (l.habitName ?? "").trim();

      if (cue) cueCounts.set(cue, (cueCounts.get(cue) ?? 0) + 1);
      if (loc) locCounts.set(loc, (locCounts.get(loc) ?? 0) + 1);
      if (habit) habitCounts.set(habit, (habitCounts.get(habit) ?? 0) + 1);
    }

    return {
      topCues: topN(cueCounts),
      topLocations: topN(locCounts),
      topHabits: topN(habitCounts),
      weekLogsPreview: weekLogs.slice(0, 10),
    };
  }, [filteredLogs]);

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

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-4"
      >
        <View className="flex-row gap-2">
          {habitTabs.map((t) => (
            <Pressable
              key={t}
              onPress={() => setActiveTab(t)}
              className={`rounded-full border px-4 py-2 ${
                t === activeTab
                  ? "bg-gray-900 border-gray-900"
                  : "bg-white border-gray-200"
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  t === activeTab ? "text-white" : "text-gray-900"
                }`}
                numberOfLines={1}
              >
                {t}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Calendar */}
      <View className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
        {/* Header with arrows + centered month */}
        <View className="flex-row items-center">
          <Pressable
            onPress={() => setMonthOffset((v) => v - 1)}
            className="h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white"
            hitSlop={10}
          >
            <Text className="text-lg font-bold text-gray-900">‹</Text>
          </Pressable>

          <View className="flex-1 items-center">
            <Text className="text-base font-semibold text-gray-900">
              {calendar.monthLabel}
            </Text>
          </View>

          <Pressable
            onPress={() => setMonthOffset((v) => v + 1)}
            className="h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white"
            hitSlop={10}
          >
            <Text className="text-lg font-bold text-gray-900">›</Text>
          </Pressable>
        </View>

        {/* Weekday headers */}
        <View className="mt-4 flex-row">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <View key={`${d}-${i}`} className="flex-1 items-center">
              <Text className="text-xs font-semibold text-gray-500">{d}</Text>
            </View>
          ))}
        </View>

        {/* Grid (rows of 7, so Sunday always renders) */}
        <View className="mt-2">
          {calendar.weeks.map((week, wi) => (
            <View key={`week-${wi}`} className="flex-row">
              {week.map((c) => {
                const isBlank = c.count === null;
                const showBadge = !isBlank && (c.count ?? 0) > 0;

                return (
                  <View key={c.key} className="flex-1 p-1">
                    <View
                      className={[
                        "aspect-square items-center justify-center rounded-xl border",
                        isBlank ? "border-transparent" : "border-gray-200",
                        c.isToday && !isBlank ? "bg-gray-50" : "bg-white",
                      ].join(" ")}
                    >
                      {isBlank ? null : (
                        <>
                          <Text className="text-xs font-semibold text-gray-900">
                            {c.label}
                          </Text>

                          {showBadge ? (
                            <View className="mt-1 rounded-full bg-gray-900 px-2 py-0.5">
                              <Text className="text-[10px] font-semibold text-white">
                                {c.count}
                              </Text>
                            </View>
                          ) : (
                            <Text className="mt-1 text-[10px] text-gray-400">
                              0
                            </Text>
                          )}
                        </>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <Text className="mt-3 text-xs text-gray-500">
          Number = times you gave in that day
        </Text>
      </View>

      {/* Weekly patterns */}
      <View className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-5">
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

      {/* Recent */}
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
