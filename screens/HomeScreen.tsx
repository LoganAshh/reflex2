import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  Modal,
  SafeAreaView,
} from "react-native";
import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { RootStackParamList, RootTabParamList } from "../App";
import { useData, type Habit } from "../data/DataContext";
import * as Haptics from "expo-haptics";
import { Screen } from "../components/Screen";
import { TrackingReviewLauncher } from "../components/TrackingReviewCard";
import { getPreviousCycleBounds } from "../data/tracking";
import { cleanHabitIcon } from "../data/habitIcons";

function startOfDayMs(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function addLocalDays(timestamp: number, days: number) {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

function startOfWeekMs(d: Date) {
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() - diffToMonday,
  );
  return startOfDayMs(monday);
}

function getPercentIncrease(current: number, previous: number) {
  if (current <= previous) return null;
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function getFirstName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0];
}

function formatAverage(value: number) {
  if (Number.isInteger(value)) return `${value}`;
  return value.toFixed(1);
}

function currentPeriodLabel(period: Habit["baselinePeriod"]) {
  if (period === "week") return "this week";
  if (period === "28_days") return "this month";
  return "today";
}

function daysInPeriod(period: Habit["baselinePeriod"]) {
  if (period === "week") return 7;
  if (period === "28_days") return 28;
  return 1;
}

function periodRateLabel(period: Habit["baselinePeriod"]) {
  if (period === "week") return "per week";
  if (period === "28_days") return "per month";
  return "per day";
}

function unitForValue(unit: string, value: number) {
  if (value !== 1) return unit;
  if (unit === "times") return "time";
  if (unit === "minutes") return "minute";
  return unit;
}

const MOTIVATIONAL_QUOTES = [
  {
    text: "An urge is temporary. Your next choice still belongs to you.",
    attribution: null,
  },
  {
    text: "Progress comes from returning, not from being perfect.",
    attribution: null,
  },
  {
    text: "A difficult moment does not erase the work you’ve done.",
    attribution: null,
  },
  {
    text: "Until you make the unconscious conscious, it will direct your life and you will call it fate.",
    attribution: "Carl Jung",
  },
  {
    text: "Awareness turns automatic patterns into choices.",
    attribution: null,
  },
  {
    text: "A pause is progress when autopilot was the alternative.",
    attribution: null,
  },
  {
    text: "You can restart from the very next choice.",
    attribution: null,
  },
  {
    text: "Small choices become strong patterns when repeated.",
    attribution: null,
  },
  {
    text: "One difficult moment does not decide the rest of your day.",
    attribution: null,
  },
  {
    text: "Noticing the pattern is already a step outside it.",
    attribution: null,
  },
  {
    text: "You do not need a perfect day to make a better choice.",
    attribution: null,
  },
  {
    text: "If there is no struggle, there is no progress.",
    attribution: "Frederick Douglass",
  },
  {
    text: "Nothing great was ever achieved without enthusiasm.",
    attribution: "Ralph Waldo Emerson",
  },
  {
    text: "Things do not change; we change.",
    attribution: "Henry David Thoreau",
  },
  {
    text: "Well done is better than well said.",
    attribution: "Benjamin Franklin",
  },
  {
    text: "Fall seven times, stand up eight.",
    attribution: "Japanese proverb",
  },
  {
    text: "No man is free who is not master of himself.",
    attribution: "Epictetus",
  },
  {
    text: "The mind converts and changes every hindrance to its activity into an aid.",
    attribution: "Marcus Aurelius",
  },
  {
    text: "Although the world is full of suffering, it is full also of the overcoming of it.",
    attribution: "Helen Keller",
  },
] as const;

