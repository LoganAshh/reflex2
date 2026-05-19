import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { RootTabParamList } from "../App";
import { useData, type LogEntry } from "../data/DataContext";
import {
  AnalyticsCalendar,
  type CalendarCell,
} from "../components/analytics/AnalyticsCalendar";
import {
  DayLogsModal,
  EditLogModal,
} from "../components/analytics/AnalyticsModals";

function startOfWeekMs(d: Date) {
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() - diffToMonday,
  );
  return new Date(
    monday.getFullYear(),
    monday.getMonth(),
    monday.getDate(),
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

function percent(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function formatAvg(n: number | null) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(1);
}

function monthInputValue(ms: number) {
  return String(new Date(ms).getMonth() + 1);
}

function dayInputValue(ms: number) {
  return String(new Date(ms).getDate());
}

function yearInputValue(ms: number) {
  return String(new Date(ms).getFullYear());
}

function hour12InputValue(ms: number) {
  const hour = new Date(ms).getHours();
  const h12 = hour % 12 || 12;
  return String(h12);
}

function minuteInputValue(ms: number) {
  return String(new Date(ms).getMinutes()).padStart(2, "0");
}

function ampmValue(ms: number) {
  return new Date(ms).getHours() >= 12 ? "PM" : "AM";
}

function buildTimestampFromInputs(params: {
  monthText: string;
  dayText: string;
  yearText: string;
  hourText: string;
  minuteText: string;
  ampm: "AM" | "PM";
}) {
  const month = Number(params.monthText);
  const day = Number(params.dayText);
  const year = Number(params.yearText);
  const hour12 = Number(params.hourText);
  const minute = Number(params.minuteText);

  if (
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(year) ||
    !Number.isInteger(hour12) ||
    !Number.isInteger(minute)
  ) {
    return null;
  }

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    year < 2000 ||
    year > 2100 ||
    hour12 < 1 ||
    hour12 > 12 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  let hour24 = hour12 % 12;
  if (params.ampm === "PM") hour24 += 12;

  const candidate = new Date(year, month - 1, day, hour24, minute, 0, 0);

  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day ||
    candidate.getHours() !== hour24 ||
    candidate.getMinutes() !== minute
  ) {
    return null;
  }

  return candidate.getTime();
}

async function lightHaptic() {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

async function successHaptic() {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

type TabKey = "Overall" | string;
type AnalyticsRoute = RouteProp<RootTabParamList, "Analytics">;
type BaseItem = { id: number; name: string };

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View className="flex-1 rounded-3xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
      <View className="flex-row items-start justify-between">
        <View className="h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white">
          <Ionicons name={icon} size={21} color="#16A34A" />
        </View>
      </View>

      <Text className="mt-4 text-3xl font-black text-gray-900">{value}</Text>
      <Text className="mt-1 text-xs font-black uppercase tracking-wide text-gray-600">
        {label}
      </Text>
      {sub ? (
        <Text className="mt-1 text-xs font-semibold text-gray-500">{sub}</Text>
      ) : null}
    </View>
  );
}

function MiniStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View className="flex-1 rounded-2xl border border-gray-200 bg-gray-50 p-3">
      <View className="h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white">
        <Ionicons name={icon} size={19} color="#16A34A" />
      </View>

      <Text className="mt-3 text-xl font-black text-gray-900">{value}</Text>
      <Text className="mt-1 text-xs font-bold text-gray-600">{label}</Text>
    </View>
  );
}

