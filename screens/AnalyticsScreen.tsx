import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useData, type LogEntry } from "../data/DataContext";

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

type TabKey = "Overall" | string;

type CalendarCell = {
  key: string;
  label: string;
  count: number | null;
  isToday: boolean;
  dayStartMs: number | null;
  isInactive: boolean;
};

const GREEN_SCALE = [
  "bg-green-600",
  "bg-green-500",
  "bg-green-400",
  "bg-green-300",
  "bg-green-200",
  "bg-green-100",
  "bg-green-50",
] as const;

function greenBgForCount(count: number) {
  const idx = Math.min(Math.max(count, 0), GREEN_SCALE.length - 1);
  return GREEN_SCALE[idx];
}

function textColorForCount(count: number) {
  return count <= 3 ? "text-white" : "text-gray-400";
}

function ChipGroup({
  title,
  options,
  selectedId,
  onSelect,
  noneLabel = "None",
}: {
  title: string;
  options: { id: number; label: string }[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  noneLabel?: string;
}) {
  return (
    <View className="mt-4">
      <Text className="text-sm font-semibold text-gray-900">{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-2"
      >
        <View className="flex-row gap-2 pr-6">
          <Pressable
            onPress={() => onSelect(null)}
            className={`rounded-full border px-4 py-2 ${
              selectedId == null
                ? "border-gray-900 bg-gray-900"
                : "border-gray-200 bg-white"
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                selectedId == null ? "text-white" : "text-gray-900"
              }`}
            >
              {noneLabel}
            </Text>
          </Pressable>

          {options.map((item) => {
            const selected = selectedId === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => onSelect(item.id)}
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
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

export default function AnalyticsScreen() {
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
  const [intensityText, setIntensityText] = useState("");
  const [countText, setCountText] = useState("1");
  const [notesText, setNotesText] = useState("");
  const [monthText, setMonthText] = useState("");
  const [dayText, setDayText] = useState("");
  const [yearText, setYearText] = useState("");
  const [hourText, setHourText] = useState("");
  const [minuteText, setMinuteText] = useState("");
  const [ampm, setAmpm] = useState<"AM" | "PM">("AM");
  const [editError, setEditError] = useState("");

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

  const selectedActions = useMemo(() => {
    const selectedSet = new Set(selectedActionIds);
    return actions
      .filter((a) => selectedSet.has(a.id))
      .map((a) => ({ id: a.id, label: a.title }));
  }, [actions, selectedActionIds]);

  const habitOptions = useMemo(
    () => habits.map((h) => ({ id: h.id, label: h.name })),
    [habits],
  );
  const cueOptions = useMemo(
    () => cues.map((c) => ({ id: c.id, label: c.name })),
    [cues],
  );
  const locationOptions = useMemo(
    () => locations.map((l) => ({ id: l.id, label: l.name })),
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

  const openDayModal = (dayStartMs: number) => {
    setSelectedDayMs(dayStartMs);
    setDayModalOpen(true);
  };

  const openEditModal = (log: LogEntry) => {
    setDayModalOpen(false);

    setTimeout(() => {
      setEditingLog(log);
      setHabitId(log.habitId);
      setCueId(log.cueId ?? null);
      setLocationId(log.locationId ?? null);
      setSelectedActionId(log.selectedActionId ?? null);
      setDidResist(log.didResist);
      setIntensityText(log.intensity == null ? "" : String(log.intensity));
      setCountText(String(log.count));
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

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditingLog(null);
    setEditError("");
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

    const intensityTrim = intensityText.trim();
    const intensity =
      intensityTrim === ""
        ? null
        : Math.min(10, Math.max(1, Math.round(Number(intensityTrim))));

    if (
      intensityTrim !== "" &&
      (!Number.isFinite(Number(intensityTrim)) ||
        Number(intensityTrim) < 1 ||
        Number(intensityTrim) > 10)
    ) {
      setEditError("Intensity must be 1 to 10, or blank.");
      return;
    }

    const countNum = Math.round(Number(countText.trim()));
    if (!Number.isFinite(countNum) || countNum < 0 || countNum > 10) {
      setEditError("Count must be between 0 and 10.");
      return;
    }

    await updateLog(editingLog.id, {
      habitId,
      cueId,
      locationId,
      intensity,
      count: countNum,
      didResist: didResist === 1,
      notes: notesText,
      selectedActionId,
      createdAt: nextCreatedAt,
    });

    closeEditModal();
  };

  const handleDeleteLog = () => {
    if (!editingLog) return;

    Alert.alert("Delete log?", "This will permanently delete this log.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const id = editingLog.id;
          closeEditModal();
          await deleteLog(id);
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
      {
        total: number;
        resisted: number;
        gaveIn: number;
      }
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
        <View className="flex-row items-start justify-between">
          <View>
            <Text className="text-xs font-semibold text-gray-500">{t}</Text>
            <Text className="mt-2 text-base font-bold text-gray-900">
              {item.habitName}
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <View
              className={`rounded-full px-2 py-1 ${
                win ? "bg-emerald-50" : "bg-gray-50"
              }`}
            >
              <Text
                className={`text-[11px] font-semibold ${
                  win ? "text-emerald-700" : "text-gray-700"
                }`}
              >
                {win ? "Resisted" : "Gave in"}
              </Text>
            </View>

            <Pressable
              onPress={() => openEditModal(item)}
              className="h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white"
              hitSlop={10}
            >
              <Ionicons name="create-outline" size={18} color="#111827" />
            </Pressable>
          </View>
        </View>

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

          {item.selectedActionTitle ? (
            <Text className="mt-1 text-sm text-gray-700">
              <Text className="font-semibold">Replacement Action:</Text>{" "}
              {item.selectedActionTitle}
            </Text>
          ) : null}

          <Text className="mt-1 text-sm text-gray-700">
            <Text className="font-semibold">Intensity:</Text>{" "}
            {item.intensity == null ? "None" : `${item.intensity}/10`}
          </Text>

          <Text className="mt-1 text-sm text-gray-700">
            <Text className="font-semibold">Count:</Text> {item.count}
          </Text>

          {item.notes ? (
            <Text className="mt-1 text-sm text-gray-700">
              <Text className="font-semibold">Notes:</Text> {item.notes}
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
                    ? "border-gray-900 bg-gray-900"
                    : "border-gray-200 bg-white"
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

        <View className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
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

          <View className="mt-4 flex-row">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <View key={`${d}-${i}`} className="flex-1 items-center">
                <Text className="text-xs font-semibold text-gray-500">{d}</Text>
              </View>
            ))}
          </View>

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
                        "aspect-square items-center justify-center overflow-hidden rounded-xl",
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

          <Text className="mt-3 text-xs text-gray-500">
            Tap a day to view your log history for that date.
          </Text>
        </View>

        <View className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-5">
          <Text className="text-base font-semibold text-gray-900">
            {patternTitle}
          </Text>

          <ListBlock
            title="Most Common Cues"
            items={data.topCues}
            empty="Add cues in your logs to see patterns."
          />

          <ListBlock
            title="Most Common Locations"
            items={data.topLocations}
            empty="Add locations in your logs to see patterns."
          />

          <ListBlock
            title="Most Common Times"
            items={data.topTimes}
            empty="Log a few check-ins and this will populate."
          />
        </View>

        <View className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-5">
          <Text className="text-base font-semibold text-gray-900">
            More insights
          </Text>

          <View className="mt-4 flex-row gap-3">
            <StatCard
              label="Logs this week"
              value={`${extraAnalytics.weeklyTotal}`}
            />
            <StatCard
              label="Resist rate"
              value={`${extraAnalytics.weeklyResistRate}%`}
              sub="This week"
            />
          </View>

          <View className="mt-3 flex-row gap-3">
            <StatCard
              label="Gave in"
              value={`${extraAnalytics.weeklyGaveIn}`}
              sub="This week"
            />
            <StatCard
              label="Active days"
              value={`${extraAnalytics.activeDays30}`}
              sub="Last 30 days"
            />
          </View>

          <View className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
            <Text className="text-base font-semibold text-gray-900">
              Outcome breakdown
            </Text>

            <View className="mt-3 flex-row gap-3">
              <View className="flex-1 rounded-xl bg-gray-50 p-3">
                <Text className="text-xs font-semibold text-gray-500">
                  Resisted
                </Text>
                <Text className="mt-1 text-xl font-bold text-gray-900">
                  {extraAnalytics.allResisted}
                </Text>
              </View>

              <View className="flex-1 rounded-xl bg-gray-50 p-3">
                <Text className="text-xs font-semibold text-gray-500">
                  Gave in
                </Text>
                <Text className="mt-1 text-xl font-bold text-gray-900">
                  {extraAnalytics.allGiveIn}
                </Text>
              </View>

              <View className="flex-1 rounded-xl bg-gray-50 p-3">
                <Text className="text-xs font-semibold text-gray-500">
                  Overall resist rate
                </Text>
                <Text className="mt-1 text-xl font-bold text-gray-900">
                  {extraAnalytics.overallResistRate}%
                </Text>
              </View>
            </View>
          </View>

          <View className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
            <Text className="text-base font-semibold text-gray-900">
              Intensity trends
            </Text>

            <View className="mt-3 flex-row gap-3">
              <View className="flex-1 rounded-xl bg-gray-50 p-3">
                <Text className="text-xs font-semibold text-gray-500">
                  Avg intensity
                </Text>
                <Text className="mt-1 text-xl font-bold text-gray-900">
                  {formatAvg(extraAnalytics.avgIntensity)}
                </Text>
              </View>

              <View className="flex-1 rounded-xl bg-gray-50 p-3">
                <Text className="text-xs font-semibold text-gray-500">
                  Avg when resisted
                </Text>
                <Text className="mt-1 text-xl font-bold text-gray-900">
                  {formatAvg(extraAnalytics.avgResistedIntensity)}
                </Text>
              </View>

              <View className="flex-1 rounded-xl bg-gray-50 p-3">
                <Text className="text-xs font-semibold text-gray-500">
                  Avg when gave in
                </Text>
                <Text className="mt-1 text-xl font-bold text-gray-900">
                  {formatAvg(extraAnalytics.avgGaveInIntensity)}
                </Text>
              </View>
            </View>
          </View>

          <View className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
            <Text className="text-base font-semibold text-gray-900">
              Last 7 days
            </Text>

            <View className="mt-4">
              {extraAnalytics.weeklyTrend.map((item) => {
                const widthPct =
                  extraAnalytics.weeklyTrendMax <= 0
                    ? 0
                    : (item.count / extraAnalytics.weeklyTrendMax) * 100;

                return (
                  <View
                    key={item.label}
                    className="mb-3 flex-row items-center gap-3"
                  >
                    <Text className="w-10 text-sm font-semibold text-gray-700">
                      {item.label}
                    </Text>

                    <View className="flex-1 rounded-full bg-gray-100">
                      <View
                        className="h-3 rounded-full bg-green-600"
                        style={{ width: `${Math.max(widthPct, 4)}%` }}
                      />
                    </View>

                    <Text className="w-8 text-right text-sm font-semibold text-gray-900">
                      {item.count}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
            <Text className="text-base font-semibold text-gray-900">
              Habit breakdown
            </Text>

            {extraAnalytics.habitBreakdown.length === 0 ? (
              <Text className="mt-2 text-sm text-gray-600">
                Log a few check-ins to see a breakdown here.
              </Text>
            ) : (
              <View className="mt-3">
                {extraAnalytics.habitBreakdown.map((item) => (
                  <View
                    key={item.name}
                    className="mb-2 rounded-xl bg-gray-50 px-3 py-3"
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm font-semibold text-gray-900">
                        {item.name}
                      </Text>
                      <Text className="text-sm font-semibold text-gray-700">
                        {item.total} logs
                      </Text>
                    </View>

                    <View className="mt-2 flex-row items-center justify-between">
                      <Text className="text-xs text-gray-600">
                        {item.resisted} resisted • {item.gaveIn} gave in
                      </Text>
                      <Text className="text-xs font-semibold text-gray-900">
                        {item.resistRate}% resist rate
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

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

      <Modal
        visible={editModalOpen}
        transparent
        animationType="slide"
        onRequestClose={closeEditModal}
      >
        <View className="flex-1 bg-black/40">
          <View className="mt-16 flex-1 rounded-t-3xl bg-white px-5 pt-5">
            <View className="flex-row items-center justify-between">
              <Text className="text-xl font-bold text-gray-900">Edit log</Text>
              <Pressable
                onPress={closeEditModal}
                className="h-10 w-10 items-center justify-center rounded-full bg-gray-100"
              >
                <Text className="text-lg font-bold text-gray-900">✕</Text>
              </Pressable>
            </View>

            <ScrollView
              className="mt-4"
              contentContainerStyle={{ paddingBottom: 28 }}
              showsVerticalScrollIndicator={false}
            >
              <ChipGroup
                title="Habit"
                options={habitOptions}
                selectedId={habitId}
                onSelect={(id) => setHabitId(id)}
                noneLabel="None"
              />

              <ChipGroup
                title="Cue"
                options={cueOptions}
                selectedId={cueId}
                onSelect={(id) => setCueId(id)}
              />

              <ChipGroup
                title="Location"
                options={locationOptions}
                selectedId={locationId}
                onSelect={(id) => setLocationId(id)}
              />

              <ChipGroup
                title="Replacement Action"
                options={selectedActions}
                selectedId={selectedActionId}
                onSelect={(id) => setSelectedActionId(id)}
              />

              <View className="mt-4">
                <Text className="text-sm font-semibold text-gray-900">
                  Outcome
                </Text>
                <View className="mt-2 flex-row gap-2">
                  <Pressable
                    onPress={() => setDidResist(0)}
                    className={`flex-1 rounded-2xl border px-4 py-3 ${
                      didResist === 0
                        ? "border-gray-900 bg-gray-900"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <Text
                      className={`text-center text-sm font-semibold ${
                        didResist === 0 ? "text-white" : "text-gray-900"
                      }`}
                    >
                      Gave in
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setDidResist(1)}
                    className={`flex-1 rounded-2xl border px-4 py-3 ${
                      didResist === 1
                        ? "border-gray-900 bg-gray-900"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <Text
                      className={`text-center text-sm font-semibold ${
                        didResist === 1 ? "text-white" : "text-gray-900"
                      }`}
                    >
                      Resisted
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View className="mt-4 flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-900">
                    Intensity
                  </Text>
                  <TextInput
                    value={intensityText}
                    onChangeText={setIntensityText}
                    keyboardType="number-pad"
                    placeholder="1-10 or blank"
                    className="mt-2 rounded-2xl border border-gray-200 px-4 py-3 text-gray-900"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-900">
                    Count
                  </Text>
                  <TextInput
                    value={countText}
                    onChangeText={setCountText}
                    keyboardType="number-pad"
                    placeholder="0-10"
                    className="mt-2 rounded-2xl border border-gray-200 px-4 py-3 text-gray-900"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>

              <View className="mt-4">
                <Text className="text-sm font-semibold text-gray-900">
                  Date
                </Text>
                <View className="mt-2 flex-row gap-2">
                  <TextInput
                    value={monthText}
                    onChangeText={setMonthText}
                    keyboardType="number-pad"
                    placeholder="MM"
                    className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-gray-900"
                    placeholderTextColor="#9CA3AF"
                  />
                  <TextInput
                    value={dayText}
                    onChangeText={setDayText}
                    keyboardType="number-pad"
                    placeholder="DD"
                    className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-gray-900"
                    placeholderTextColor="#9CA3AF"
                  />
                  <TextInput
                    value={yearText}
                    onChangeText={setYearText}
                    keyboardType="number-pad"
                    placeholder="YYYY"
                    className="flex-[1.4] rounded-2xl border border-gray-200 px-4 py-3 text-gray-900"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>

              <View className="mt-4">
                <Text className="text-sm font-semibold text-gray-900">
                  Time
                </Text>
                <View className="mt-2 flex-row gap-2">
                  <TextInput
                    value={hourText}
                    onChangeText={setHourText}
                    keyboardType="number-pad"
                    placeholder="HH"
                    className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-gray-900"
                    placeholderTextColor="#9CA3AF"
                  />
                  <TextInput
                    value={minuteText}
                    onChangeText={setMinuteText}
                    keyboardType="number-pad"
                    placeholder="MM"
                    className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-gray-900"
                    placeholderTextColor="#9CA3AF"
                  />
                  <Pressable
                    onPress={() => setAmpm("AM")}
                    className={`flex-1 rounded-2xl border px-4 py-3 ${
                      ampm === "AM"
                        ? "border-gray-900 bg-gray-900"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <Text
                      className={`text-center text-sm font-semibold ${
                        ampm === "AM" ? "text-white" : "text-gray-900"
                      }`}
                    >
                      AM
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setAmpm("PM")}
                    className={`flex-1 rounded-2xl border px-4 py-3 ${
                      ampm === "PM"
                        ? "border-gray-900 bg-gray-900"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <Text
                      className={`text-center text-sm font-semibold ${
                        ampm === "PM" ? "text-white" : "text-gray-900"
                      }`}
                    >
                      PM
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View className="mt-4">
                <Text className="text-sm font-semibold text-gray-900">
                  Notes
                </Text>
                <TextInput
                  value={notesText}
                  onChangeText={setNotesText}
                  multiline
                  placeholder="Optional"
                  className="mt-2 min-h-[110px] rounded-2xl border border-gray-200 px-4 py-3 text-gray-900"
                  placeholderTextColor="#9CA3AF"
                  textAlignVertical="top"
                />
              </View>

              {editError ? (
                <Text className="mt-4 text-sm font-semibold text-red-600">
                  {editError}
                </Text>
              ) : null}

              <Pressable
                onPress={handleSaveEdit}
                className="mt-5 rounded-2xl bg-green-600 py-4"
              >
                <Text className="text-center text-base font-bold text-white">
                  Save Changes
                </Text>
              </Pressable>

              <Pressable
                onPress={handleDeleteLog}
                className="mt-3 rounded-2xl border border-red-200 bg-red-50 py-4"
              >
                <Text className="text-center text-base font-bold text-red-700">
                  Delete Log
                </Text>
              </Pressable>

              <Pressable
                onPress={closeEditModal}
                className="mt-3 rounded-2xl border border-gray-200 bg-white py-4"
              >
                <Text className="text-center text-base font-bold text-gray-900">
                  Cancel
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
