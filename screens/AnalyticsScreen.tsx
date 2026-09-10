import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList, RootTabParamList } from "../App";
import { useData, type LogEntry } from "../data/DataContext";
import {
  AnalyticsCalendar,
  type CalendarCell,
} from "../components/analytics/AnalyticsCalendar";
import {
  DayLogsModal,
  EditLogModal,
} from "../components/analytics/AnalyticsModals";
import { Screen } from "../components/Screen";
import { TrackingReviewLauncher } from "../components/TrackingReviewCard";
import { ProgressTrendChart } from "../components/analytics/ProgressTrendChart";

const ICON_BUBBLE_BORDER = "#E5E7EB";
const BRAND_GREEN = "#16A34A";

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
type PatternRangeKey = "Week" | "4W" | "3M" | "All";
type PatternDetailKey = "when" | "where" | "why";
type ActivityDetailKey = "activity" | "outcomes" | "intensity";

const PATTERN_RANGE_OPTIONS: Array<{
  key: PatternRangeKey;
  label: string;
  days: number | null;
}> = [
  { key: "Week", label: "Week", days: 7 },
  { key: "4W", label: "Month", days: 28 },
  { key: "3M", label: "3M", days: 90 },
  { key: "All", label: "All", days: null },
];

function rangeLabel(range: PatternRangeKey) {
  return PATTERN_RANGE_OPTIONS.find((option) => option.key === range)?.label;
}
type AnalyticsRoute = RouteProp<RootTabParamList, "Analytics">;
type Nav = BottomTabNavigationProp<RootTabParamList, "Analytics"> &
  NativeStackNavigationProp<RootStackParamList>;
function ActivitySummaryRow({
  label,
  summary,
  icon,
  onPress,
  disabled = false,
  accentColor = BRAND_GREEN,
}: {
  label: string;
  summary: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  accentColor?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={disabled ? undefined : "button"}
      accessibilityHint={
        disabled ? undefined : `View ${label.toLowerCase()} details`
      }
      className="mt-2.5 flex-row items-center rounded-2xl border border-gray-200 bg-white px-3 py-3"
    >
      <View
        className="h-10 w-10 items-center justify-center rounded-xl border bg-white"
        style={{ borderColor: ICON_BUBBLE_BORDER }}
      >
        <Ionicons name={icon} size={20} color={accentColor} />
      </View>

      <View className="ml-3 flex-1">
        <Text className="text-sm font-black text-black">{label}</Text>
        <Text
          className="mt-0.5 text-xs font-semibold text-gray-500"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {summary}
        </Text>
      </View>

      {!disabled ? (
        <Ionicons name="chevron-forward" size={19} color="#6B7280" />
      ) : null}
    </Pressable>
  );
}

function PatternSummaryRow({
  label,
  items,
  icon,
  onPress,
  accentColor = BRAND_GREEN,
}: {
  label: string;
  items: { name: string; count: number }[];
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accentColor?: string;
}) {
  const summary = items
    .slice(0, 1)
    .map((item) => `${item.name} · ${item.count}`)
    .join("");
  const canOpen = items.length > 1;

  return (
    <Pressable
      onPress={onPress}
      disabled={!canOpen}
      accessibilityRole={canOpen ? "button" : undefined}
      accessibilityHint={
        canOpen ? `View all ${label.toLowerCase()} patterns` : undefined
      }
      className="mt-2.5 flex-row items-center rounded-2xl border border-gray-200 bg-white px-3 py-3"
    >
      <View
        className="h-10 w-10 items-center justify-center rounded-xl border bg-white"
        style={{ borderColor: ICON_BUBBLE_BORDER }}
      >
        <Ionicons name={icon} size={20} color={accentColor} />
      </View>

      <View className="ml-3 flex-1">
        <Text className="text-sm font-black text-black">{label}</Text>
        <Text
          className="mt-0.5 text-xs font-semibold text-gray-500"
          numberOfLines={1}
        >
          {summary || "No information recorded"}
        </Text>
      </View>

      {canOpen ? (
        <Ionicons name="chevron-forward" size={19} color="#6B7280" />
      ) : null}
    </Pressable>
  );
}