type TabNav = BottomTabNavigationProp<RootTabParamList, "Home">;
type StackNav = NativeStackNavigationProp<RootStackParamList>;
type Nav = TabNav & StackNav;
type HomeRoute = RouteProp<RootTabParamList, "Home">;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<HomeRoute>();
  const {
    logs,
    habits,
    selectedHabits,
    profileName,
    profilePhotoUri,
    trackingConfirmations,
    cycleReviews,
    goalHistory,
    acknowledgedRecoveryGoalHistoryIds,
    acknowledgeRecoveryGoal,
    acknowledgedCalculatedHabitIds,
    acknowledgeCalculatedHabits,
    baselineSummaries,
    proposeNextGoal,
  } = useData();

  const [selectedHabitId, setSelectedHabitId] = useState<number | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const habitChipsScrollRef = useRef<ScrollView | null>(null);
  const handledResetTokenRef = useRef<number | null>(null);
  const [calculatedNoticeOpen, setCalculatedNoticeOpen] = useState(false);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [weeklyReviewOpenToken, setWeeklyReviewOpenToken] = useState<
    number | undefined
  >(undefined);
  const [calculatedNoticeSnapshot, setCalculatedNoticeSnapshot] = useState<
    Habit[]
  >([]);
  const bannerPreviewActive =
    __DEV__ && route.params?.bannerPreviewToken != null;

  const displayName = useMemo(() => getFirstName(profileName), [profileName]);
  const hasCompletedTrackingDay = selectedHabits.some(
    (habit) =>
      habit.calibrationStartedAt != null &&
      habit.calibrationStartedAt < startOfDayMs(new Date()),
  );
  const isBrandNew = logs.length === 0 && !hasCompletedTrackingDay;

  const activeHabitColor = useMemo(() => {
    if (selectedHabitId == null) return "#16A34A";
    return (
      habits.find((habit) => habit.id === selectedHabitId)?.color ?? "#16A34A"
    );
  }, [habits, selectedHabitId]);

  const activeHabitUnit = useMemo(() => {
    if (selectedHabitId == null) return "habit activities";
    return (
      habits.find((habit) => habit.id === selectedHabitId)?.unit?.trim() ||
      "times"
    );
  }, [habits, selectedHabitId]);

  const activeHabit = useMemo(
    () => habits.find((habit) => habit.id === selectedHabitId) ?? null,
    [habits, selectedHabitId],
  );
  const encouragementIcon = activeHabit
    ? cleanHabitIcon(activeHabit.icon)
    : "bulb";
  const activeCurrentGoal = activeHabit
    ? (activeHabit.currentGoal ?? activeHabit.finalTarget)
    : null;
  const activeCurrentGoalPeriod = activeHabit
    ? activeHabit.currentGoal != null
      ? activeHabit.currentGoalPeriod
      : activeHabit.goalPeriod
    : "day";
  const activePlanReady =
    activeHabit?.estimatedBaseline != null &&
    activeHabit.finalTarget != null &&
    activeCurrentGoal != null;
  const missingPlanHabits = useMemo(
    () =>
      selectedHabits.filter(
        (habit) =>
          habit.estimatedBaseline == null ||
          habit.finalTarget == null ||
          habit.currentGoal == null,
      ),
    [selectedHabits],
  );
  const nextGoalHabits = useMemo(
    () =>
      selectedHabits.filter((habit) => {
        const review = cycleReviews[habit.id];
        if (
          !review?.complete ||
          review.result !== "goal_achieved" ||
          review.goalAlreadyAdvanced ||
          habit.currentGoal == null ||
          habit.finalTarget == null
        ) {
          return false;
        }
        const finalInCurrentPeriod =
          (habit.finalTarget / daysInPeriod(habit.goalPeriod)) *
          daysInPeriod(habit.currentGoalPeriod);
        return habit.currentGoal > finalInCurrentPeriod;
      }),
    [cycleReviews, selectedHabits],
  );
  const nextGoalHabit =
    (selectedHabitId == null
      ? nextGoalHabits[0]
      : nextGoalHabits.find((habit) => habit.id === selectedHabitId)) ?? null;
  const recoveryGoalHabits = useMemo(() => {
    const selectedById = new Map(
      selectedHabits.map((habit) => [habit.id, habit]),
    );
    const latestChanges = new Map<number, (typeof goalHistory)[number]>();
    for (const entry of goalHistory) {
      if (!latestChanges.has(entry.habitId)) {
        latestChanges.set(entry.habitId, entry);
      }
    }
    return [...latestChanges.values()]
      .filter(
        (entry) =>
          selectedById.has(entry.habitId) &&
          latestChanges.get(entry.habitId)?.id === entry.id &&
          entry.reason === "recovery" &&
          !acknowledgedRecoveryGoalHistoryIds.includes(entry.id),
      )
      .map((entry) => ({
        habit: selectedById.get(entry.habitId)!,
        goalHistoryId: entry.id,
      }));
  }, [acknowledgedRecoveryGoalHistoryIds, goalHistory, selectedHabits]);
  const recoveryGoalHabit =
    (selectedHabitId == null
      ? recoveryGoalHabits[0]
      : recoveryGoalHabits.find((item) => item.habit.id === selectedHabitId)) ??
    null;
  const newlyCalculatedHabits = useMemo(
    () =>
      selectedHabits.filter(
        (habit) =>
          habit.calibratedBaseline != null &&
          !acknowledgedCalculatedHabitIds.includes(habit.id),
      ),
    [acknowledgedCalculatedHabitIds, selectedHabits],
  );
  const relevantCalculatedHabits = useMemo(
    () =>
      selectedHabitId == null
        ? newlyCalculatedHabits
        : newlyCalculatedHabits.filter((habit) => habit.id === selectedHabitId),
    [newlyCalculatedHabits, selectedHabitId],
  );
  const calculatedNoticeHabits = relevantCalculatedHabits;
  const calculatedNoticeHabitName =
    calculatedNoticeHabits[0]?.name ?? "your habit";
  const previewHabit = activeHabit ?? selectedHabits[0] ?? null;
  const displayedCalculatedNoticeHabits =
    calculatedNoticeHabits.length > 0
      ? calculatedNoticeHabits
      : bannerPreviewActive && previewHabit
        ? [previewHabit]
        : [];
  const displayedCalculatedNoticeCount =
    displayedCalculatedNoticeHabits.length || 1;
  const displayedCalculatedNoticeHabitName =
    displayedCalculatedNoticeHabits[0]?.name ?? calculatedNoticeHabitName;
  const showCalculatedNotice =
    relevantCalculatedHabits.length > 0 ||
    (bannerPreviewActive && previewHabit != null);
  const relevantMissingPlanHabits =
    selectedHabitId == null
      ? missingPlanHabits
      : missingPlanHabits.filter((habit) => habit.id === selectedHabitId);
  const displayedMissingPlanHabits =
    relevantMissingPlanHabits.length > 0
      ? relevantMissingPlanHabits
      : bannerPreviewActive && previewHabit
        ? [previewHabit]
        : [];
  const displayedNextGoalHabit =
    nextGoalHabit ?? (bannerPreviewActive ? previewHabit : null);
  const displayedRecoveryGoalHabit =
    recoveryGoalHabit ??
    (bannerPreviewActive && previewHabit
      ? { habit: previewHabit, goalHistoryId: -1 }
      : null);
  const showMissingPlanBanner = displayedMissingPlanHabits.length > 0;
  const showNextGoalBanner = displayedNextGoalHabit != null;
  const showRecoveryGoalBanner = displayedRecoveryGoalHabit != null;
  const previousWeekForUpdates = getPreviousCycleBounds("week");
  const weeklyReviewHabits = (
    selectedHabitId == null
      ? selectedHabits
      : selectedHabits.filter((habit) => habit.id === selectedHabitId)
  ).filter((habit) => {
    if (bannerPreviewActive) return true;
    const starts = [
      habit.calibrationStartedAt,
      ...logs
        .filter((log) => log.habitId === habit.id)
        .map((log) => log.createdAt),
      ...trackingConfirmations
        .filter(
          (confirmation) =>
            confirmation.habitId === habit.id &&
            confirmation.status !== "not_yet",
        )
        .map((confirmation) => confirmation.periodStart),
    ].filter((value): value is number => value != null);
    const hasFullWeek =
      starts.length > 0 &&
      startOfDayMs(new Date(Math.min(...starts))) <=
        previousWeekForUpdates.startAt;
    const confirmation = trackingConfirmations.find(
      (item) =>
        item.habitId === habit.id &&
        item.period === "week" &&
        item.periodStart === previousWeekForUpdates.startAt,
    );
    const complete =
      confirmation?.status === "everything_logged" ||
      confirmation?.status === "nothing_happened";
    return hasFullWeek && !complete;
  });
  const showWeeklyReviewUpdate = weeklyReviewHabits.length > 0;
  const updatesCount =
    Number(showMissingPlanBanner) +
    Number(showRecoveryGoalBanner) +
    Number(showWeeklyReviewUpdate) +
    Number(showNextGoalBanner) +
    Number(showCalculatedNotice);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setUpdatesOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Updates${updatesCount > 0 ? `, ${updatesCount} available` : ""}`}
          className="mr-3 h-10 w-10 items-center justify-center rounded-full"
          hitSlop={8}
        >
          <Ionicons
            name={updatesCount > 0 ? "notifications" : "notifications-outline"}
            size={24}
            color="#111827"
          />
          {updatesCount > 0 ? (
            <View className="absolute right-0 top-0 min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 py-0.5">
              <Text className="text-[9px] font-black text-white">
                {updatesCount > 9 ? "9+" : updatesCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ),
    });
  }, [navigation, updatesCount]);

  const currentProgress = useMemo(() => {
    if (!activeHabit) return null;

    const now = Date.now();
    const period = activeCurrentGoalPeriod;
    const previous = getPreviousCycleBounds(period, now);
    const currentStart = previous.endAtExclusive;
    const currentAmount = logs
      .filter(
        (log) =>
          log.habitId === activeHabit.id &&
          log.createdAt >= currentStart &&
          log.createdAt <= now,
      )
      .reduce(
        (total, log) =>
          total + (log.didResist === 1 ? 0 : Math.max(0, log.count ?? 1)),
        0,
      );

    let currentDayStart = currentStart;
    let previousSameDayStart = previous.startAt;
    while (addLocalDays(currentDayStart, 1) <= now) {
      currentDayStart = addLocalDays(currentDayStart, 1);
      previousSameDayStart = addLocalDays(previousSameDayStart, 1);
    }
    const timeIntoCurrentDay = now - currentDayStart;
    const previousSamePoint = Math.min(
      previous.endAtExclusive,
      previousSameDayStart + timeIntoCurrentDay,
    );

    const habitConfirmations = trackingConfirmations.filter(
      (confirmation) => confirmation.habitId === activeHabit.id,
    );
    const wholePeriodConfirmed = habitConfirmations.some(
      (confirmation) =>
        period !== "week" &&
        confirmation.period === period &&
        confirmation.periodStart === previous.startAt &&
        confirmation.status !== "not_yet",
    );
    let comparisonIsTrustworthy = wholePeriodConfirmed;
    if (!comparisonIsTrustworthy) {
      comparisonIsTrustworthy = true;
      for (
        let dayStart = previous.startAt;
        dayStart < previousSamePoint;
        dayStart = addLocalDays(dayStart, 1)
      ) {
        const dayIsConfirmed = habitConfirmations.some(
          (confirmation) =>
            confirmation.period === "day" &&
            confirmation.periodStart === dayStart &&
            confirmation.status !== "not_yet",
        );
        if (!dayIsConfirmed) {
          comparisonIsTrustworthy = false;
          break;
        }
      }
    }

    const previousAmount = comparisonIsTrustworthy
      ? logs
          .filter(
            (log) =>
              log.habitId === activeHabit.id &&
              log.createdAt >= previous.startAt &&
              log.createdAt < previousSamePoint,
          )
          .reduce(
            (total, log) =>
              total + (log.didResist === 1 ? 0 : Math.max(0, log.count ?? 1)),
            0,
          )
      : null;
    const difference =
      previousAmount == null ? null : previousAmount - currentAmount;
    const comparisonTime =
      period === "day"
        ? "this time yesterday"
        : period === "week"
          ? "this point last week"
          : "this point last month";
    const comparison =
      difference == null
        ? undefined
        : difference > 0
          ? `${formatAverage(difference)} fewer than ${comparisonTime}`
          : difference < 0
            ? `${formatAverage(Math.abs(difference))} more than ${comparisonTime}`
            : `Same as ${comparisonTime}`;
    const improvementPercent =
      difference != null &&
      difference > 0 &&
      previousAmount != null &&
      previousAmount > 0
        ? Math.round((difference / previousAmount) * 100)
        : null;
    const timeframe =
      period === "day"
        ? "today"
        : period === "week"
          ? "this week"
          : "this month";

    return {
      value: formatAverage(currentAmount),
      sub: `${unitForValue(activeHabitUnit, currentAmount)} ${timeframe}`,
      currentAmount,
      timeframe,
      comparison,
      difference,
      improvementPercent,
    };
  }, [
    activeCurrentGoalPeriod,
    activeHabit,
    activeHabitUnit,
    logs,
    trackingConfirmations,
  ]);

  useEffect(() => {
    const resetToken = route.params?.resetToken;
    if (!resetToken) return;
    if (handledResetTokenRef.current === resetToken) return;

    handledResetTokenRef.current = resetToken;
    setSelectedHabitId(null);
    setUpdatesOpen(false);
    setCalculatedNoticeOpen(false);
    if (route.params?.bannerPreviewToken != null) {
      navigation.setParams({ bannerPreviewToken: undefined });
    }

    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      habitChipsScrollRef.current?.scrollTo({ x: 0, animated: true });
    });
  }, [navigation, route.params?.bannerPreviewToken, route.params?.resetToken]);

  const habitOptions = selectedHabits;

  useEffect(() => {
    if (selectedHabitId == null) return;

    const stillExists = habitOptions.some(
      (habit) => habit.id === selectedHabitId,
    );
    if (!stillExists) {
      setSelectedHabitId(null);
    }
  }, [habitOptions, selectedHabitId]);

  const stats = useMemo(() => {
    const selectedHabitIds = new Set(selectedHabits.map((habit) => habit.id));
    const logsForStats =
      selectedHabitId == null
        ? logs.filter((log) => selectedHabitIds.has(log.habitId))
        : logs.filter((l) => l.habitId === selectedHabitId);

    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const todayStart = startOfDayMs(now);
    const tomorrowStart = todayStart + dayMs;

    const weekStart = startOfWeekMs(now);
    const daysSoFarThisWeek = Math.floor((todayStart - weekStart) / dayMs) + 1;

    const todaysLogs = logsForStats.filter(
      (l) => l.createdAt >= todayStart && l.createdAt < tomorrowStart,
    );

    const weekLogsArr = logsForStats.filter((l) => l.createdAt >= weekStart);

    const todayLogs = todaysLogs.length;

    const todayResists = todaysLogs.reduce(
      (acc, l) => acc + (l.didResist === 1 ? 1 : 0),
      0,
    );

    const weekLogs = weekLogsArr.length;

    const weekResists = weekLogsArr.reduce(
      (acc, l) => acc + (l.didResist === 1 ? 1 : 0),
      0,
    );

    const weekResistRate =
      weekLogs > 0 ? Math.round((weekResists / weekLogs) * 100) : 0;

    const todayResistRate =
      todayLogs > 0 ? Math.round((todayResists / todayLogs) * 100) : 0;

    const logsBeforeToday = logsForStats.filter(
      (l) => l.createdAt < todayStart,
    );

    const todayGiveIns = todaysLogs.reduce(
      (total, log) =>
        total + (log.didResist === 1 ? 0 : Math.max(0, log.count ?? 1)),
      0,
    );
    const twoWeeksAgoStart = todayStart - 14 * dayMs;

    const firstLogBeforeToday = logsBeforeToday.reduce<number | null>(
      (earliest, log) => {
        const logDay = startOfDayMs(new Date(log.createdAt));
        if (earliest == null) return logDay;
        return Math.min(earliest, logDay);
      },
      null,
    );

    const trackingStartBeforeToday =
      selectedHabitId != null && activeHabit?.calibrationStartedAt != null
        ? Math.min(
            startOfDayMs(new Date(activeHabit.calibrationStartedAt)),
            firstLogBeforeToday ?? Number.POSITIVE_INFINITY,
          )
        : firstLogBeforeToday;
    const hasTwoWeeksOfData =
      trackingStartBeforeToday != null &&
      trackingStartBeforeToday <= twoWeeksAgoStart;

    const comparisonStart = hasTwoWeeksOfData
      ? twoWeeksAgoStart
      : trackingStartBeforeToday;

    const comparisonLogs = comparisonStart
      ? logsForStats.filter(
          (l) => l.createdAt >= comparisonStart && l.createdAt < todayStart,
        )
      : [];

    let comparisonDays = new Set(
      comparisonLogs.map((log) => startOfDayMs(new Date(log.createdAt))),
    ).size;
    if (selectedHabitId != null && comparisonStart != null) {
      comparisonDays = 0;
      for (let dayStart = comparisonStart; dayStart < todayStart; ) {
        const markedUnknown = trackingConfirmations.some(
          (confirmation) =>
            confirmation.habitId === selectedHabitId &&
            confirmation.period === "day" &&
            confirmation.periodStart === dayStart &&
            confirmation.status === "not_yet",
        );
        if (!markedUnknown) comparisonDays += 1;
        dayStart = addLocalDays(dayStart, 1);
      }
    }

    const comparisonTotalLogs = comparisonLogs.length;
    const comparisonTotalResists = comparisonLogs.reduce(
      (acc, l) => acc + (l.didResist === 1 ? 1 : 0),
      0,
    );
    const comparisonTotalGiveIns = comparisonLogs.reduce(
      (total, log) =>
        total + (log.didResist === 1 ? 0 : Math.max(0, log.count ?? 1)),
      0,
    );

    const averageLogs =
      comparisonDays > 0 ? comparisonTotalLogs / comparisonDays : 0;
    const averageResists =
      comparisonDays > 0 ? comparisonTotalResists / comparisonDays : 0;
    const averageGiveIns =
      comparisonDays > 0 ? comparisonTotalGiveIns / comparisonDays : 0;
    const averageWeekToDateLogs = averageLogs * daysSoFarThisWeek;
    const averageWeekToDateResists = averageResists * daysSoFarThisWeek;
    return {
      todayLogs,
      weekLogs,
      todayResists,
      weekResists,
      todayGiveIns,
      averageLogs,
      averageResists,
      averageGiveIns,
      averageWeekToDateLogs,
      averageWeekToDateResists,
      comparisonDays,
      weekResistRate,
      todayResistRate,
    };
  }, [
    logs,
    selectedHabitId,
    activeHabit,
    trackingConfirmations,
    selectedHabits,
  ]);

  const positiveFeedback = useMemo(() => {
    if (
      selectedHabitId != null &&
      currentProgress?.difference != null &&
      currentProgress.difference > 0 &&
      currentProgress.comparison
    ) {
      return {
        title:
          currentProgress.currentAmount === 0
            ? "You Stayed on Track"
            : "Less Habit Activity",
        text:
          currentProgress.currentAmount === 0
            ? `Excellent work! No habit activity has been logged ${currentProgress.timeframe}, ${currentProgress.comparison}.`
            : `Great job! You logged ${currentProgress.value} ${currentProgress.sub}, ${currentProgress.comparison}.`,
      };
    }

    if (stats.comparisonDays === 0 && stats.todayLogs === 0) {
      const dayNumber = Math.floor(startOfDayMs(new Date()) / 86_400_000);
      const habitOffset = selectedHabitId ?? 0;
      const quote =
        MOTIVATIONAL_QUOTES[
          Math.abs(dayNumber + habitOffset) % MOTIVATIONAL_QUOTES.length
        ];

      return {
        title: "A Thought for Today",
        text: quote.attribution
          ? `“${quote.text}” — ${quote.attribution}`
          : quote.text,
      };
    }

    const averageGiveInsText = formatAverage(stats.averageGiveIns);
    const todayActivityUnit =
      stats.todayGiveIns === 1
        ? activeHabitUnit === "times"
          ? "time"
          : activeHabitUnit === "minutes"
            ? "minute"
            : activeHabitUnit === "habit activities"
              ? "habit activity"
              : activeHabitUnit
        : activeHabitUnit;
    const averageResistsText = formatAverage(stats.averageResists);
    const averageLogsText = formatAverage(stats.averageLogs);
    const comparisonText =
      stats.comparisonDays >= 14
        ? "the past 2 weeks"
        : stats.comparisonDays > 0
          ? `${stats.comparisonDays} ${
              stats.comparisonDays === 1 ? "day" : "days"
            } before today`
          : "your previous days";

    if (stats.todayGiveIns === 0) {
      if (stats.todayLogs > 0) {
        return {
          title: "You Stayed on Track",
          text: `Excellent work! You logged ${stats.todayLogs} ${
            stats.todayLogs === 1 ? "urge" : "urges"
          } today with no habit activity, below your usual ${averageGiveInsText} per day from ${comparisonText}.`,
        };
      }

      return {
        title: "You Stayed on Track",
        text: `Excellent work! No habit activity has been logged today, compared with your usual ${averageGiveInsText} per day from ${comparisonText}.`,
      };
    }

    if (stats.todayGiveIns > 0 && stats.todayGiveIns < stats.averageGiveIns) {
      return {
        title: "Less Habit Activity Than Usual",
        text: `Great job! You logged ${stats.todayGiveIns} ${todayActivityUnit} today, below your usual ${averageGiveInsText} per day from ${comparisonText}.`,
      };
    }

    if (
      stats.todayGiveIns > stats.averageGiveIns &&
      stats.todayResists > stats.averageResists
    ) {
      return {
        title: "You Resisted More than Usual",
        text: `Strong effort! You resisted ${stats.todayResists} ${
          stats.todayResists === 1 ? "urge" : "urges"
        } today, above your usual ${averageResistsText} per day from ${comparisonText}.`,
      };
    }

    if (
      stats.todayResists < stats.averageResists &&
      stats.todayLogs > stats.averageLogs
    ) {
      return {
        title: "You Were More Aware than Usual",
        text: `Good awareness! You logged ${stats.todayLogs} ${
          stats.todayLogs === 1 ? "time" : "times"
        } today, above your usual ${averageLogsText} per day from ${comparisonText}.`,
      };
    }

    if (stats.todayResists > 1) {
      return {
        title: "You Resisted",
        text: `Solid progress! You resisted ${stats.todayResists} urges today. Every resist interrupts the pattern.`,
      };
    }

    if (stats.todayLogs > 1) {
      return {
        title: "You Were Aware",
        text: `Nice follow-through! You checked in ${stats.todayLogs} times today and kept the habit visible.`,
      };
    }

    return {
      title: "You Stayed Engaged",
      text: "You showed up! You noticed the moment instead of ignoring it.",
    };
  }, [
    stats.averageGiveIns,
    stats.averageLogs,
    stats.averageResists,
    stats.comparisonDays,
    stats.todayGiveIns,
    activeHabitUnit,
    stats.todayLogs,
    stats.todayResists,
    currentProgress,
    selectedHabitId,
  ]);

  const StatTile = ({
    label,
    value,
    icon,
    sub,
    labelAtBottom = false,
    percentIncrease,
    accentColor = "#16A34A",
  }: {
    label: string;
    value: string;
    icon: keyof typeof Ionicons.glyphMap;
    sub?: string;
    labelAtBottom?: boolean;
    percentIncrease?: number | null;
    accentColor?: string;
  }) => (
    <View
      className="flex-1 rounded-3xl border border-gray-200 bg-white p-3 shadow-sm"
      style={{ height: 112 }}
    >
      <View className="flex-row items-start justify-between">
        <View className="h-9 w-9 items-center justify-center rounded-3xl border border-gray-200 bg-white">
          <Ionicons name={icon} size={19} color="#000000" />
        </View>

        {percentIncrease != null ? (
          <View
            className={
              labelAtBottom
                ? "min-w-[50px] items-center rounded-full px-2 py-0.5"
                : "rounded-full px-2 py-0.5"
            }
            style={{ backgroundColor: accentColor }}
          >
            <Text className="text-[11px] font-black text-white">
              ↑ {percentIncrease}%
            </Text>
          </View>
        ) : labelAtBottom ? (
          <View
            className="min-w-[50px] rounded-full px-2 py-0.5"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text className="text-[11px] font-black text-transparent">
              ↑ 100%
            </Text>
          </View>
        ) : null}
      </View>

      <Text
        className="mt-1 text-center text-3xl font-black leading-9 text-black"
        style={{
          transform: [{ translateY: labelAtBottom ? -14 : -8 }],
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.65}
      >
        {value}
      </Text>

      {labelAtBottom ? (
        <View style={{ transform: [{ translateY: -8 }] }}>
          {sub ? (
            <Text
              className="mt-1 text-center text-[11px] font-semibold text-gray-500"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {sub}
            </Text>
          ) : null}
          <Text
            className="mt-0.5 text-center text-[11px] font-black uppercase tracking-wide text-gray-500"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {label}
          </Text>
        </View>
      ) : (
        <>
          <Text
            className="mt-1 text-center text-[11px] font-black uppercase tracking-wide text-gray-500"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {label}
          </Text>
          {sub ? (
            <Text
              className="mt-0.5 text-center text-[11px] font-semibold text-gray-500"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {sub}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );

  const Chip = ({
    label,
    selected,
    onPress,
  }: {
    label: string;
    selected: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      className="mr-2 rounded-full border px-3.5 py-2"
      style={{
        borderColor: selected ? activeHabitColor : "#E5E7EB",
        backgroundColor: selected ? activeHabitColor : "#FFFFFF",
      }}
    >
      <Text
        className={[
          "text-sm font-black",
          selected ? "text-white" : "text-black",
        ].join(" ")}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );

  const dismissCalculatedNotice = async () => {
    setCalculatedNoticeOpen(false);
    if (!bannerPreviewActive && calculatedNoticeSnapshot.length > 0) {
      await acknowledgeCalculatedHabits(
        calculatedNoticeSnapshot.map((habit) => habit.id),
      );
    }
  };

  return (
    <Screen
      scroll
      scrollViewRef={scrollViewRef}
      scrollViewProps={{
        showsVerticalScrollIndicator: false,
        contentContainerStyle: {
          paddingHorizontal: 20,
          paddingTop: 42,
          paddingBottom: 28,
          flexGrow: 1,
        },
      }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-4">
          <Text className="text-sm font-black uppercase tracking-widest text-green-600">
            Reflex
          </Text>

          <Text
            className="mt-1 text-3xl font-black leading-9 text-black"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
          >
            {isBrandNew
              ? `Welcome, ${displayName}`
              : `Welcome back, ${displayName}`}
          </Text>
        </View>

        <View>
          {profilePhotoUri ? (
            <View className="rounded-full border-4 border-green-600 bg-white shadow-sm">
              <Image
                source={{ uri: profilePhotoUri }}
                className="h-16 w-16 rounded-full"
                resizeMode="cover"
              />
            </View>
          ) : (
            <View className="h-16 w-16 items-center justify-center rounded-full border-4 border-green-600 bg-white shadow-sm">
              <Ionicons name="person" size={27} color="#000000" />
            </View>
          )}
        </View>
      </View>

      {isBrandNew ? (
        <>
          <View className="mt-5 rounded-[32px] border border-gray-200 bg-gray-50 p-5 shadow-sm">
            <View className="items-center">
              <View className="h-16 w-16 items-center justify-center rounded-full border border-gray-200 bg-white">
                <Ionicons name="create" size={30} color="#000000" />
              </View>

              <Text className="mt-5 text-center text-2xl font-black text-black">
                No logs yet.
              </Text>

              <Text className="mt-2 text-center text-base font-bold leading-6 text-gray-500">
                Every time you get the urge to do the habit, log it here. Start
                by logging one urge.
              </Text>

              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
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
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
        </>
      ) : (
        <>
          <View className="mt-5 flex-row gap-3">
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                navigation.navigate("Log");
              }}
              className="flex-1 rounded-3xl bg-green-600 px-5 py-3.5 shadow-sm"
            >
              <View className="flex-row items-center justify-center">
                <Ionicons name="add-circle" size={22} color="#FFFFFF" />
                <Text className="ml-2 text-center text-base font-black text-white">
                  Log Check-In
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                navigation.navigate("ShopPicker", { showDoneButton: true });
              }}
              className="rounded-3xl border border-gray-200 bg-gray-50 px-5 py-3.5 shadow-sm"
            >
              <Ionicons name="bag-handle" size={24} color="#000000" />
            </Pressable>
          </View>

          <View className="mt-5 rounded-[28px] border border-gray-200 bg-gray-50 p-4 shadow-sm">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-lg font-black text-black">Dashboard</Text>
              </View>

              <View className="flex-row items-center gap-2">
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    navigation.navigate("ManageList", { type: "habits" });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Manage habits"
                  accessibilityHint="Opens the habit editor"
                  hitSlop={6}
                  className="h-10 w-10 items-center justify-center rounded-3xl border border-gray-200 bg-white"
                >
                  <FontAwesome5
                    name="pencil-alt"
                    size={19}
                    color="#111827"
                    solid
                  />
                </Pressable>
              </View>
            </View>

            <ScrollView
              ref={habitChipsScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mt-4"
            >
              <Chip
                label="Overall"
                selected={selectedHabitId === null}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedHabitId(null);
                }}
              />

              {habitOptions.map((habit: Habit) => (
                <Chip
                  key={habit.id}
                  label={habit.name}
                  selected={selectedHabitId === habit.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedHabitId(habit.id);
                  }}
                />
              ))}
            </ScrollView>

            <View className="mt-4 rounded-3xl border border-gray-200 bg-white p-3 shadow-sm">
              <View className="flex-row items-center">
                <View
                  className="h-9 w-9 items-center justify-center rounded-3xl border bg-white"
                  style={{ borderColor: "#E5E7EB" }}
                >
                  <Ionicons
                    name={encouragementIcon}
                    size={20}
                    color={activeHabitColor}
                  />
                </View>

                <View className="ml-3 flex-1">
                  <Text className="text-sm font-black text-black">
                    {positiveFeedback.title}
                  </Text>

                  <Text className="mt-0.5 text-xs font-semibold leading-4 text-gray-500">
                    {positiveFeedback.text}
                  </Text>
                </View>
              </View>
            </View>

            {selectedHabitId === null ? (
              <>
                <View className="mt-4 flex-row gap-3">
                  <StatTile
                    accentColor={activeHabitColor}
                    label="Resists this week"
                    value={`${stats.weekResists}`}
                    icon="trophy"
                    percentIncrease={getPercentIncrease(
                      stats.weekResists,
                      stats.averageWeekToDateResists,
                    )}
                  />

                  <StatTile
                    accentColor={activeHabitColor}
                    label="Logs this week"
                    value={`${stats.weekLogs}`}
                    icon="calendar"
                    percentIncrease={getPercentIncrease(
                      stats.weekLogs,
                      stats.averageWeekToDateLogs,
                    )}
                  />
                </View>

                <View className="mt-3 flex-row gap-3">
                  <StatTile
                    accentColor={activeHabitColor}
                    label="Resists today"
                    value={`${stats.todayResists}`}
                    icon="shield-checkmark"
                    percentIncrease={getPercentIncrease(
                      stats.todayResists,
                      stats.averageResists,
                    )}
                  />

                  <StatTile
                    accentColor={activeHabitColor}
                    label="Logs today"
                    value={`${stats.todayLogs}`}
                    icon="create"
                    percentIncrease={getPercentIncrease(
                      stats.todayLogs,
                      stats.averageLogs,
                    )}
                  />
                </View>
              </>
            ) : (
              <>
                {activePlanReady ? (
                  <View className="mt-4 flex-row gap-3">
                    <StatTile
                      accentColor={activeHabitColor}
                      label="Current progress"
                      labelAtBottom
                      value={currentProgress?.value ?? "0"}
                      sub={currentProgress?.sub}
                      icon="pulse"
                      percentIncrease={currentProgress?.improvementPercent}
                    />

                    <StatTile
                      accentColor={activeHabitColor}
                      label="Current goal"
                      labelAtBottom
                      value={formatAverage(activeCurrentGoal)}
                      sub={`${unitForValue(
                        activeHabitUnit,
                        activeCurrentGoal,
                      )} ${currentPeriodLabel(activeCurrentGoalPeriod)}`}
                      icon="flag"
                    />
                  </View>
                ) : (
                  <Pressable
                    onPress={() =>
                      navigation.navigate("ManageList", { type: "habits" })
                    }
                    className="mt-4 rounded-3xl border border-green-200 bg-green-50 px-4 py-4"
                  >
                    <Text className="text-center text-sm font-black text-green-700">
                      Finish habit setup
                    </Text>
                  </Pressable>
                )}

                <View className="mt-3 flex-row gap-3">
                  <StatTile
                    accentColor={activeHabitColor}
                    label="Resists today"
                    value={`${stats.todayResists}`}
                    icon="shield-checkmark"
                    percentIncrease={getPercentIncrease(
                      stats.todayResists,
                      stats.averageResists,
                    )}
                  />

                  <StatTile
                    accentColor={activeHabitColor}
                    label="Logs today"
                    value={`${stats.todayLogs}`}
                    icon="create"
                    percentIncrease={getPercentIncrease(
                      stats.todayLogs,
                      stats.averageLogs,
                    )}
                  />
                </View>
              </>
            )}
          </View>
        </>
      )}

      <TrackingReviewLauncher
        placement="home"
        habitId={
          bannerPreviewActive ? (previewHabit?.id ?? null) : selectedHabitId
        }
        previewOnly={bannerPreviewActive}
        hideLauncher
        openToken={weeklyReviewOpenToken}
      />

      <Modal
        visible={updatesOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setUpdatesOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
          <View className="flex-row items-center justify-between border-b border-gray-200 px-5 py-4">
            <View className="flex-1 pr-4">
              <Text className="text-xs font-black uppercase tracking-widest text-green-600">
                Reflex
              </Text>
              <Text className="mt-1 text-2xl font-black text-black">
                Updates
              </Text>
            </View>
            <Pressable
              onPress={() => setUpdatesOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Close updates"
              className="h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white"
            >
              <Ionicons name="close" size={20} color="#000000" />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 20,
              paddingBottom: 32,
            }}
            showsVerticalScrollIndicator={false}
          >
            {bannerPreviewActive ? (
              <View className="mb-3 flex-row items-center rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3">
                <Ionicons name="construct" size={19} color="#7C3AED" />
                <Text className="ml-3 flex-1 text-xs font-bold leading-4 text-purple-800">
                  Preview mode uses safe sample updates and will not save
                  changes.
                </Text>
              </View>
            ) : null}

            {updatesCount === 0 ? (
              <View className="items-center rounded-[28px] border border-gray-200 bg-gray-50 p-6">
                <View className="h-14 w-14 items-center justify-center rounded-full bg-white">
                  <Ionicons name="checkmark-circle" size={29} color="#16A34A" />
                </View>
                <Text className="mt-3 text-lg font-black text-black">
                  You’re all caught up
                </Text>
                <Text className="mt-1 text-center text-sm font-semibold leading-5 text-gray-500">
                  New reviews and progress updates will appear here.
                </Text>
              </View>
            ) : null}

            {showMissingPlanBanner ? (
              <Pressable
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const habit = displayedMissingPlanHabits[0];
                  if (!habit) return;
                  setUpdatesOpen(false);
                  setTimeout(() => {
                    navigation.navigate("ManageList", {
                      type: "habits",
                      habitId: habit.id,
                      setupMissingPlans: true,
                      previewOnly: bannerPreviewActive,
                    });
                  }, 250);
                }}
                className="mb-3 flex-row items-center rounded-3xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <View className="h-10 w-10 items-center justify-center rounded-2xl bg-amber-50">
                  <Ionicons name="options" size={19} color="#B45309" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-black text-gray-950">
                    Finish setting up your goals
                  </Text>
                  <Text className="mt-0.5 text-xs font-semibold leading-4 text-gray-600">
                    {displayedMissingPlanHabits.length === 1
                      ? `Add amounts for ${displayedMissingPlanHabits[0].name}`
                      : `Add amounts for ${displayedMissingPlanHabits.length} habits`}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#B45309" />
              </Pressable>
            ) : null}

            {showRecoveryGoalBanner ? (
              <Pressable
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (!displayedRecoveryGoalHabit) return;
                  if (!bannerPreviewActive) {
                    await acknowledgeRecoveryGoal(
                      displayedRecoveryGoalHabit.goalHistoryId,
                    );
                  }
                  setUpdatesOpen(false);
                  setTimeout(() => {
                    navigation.navigate("ManageList", {
                      type: "habits",
                      habitId: displayedRecoveryGoalHabit.habit.id,
                      openGoal: true,
                      previewOnly: bannerPreviewActive,
                      previewGoalKind: bannerPreviewActive
                        ? "recovery"
                        : undefined,
                    });
                  }, 250);
                }}
                className="mb-3 flex-row items-center rounded-3xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <View className="h-10 w-10 items-center justify-center rounded-2xl bg-blue-50">
                  <Ionicons name="heart" size={19} color="#2563EB" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-black text-gray-950">
                    Your current goal was updated
                  </Text>
                  <Text className="mt-0.5 text-xs font-semibold leading-4 text-gray-600">
                    {`We adjusted ${displayedRecoveryGoalHabit.habit.name}’s next step based on recent progress.`}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss goal update"
                  hitSlop={8}
                  onPress={(event) => {
                    event.stopPropagation();
                    if (!bannerPreviewActive) {
                      void acknowledgeRecoveryGoal(
                        displayedRecoveryGoalHabit.goalHistoryId,
                      );
                    }
                  }}
                  className="ml-2 h-9 w-9 items-center justify-center rounded-full"
                >
                  <Ionicons name="close" size={22} color="#2563EB" />
                </Pressable>
              </Pressable>
            ) : null}

            {showWeeklyReviewUpdate ? (
              <Pressable
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setUpdatesOpen(false);
                  setTimeout(() => setWeeklyReviewOpenToken(Date.now()), 250);
                }}
                className="mb-3 flex-row items-center rounded-3xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <View className="h-10 w-10 items-center justify-center rounded-2xl bg-teal-50">
                  <Ionicons name="calendar-outline" size={19} color="#0F766E" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-black text-black">
                    {weeklyReviewHabits.length === 1
                      ? "Last week is ready to review"
                      : `${weeklyReviewHabits.length} weekly reviews are ready`}
                  </Text>
                  <Text className="mt-0.5 text-xs font-semibold text-gray-500">
                    About 1 minute
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#0F766E" />
              </Pressable>
            ) : null}

            {showNextGoalBanner ? (
              <Pressable
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (!displayedNextGoalHabit) return;
                  if (!bannerPreviewActive) {
                    await proposeNextGoal(displayedNextGoalHabit.id);
                  }
                  setUpdatesOpen(false);
                  setTimeout(() => {
                    navigation.navigate("ManageList", {
                      type: "habits",
                      habitId: displayedNextGoalHabit.id,
                      openGoal: true,
                      previewOnly: bannerPreviewActive,
                      previewGoalKind: bannerPreviewActive ? "next" : undefined,
                    });
                  }, 250);
                }}
                className="mb-3 flex-row items-center rounded-3xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <View className="h-10 w-10 items-center justify-center rounded-2xl bg-green-50">
                  <Ionicons name="flag" size={19} color="#16A34A" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-black text-gray-950">
                    Your next goal is ready
                  </Text>
                  <Text className="mt-0.5 text-xs font-semibold text-gray-600">
                    Review the next step for {displayedNextGoalHabit.name}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#16A34A" />
              </Pressable>
            ) : null}

            {showCalculatedNotice ? (
              <Pressable
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const snapshot = displayedCalculatedNoticeHabits.map(
                    (habit) => {
                      if (!bannerPreviewActive) return habit;
                      const estimated = habit.estimatedBaseline ?? 10;
                      return {
                        ...habit,
                        estimatedBaseline: estimated,
                        calibratedBaseline:
                          habit.calibratedBaseline ??
                          Math.max(0, Math.round(estimated * 0.8)),
                      };
                    },
                  );
                  setCalculatedNoticeSnapshot(snapshot);
                  setUpdatesOpen(false);
                  setTimeout(() => setCalculatedNoticeOpen(true), 250);
                }}
                className="mb-3 flex-row items-center rounded-3xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <View className="h-10 w-10 items-center justify-center rounded-2xl bg-purple-50">
                  <Ionicons name="calculator" size={19} color="#7C3AED" />
                </View>
                <View className="ml-3 flex-1">
                  <Text
                    className="text-sm font-black text-black"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.82}
                  >
                    {displayedCalculatedNoticeCount === 1
                      ? "Your calculated average is ready"
                      : `${displayedCalculatedNoticeCount} calculated averages are ready`}
                  </Text>
                  <Text className="mt-0.5 text-xs font-semibold text-gray-500">
                    {displayedCalculatedNoticeCount === 1
                      ? `See what changed for ${displayedCalculatedNoticeHabitName}`
                      : "See how your estimates compare"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#7C3AED" />
              </Pressable>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={calculatedNoticeOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => void dismissCalculatedNotice()}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
          <View className="flex-row items-center justify-between border-b border-gray-200 px-5 py-4">
            <View className="flex-1 pr-4">
              <Text className="text-xs font-black uppercase tracking-widest text-purple-600">
                Progress update
              </Text>
              <Text className="mt-1 text-2xl font-black text-black">
                Your Current Amount
              </Text>
            </View>
            <Pressable
              onPress={() => void dismissCalculatedNotice()}
              accessibilityRole="button"
              accessibilityLabel="Close current amount update"
              className="h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white"
            >
              <Ionicons name="close" size={20} color="#000000" />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 20,
              paddingBottom: 32,
            }}
            showsVerticalScrollIndicator={false}
          >
            <Text className="text-base font-bold leading-6 text-gray-600">
              Reflex has enough tracking data to replace your starting estimate
              with your calculated average.
            </Text>

            {calculatedNoticeSnapshot.length > 0 ? (
              <View className="mt-5 gap-3">
                {calculatedNoticeSnapshot.map((habit) => {
                  const estimatedAmount = habit.estimatedBaseline;
                  const calculatedAmount =
                    habit.calibratedBaseline ??
                    baselineSummaries[habit.id]?.recent ??
                    estimatedAmount;
                  const displayedEstimatedAmount =
                    estimatedAmount == null
                      ? null
                      : Math.round(estimatedAmount);
                  const displayedCalculatedAmount =
                    calculatedAmount == null
                      ? null
                      : Math.round(calculatedAmount);
                  const estimatedUnit =
                    displayedEstimatedAmount == null
                      ? habit.unit
                      : unitForValue(habit.unit, displayedEstimatedAmount);
                  const calculatedUnit =
                    displayedCalculatedAmount == null
                      ? habit.unit
                      : unitForValue(habit.unit, displayedCalculatedAmount);

                  return (
                    <View
                      key={habit.id}
                      className="rounded-[28px] border border-gray-200 bg-gray-50 p-4"
                    >
                      <View className="flex-row items-center">
                        <View className="h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white">
                          <Ionicons
                            name={cleanHabitIcon(habit.icon)}
                            size={21}
                            color={habit.color}
                          />
                        </View>
                        <Text className="ml-3 flex-1 text-lg font-black text-black">
                          {habit.name}
                        </Text>
                      </View>

                      <View className="mt-4 flex-row items-stretch gap-3">
                        <View className="flex-1 rounded-3xl border border-gray-200 bg-white p-4">
                          <Text className="text-xs font-black uppercase tracking-wide text-gray-500">
                            Estimated Before
                          </Text>
                          <Text className="mt-2 text-3xl font-black text-black">
                            {displayedEstimatedAmount == null
                              ? "—"
                              : displayedEstimatedAmount}
                          </Text>
                          <Text className="mt-1 text-xs font-bold leading-4 text-gray-500">
                            {`${estimatedUnit} ${periodRateLabel(habit.baselinePeriod)}`}
                          </Text>
                        </View>

                        <View className="flex-1 rounded-3xl border border-purple-200 bg-purple-50 p-4">
                          <Text className="text-xs font-black uppercase tracking-wide text-purple-700">
                            Calculated Now
                          </Text>
                          <Text className="mt-2 text-3xl font-black text-black">
                            {displayedCalculatedAmount == null
                              ? "—"
                              : displayedCalculatedAmount}
                          </Text>
                          <Text className="mt-1 text-xs font-bold leading-4 text-gray-600">
                            {`${calculatedUnit} ${periodRateLabel(habit.baselinePeriod)}`}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}

            <Text className="mt-5 text-center text-sm font-bold leading-5 text-gray-500">
              Your dashboard and goals will now use the calculated amount.
            </Text>

            <Pressable
              onPress={() => void dismissCalculatedNotice()}
              className="mt-5 rounded-3xl bg-purple-600 px-5 py-4"
            >
              <Text className="text-center text-base font-black text-white">
                Done
              </Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}
