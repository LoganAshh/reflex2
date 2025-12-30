import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Modal } from "react-native";
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

function startOfDayMs(ms: number) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function endOfDayMs(ms: number) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
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
  dayStartMs: number | null;
  isInactive: boolean; // before install OR in the future (except: allow today on first open)
};

const GREEN_SCALE = [
  "bg-green-600", // 0
  "bg-green-500", // 1
  "bg-green-400", // 2
  "bg-green-300", // 3
  "bg-green-200", // 4
  "bg-green-100", // 5
  "bg-green-50", // 6+
] as const;

function greenBgForCount(count: number) {
  const idx = Math.min(Math.max(count, 0), GREEN_SCALE.length - 1);
  return GREEN_SCALE[idx];
}

function textColorForCount(count: number) {
  // ✅ change: stay white through 0–3; switch to light gray starting at 4+
  return count <= 3 ? "text-white" : "text-gray-400";
}

export default function AnalyticsScreen() {
  const { logs } = useData();
  const [activeTab, setActiveTab] = useState<TabKey>("Overall");
  const [monthOffset, setMonthOffset] = useState(0);

  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [selectedDayMs, setSelectedDayMs] = useState<number | null>(null);

  const todayStartMs = useMemo(() => startOfDayMs(Date.now()), []);
  const hasAnyLogs = logs.length > 0;

  // If there are no logs yet, treat "install day" as today so today isn't rendered as inactive.
  const installDayStartMs = useMemo(() => {
    if (!logs || logs.length === 0) return todayStartMs;
    let min = logs[0].createdAt;
    for (let i = 1; i < logs.length; i++) {
      if (logs[i].createdAt < min) min = logs[i].createdAt;
    }
    return startOfDayMs(min);
  }, [logs, todayStartMs]);

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

  const calendar = useMemo(() => {
    const base = new Date();
    const shown = new Date(
      base.getFullYear(),
      base.getMonth() + monthOffset,
      1
    );

    const monthStart = startOfMonthMs(shown);
    const monthEnd = endOfMonthMs(shown);

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

    const jsDay = firstDay.getDay(); // 0=Sun
    const mondayIndex = (jsDay + 6) % 7;

    const cells: CalendarCell[] = [];
    for (let i = 0; i < mondayIndex; i++) {
      cells.push({
        key: `blank-${shown.getFullYear()}-${shown.getMonth()}-${i}`,
        label: "",
        count: null,
        isToday: false,
        dayStartMs: null,
        isInactive: true,
      });
    }

    const todayKeyStr = dayKey(todayStartMs);

    for (let d = 1; d <= daysInMonth; d++) {
      const ms = new Date(shown.getFullYear(), shown.getMonth(), d).getTime();
      const dayStart = startOfDayMs(ms);
      const k = dayKey(dayStart);

      const isToday = k === todayKeyStr;
      const isFuture = dayStart > todayStartMs;

      const isBeforeInstall = dayStart < installDayStartMs;
      const treatTodayAsActiveOnFirstOpen = !hasAnyLogs && isToday;

      const isInactive =
        isFuture || (isBeforeInstall && !treatTodayAsActiveOnFirstOpen);

      cells.push({
        key: k,
        label: String(d),
        count: giveInCounts.get(k) ?? 0,
        isToday,
        dayStartMs: dayStart,
        isInactive,
      });
    }

    while (cells.length % 7 !== 0) {
      cells.push({
        key: `blank-end-${shown.getFullYear()}-${shown.getMonth()}-${cells.length}`,
        label: "",
        count: null,
        isToday: false,
        dayStartMs: null,
        isInactive: true,
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
  }, [filteredLogs, monthOffset, installDayStartMs, todayStartMs, hasAnyLogs]);

  const selectedDayLogs = useMemo(() => {
    if (selectedDayMs == null) return [];
    const dayStart = startOfDayMs(selectedDayMs);
    const dayEnd = endOfDayMs(selectedDayMs);

    return filteredLogs
      .filter((l) => l.createdAt >= dayStart && l.createdAt < dayEnd)
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [filteredLogs, selectedDayMs]);

  const selectedDayLabel = useMemo(() => {
    if (selectedDayMs == null) return "";
    return new Date(selectedDayMs).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [selectedDayMs]);

  const openDayModal = (dayStartMs: number) => {
    setSelectedDayMs(dayStartMs);
    setDayModalOpen(true);
  };

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

  const renderDayLog = (item: LogEntry) => {
    const t = new Date(item.createdAt).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    const win = item.didResist === 1;

    return (
      <View
        key={String(item.id)}
        className="mb-3 rounded-2xl border border-gray-200 bg-white p-4"
      >
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-semibold text-gray-500">{t}</Text>
          <View
            className={`rounded-full px-2 py-1 ${win ? "bg-emerald-50" : "bg-gray-50"}`}
          >
            <Text
              className={`text-[11px] font-semibold ${win ? "text-emerald-700" : "text-gray-700"}`}
            >
              {win ? "Resisted" : "Gave in"}
            </Text>
          </View>
        </View>

        <Text className="mt-2 text-base font-bold text-gray-900">
          {item.habitName}
        </Text>

        <View className="mt-2">
          {item.cueName ? (
            <Text className="text-sm text-gray-700">
              <Text className="font-semibold">Cue:</Text> {item.cueName}
            </Text>
          ) : null}

          {item.locationName ? (
            <Text className="mt-1 text-sm text-gray-700">
              <Text className="font-semibold">Location:</Text>{" "}
              {item.locationName}
            </Text>
          ) : null}

          <Text className="mt-1 text-sm text-gray-700">
            <Text className="font-semibold">Intensity:</Text>{" "}
            {item.intensity == null ? "None" : `${item.intensity}/10`}
          </Text>

          {"count" in item && (item as any).count != null ? (
            <Text className="mt-1 text-sm text-gray-700">
              <Text className="font-semibold">Count:</Text>{" "}
              {(item as any).count}
            </Text>
          ) : null}

          {"durationSec" in item && (item as any).durationSec != null ? (
            <Text className="mt-1 text-sm text-gray-700">
              <Text className="font-semibold">Duration:</Text>{" "}
              {(item as any).durationSec}s
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  const patternTitle =
    activeTab === "Overall"
      ? "Weekly patterns"
      : `Weekly patterns — ${activeTab}`;

  return (
    <>
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
          {/* Header */}
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

          {/* Grid */}
          <View className="mt-2">
            {calendar.weeks.map((week, wi) => (
              <View key={`week-${wi}`} className="flex-row">
                {week.map((c) => {
                  const isBlank = c.count === null;

                  if (isBlank) {
                    return (
                      <View key={c.key} className="flex-1 p-1">
                        <View className="aspect-square rounded-xl" />
                      </View>
                    );
                  }

                  const count = c.count ?? 0;

                  const bg = c.isInactive ? "bg-white" : greenBgForCount(count);
                  const baseBorder = c.isInactive
                    ? "border border-gray-200"
                    : "border border-transparent";
                  const todayBorder =
                    c.isToday && !c.isInactive
                      ? "border-2 border-gray-900"
                      : "";

                  const textColor = c.isInactive
                    ? "text-gray-400"
                    : textColorForCount(count);

                  const badgeTextColor =
                    count <= 3 ? "text-white" : "text-gray-400";
                  const badgeBg = count <= 3 ? "bg-white/25" : "bg-black/10";

                  const Tile = (
                    <View
                      className={[
                        "aspect-square items-center justify-center rounded-xl overflow-hidden",
                        bg,
                        baseBorder,
                        todayBorder,
                      ].join(" ")}
                    >
                      <Text className={`text-xs font-semibold ${textColor}`}>
                        {c.label}
                      </Text>

                      {!c.isInactive ? (
                        <View
                          className={[
                            "mt-1 rounded-full px-2 py-0.5",
                            badgeBg,
                          ].join(" ")}
                        >
                          <Text
                            className={[
                              "text-[10px] font-semibold",
                              badgeTextColor,
                            ].join(" ")}
                          >
                            {count}
                          </Text>
                        </View>
                      ) : (
                        <Text className="mt-1 text-[10px] text-transparent">
                          0
                        </Text>
                      )}
                    </View>
                  );

                  return (
                    <View key={c.key} className="flex-1 p-1">
                      {c.isInactive || c.dayStartMs == null ? (
                        Tile
                      ) : (
                        <Pressable
                          onPress={() => openDayModal(c.dayStartMs!)}
                          hitSlop={6}
                        >
                          {Tile}
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
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
      </ScrollView>

      {/* Day details modal */}
      <Modal
        visible={dayModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDayModalOpen(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-5">
          <View className="w-full max-w-[520px] rounded-3xl bg-white p-5">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-lg font-bold text-gray-900">Logs</Text>
                <Text className="mt-1 text-sm text-gray-600">
                  {selectedDayLabel}
                </Text>
              </View>

              <Pressable
                onPress={() => setDayModalOpen(false)}
                className="h-10 w-10 items-center justify-center rounded-full bg-gray-100"
                hitSlop={10}
              >
                <Text className="text-lg font-bold text-gray-900">✕</Text>
              </Pressable>
            </View>

            <ScrollView
              className="mt-4 max-h-[520px]"
              showsVerticalScrollIndicator={false}
            >
              {selectedDayLogs.length === 0 ? (
                <View className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <Text className="text-sm text-gray-700">
                    No logs on this day.
                  </Text>
                </View>
              ) : (
                <View>{selectedDayLogs.map(renderDayLog)}</View>
              )}
            </ScrollView>

            <Pressable
              onPress={() => setDayModalOpen(false)}
              className="mt-4 rounded-2xl bg-gray-900 py-3"
            >
              <Text className="text-center text-sm font-semibold text-white">
                Close
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