export default function AnalyticsScreen() {
  const route = useRoute<AnalyticsRoute>();
  const navigation = useNavigation<Nav>();
  const {
    logs,
    habits,
    cues,
    locations,
    selectedHabits,
    selectedCues,
    selectedLocations,
    cycleHistory,
    actions,
    selectedActionIds,
    updateLog,
    deleteLog,
  } = useData();

  const [activeTab, setActiveTab] = useState<TabKey>("Overall");
  const [monthOffset, setMonthOffset] = useState(0);
  const [progressView, setProgressView] = useState<"calendar" | "progress">(
    "calendar",
  );
  const [patternRange, setPatternRange] = useState<PatternRangeKey>("4W");
  const [insightRange, setInsightRange] = useState<PatternRangeKey>("4W");
  const [patternDetailKey, setPatternDetailKey] =
    useState<PatternDetailKey | null>(null);
  const [activityDetailKey, setActivityDetailKey] =
    useState<ActivityDetailKey | null>(null);
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [selectedDayMs, setSelectedDayMs] = useState<number | null>(null);
  const [editingLog, setEditingLog] = useState<LogEntry | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [habitId, setHabitId] = useState<number | null>(null);
  const [cueIds, setCueIds] = useState<number[]>([]);
  const [locationId, setLocationId] = useState<number | null>(null);
  const [movedToLocationId, setMovedToLocationId] = useState<number | null>(
    null,
  );
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
    setPatternRange("4W");
    setInsightRange("4W");
    setPatternDetailKey(null);
    setActivityDetailKey(null);
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
  const hasAnyAnalyticsData = hasAnyLogs || cycleHistory.length > 0;

  const installDayStartMs = useMemo(() => {
    if (!logs || logs.length === 0) return todayStartMs;

    let min = logs[0].createdAt;

    for (let i = 1; i < logs.length; i++) {
      if (logs[i].createdAt < min) min = logs[i].createdAt;
    }

    return startOfDayMs(min);
  }, [logs, todayStartMs]);

  const habitOptions = useMemo(() => {
    const selectedIds = new Set(selectedHabits.map((habit) => habit.id));
    return habits
      .filter(
        (habit) =>
          selectedIds.has(habit.id) || habit.id === editingLog?.habitId,
      )
      .map((habit) => ({
        id: habit.id,
        name: habit.name,
        color: habit.color,
        unit: habit.unit,
      }));
  }, [editingLog?.habitId, habits, selectedHabits]);

  const cueOptions = useMemo(() => {
    const visibleIds = new Set([
      ...selectedCues.map((cue) => cue.id),
      ...(editingLog?.cueIds ?? []),
    ]);
    return cues
      .filter((cue) => visibleIds.has(cue.id))
      .map((cue) => ({ id: cue.id, name: cue.name }));
  }, [cues, editingLog?.cueIds, selectedCues]);

  const locationOptions = useMemo(() => {
    const visibleIds = new Set(
      selectedLocations.map((location) => location.id),
    );
    if (editingLog?.locationId != null) {
      visibleIds.add(editingLog.locationId);
    }
    if (editingLog?.movedToLocationId != null) {
      visibleIds.add(editingLog.movedToLocationId);
    }
    const options = locations
      .filter((location) => visibleIds.has(location.id))
      .map((location) => ({ id: location.id, name: location.name }));
    if (
      editingLog?.locationId != null &&
      editingLog.locationName &&
      !options.some((location) => location.id === editingLog.locationId)
    ) {
      options.push({
        id: editingLog.locationId,
        name: editingLog.locationName,
      });
    }
    if (
      editingLog?.movedToLocationId != null &&
      editingLog.movedToLocationName &&
      !options.some((location) => location.id === editingLog.movedToLocationId)
    ) {
      options.push({
        id: editingLog.movedToLocationId,
        name: editingLog.movedToLocationName,
      });
    }
    return options;
  }, [
    editingLog?.locationId,
    editingLog?.locationName,
    editingLog?.movedToLocationId,
    editingLog?.movedToLocationName,
    locations,
    selectedLocations,
  ]);

  const replacementActionOptions = useMemo(() => {
    const visibleIds = new Set(selectedActionIds);
    if (editingLog?.selectedActionId != null) {
      visibleIds.add(editingLog.selectedActionId);
    }
    const options = actions
      .filter((action) => visibleIds.has(action.id))
      .map((action) => ({ id: action.id, name: action.title }));
    if (
      editingLog?.selectedActionId != null &&
      editingLog.selectedActionTitle &&
      !options.some((action) => action.id === editingLog.selectedActionId)
    ) {
      options.push({
        id: editingLog.selectedActionId,
        name: editingLog.selectedActionTitle,
      });
    }
    return options;
  }, [
    actions,
    editingLog?.selectedActionId,
    editingLog?.selectedActionTitle,
    selectedActionIds,
  ]);

  const habitTabs = useMemo(() => {
    return [
      "Overall",
      ...selectedHabits.map((habit) => habit.name),
    ] as TabKey[];
  }, [selectedHabits]);

  useEffect(() => {
    if (activeTab === "Overall" || habitTabs.includes(activeTab)) return;
    setActiveTab("Overall");
  }, [activeTab, habitTabs]);

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
      setCueIds(log.cueIds);
      setLocationId(log.locationId ?? null);
      setMovedToLocationId(log.movedToLocationId ?? null);
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
      cueIds,
      locationId,
      movedToLocationId,
      intensity,
      count: didResist === 1 ? 0 : Math.max(1, count),
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
    const selectedRange = PATTERN_RANGE_OPTIONS.find(
      (option) => option.key === patternRange,
    );
    const now = new Date();
    const rangeStart =
      selectedRange?.days == null
        ? null
        : startOfDayMs(
            new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate() - (selectedRange.days - 1),
            ).getTime(),
          );
    const patternLogs = filteredLogs.filter(
      (log) =>
        log.didResist !== 1 &&
        (rangeStart == null || log.createdAt >= rangeStart),
    );
    const ranked = (m: Map<string, number>) =>
      Array.from(m.entries())
        .sort((a, b) => b[1] - a[1])
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

    for (const l of patternLogs) {
      const loc = (l.locationName ?? "").trim();

      for (const cue of l.cueNames) {
        const cleanCue = cue.trim();
        if (cleanCue) {
          cueCounts.set(cleanCue, (cueCounts.get(cleanCue) ?? 0) + 1);
        }
      }
      if (loc) locCounts.set(loc, (locCounts.get(loc) ?? 0) + 1);

      const bucket = timeBucket(l.createdAt);
      timeCounts.set(bucket, (timeCounts.get(bucket) ?? 0) + 1);
    }

    return {
      gaveInCount: patternLogs.length,
      topCues: ranked(cueCounts),
      topLocations: ranked(locCounts),
      topTimes: ranked(timeCounts),
    };
  }, [filteredLogs, patternRange]);

  const activePatternDetail =
    patternDetailKey === "when"
      ? {
          title: "When it happens",
          icon: "time" as const,
          items: data.topTimes,
          total: data.gaveInCount,
        }
      : patternDetailKey === "where"
        ? {
            title: "Where it happens",
            icon: "location" as const,
            items: data.topLocations,
            total: data.gaveInCount,
          }
        : patternDetailKey === "why"
          ? {
              title: "Why it happens",
              icon: "alert-circle" as const,
              items: data.topCues,
              total: data.gaveInCount,
            }
          : null;

  const activitySummary = useMemo(() => {
    const selectedRange = PATTERN_RANGE_OPTIONS.find(
      (option) => option.key === insightRange,
    );
    const now = new Date();
    const rangeStart =
      selectedRange?.days == null
        ? null
        : startOfDayMs(
            new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate() - (selectedRange.days - 1),
            ).getTime(),
          );
    const rangeLogs = filteredLogs.filter(
      (log) => rangeStart == null || log.createdAt >= rangeStart,
    );
    const resisted = rangeLogs.filter((log) => log.didResist === 1);
    const gaveIn = rangeLogs.filter((log) => log.didResist !== 1);
    const withIntensity = rangeLogs.filter(
      (log) => typeof log.intensity === "number",
    );
    const resistedWithIntensity = resisted.filter(
      (log) => typeof log.intensity === "number",
    );
    const gaveInWithIntensity = gaveIn.filter(
      (log) => typeof log.intensity === "number",
    );
    const averageIntensity = (entries: LogEntry[]) =>
      entries.length === 0
        ? null
        : entries.reduce((sum, log) => sum + (log.intensity ?? 0), 0) /
          entries.length;

    return {
      total: rangeLogs.length,
      activeDays: new Set(rangeLogs.map((log) => dayKey(log.createdAt))).size,
      resisted: resisted.length,
      gaveIn: gaveIn.length,
      resistRate: percent(resisted.length, rangeLogs.length),
      gaveInRate: percent(gaveIn.length, rangeLogs.length),
      intensityRatedCount: withIntensity.length,
      avgIntensity: averageIntensity(withIntensity),
      avgResistedIntensity: averageIntensity(resistedWithIntensity),
      avgGaveInIntensity: averageIntensity(gaveInWithIntensity),
    };
  }, [filteredLogs, insightRange]);

  const averageLogsPerActiveDay =
    activitySummary.activeDays === 0
      ? null
      : activitySummary.total / activitySummary.activeDays;

  const patternTitle = "Habit activity patterns";

  const activeHabitColor =
    activeTab === "Overall"
      ? BRAND_GREEN
      : (habits.find((habit) => habit.name === activeTab)?.color ??
        BRAND_GREEN);
  const activeHabit =
    activeTab === "Overall"
      ? null
      : (habits.find((habit) => habit.name === activeTab) ?? null);
  const activeHabitIcon: keyof typeof Ionicons.glyphMap =
    activeTab === "Overall"
      ? "stats-chart"
      : ((habits.find((habit) => habit.name === activeTab)
          ?.icon as keyof typeof Ionicons.glyphMap) ?? "ellipse");

  if (!hasAnyAnalyticsData) {
    return (
      <Screen
        scroll
        scrollViewRef={scrollViewRef}
        scrollViewProps={{
          showsVerticalScrollIndicator: false,
          contentContainerStyle: {
            paddingHorizontal: 20,
            paddingTop: 30,
            paddingBottom: 28,
            flexGrow: 1,
          },
        }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-4">
            <Text
              className="text-xs font-black uppercase tracking-widest"
              style={{ color: BRAND_GREEN }}
            >
              Analytics
            </Text>

            <Text className="mt-0.5 text-2xl font-black text-black">
              Pattern map
            </Text>
          </View>

          <View
            className="h-12 w-12 items-center justify-center rounded-full border-4 bg-white shadow-sm"
            style={{ borderColor: BRAND_GREEN }}
          >
            <Ionicons name={activeHabitIcon} size={23} color="#000000" />
          </View>
        </View>

        <TrackingReviewLauncher
          placement="analytics"
          habitId={activeHabit?.id ?? null}
        />

        <View className="mt-5 rounded-[32px] border border-gray-200 bg-gray-50 p-5 shadow-sm">
          <View className="items-center">
            <View
              className="h-16 w-16 items-center justify-center rounded-full border bg-white"
              style={{ borderColor: ICON_BUBBLE_BORDER }}
            >
              <Ionicons name="analytics" size={31} color={BRAND_GREEN} />
            </View>

            <Text className="mt-5 text-center text-2xl font-black text-black">
              No analytics yet
            </Text>

            <Text className="mt-2 text-center text-base font-bold leading-6 text-gray-500">
              Once you log your first urge, this page will show your calendar,
              patterns, triggers, and progress.
            </Text>

            <Pressable
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                navigation.navigate("Log");
              }}
              className="mt-6 w-full rounded-3xl bg-green-600 px-5 py-4 shadow-sm"
            >
              <View className="flex-row items-center justify-center">
                <Ionicons name="add-circle" size={22} color="#FFFFFF" />
                <Text className="ml-2 text-center text-base font-black text-white">
                  Log your first urge
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate("ShopPicker", { showDoneButton: true });
              }}
              className="mt-3 w-full rounded-3xl border border-gray-200 bg-white px-5 py-4 shadow-sm"
            >
              <View className="flex-row items-center justify-center">
                <Ionicons name="bag-handle" size={22} color="#000000" />
                <Text className="ml-2 text-center text-base font-black text-black">
                  Pick backup actions
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <>
      <Screen
        scroll
        scrollViewRef={scrollViewRef}
        scrollViewProps={{
          showsVerticalScrollIndicator: false,
          contentContainerStyle: {
            paddingHorizontal: 20,
            paddingTop: 30,
            paddingBottom: 28,
          },
        }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-4">
            <Text
              className="text-xs font-black uppercase tracking-widest"
              style={{ color: BRAND_GREEN }}
            >
              Analytics
            </Text>

            <Text className="mt-0.5 text-2xl font-black text-black">
              Pattern map
            </Text>

            <Text className="mt-2 text-sm font-semibold leading-5 text-gray-500">
              Tip: Look for patterns. Notice what makes urges easier or harder
              to beat.
            </Text>
          </View>

          <View
            className="h-12 w-12 items-center justify-center rounded-full border-4 bg-white shadow-sm"
            style={{ borderColor: BRAND_GREEN }}
          >
            <Ionicons name={activeHabitIcon} size={23} color="#000000" />
          </View>
        </View>

        <ScrollView
          ref={habitTabsScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-4"
        >
          {habitTabs.map((t) => (
            <Pressable
              key={t}
              onPress={async () => {
                await lightHaptic();
                setActiveTab(t);
              }}
              className="mr-2 rounded-full border px-3.5 py-2"
              style={{
                borderColor: t === activeTab ? activeHabitColor : "#E5E7EB",
                backgroundColor: t === activeTab ? activeHabitColor : "#FFFFFF",
              }}
            >
              <Text
                className={`text-sm font-black ${
                  t === activeTab ? "text-white" : "text-black"
                }`}
                numberOfLines={1}
              >
                {t}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View className="mt-3 rounded-3xl border border-gray-200 bg-gray-50 p-3 shadow-sm">
          <View className="mb-3 flex-row rounded-full border border-gray-200 bg-white p-1">
            {(
              [
                { key: "calendar", label: "Calendar" },
                { key: "progress", label: "Progress" },
              ] as const
            ).map((option) => {
              const selected = progressView === option.key;

              return (
                <Pressable
                  key={option.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setProgressView(option.key);
                  }}
                  className="flex-1 rounded-full px-3 py-2"
                  style={{
                    backgroundColor: selected
                      ? activeHabitColor
                      : "transparent",
                  }}
                >
                  <Text
                    className={`text-center text-sm font-black ${
                      selected ? "text-white" : "text-gray-600"
                    }`}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ minHeight: 430 }}>
            {progressView === "calendar" ? (
              <>
                <View className="mb-2 flex-row items-center justify-between">
                  <View className="flex-1 pr-3">
                    <Text className="text-base font-black text-black">
                      Habit activity calendar
                    </Text>

                    <Text className="mt-0.5 text-xs font-semibold leading-4 text-gray-500">
                      Tap a day to view or edit logs for that day.
                    </Text>
                  </View>

                  <View
                    className="h-9 w-9 items-center justify-center rounded-2xl border bg-white"
                    style={{ borderColor: ICON_BUBBLE_BORDER }}
                  >
                    <Ionicons
                      name="calendar"
                      size={19}
                      color={activeHabitColor}
                    />
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
                  accentColor={activeHabitColor}
                />
              </>
            ) : (
              <ProgressTrendChart
                habit={activeHabit}
                cycles={cycleHistory}
                logs={logs}
                accentColor={activeHabitColor}
                embedded
              />
            )}
          </View>
        </View>

        <TrackingReviewLauncher
          placement="analytics"
          habitId={activeHabit?.id ?? null}
        />

        <View className="mt-5 rounded-[32px] border border-gray-200 bg-gray-50 p-5 shadow-sm">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-xl font-black text-black">
                {patternTitle}
              </Text>

              <Text
                className="mt-1 text-sm font-semibold text-gray-500"
                numberOfLines={1}
              >
                When, where, and why it happens.
              </Text>
            </View>

            <View
              className="h-12 w-12 items-center justify-center rounded-2xl border bg-white"
              style={{ borderColor: ICON_BUBBLE_BORDER }}
            >
              <Ionicons name="search" size={24} color={activeHabitColor} />
            </View>
          </View>

          <View className="mt-3 flex-row gap-2">
            {PATTERN_RANGE_OPTIONS.map((option) => {
              const selected = patternRange === option.key;

              return (
                <Pressable
                  key={option.key}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setPatternRange(option.key);
                  }}
                  className="flex-1 rounded-full border px-2 py-1.5"
                  style={{
                    borderColor: selected
                      ? activeHabitColor
                      : ICON_BUBBLE_BORDER,
                    backgroundColor: selected ? activeHabitColor : "#FFFFFF",
                  }}
                >
                  <Text
                    className={`text-center text-xs font-black ${
                      selected ? "text-white" : "text-black"
                    }`}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {data.gaveInCount === 0 ? (
            <View className="mt-4 flex-row items-center rounded-[28px] border border-green-200 bg-green-50 p-4">
              <View className="h-11 w-11 items-center justify-center rounded-2xl border border-green-200 bg-white">
                <Ionicons
                  name="checkmark-circle"
                  size={23}
                  color={activeHabitColor}
                />
              </View>

              <Text className="ml-3 flex-1 text-sm font-bold leading-5 text-gray-700">
                No habit activity in this period.
              </Text>
            </View>
          ) : (
            <View className="mt-1">
              <PatternSummaryRow
                accentColor={activeHabitColor}
                label="When"
                items={data.topTimes}
                icon="time"
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setPatternDetailKey("when");
                }}
              />

              <PatternSummaryRow
                accentColor={activeHabitColor}
                label="Where"
                items={data.topLocations}
                icon="location"
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setPatternDetailKey("where");
                }}
              />

              <PatternSummaryRow
                accentColor={activeHabitColor}
                label="Why"
                items={data.topCues}
                icon="alert-circle"
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setPatternDetailKey("why");
                }}
              />
            </View>
          )}
        </View>

        <View className="mt-5 rounded-[32px] border border-gray-200 bg-gray-50 p-5 shadow-sm">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-xl font-black text-black">
                Activity Summary
              </Text>

              <Text className="mt-1 text-sm font-semibold text-gray-500">
                Your activity, outcomes, and intensity.
              </Text>
            </View>

            <View
              className="h-12 w-12 items-center justify-center rounded-2xl border bg-white"
              style={{ borderColor: ICON_BUBBLE_BORDER }}
            >
              <Ionicons name="sparkles" size={24} color={activeHabitColor} />
            </View>
          </View>

          <View className="mt-3 flex-row gap-2">
            {PATTERN_RANGE_OPTIONS.map((option) => {
              const selected = insightRange === option.key;

              return (
                <Pressable
                  key={option.key}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setInsightRange(option.key);
                  }}
                  className="flex-1 rounded-full border px-2 py-1.5"
                  style={{
                    borderColor: selected
                      ? activeHabitColor
                      : ICON_BUBBLE_BORDER,
                    backgroundColor: selected ? activeHabitColor : "#FFFFFF",
                  }}
                >
                  <Text
                    className={`text-center text-xs font-black ${
                      selected ? "text-white" : "text-black"
                    }`}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View className="mt-1">
            <ActivitySummaryRow
              accentColor={activeHabitColor}
              label="Activity"
              summary={`${activitySummary.total} ${activitySummary.total === 1 ? "log" : "logs"}`}
              icon="create"
              disabled={activitySummary.total === 0}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setActivityDetailKey("activity");
              }}
            />

            <ActivitySummaryRow
              accentColor={activeHabitColor}
              label="Outcomes"
              summary={`${activitySummary.resistRate}% resisted`}
              icon="shield-checkmark"
              disabled={activitySummary.total === 0}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setActivityDetailKey("outcomes");
              }}
            />

            <ActivitySummaryRow
              accentColor={activeHabitColor}
              label="Intensity"
              summary={`${formatAvg(activitySummary.avgIntensity)} average`}
              icon="pulse"
              disabled={activitySummary.intensityRatedCount === 0}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setActivityDetailKey("intensity");
              }}
            />
          </View>
        </View>
      </Screen>

      <Modal
        visible={activePatternDetail != null}
        transparent
        animationType="fade"
        onRequestClose={() => setPatternDetailKey(null)}
      >
        <View className="flex-1 justify-center bg-black/40 px-5">
          <View className="max-h-[75%] rounded-[32px] bg-white p-5 shadow-lg">
            <View className="flex-row items-center">
              <View
                className="h-12 w-12 items-center justify-center rounded-2xl border bg-white"
                style={{ borderColor: ICON_BUBBLE_BORDER }}
              >
                <Ionicons
                  name={activePatternDetail?.icon ?? "analytics"}
                  size={24}
                  color={activeHabitColor}
                />
              </View>

              <View className="ml-3 flex-1">
                <Text className="text-xl font-black text-black">
                  {activePatternDetail?.title}
                </Text>
                <Text className="mt-1 text-sm font-semibold text-gray-500">
                  Based on {activePatternDetail?.total ?? 0}{" "}
                  {(activePatternDetail?.total ?? 0) === 1
                    ? "give-in"
                    : "give-ins"}{" "}
                  · {rangeLabel(patternRange)} view
                </Text>
              </View>

              <Pressable
                onPress={() => setPatternDetailKey(null)}
                accessibilityRole="button"
                accessibilityLabel="Close pattern details"
                className="h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-gray-50"
              >
                <Ionicons name="close" size={22} color="#000000" />
              </Pressable>
            </View>

            <ScrollView className="mt-4" showsVerticalScrollIndicator={false}>
              {activePatternDetail?.items.map((item, index) => {
                const total = Math.max(activePatternDetail.total, 1);
                const percentage = Math.min(
                  100,
                  Math.round((item.count / total) * 100),
                );

                return (
                  <View
                    key={`${item.name}-${index}`}
                    className="mb-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3"
                  >
                    <View className="flex-row items-center">
                      <Text className="flex-1 pr-3 text-sm font-bold text-black">
                        {item.name}
                      </Text>
                      <Text
                        className="text-xs font-black"
                        style={{ color: activeHabitColor }}
                      >
                        {item.count} {item.count === 1 ? "time" : "times"} ·{" "}
                        {percentage}%
                      </Text>
                    </View>

                    <View className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: activeHabitColor,
                        }}
                      />
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <Pressable
              onPress={() => setPatternDetailKey(null)}
              className="mt-3 rounded-3xl bg-green-600 py-4 active:bg-green-700"
            >
              <Text className="text-center text-base font-black text-white">
                Done
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={activityDetailKey != null}
        transparent
        animationType="fade"
        onRequestClose={() => setActivityDetailKey(null)}
      >
        <View className="flex-1 justify-center bg-black/40 px-5">
          <View className="rounded-[32px] bg-white p-5 shadow-lg">
            <View className="flex-row items-center">
              <View
                className="h-12 w-12 items-center justify-center rounded-2xl border bg-white"
                style={{ borderColor: ICON_BUBBLE_BORDER }}
              >
                <Ionicons
                  name={
                    activityDetailKey === "activity"
                      ? "create"
                      : activityDetailKey === "outcomes"
                        ? "shield-checkmark"
                        : "pulse"
                  }
                  size={24}
                  color={activeHabitColor}
                />
              </View>

              <View className="ml-3 flex-1">
                <Text className="text-xl font-black text-black">
                  {activityDetailKey === "activity"
                    ? "Activity"
                    : activityDetailKey === "outcomes"
                      ? "Outcomes"
                      : "Intensity"}
                </Text>
                <Text className="mt-1 text-sm font-semibold text-gray-500">
                  {rangeLabel(insightRange)} view
                </Text>
              </View>

              <Pressable
                onPress={() => setActivityDetailKey(null)}
                accessibilityRole="button"
                accessibilityLabel="Close activity details"
                className="h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-gray-50"
              >
                <Ionicons name="close" size={22} color="#000000" />
              </Pressable>
            </View>

            {activityDetailKey === "activity" ? (
              <View className="mt-4 gap-2">
                <View className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <Text className="text-sm font-bold text-gray-500">
                    Total logs
                  </Text>
                  <Text className="mt-1 text-xl font-black text-black">
                    {activitySummary.total}
                  </Text>
                </View>
                <View className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <Text className="text-sm font-bold text-gray-500">
                    Active days
                  </Text>
                  <Text className="mt-1 text-xl font-black text-black">
                    {activitySummary.activeDays}
                  </Text>
                </View>
                <View className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <Text className="text-sm font-bold text-gray-500">
                    Average per active day
                  </Text>
                  <Text className="mt-1 text-xl font-black text-black">
                    {formatAvg(averageLogsPerActiveDay)}
                  </Text>
                </View>
              </View>
            ) : activityDetailKey === "outcomes" ? (
              <View className="mt-4 gap-2">
                {[
                  {
                    label: "Resisted",
                    count: activitySummary.resisted,
                    percentage: activitySummary.resistRate,
                  },
                  {
                    label: "Gave in",
                    count: activitySummary.gaveIn,
                    percentage: activitySummary.gaveInRate,
                  },
                ].map((item) => (
                  <View
                    key={item.label}
                    className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3"
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm font-bold text-black">
                        {item.label}
                      </Text>
                      <Text
                        className="text-sm font-black"
                        style={{ color: activeHabitColor }}
                      >
                        {item.count} · {item.percentage}%
                      </Text>
                    </View>
                    <View className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: `${item.percentage}%`,
                          backgroundColor: activeHabitColor,
                        }}
                      />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View className="mt-4 gap-2">
                <Text className="text-sm font-semibold text-gray-500">
                  Based on {activitySummary.intensityRatedCount}{" "}
                  {activitySummary.intensityRatedCount === 1 ? "log" : "logs"}{" "}
                  with an intensity rating.
                </Text>
                {[
                  { label: "Overall", value: activitySummary.avgIntensity },
                  {
                    label: "When resisted",
                    value: activitySummary.avgResistedIntensity,
                  },
                  {
                    label: "When gave in",
                    value: activitySummary.avgGaveInIntensity,
                  },
                ].map((item) => (
                  <View
                    key={item.label}
                    className="flex-row items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3"
                  >
                    <Text className="text-sm font-bold text-black">
                      {item.label}
                    </Text>
                    <Text
                      className="text-xl font-black"
                      style={{ color: activeHabitColor }}
                    >
                      {formatAvg(item.value)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <Pressable
              onPress={() => setActivityDetailKey(null)}
              className="mt-4 rounded-3xl py-4"
              style={{ backgroundColor: activeHabitColor }}
            >
              <Text className="text-center text-base font-black text-white">
                Done
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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
        replacementActionOptions={replacementActionOptions}
        habitId={habitId}
        cueIds={cueIds}
        locationId={locationId}
        movedToLocationId={movedToLocationId}
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
        setCueIds={setCueIds}
        setLocationId={setLocationId}
        setMovedToLocationId={setMovedToLocationId}
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