function ListBlock({
  title,
  items,
  empty,
  icon,
}: {
  title: string;
  items: { name: string; count: number }[];
  empty: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View className="mt-4 rounded-[28px] border border-gray-200 bg-white p-4 shadow-sm">
      <View className="flex-row items-center">
        <View className="h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white">
          <Ionicons name={icon} size={23} color="#16A34A" />
        </View>

        <Text className="ml-3 flex-1 text-base font-black text-gray-900">
          {title}
        </Text>
      </View>

      {items.length === 0 ? (
        <Text className="mt-3 text-sm leading-5 text-gray-600">{empty}</Text>
      ) : (
        <View className="mt-3">
          {items.map((x, idx) => (
            <View
              key={`${x.name}-${idx}`}
              className="mb-2 flex-row items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3"
            >
              <Text className="flex-1 pr-3 text-sm font-bold text-gray-900">
                {x.name}
              </Text>

              <View className="rounded-full bg-white px-3 py-1">
                <Text className="text-sm font-black text-green-600">
                  {x.count}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function AnalyticsScreen() {
  const route = useRoute<AnalyticsRoute>();
  const {
    logs,
    habits,
    cues,
    locations,
    actions,
    selectedActionIds,
    updateLog,
    deleteLog,
  } = useData();

  const [activeTab, setActiveTab] = useState<TabKey>("Overall");
  const [monthOffset, setMonthOffset] = useState(0);
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [selectedDayMs, setSelectedDayMs] = useState<number | null>(null);
  const [editingLog, setEditingLog] = useState<LogEntry | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [habitId, setHabitId] = useState<number | null>(null);
  const [cueId, setCueId] = useState<number | null>(null);
  const [locationId, setLocationId] = useState<number | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<number | null>(null);
  const [didResist, setDidResist] = useState<0 | 1>(0);
  const [intensity, setIntensity] = useState<number | null>(null);
  const [count, setCount] = useState(1);
  const [notesText, setNotesText] = useState("");
  const [monthText, setMonthText] = useState("");
  const [dayText, setDayText] = useState("");
  const [yearText, setYearText] = useState("");
  const [hourText, setHourText] = useState("");
  const [minuteText, setMinuteText] = useState("");
  const [ampm, setAmpm] = useState<"AM" | "PM">("AM");
  const [editError, setEditError] = useState("");
  const [showIntensityPicker, setShowIntensityPicker] = useState(false);
  const [showCountPicker, setShowCountPicker] = useState(false);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const habitTabsScrollRef = useRef<ScrollView | null>(null);
  const handledResetTokenRef = useRef<number | null>(null);

  const closeEditModalWithoutHaptic = () => {
    setEditModalOpen(false);
    setEditingLog(null);
    setEditError("");
    setShowIntensityPicker(false);
    setShowCountPicker(false);
    Keyboard.dismiss();
  };

  useEffect(() => {
    const resetToken = route.params?.resetToken;
    if (!resetToken) return;
    if (handledResetTokenRef.current === resetToken) return;

    handledResetTokenRef.current = resetToken;
    setActiveTab("Overall");
    setMonthOffset(0);
    setDayModalOpen(false);
    setSelectedDayMs(null);
    closeEditModalWithoutHaptic();
    Keyboard.dismiss();

    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      habitTabsScrollRef.current?.scrollTo({ x: 0, animated: true });
    });
  }, [route.params?.resetToken]);

  const todayStartMs = useMemo(() => startOfDayMs(Date.now()), []);
  const hasAnyLogs = logs.length > 0;

  const installDayStartMs = useMemo(() => {
    if (!logs || logs.length === 0) return todayStartMs;
    let min = logs[0].createdAt;

    for (let i = 1; i < logs.length; i++) {
      if (logs[i].createdAt < min) min = logs[i].createdAt;
    }

    return startOfDayMs(min);
  }, [logs, todayStartMs]);

  const selectedActions: BaseItem[] = useMemo(() => {
    const selectedSet = new Set(selectedActionIds);
    return actions
      .filter((a) => selectedSet.has(a.id))
      .map((a) => ({ id: a.id, name: a.title }));
  }, [actions, selectedActionIds]);

  const habitOptions = useMemo(
    () => habits.map((h) => ({ id: h.id, name: h.name })),
    [habits],
  );

  const cueOptions = useMemo(
    () => cues.map((c) => ({ id: c.id, name: c.name })),
    [cues],
  );

  const locationOptions = useMemo(
    () => locations.map((l) => ({ id: l.id, name: l.name })),
    [locations],
  );

  const habitTabs = useMemo(() => {
    const counts = new Map<string, number>();

    for (const l of logs) {
      const h = (l.habitName ?? "").trim();
      if (!h) continue;
      counts.set(h, (counts.get(h) ?? 0) + 1);
    }

    const sortedHabits = Array.from(counts.entries())
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
      })
      .map(([name]) => name);

    return ["Overall", ...sortedHabits] as TabKey[];
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
      1,
    );

    const monthStart = startOfMonthMs(shown);
    const monthEnd = endOfMonthMs(shown);
    const giveInCounts = new Map<string, number>();

    for (const l of filteredLogs) {
      if (l.createdAt < monthStart || l.createdAt >= monthEnd) continue;
      if (l.didResist === 1) continue;
      const k = dayKey(l.createdAt);
      const add = typeof l.count === "number" ? Math.max(0, l.count) : 1;
      giveInCounts.set(k, (giveInCounts.get(k) ?? 0) + add);
    }

    const firstDay = new Date(shown.getFullYear(), shown.getMonth(), 1);
    const daysInMonth = new Date(
      shown.getFullYear(),
      shown.getMonth() + 1,
      0,
    ).getDate();
    const jsDay = firstDay.getDay();
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

  const openDayModal = async (dayStartMs: number) => {
    await lightHaptic();
    setSelectedDayMs(dayStartMs);
    setDayModalOpen(true);
  };

  const closeDayModal = async () => {
    await lightHaptic();
    setDayModalOpen(false);
  };

  const openEditModal = async (log: LogEntry) => {
    await lightHaptic();
    setDayModalOpen(false);

    setTimeout(() => {
      setEditingLog(log);
      setHabitId(log.habitId);
      setCueId(log.cueId ?? null);
      setLocationId(log.locationId ?? null);
      setSelectedActionId(log.selectedActionId ?? null);
      setDidResist(log.didResist);
      setIntensity(log.intensity ?? null);
      setCount(log.count);
      setNotesText(log.notes ?? "");
      setMonthText(monthInputValue(log.createdAt));
      setDayText(dayInputValue(log.createdAt));
      setYearText(yearInputValue(log.createdAt));
      setHourText(hour12InputValue(log.createdAt));
      setMinuteText(minuteInputValue(log.createdAt));
      setAmpm(ampmValue(log.createdAt));
      setEditError("");
      setEditModalOpen(true);
    }, 150);
  };

  const closeEditModal = async () => {
    await lightHaptic();
    closeEditModalWithoutHaptic();
  };

  const handleSaveEdit = async () => {
    if (!editingLog || habitId == null) {
      setEditError("Pick a habit.");
      return;
    }

    const nextCreatedAt = buildTimestampFromInputs({
      monthText,
      dayText,
      yearText,
      hourText,
      minuteText,
      ampm,
    });

    if (nextCreatedAt == null) {
      setEditError("Enter a valid date and time.");
      return;
    }

    await updateLog(editingLog.id, {
      habitId,
      cueId,
      locationId,
      intensity,
      count,
      didResist: didResist === 1,
      notes: notesText,
      selectedActionId,
      createdAt: nextCreatedAt,
    });

    await successHaptic();
    closeEditModalWithoutHaptic();
  };

  const handleDeleteLog = async () => {
    if (!editingLog) return;

    await lightHaptic();

    Alert.alert("Delete log?", "This will permanently delete this log.", [
      {
        text: "Cancel",
        style: "cancel",
        onPress: () => {
          lightHaptic();
        },
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const id = editingLog.id;
          closeEditModalWithoutHaptic();
          await deleteLog(id);
          await successHaptic();
        },
      },
    ]);
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
    const timeCounts = new Map<string, number>();

    const timeBucket = (ms: number) => {
      const d = new Date(ms);
      const h = d.getHours();
      if (h >= 5 && h <= 10) return "Morning";
      if (h >= 11 && h <= 15) return "Midday";
      if (h >= 16 && h <= 20) return "Evening";
      return "Night";
    };

    for (const l of weekLogs) {
      const cue = (l.cueName ?? "").trim();
      const loc = (l.locationName ?? "").trim();
      if (cue) cueCounts.set(cue, (cueCounts.get(cue) ?? 0) + 1);
      if (loc) locCounts.set(loc, (locCounts.get(loc) ?? 0) + 1);
      const bucket = timeBucket(l.createdAt);
      timeCounts.set(bucket, (timeCounts.get(bucket) ?? 0) + 1);
    }

    return {
      topCues: topN(cueCounts),
      topLocations: topN(locCounts),
      topTimes: topN(timeCounts),
    };
  }, [filteredLogs]);

  const extraAnalytics = useMemo(() => {
    const now = Date.now();
    const weekStart = startOfWeekMs(new Date(now));
    const thirtyDaysAgo = startOfDayMs(now - 29 * 24 * 60 * 60 * 1000);
    const weekLogs = filteredLogs.filter((l) => l.createdAt >= weekStart);
    const monthLogs = filteredLogs.filter((l) => l.createdAt >= thirtyDaysAgo);
    const weeklyTotal = weekLogs.length;
    const weeklyResisted = weekLogs.filter((l) => l.didResist === 1).length;
    const weeklyGaveIn = weeklyTotal - weeklyResisted;
    const weeklyResistRate = percent(weeklyResisted, weeklyTotal);
    const allResisted = filteredLogs.filter((l) => l.didResist === 1).length;
    const allGiveIn = filteredLogs.length - allResisted;
    const overallResistRate = percent(allResisted, filteredLogs.length);
    let sumIntensity = 0;
    let intensityCount = 0;

    for (const l of filteredLogs) {
      if (typeof l.intensity === "number") {
        sumIntensity += l.intensity;
        intensityCount += 1;
      }
    }

    const avgIntensity =
      intensityCount > 0 ? sumIntensity / intensityCount : null;
    let resistedIntensitySum = 0;
    let resistedIntensityCount = 0;
    let gaveInIntensitySum = 0;
    let gaveInIntensityCount = 0;

    for (const l of filteredLogs) {
      if (typeof l.intensity !== "number") continue;

      if (l.didResist === 1) {
        resistedIntensitySum += l.intensity;
        resistedIntensityCount += 1;
      } else {
        gaveInIntensitySum += l.intensity;
        gaveInIntensityCount += 1;
      }
    }

    const avgResistedIntensity =
      resistedIntensityCount > 0
        ? resistedIntensitySum / resistedIntensityCount
        : null;
    const avgGaveInIntensity =
      gaveInIntensityCount > 0
        ? gaveInIntensitySum / gaveInIntensityCount
        : null;
    const weekdayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const weekdayCounts = new Map<string, number>(
      weekdayOrder.map((d) => [d, 0] as const),
    );

    for (const l of weekLogs) {
      const jsDay = new Date(l.createdAt).getDay();
      const idx = (jsDay + 6) % 7;
      const key = weekdayOrder[idx];
      weekdayCounts.set(key, (weekdayCounts.get(key) ?? 0) + 1);
    }

    const weeklyTrend = weekdayOrder.map((label) => ({
      label,
      count: weekdayCounts.get(label) ?? 0,
    }));
    const weeklyTrendMax = Math.max(...weeklyTrend.map((x) => x.count), 1);
    const habitMap = new Map<
      string,
      { total: number; resisted: number; gaveIn: number }
    >();
    const sourceLogs = activeTab === "Overall" ? monthLogs : filteredLogs;

    for (const l of sourceLogs) {
      const habit = (l.habitName ?? "").trim();
      if (!habit) continue;

      const curr = habitMap.get(habit) ?? {
        total: 0,
        resisted: 0,
        gaveIn: 0,
      };

      curr.total += 1;
      if (l.didResist === 1) curr.resisted += 1;
      else curr.gaveIn += 1;
      habitMap.set(habit, curr);
    }

    const habitBreakdown = Array.from(habitMap.entries())
      .map(([name, stats]) => ({
        name,
        total: stats.total,
        resisted: stats.resisted,
        gaveIn: stats.gaveIn,
        resistRate: percent(stats.resisted, stats.total),
      }))
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 5);
    const recentDayCounts = new Map<string, number>();

    for (let i = 0; i < 30; i++) {
      const dayMs = startOfDayMs(now - i * 24 * 60 * 60 * 1000);
      recentDayCounts.set(dayKey(dayMs), 0);
    }

    for (const l of monthLogs) {
      const k = dayKey(l.createdAt);
      if (recentDayCounts.has(k)) {
        recentDayCounts.set(k, (recentDayCounts.get(k) ?? 0) + 1);
      }
    }

    let activeDays30 = 0;
    for (const v of recentDayCounts.values()) {
      if (v > 0) activeDays30 += 1;
    }

    return {
      weeklyTotal,
      weeklyResisted,
      weeklyGaveIn,
      weeklyResistRate,
      allResisted,
      allGiveIn,
      overallResistRate,
      avgIntensity,
      avgResistedIntensity,
      avgGaveInIntensity,
      weeklyTrend,
      weeklyTrendMax,
      habitBreakdown,
      activeDays30,
    };
  }, [filteredLogs, activeTab]);

  const patternTitle =
    activeTab === "Overall"
      ? "Weekly patterns"
      : `Weekly patterns — ${activeTab}`;

  return (
    <>
      <ScrollView
        ref={scrollViewRef}
        className="flex-1 bg-white"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 30,
          paddingBottom: 28,
        }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-4">
            <Text className="text-xs font-black uppercase tracking-widest text-green-600">
              Analytics
            </Text>

            <Text className="mt-0.5 text-2xl font-black text-gray-900">
              Pattern map
            </Text>
          </View>

          <View className="h-12 w-12 items-center justify-center rounded-full border-4 border-green-500 bg-gray-100 shadow-sm">
            <Ionicons name="stats-chart" size={23} color="#16A34A" />
          </View>
        </View>

        <View className="mt-3 rounded-3xl border border-gray-200 bg-gray-50 p-3 shadow-sm">
          <View className="flex-row items-center">
            <View className="h-9 w-9 items-center justify-center rounded-2xl bg-green-100">
              <Ionicons name="bulb" size={19} color="#16A34A" />
            </View>

            <View className="ml-2 flex-1">
              <Text className="text-sm font-black text-gray-900">
                Look for patterns
              </Text>

              <Text className="mt-0.5 text-xs leading-4 text-gray-600">
                Notice what makes urges easier or harder to beat.
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          ref={habitTabsScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-3"
        >
          {habitTabs.map((t) => (
            <Pressable
              key={t}
              onPress={async () => {
                await lightHaptic();
                setActiveTab(t);
              }}
              className={`mr-2 rounded-full border px-3 py-1.5 ${
                t === activeTab
                  ? "border-green-600 bg-green-600"
                  : "border-gray-200 bg-white"
              }`}
            >
              <Text
                className={`text-xs font-black ${
                  t === activeTab ? "text-white" : "text-gray-900"
                }`}
                numberOfLines={1}
              >
                {t}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View className="mt-3 rounded-3xl border border-gray-200 bg-gray-50 p-3 shadow-sm">
          <View className="mb-2 flex-row items-center justify-between">
            <View>
              <Text className="text-base font-black text-gray-900">
                Give-in calendar
              </Text>
              <Text className="mt-0.5 text-xs font-semibold text-gray-500">
                Tap a day to view or edit logs.
              </Text>
            </View>

            <View className="h-9 w-9 items-center justify-center rounded-2xl border border-gray-200 bg-white">
              <Ionicons name="calendar" size={19} color="#16A34A" />
            </View>
          </View>

          <AnalyticsCalendar
            monthLabel={calendar.monthLabel}
            weeks={calendar.weeks}
            onPreviousMonth={async () => {
              await lightHaptic();
              setMonthOffset((v) => v - 1);
            }}
            onNextMonth={async () => {
              await lightHaptic();
              setMonthOffset((v) => v + 1);
            }}
            onOpenDay={openDayModal}
          />
        </View>

        <View className="mt-5 rounded-[32px] border border-gray-200 bg-gray-50 p-5 shadow-sm">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-xl font-black text-gray-900">
                {patternTitle}
              </Text>

              <Text className="mt-1 text-sm font-semibold text-gray-500">
                Your most common triggers this week.
              </Text>
            </View>

            <View className="h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white">
              <Ionicons name="search" size={24} color="#16A34A" />
            </View>
          </View>

          <ListBlock
            title="Most Common Cues"
            items={data.topCues}
            empty="Add cues in your logs to see patterns."
            icon="alert-circle"
          />

          <ListBlock
            title="Most Common Locations"
            items={data.topLocations}
            empty="Add locations in your logs to see patterns."
            icon="location"
          />

          <ListBlock
            title="Most Common Times"
            items={data.topTimes}
            empty="Log a few check-ins and this will populate."
            icon="time"
          />
        </View>

        <View className="mt-5 rounded-[32px] border border-gray-200 bg-gray-50 p-5 shadow-sm">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-xl font-black text-gray-900">
                More insights
              </Text>

              <Text className="mt-1 text-sm font-semibold text-gray-500">
                Small numbers still reveal useful patterns.
              </Text>
            </View>

            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-green-100">
              <Ionicons name="sparkles" size={24} color="#16A34A" />
            </View>
          </View>

          <View className="mt-5 flex-row gap-3">
            <StatCard
              label="Logs this week"
              value={`${extraAnalytics.weeklyTotal}`}
              icon="create"
            />

            <StatCard
              label="Resist rate"
              value={`${extraAnalytics.weeklyResistRate}%`}
              sub="This week"
              icon="shield-checkmark"
            />
          </View>

          <View className="mt-3 flex-row gap-3">
            <StatCard
              label="Gave in"
              value={`${extraAnalytics.weeklyGaveIn}`}
              sub="This week"
              icon="trending-down"
            />

            <StatCard
              label="Active days"
              value={`${extraAnalytics.activeDays30}`}
              sub="Last 30 days"
              icon="flame"
            />
          </View>

          <View className="mt-5 rounded-[28px] border border-gray-100 bg-white p-4 shadow-sm">
            <View className="flex-row items-center">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-green-100">
                <Ionicons name="pie-chart" size={23} color="#16A34A" />
              </View>

              <Text className="ml-3 flex-1 text-base font-black text-gray-900">
                Outcome breakdown
              </Text>
            </View>

            <View className="mt-4 flex-row gap-3">
              <MiniStat
                label="Resisted"
                value={`${extraAnalytics.allResisted}`}
                icon="shield-checkmark"
              />

              <MiniStat
                label="Gave in"
                value={`${extraAnalytics.allGiveIn}`}
                icon="close-circle"
              />

              <MiniStat
                label="Rate"
                value={`${extraAnalytics.overallResistRate}%`}
                icon="pulse"
              />
            </View>
          </View>

          <View className="mt-5 rounded-[28px] border border-gray-100 bg-white p-4 shadow-sm">
            <View className="flex-row items-center">
              <View className="h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white">
                <Ionicons name="pulse" size={23} color="#16A34A" />
              </View>

              <Text className="ml-3 flex-1 text-base font-black text-gray-900">
                Intensity trends
              </Text>
            </View>

            <View className="mt-4 flex-row gap-3">
              <MiniStat
                label="Average"
                value={formatAvg(extraAnalytics.avgIntensity)}
                icon="analytics"
              />

              <MiniStat
                label="Resisted"
                value={formatAvg(extraAnalytics.avgResistedIntensity)}
                icon="shield-checkmark"
              />

              <MiniStat
                label="Gave in"
                value={formatAvg(extraAnalytics.avgGaveInIntensity)}
                icon="alert"
              />
            </View>
          </View>
        </View>
      </ScrollView>

      <DayLogsModal
        visible={dayModalOpen}
        selectedDayLabel={selectedDayLabel}
        selectedDayLogs={selectedDayLogs}
        onClose={closeDayModal}
        onEditLog={openEditModal}
      />

      <EditLogModal
        visible={editModalOpen}
        habitOptions={habitOptions}
        cueOptions={cueOptions}
        locationOptions={locationOptions}
        selectedActions={selectedActions}
        habitId={habitId}
        cueId={cueId}
        locationId={locationId}
        selectedActionId={selectedActionId}
        didResist={didResist}
        intensity={intensity}
        count={count}
        notesText={notesText}
        monthText={monthText}
        dayText={dayText}
        yearText={yearText}
        hourText={hourText}
        minuteText={minuteText}
        ampm={ampm}
        editError={editError}
        showIntensityPicker={showIntensityPicker}
        showCountPicker={showCountPicker}
        setHabitId={setHabitId}
        setCueId={setCueId}
        setLocationId={setLocationId}
        setSelectedActionId={setSelectedActionId}
        setDidResist={setDidResist}
        setIntensity={setIntensity}
        setCount={setCount}
        setNotesText={setNotesText}
        setMonthText={setMonthText}
        setDayText={setDayText}
        setYearText={setYearText}
        setHourText={setHourText}
        setMinuteText={setMinuteText}
        setAmpm={setAmpm}
        setShowIntensityPicker={setShowIntensityPicker}
        setShowCountPicker={setShowCountPicker}
        onSave={handleSaveEdit}
        onDelete={handleDeleteLog}
        onClose={closeEditModal}
      />
    </>
  );
}
