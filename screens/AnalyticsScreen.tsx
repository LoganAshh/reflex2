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
};

export default function AnalyticsScreen() {
  const { logs } = useData();
  const [activeTab, setActiveTab] = useState<TabKey>("Overall");

  // Month navigation (0 = current month)
  const [monthOffset, setMonthOffset] = useState(0);

  // Day details modal
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [selectedDayMs, setSelectedDayMs] = useState<number | null>(null);

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
        dayStartMs: null,
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
        dayStartMs: startOfDayMs(ms),
      });
    }

    while (cells.length % 7 !== 0) {
      cells.push({
        key: `blank-end-${shown.getFullYear()}-${shown.getMonth()}-${cells.length}`,
        label: "",
        count: null,
        isToday: false,
        dayStartMs: null,
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

  // ---------- Selected day logs (for modal) ----------
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
              className={`text-[11px] font-semibold ${
                win ? "text-emerald-700" : "text-gray-700"
              }`}
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

          {/* Grid */}
          <View className="mt-2">
            {calendar.weeks.map((week, wi) => (
              <View key={`week-${wi}`} className="flex-row">
                {week.map((c) => {
                  const isBlank = c.count === null;
                  const showBadge = !isBlank && (c.count ?? 0) > 0;

                  const DayCell = (
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
                  );

                  return (
                    <View key={c.key} className="flex-1 p-1">
                      {isBlank ? (
                        DayCell
                      ) : (
                        <Pressable
                          onPress={() => {
                            if (c.dayStartMs != null)
                              openDayModal(c.dayStartMs);
                          }}
                          hitSlop={6}
                        >
                          {DayCell}
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>

          <Text className="mt-3 text-xs text-gray-500">
            Number = times you gave in that day (tap any day for details)
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
