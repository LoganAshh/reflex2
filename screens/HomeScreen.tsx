import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  Keyboard,
  Modal,
  Platform,
  ActionSheetIOS,
  Alert,
  SafeAreaView,
  TextInput,
  type LayoutChangeEvent,
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
import { CALIBRATION_RULES } from "../data/baselines";
import {
  calculateInitialCurrentGoal,
  calculateNextReductionGoal,
  normalizeGoalAmount,
} from "../data/goals";

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

function useActiveChipScroller(activeId: number | null, visible: boolean) {
  const scrollRef = useRef<ScrollView | null>(null);
  const viewportWidthRef = useRef(0);
  const layoutsRef = useRef<Record<number, { x: number; width: number }>>({});
  const pendingScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const scrollIntoView = (id: number, animated = true) => {
    const layout = layoutsRef.current[id];
    const viewportWidth = viewportWidthRef.current;
    if (!layout || viewportWidth <= 0) return;

    scrollRef.current?.scrollTo({
      x: Math.max(0, layout.x - (viewportWidth - layout.width) / 2),
      animated,
    });
  };

  const scheduleScrollIntoView = (id: number, animated = true) => {
    if (pendingScrollTimerRef.current != null) {
      clearTimeout(pendingScrollTimerRef.current);
    }
    pendingScrollTimerRef.current = setTimeout(() => {
      pendingScrollTimerRef.current = null;
      scrollIntoView(id, animated);
    }, 40);
  };

  useEffect(() => {
    if (!visible || activeId == null) return;
    scheduleScrollIntoView(activeId);
    return () => {
      if (pendingScrollTimerRef.current != null) {
        clearTimeout(pendingScrollTimerRef.current);
        pendingScrollTimerRef.current = null;
      }
    };
  }, [activeId, visible]);

  const onViewportLayout = (event: LayoutChangeEvent) => {
    viewportWidthRef.current = event.nativeEvent.layout.width;
    if (activeId != null) scheduleScrollIntoView(activeId, false);
  };

  const onChipLayout = (
    id: number,
    selected: boolean,
    event: LayoutChangeEvent,
  ) => {
    layoutsRef.current[id] = {
      x: event.nativeEvent.layout.x,
      width: event.nativeEvent.layout.width,
    };
    if (selected) scheduleScrollIntoView(id);
  };

  return { scrollRef, onViewportLayout, onChipLayout };
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
    updateHabitPlan,
    proposeNextGoal,
    approveProposedGoal,
    dismissProposedGoal,
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
  const [activeCalculatedHabitId, setActiveCalculatedHabitId] = useState<
    number | null
  >(null);
  const [reviewedCalculatedHabitIds, setReviewedCalculatedHabitIds] = useState<
    number[]
  >([]);
  const [missingPlanReviewOpen, setMissingPlanReviewOpen] = useState(false);
  const [missingPlanSnapshot, setMissingPlanSnapshot] = useState<Habit[]>([]);
  const [activeMissingPlanHabitId, setActiveMissingPlanHabitId] = useState<
    number | null
  >(null);
  const [reviewedMissingPlanHabitIds, setReviewedMissingPlanHabitIds] =
    useState<number[]>([]);
  const [missingPlanStartingAmount, setMissingPlanStartingAmount] =
    useState("");
  const [missingPlanGoalAmount, setMissingPlanGoalAmount] = useState("");
  const [missingPlanMeasurementType, setMissingPlanMeasurementType] = useState<
    "times" | "minutes"
  >("times");
  const [missingPlanPeriod, setMissingPlanPeriod] =
    useState<Habit["goalPeriod"]>("week");
  const [missingPlanError, setMissingPlanError] = useState("");
  const [savingMissingPlan, setSavingMissingPlan] = useState(false);
  const missingPlanGoalInputRef = useRef<TextInput | null>(null);
  const [recoveryGoalReviewOpen, setRecoveryGoalReviewOpen] = useState(false);
  const [recoveryGoalSnapshot, setRecoveryGoalSnapshot] = useState<
    {
      habit: Habit;
      goalHistoryId: number;
      previousAmount: number | null;
      amount: number;
      period: Habit["goalPeriod"];
    }[]
  >([]);
  const [activeRecoveryGoalHabitId, setActiveRecoveryGoalHabitId] = useState<
    number | null
  >(null);
  const [reviewedRecoveryGoalHabitIds, setReviewedRecoveryGoalHabitIds] =
    useState<number[]>([]);
  const [nextGoalReviewOpen, setNextGoalReviewOpen] = useState(false);
  const [nextGoalSnapshot, setNextGoalSnapshot] = useState<Habit[]>([]);
  const [activeNextGoalHabitId, setActiveNextGoalHabitId] = useState<
    number | null
  >(null);
  const [reviewedNextGoalHabitIds, setReviewedNextGoalHabitIds] = useState<
    number[]
  >([]);
  const [nextGoalDecisions, setNextGoalDecisions] = useState<
    Record<number, "approve" | "later">
  >({});
  const [nextGoalActionBusy, setNextGoalActionBusy] = useState(false);
  const bannerPreviewActive =
    __DEV__ && route.params?.bannerPreviewToken != null;
  const missingPlanChipScroller = useActiveChipScroller(
    activeMissingPlanHabitId,
    missingPlanReviewOpen,
  );
  const recoveryGoalChipScroller = useActiveChipScroller(
    activeRecoveryGoalHabitId,
    recoveryGoalReviewOpen,
  );
  const nextGoalChipScroller = useActiveChipScroller(
    activeNextGoalHabitId,
    nextGoalReviewOpen,
  );
  const calculatedNoticeChipScroller = useActiveChipScroller(
    activeCalculatedHabitId,
    calculatedNoticeOpen,
  );

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
      .map((entry) => {
        const entryIndex = goalHistory.findIndex(
          (candidate) => candidate.id === entry.id,
        );
        const previousEntry = goalHistory
          .slice(entryIndex + 1)
          .find((candidate) => candidate.habitId === entry.habitId);
        return {
          habit: selectedById.get(entry.habitId)!,
          goalHistoryId: entry.id,
          previousAmount:
            previousEntry == null
              ? null
              : normalizeGoalAmount(
                  previousEntry.amount,
                  previousEntry.period,
                  entry.period,
                ),
          amount: entry.amount,
          period: entry.period,
        };
      });
  }, [acknowledgedRecoveryGoalHistoryIds, goalHistory, selectedHabits]);
  const newlyCalculatedHabits = useMemo(
    () =>
      selectedHabits.filter(
        (habit) =>
          habit.calibratedBaseline != null &&
          !acknowledgedCalculatedHabitIds.includes(habit.id),
      ),
    [acknowledgedCalculatedHabitIds, selectedHabits],
  );
  const relevantCalculatedHabits = newlyCalculatedHabits;
  const calculatedNoticeHabits = relevantCalculatedHabits;
  const calculatedNoticeHabitName =
    calculatedNoticeHabits[0]?.name ?? "your habit";
  const previewHabit = activeHabit ?? selectedHabits[0] ?? null;
  const previewHabits = useMemo(
    () =>
      selectedHabits.map((habit, index) => {
        const fallbackFinalTarget =
          habit.measurementType === "minutes" ? 10 : 1;
        const finalTarget = habit.finalTarget ?? fallbackFinalTarget;
        const finalInCurrentPeriod = normalizeGoalAmount(
          finalTarget,
          habit.goalPeriod,
          habit.currentGoalPeriod,
        );
        const previewStep = habit.measurementType === "minutes" ? 10 : 2;
        const existingCurrentGoal = habit.currentGoal ?? 0;
        const currentGoal =
          existingCurrentGoal > finalInCurrentPeriod
            ? existingCurrentGoal
            : finalInCurrentPeriod + previewStep + index;
        const currentInBaselinePeriod = normalizeGoalAmount(
          currentGoal,
          habit.currentGoalPeriod,
          habit.baselinePeriod,
        );
        const estimatedBaseline =
          habit.estimatedBaseline ?? currentInBaselinePeriod + previewStep;
        const calibratedBaseline = Math.max(
          normalizeGoalAmount(
            finalTarget,
            habit.goalPeriod,
            habit.baselinePeriod,
          ),
          Math.round(estimatedBaseline * 0.8),
        );

        return {
          ...habit,
          estimatedBaseline,
          calibratedBaseline,
          finalTarget,
          currentGoal,
          pendingGoal: null,
          pendingGoalReason: null,
        };
      }),
    [selectedHabits],
  );
  const displayedCalculatedNoticeHabits =
    bannerPreviewActive && previewHabits.length > 0
      ? previewHabits
      : calculatedNoticeHabits;
  const displayedCalculatedNoticeCount =
    displayedCalculatedNoticeHabits.length || 1;
  const displayedCalculatedNoticeHabitName =
    displayedCalculatedNoticeHabits[0]?.name ?? calculatedNoticeHabitName;
  const showCalculatedNotice =
    relevantCalculatedHabits.length > 0 ||
    (bannerPreviewActive && previewHabit != null);
  const relevantMissingPlanHabits = missingPlanHabits;
  const displayedMissingPlanHabits =
    bannerPreviewActive && previewHabits.length > 0
      ? previewHabits.map((habit) => ({
          ...habit,
          estimatedBaseline: null,
          calibratedBaseline: null,
          finalTarget: null,
          currentGoal: null,
        }))
      : relevantMissingPlanHabits;
  const displayedNextGoalHabits =
    bannerPreviewActive && previewHabits.length > 0
      ? previewHabits
      : nextGoalHabits;
  const displayedRecoveryGoalHabits =
    bannerPreviewActive && previewHabits.length > 0
      ? previewHabits.map((habit) => ({
          habit,
          goalHistoryId: -habit.id,
          previousAmount: Math.max(
            0,
            (habit.currentGoal ?? habit.estimatedBaseline ?? 1) -
              (habit.measurementType === "minutes" ? 5 : 1),
          ),
          amount: habit.currentGoal ?? habit.estimatedBaseline ?? 1,
          period: habit.currentGoalPeriod,
        }))
      : recoveryGoalHabits.length > 0
        ? recoveryGoalHabits
        : bannerPreviewActive && previewHabit
          ? [
              {
                habit: previewHabit,
                goalHistoryId: -1,
                previousAmount: Math.max(
                  0,
                  (previewHabit.currentGoal ??
                    previewHabit.estimatedBaseline ??
                    1) - (previewHabit.measurementType === "minutes" ? 5 : 1),
                ),
                amount:
                  previewHabit.currentGoal ??
                  previewHabit.estimatedBaseline ??
                  1,
                period: previewHabit.currentGoalPeriod,
              },
            ]
          : [];
  const showMissingPlanBanner = displayedMissingPlanHabits.length > 0;
  const showNextGoalBanner = displayedNextGoalHabits.length > 0;
  const showRecoveryGoalBanner = displayedRecoveryGoalHabits.length > 0;
  const previousWeekForUpdates = getPreviousCycleBounds("week");
  const weeklyReviewHabits = selectedHabits.filter((habit) => {
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
    setMissingPlanReviewOpen(false);
    setRecoveryGoalReviewOpen(false);
    setNextGoalReviewOpen(false);
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

    const trackedHabits =
      selectedHabitId != null
        ? activeHabit
          ? [activeHabit]
          : []
        : selectedHabits;
    const earliestCalibrationStart = trackedHabits.reduce<number | null>(
      (earliest, habit) => {
        if (habit.calibrationStartedAt == null) return earliest;
        const start = startOfDayMs(new Date(habit.calibrationStartedAt));
        return earliest == null ? start : Math.min(earliest, start);
      },
      null,
    );
    const trackingStartBeforeToday =
      earliestCalibrationStart == null
        ? firstLogBeforeToday
        : firstLogBeforeToday == null
          ? earliestCalibrationStart
          : Math.min(earliestCalibrationStart, firstLogBeforeToday);
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
    const averageWeeklyLogsPastTwoWeeks = hasTwoWeeksOfData
      ? comparisonTotalLogs / 2
      : null;
    const averageWeeklyResistsPastTwoWeeks = hasTwoWeeksOfData
      ? comparisonTotalResists / 2
      : null;
    const nextWeekStart = addLocalDays(weekStart, 7);
    const weekProgress = Math.max(
      0,
      Math.min(1, (now.getTime() - weekStart) / (nextWeekStart - weekStart)),
    );
    const averageLogsAtThisPointInWeek =
      averageWeeklyLogsPastTwoWeeks == null
        ? null
        : averageWeeklyLogsPastTwoWeeks * weekProgress;
    const averageResistsAtThisPointInWeek =
      averageWeeklyResistsPastTwoWeeks == null
        ? null
        : averageWeeklyResistsPastTwoWeeks * weekProgress;
    return {
      todayLogs,
      weekLogs,
      todayResists,
      weekResists,
      todayGiveIns,
      averageLogs,
      averageResists,
      averageGiveIns,
      averageWeeklyLogsPastTwoWeeks,
      averageWeeklyResistsPastTwoWeeks,
      averageLogsAtThisPointInWeek,
      averageResistsAtThisPointInWeek,
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

  const recentHabitAverage = useMemo(() => {
    if (!activeHabit) return null;

    const todayStart = startOfDayMs(new Date());
    const windowStart = addLocalDays(todayStart, -14);
    const recentLogs = logs.filter(
      (log) =>
        log.habitId === activeHabit.id &&
        log.createdAt >= windowStart &&
        log.createdAt < todayStart,
    );
    const observedDays = new Set(
      recentLogs.map((log) => startOfDayMs(new Date(log.createdAt))),
    );

    for (const confirmation of trackingConfirmations) {
      if (
        confirmation.habitId === activeHabit.id &&
        confirmation.period === "day" &&
        confirmation.status !== "not_yet" &&
        confirmation.periodStart >= windowStart &&
        confirmation.periodStart < todayStart
      ) {
        observedDays.add(confirmation.periodStart);
      }
    }

    const requiredObservedDays =
      CALIBRATION_RULES[activeHabit.baselinePeriod].recentObservedDays;
    if (observedDays.size < requiredObservedDays) return null;

    const quantity = recentLogs.reduce(
      (total, log) =>
        total + (log.didResist === 1 ? 0 : Math.max(0, log.count ?? 1)),
      0,
    );

    return (
      (quantity / observedDays.size) * daysInPeriod(activeHabit.baselinePeriod)
    );
  }, [activeHabit, logs, trackingConfirmations]);
  const habitAverageCard = useMemo(() => {
    if (recentHabitAverage != null) {
      return {
        label: "Recent average",
        amount: recentHabitAverage,
      };
    }

    if (activeHabit?.calibratedBaseline != null) {
      return {
        label: "Last known average",
        amount: activeHabit.calibratedBaseline,
      };
    }

    if (activeHabit?.estimatedBaseline != null) {
      return {
        label: "Estimated average",
        amount: activeHabit.estimatedBaseline,
      };
    }

    return {
      label: "Recent average",
      amount: null,
    };
  }, [activeHabit, recentHabitAverage]);
  const displayedHabitAverage =
    habitAverageCard.amount == null
      ? null
      : Math.round(habitAverageCard.amount);
  const currentProgressVsRecentPercent = useMemo(() => {
    if (
      !activeHabit ||
      !currentProgress ||
      recentHabitAverage == null ||
      recentHabitAverage <= 0
    ) {
      return null;
    }

    const now = Date.now();
    const previousPeriod = getPreviousCycleBounds(activeCurrentGoalPeriod, now);
    const currentPeriodStart = previousPeriod.endAtExclusive;
    const currentPeriodEnd = addLocalDays(
      currentPeriodStart,
      daysInPeriod(activeCurrentGoalPeriod),
    );
    const elapsedFraction = Math.max(
      0,
      Math.min(
        1,
        (now - currentPeriodStart) / (currentPeriodEnd - currentPeriodStart),
      ),
    );
    const recentAverageInCurrentPeriod =
      (recentHabitAverage / daysInPeriod(activeHabit.baselinePeriod)) *
      daysInPeriod(activeCurrentGoalPeriod);
    const expectedAtThisPoint = recentAverageInCurrentPeriod * elapsedFraction;

    if (
      expectedAtThisPoint <= 0 ||
      currentProgress.currentAmount >= expectedAtThisPoint
    ) {
      return null;
    }

    return Math.round(
      ((expectedAtThisPoint - currentProgress.currentAmount) /
        expectedAtThisPoint) *
        100,
    );
  }, [
    activeCurrentGoalPeriod,
    activeHabit,
    currentProgress,
    recentHabitAverage,
  ]);

  const resistsImprovementPercent =
    stats.averageResistsAtThisPointInWeek == null
      ? null
      : getPercentIncrease(
          stats.weekResists,
          stats.averageResistsAtThisPointInWeek,
        );
  const logsImprovementPercent =
    stats.averageLogsAtThisPointInWeek == null
      ? null
      : getPercentIncrease(stats.weekLogs, stats.averageLogsAtThisPointInWeek);
  const dailyQuoteNumber = Math.floor(startOfDayMs(new Date()) / 86_400_000);
  const dailyQuote =
    MOTIVATIONAL_QUOTES[
      Math.abs(dailyQuoteNumber) % MOTIVATIONAL_QUOTES.length
    ];

  const positiveFeedback = useMemo(() => {
    if (selectedHabitId != null && currentProgressVsRecentPercent != null) {
      return {
        title: "Less Habit Activity",
        text: `You have ${currentProgressVsRecentPercent}% less habit activity than your recent pace.`,
      };
    }

    if (resistsImprovementPercent != null) {
      return {
        title: "More Urges Resisted",
        text: `You’ve resisted ${resistsImprovementPercent}% more urges than your recent pace this week.`,
      };
    }

    if (logsImprovementPercent != null) {
      return {
        title: "More Check-Ins",
        text: `You’ve logged ${logsImprovementPercent}% more check-ins than your recent pace this week.`,
      };
    }

    return {
      title: "A Thought for Today",
      text: dailyQuote.attribution
        ? `“${dailyQuote.text}” — ${dailyQuote.attribution}`
        : dailyQuote.text,
    };
  }, [
    currentProgressVsRecentPercent,
    dailyQuote,
    logsImprovementPercent,
    resistsImprovementPercent,
    selectedHabitId,
  ]);

  const StatTile = ({
    label,
    value,
    icon,
    sub,
    labelAtBottom = false,
    percentIncrease,
    percentDirection = "up",
    accentColor = "#16A34A",
  }: {
    label: string;
    value: string;
    icon: keyof typeof Ionicons.glyphMap;
    sub?: string;
    labelAtBottom?: boolean;
    percentIncrease?: number | null;
    percentDirection?: "up" | "down";
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
              {percentDirection === "down" ? "↓" : "↑"} {percentIncrease}%
            </Text>
          </View>
        ) : labelAtBottom ? (
          <View
            className="min-w-[50px] rounded-full px-2 py-0.5"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text className="text-[11px] font-black text-transparent">
              {percentDirection === "down" ? "↓" : "↑"} 100%
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

  const dismissCalculatedNotice = () => {
    setCalculatedNoticeOpen(false);
  };

  const openMissingPlanReview = () => {
    const snapshot = [...displayedMissingPlanHabits];
    if (snapshot.length === 0) return;
    setMissingPlanSnapshot(snapshot);
    setActiveMissingPlanHabitId(snapshot[0].id);
    setReviewedMissingPlanHabitIds([]);
    setMissingPlanError("");
    setUpdatesOpen(false);
    setTimeout(() => setMissingPlanReviewOpen(true), 250);
  };

  const openRecoveryGoalReview = () => {
    const snapshot = [...displayedRecoveryGoalHabits];
    if (snapshot.length === 0) return;
    setRecoveryGoalSnapshot(snapshot);
    setActiveRecoveryGoalHabitId(snapshot[0].habit.id);
    setReviewedRecoveryGoalHabitIds([]);
    setUpdatesOpen(false);
    setTimeout(() => setRecoveryGoalReviewOpen(true), 250);
  };

  const openCalculatedNoticeReview = (snapshot: Habit[]) => {
    if (snapshot.length === 0) return;
    setCalculatedNoticeSnapshot(snapshot);
    setActiveCalculatedHabitId(snapshot[0].id);
    setReviewedCalculatedHabitIds([]);
    setUpdatesOpen(false);
    setTimeout(() => setCalculatedNoticeOpen(true), 250);
  };

  const activeMissingPlanHabit =
    missingPlanSnapshot.find(
      (habit) => habit.id === activeMissingPlanHabitId,
    ) ?? null;
  const allMissingPlansCompleted =
    missingPlanSnapshot.length > 0 &&
    reviewedMissingPlanHabitIds.length >= missingPlanSnapshot.length;
  const missingPlanStartingAmountLocked =
    activeMissingPlanHabit?.calibratedBaseline != null;
  const activeRecoveryGoal =
    recoveryGoalSnapshot.find(
      (item) => item.habit.id === activeRecoveryGoalHabitId,
    ) ?? null;
  const allRecoveryGoalsReviewed =
    recoveryGoalSnapshot.length > 0 &&
    reviewedRecoveryGoalHabitIds.length >= recoveryGoalSnapshot.length;
  const activeCalculatedHabit =
    calculatedNoticeSnapshot.find(
      (habit) => habit.id === activeCalculatedHabitId,
    ) ?? null;
  const allCalculatedHabitsReviewed =
    calculatedNoticeSnapshot.length > 0 &&
    reviewedCalculatedHabitIds.length >= calculatedNoticeSnapshot.length;

  useEffect(() => {
    if (!activeMissingPlanHabit) return;
    const period =
      activeMissingPlanHabit.estimatedBaseline == null
        ? "week"
        : activeMissingPlanHabit.baselinePeriod;
    const startingAmount =
      activeMissingPlanHabit.calibratedBaseline ??
      activeMissingPlanHabit.estimatedBaseline;
    const convertedStartingAmount =
      startingAmount == null
        ? null
        : normalizeGoalAmount(
            startingAmount,
            activeMissingPlanHabit.baselinePeriod,
            period,
          );
    const convertedGoalAmount =
      activeMissingPlanHabit.finalTarget == null
        ? null
        : normalizeGoalAmount(
            activeMissingPlanHabit.finalTarget,
            activeMissingPlanHabit.goalPeriod,
            period,
          );
    const inputValue = (value: number | null) =>
      value == null ? "" : `${Math.round(value * 100) / 100}`;

    setMissingPlanPeriod(period);
    setMissingPlanMeasurementType(
      activeMissingPlanHabit.measurementType === "minutes"
        ? "minutes"
        : "times",
    );
    setMissingPlanStartingAmount(inputValue(convertedStartingAmount));
    setMissingPlanGoalAmount(inputValue(convertedGoalAmount));
    setMissingPlanError("");
  }, [activeMissingPlanHabit]);

  const showMissingPlanMeasurementMenu = () => {
    Keyboard.dismiss();
    const choose = (measurement: "times" | "minutes") => {
      setMissingPlanMeasurementType(measurement);
      setMissingPlanError("");
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Times", "Minutes", "Cancel"],
          cancelButtonIndex: 2,
          title: "Choose measurement",
        },
        (index) => {
          if (index === 0) choose("times");
          if (index === 1) choose("minutes");
        },
      );
      return;
    }

    Alert.alert("Choose measurement", undefined, [
      { text: "Times", onPress: () => choose("times") },
      { text: "Minutes", onPress: () => choose("minutes") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const showMissingPlanPeriodMenu = () => {
    Keyboard.dismiss();
    const options: Array<{
      label: string;
      value: Habit["goalPeriod"];
    }> = [
      { label: "Day", value: "day" },
      { label: "Week", value: "week" },
      { label: "Month", value: "28_days" },
    ];

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...options.map((option) => option.label), "Cancel"],
          cancelButtonIndex: options.length,
          title: "Choose frequency",
        },
        (index) => {
          const option = options[index];
          if (option) changeMissingPlanPeriod(option.value);
        },
      );
      return;
    }

    Alert.alert("Choose frequency", undefined, [
      ...options.map((option) => ({
        text: option.label,
        onPress: () => changeMissingPlanPeriod(option.value),
      })),
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const changeMissingPlanPeriod = (period: Habit["goalPeriod"]) => {
    if (period === missingPlanPeriod) return;
    const convertInput = (value: string) => {
      const amount = Number(value);
      if (!value.trim() || !Number.isFinite(amount)) return value;
      return `${
        Math.round(
          normalizeGoalAmount(amount, missingPlanPeriod, period) * 100,
        ) / 100
      }`;
    };
    setMissingPlanStartingAmount((value) => convertInput(value));
    setMissingPlanGoalAmount((value) => convertInput(value));
    setMissingPlanPeriod(period);
    setMissingPlanError("");
  };

  const saveActiveMissingPlan = async () => {
    if (!activeMissingPlanHabit || savingMissingPlan) return;
    const startingAmount = Number(missingPlanStartingAmount);
    const goalAmount = Number(missingPlanGoalAmount);

    if (
      !missingPlanStartingAmount.trim() ||
      !Number.isFinite(startingAmount) ||
      startingAmount < 0
    ) {
      setMissingPlanError("Add a valid estimated starting amount.");
      return;
    }
    if (
      !missingPlanGoalAmount.trim() ||
      !Number.isFinite(goalAmount) ||
      goalAmount < 0
    ) {
      setMissingPlanError("Add a valid long-term goal amount.");
      return;
    }
    if (goalAmount > startingAmount) {
      setMissingPlanError(
        "The long-term goal cannot be higher than the starting amount.",
      );
      return;
    }

    setSavingMissingPlan(true);
    setMissingPlanError("");
    Keyboard.dismiss();
    try {
      if (!bannerPreviewActive) {
        await updateHabitPlan(activeMissingPlanHabit.id, {
          measurementType: missingPlanMeasurementType,
          unit: missingPlanMeasurementType,
          estimatedBaseline: startingAmount,
          baselinePeriod: missingPlanPeriod,
          finalTarget: goalAmount,
          goalPeriod: missingPlanPeriod,
        });
      }

      setMissingPlanSnapshot((current) =>
        current.map((habit) =>
          habit.id === activeMissingPlanHabit.id
            ? {
                ...habit,
                measurementType: missingPlanMeasurementType,
                unit: missingPlanMeasurementType,
                estimatedBaseline: startingAmount,
                baselinePeriod: missingPlanPeriod,
                finalTarget: goalAmount,
                goalPeriod: missingPlanPeriod,
              }
            : habit,
        ),
      );

      const reviewedIds = Array.from(
        new Set([...reviewedMissingPlanHabitIds, activeMissingPlanHabit.id]),
      );
      setReviewedMissingPlanHabitIds(reviewedIds);
      const next = missingPlanSnapshot.find(
        (habit) => !reviewedIds.includes(habit.id),
      );
      setActiveMissingPlanHabitId(next?.id ?? null);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setMissingPlanError(
        error instanceof Error ? error.message : "Could not save this setup.",
      );
    } finally {
      setSavingMissingPlan(false);
    }
  };

  const finishActiveRecoveryGoal = async () => {
    if (!activeRecoveryGoal) return;
    if (!bannerPreviewActive) {
      await acknowledgeRecoveryGoal(activeRecoveryGoal.goalHistoryId);
    }
    const reviewedIds = Array.from(
      new Set([...reviewedRecoveryGoalHabitIds, activeRecoveryGoal.habit.id]),
    );
    setReviewedRecoveryGoalHabitIds(reviewedIds);
    const next = recoveryGoalSnapshot.find(
      (item) => !reviewedIds.includes(item.habit.id),
    );
    setActiveRecoveryGoalHabitId(next?.habit.id ?? null);
    await Haptics.selectionAsync();
  };

  const finishActiveCalculatedHabit = async () => {
    if (!activeCalculatedHabit) return;
    if (!bannerPreviewActive) {
      await acknowledgeCalculatedHabits([activeCalculatedHabit.id]);
    }
    const reviewedIds = Array.from(
      new Set([...reviewedCalculatedHabitIds, activeCalculatedHabit.id]),
    );
    setReviewedCalculatedHabitIds(reviewedIds);
    const next = calculatedNoticeSnapshot.find(
      (habit) => !reviewedIds.includes(habit.id),
    );
    setActiveCalculatedHabitId(next?.id ?? null);
    await Haptics.selectionAsync();
  };

  const openNextGoalReview = async () => {
    const snapshot = [...displayedNextGoalHabits];
    if (snapshot.length === 0) return;

    setUpdatesOpen(false);
    setNextGoalSnapshot(snapshot);
    setActiveNextGoalHabitId(snapshot[0].id);
    setReviewedNextGoalHabitIds([]);
    setNextGoalDecisions({});
    setNextGoalActionBusy(true);

    if (!bannerPreviewActive) {
      for (const habit of snapshot) {
        await proposeNextGoal(habit.id);
      }
    }

    setNextGoalActionBusy(false);
    setTimeout(() => setNextGoalReviewOpen(true), 250);
  };

  const activeNextGoalHabit =
    nextGoalSnapshot.find((habit) => habit.id === activeNextGoalHabitId) ??
    null;
  const allNextGoalsReviewed =
    nextGoalSnapshot.length > 0 &&
    reviewedNextGoalHabitIds.length >= nextGoalSnapshot.length;
  const activeNextGoalCurrentAmount =
    activeNextGoalHabit?.currentGoal ??
    activeNextGoalHabit?.estimatedBaseline ??
    0;
  const activeNextGoalFinalAmount = activeNextGoalHabit
    ? normalizeGoalAmount(
        activeNextGoalHabit.finalTarget ?? 0,
        activeNextGoalHabit.goalPeriod,
        activeNextGoalHabit.currentGoalPeriod,
      )
    : 0;
  const activeNextGoalAmount = activeNextGoalHabit
    ? (activeNextGoalHabit.pendingGoal ??
      calculateNextReductionGoal(
        activeNextGoalCurrentAmount,
        activeNextGoalFinalAmount,
        activeNextGoalHabit.measurementType,
      ))
    : null;
  const activeNextGoalDecision = activeNextGoalHabit
    ? nextGoalDecisions[activeNextGoalHabit.id]
    : undefined;

  const finishActiveNextGoal = async (decision: "approve" | "later") => {
    if (!activeNextGoalHabit || nextGoalActionBusy) return;
    setNextGoalActionBusy(true);

    if (!bannerPreviewActive) {
      if (decision === "approve") {
        await approveProposedGoal(activeNextGoalHabit.id);
      } else {
        await dismissProposedGoal(activeNextGoalHabit.id);
      }
    }

    const reviewedIds = Array.from(
      new Set([...reviewedNextGoalHabitIds, activeNextGoalHabit.id]),
    );
    setReviewedNextGoalHabitIds(reviewedIds);
    setNextGoalDecisions((current) => ({
      ...current,
      [activeNextGoalHabit.id]: decision,
    }));
    const nextHabit = nextGoalSnapshot.find(
      (habit) => !reviewedIds.includes(habit.id),
    );
    setActiveNextGoalHabitId(nextHabit?.id ?? null);
    setNextGoalActionBusy(false);

    if (decision === "approve") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      await Haptics.selectionAsync();
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

                  <Text
                    adjustsFontSizeToFit
                    className="mt-0.5 text-xs font-semibold leading-4 text-gray-500"
                    minimumFontScale={0.72}
                    numberOfLines={2}
                  >
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
                    percentIncrease={resistsImprovementPercent}
                  />

                  <StatTile
                    accentColor={activeHabitColor}
                    label="Logs this week"
                    value={`${stats.weekLogs}`}
                    icon="calendar"
                    percentIncrease={logsImprovementPercent}
                  />
                </View>

                <View className="mt-3 flex-row gap-3">
                  <StatTile
                    accentColor={activeHabitColor}
                    label="Average resists"
                    value={
                      stats.averageWeeklyResistsPastTwoWeeks == null
                        ? "—"
                        : `${Math.round(
                            stats.averageWeeklyResistsPastTwoWeeks,
                          )}`
                    }
                    icon="shield-checkmark"
                  />

                  <StatTile
                    accentColor={activeHabitColor}
                    label="Average logs"
                    value={
                      stats.averageWeeklyLogsPastTwoWeeks == null
                        ? "—"
                        : `${Math.round(stats.averageWeeklyLogsPastTwoWeeks)}`
                    }
                    icon="create"
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
                      percentIncrease={currentProgressVsRecentPercent}
                      percentDirection="down"
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
                    label={habitAverageCard.label}
                    labelAtBottom
                    value={
                      displayedHabitAverage == null
                        ? "—"
                        : `${displayedHabitAverage}`
                    }
                    sub={
                      displayedHabitAverage == null || !activeHabit
                        ? "Add your starting amount"
                        : `${unitForValue(
                            activeHabitUnit,
                            displayedHabitAverage,
                          )} ${periodRateLabel(activeHabit.baselinePeriod)}`
                    }
                    icon="analytics"
                  />

                  <StatTile
                    accentColor={activeHabitColor}
                    label="Long-term goal"
                    labelAtBottom
                    value={
                      activeHabit?.finalTarget == null
                        ? "—"
                        : formatAverage(activeHabit.finalTarget)
                    }
                    sub={
                      activeHabit?.finalTarget == null
                        ? "Add your goal"
                        : `${unitForValue(
                            activeHabitUnit,
                            activeHabit.finalTarget,
                          )} ${periodRateLabel(activeHabit.goalPeriod)}`
                    }
                    icon="ribbon"
                  />
                </View>
              </>
            )}
          </View>
        </>
      )}

      <TrackingReviewLauncher
        placement="home"
        habitId={null}
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
                  openMissingPlanReview();
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
                  openRecoveryGoalReview();
                }}
                className="mb-3 flex-row items-center rounded-3xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <View className="h-10 w-10 items-center justify-center rounded-2xl bg-blue-50">
                  <Ionicons name="heart" size={19} color="#2563EB" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-black text-gray-950">
                    {displayedRecoveryGoalHabits.length === 1
                      ? "Your current goal was updated"
                      : `${displayedRecoveryGoalHabits.length} current goals were updated`}
                  </Text>
                  <Text className="mt-0.5 text-xs font-semibold leading-4 text-gray-600">
                    {displayedRecoveryGoalHabits.length === 1
                      ? `See the update for ${displayedRecoveryGoalHabits[0].habit.name}`
                      : "Review each adjusted goal"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#2563EB" />
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
                  await openNextGoalReview();
                }}
                className="mb-3 flex-row items-center rounded-3xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <View className="h-10 w-10 items-center justify-center rounded-2xl bg-green-50">
                  <Ionicons name="trophy" size={19} color="#16A34A" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-black text-gray-950">
                    {displayedNextGoalHabits.length === 1
                      ? "You reached your goal!"
                      : `${displayedNextGoalHabits.length} goals reached!`}
                  </Text>
                  <Text className="mt-0.5 text-xs font-semibold text-gray-600">
                    {displayedNextGoalHabits.length === 1
                      ? `A new step is ready for ${displayedNextGoalHabits[0].name}`
                      : "Your next steps are ready"}
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
                  openCalculatedNoticeReview(snapshot);
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
        visible={missingPlanReviewOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setMissingPlanReviewOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
          <View className="flex-row items-center justify-between border-b border-gray-200 px-5 py-4">
            <View className="flex-1 pr-4">
              <Text className="text-xs font-black uppercase tracking-widest text-amber-600">
                Setup update
              </Text>
              <Text className="mt-1 text-2xl font-black text-black">
                Finish Your Goals
              </Text>
            </View>
            <Pressable
              onPress={() => setMissingPlanReviewOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Close goal setup"
              className="h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white"
            >
              <Ionicons name="close" size={20} color="#000000" />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            automaticallyAdjustKeyboardInsets
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 20,
              paddingBottom: 32,
            }}
            showsVerticalScrollIndicator={false}
          >
            {missingPlanSnapshot.length > 1 ? (
              <>
                <Text className="text-sm font-black text-gray-600">
                  {`${reviewedMissingPlanHabitIds.length} of ${missingPlanSnapshot.length} set up`}
                </Text>
                <ScrollView
                  ref={missingPlanChipScroller.scrollRef}
                  className="mt-3"
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  onLayout={missingPlanChipScroller.onViewportLayout}
                >
                  {missingPlanSnapshot.map((habit) => {
                    const selected = habit.id === activeMissingPlanHabitId;
                    const reviewed = reviewedMissingPlanHabitIds.includes(
                      habit.id,
                    );
                    return (
                      <Pressable
                        key={habit.id}
                        onLayout={(event) => {
                          missingPlanChipScroller.onChipLayout(
                            habit.id,
                            selected,
                            event,
                          );
                        }}
                        onPress={() => {
                          void Haptics.selectionAsync();
                          setActiveMissingPlanHabitId(habit.id);
                        }}
                        className="mr-2 flex-row items-center rounded-full border px-3.5 py-2"
                        style={{
                          borderColor: selected ? habit.color : "#E5E7EB",
                          backgroundColor: selected
                            ? habit.color
                            : reviewed
                              ? "#FFFBEB"
                              : "#FFFFFF",
                        }}
                      >
                        {reviewed ? (
                          <Ionicons
                            name="checkmark-circle"
                            size={15}
                            color={selected ? "#FFFFFF" : "#B45309"}
                          />
                        ) : null}
                        <Text
                          numberOfLines={1}
                          className={`font-black ${reviewed ? "ml-1" : ""} ${
                            selected ? "text-white" : "text-black"
                          }`}
                        >
                          {habit.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            ) : null}

            {allMissingPlansCompleted && activeMissingPlanHabitId == null ? (
              <View className="mt-6 items-center rounded-[28px] border border-amber-200 bg-amber-50 p-6">
                <View className="h-14 w-14 items-center justify-center rounded-full bg-white">
                  <Ionicons name="checkmark-circle" size={30} color="#B45309" />
                </View>
                <Text className="mt-3 text-xl font-black text-black">
                  All habits set up
                </Text>
                <Text className="mt-1 text-center text-sm font-semibold leading-5 text-gray-600">
                  Reflex created a starting step for each habit.
                </Text>
                <Pressable
                  onPress={() => setMissingPlanReviewOpen(false)}
                  className="mt-5 w-full rounded-3xl bg-amber-500 px-5 py-4"
                >
                  <Text className="text-center text-base font-black text-white">
                    Done
                  </Text>
                </Pressable>
              </View>
            ) : activeMissingPlanHabit ? (
              <View className="mt-5 rounded-[28px] border border-gray-200 bg-gray-50 p-4">
                <View className="flex-row items-center">
                  <View className="h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white">
                    <Ionicons
                      name={cleanHabitIcon(activeMissingPlanHabit.icon)}
                      size={22}
                      color={activeMissingPlanHabit.color}
                    />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-lg font-black text-black">
                      {activeMissingPlanHabit.name}
                    </Text>
                    <Text className="mt-0.5 text-xs font-semibold text-gray-500">
                      Add the amounts needed to build your plan
                    </Text>
                  </View>
                </View>

                <View className="mt-4">
                  <Text className="text-xs font-black uppercase tracking-wide text-gray-500">
                    {missingPlanStartingAmountLocked
                      ? "Calculated starting amount"
                      : "Estimated starting amount"}
                  </Text>
                  <View className="mt-2 flex-row items-center rounded-2xl border border-gray-200 bg-white p-2">
                    <TextInput
                      value={missingPlanStartingAmount}
                      onChangeText={setMissingPlanStartingAmount}
                      editable={!missingPlanStartingAmountLocked}
                      placeholder="5"
                      placeholderTextColor="#9CA3AF"
                      keyboardType={
                        Platform.OS === "ios"
                          ? "numbers-and-punctuation"
                          : "decimal-pad"
                      }
                      returnKeyType="done"
                      blurOnSubmit={false}
                      onSubmitEditing={() =>
                        missingPlanGoalInputRef.current?.focus()
                      }
                      maxLength={8}
                      textAlignVertical="center"
                      className={`h-10 w-16 rounded-xl border border-gray-200 px-3 py-0 text-center text-black ${
                        missingPlanStartingAmountLocked
                          ? "bg-gray-100 opacity-60"
                          : "bg-white"
                      }`}
                    />
                    <Pressable
                      disabled={missingPlanStartingAmountLocked}
                      onPress={showMissingPlanMeasurementMenu}
                      className={`ml-2 flex-row items-center rounded-xl border border-gray-200 bg-white px-2 py-2 ${
                        missingPlanStartingAmountLocked ? "opacity-60" : ""
                      }`}
                    >
                      <Text className="text-xs font-black text-black">
                        {unitForValue(
                          missingPlanMeasurementType,
                          Number(missingPlanStartingAmount),
                        )}
                      </Text>
                      <Ionicons name="chevron-down" size={12} color="#6B7280" />
                    </Pressable>
                    <Text className="mx-1.5 text-xs font-bold text-gray-500">
                      per
                    </Text>
                    <Pressable
                      onPress={showMissingPlanPeriodMenu}
                      className="w-20 flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-2 py-2"
                    >
                      <Text className="text-xs font-black text-black">
                        {missingPlanPeriod === "day"
                          ? "Day"
                          : missingPlanPeriod === "week"
                            ? "Week"
                            : "Month"}
                      </Text>
                      <Ionicons name="chevron-down" size={14} color="#6B7280" />
                    </Pressable>
                  </View>
                </View>

                <View className="mt-4">
                  <Text className="text-xs font-black uppercase tracking-wide text-gray-500">
                    Long-term goal amount
                  </Text>
                  <View className="mt-2 flex-row items-center rounded-2xl border border-gray-200 bg-white p-2">
                    <TextInput
                      ref={missingPlanGoalInputRef}
                      value={missingPlanGoalAmount}
                      onChangeText={setMissingPlanGoalAmount}
                      placeholder="0"
                      placeholderTextColor="#9CA3AF"
                      keyboardType={
                        Platform.OS === "ios"
                          ? "numbers-and-punctuation"
                          : "decimal-pad"
                      }
                      returnKeyType="done"
                      blurOnSubmit
                      onSubmitEditing={() => Keyboard.dismiss()}
                      maxLength={8}
                      textAlignVertical="center"
                      className="h-10 w-16 rounded-xl border border-gray-200 bg-white px-3 py-0 text-center text-black"
                    />
                    <Pressable
                      disabled={missingPlanStartingAmountLocked}
                      onPress={showMissingPlanMeasurementMenu}
                      className={`ml-2 flex-row items-center rounded-xl border border-gray-200 bg-white px-2 py-2 ${
                        missingPlanStartingAmountLocked ? "opacity-60" : ""
                      }`}
                    >
                      <Text className="text-xs font-black text-black">
                        {unitForValue(
                          missingPlanMeasurementType,
                          Number(missingPlanGoalAmount),
                        )}
                      </Text>
                      <Ionicons name="chevron-down" size={12} color="#6B7280" />
                    </Pressable>
                    <Text className="mx-1.5 text-xs font-bold text-gray-500">
                      per
                    </Text>
                    <Pressable
                      onPress={showMissingPlanPeriodMenu}
                      className="w-20 flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-2 py-2"
                    >
                      <Text className="text-xs font-black text-black">
                        {missingPlanPeriod === "day"
                          ? "Day"
                          : missingPlanPeriod === "week"
                            ? "Week"
                            : "Month"}
                      </Text>
                      <Ionicons name="chevron-down" size={14} color="#6B7280" />
                    </Pressable>
                  </View>
                </View>

                {missingPlanError ? (
                  <View className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                    <Text className="text-sm font-bold text-red-700">
                      {missingPlanError}
                    </Text>
                  </View>
                ) : null}

                <Pressable
                  disabled={savingMissingPlan}
                  onPress={() => void saveActiveMissingPlan()}
                  className={`mt-5 rounded-3xl bg-amber-500 px-5 py-4 ${
                    savingMissingPlan ? "opacity-50" : ""
                  }`}
                >
                  <Text className="text-center text-base font-black text-white">
                    {savingMissingPlan
                      ? "Saving..."
                      : reviewedMissingPlanHabitIds.includes(
                            activeMissingPlanHabit.id,
                          )
                        ? "Save Changes"
                        : "Save and Continue"}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={recoveryGoalReviewOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setRecoveryGoalReviewOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
          <View className="flex-row items-center justify-between border-b border-gray-200 px-5 py-4">
            <View className="flex-1 pr-4">
              <Text className="text-xs font-black uppercase tracking-widest text-blue-600">
                Progress update
              </Text>
              <Text className="mt-1 text-2xl font-black text-black">
                {recoveryGoalSnapshot.length === 1
                  ? "Your Updated Goal"
                  : "Your Updated Goals"}
              </Text>
            </View>
            <Pressable
              onPress={() => setRecoveryGoalReviewOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Close updated goals"
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
            {recoveryGoalSnapshot.length > 1 ? (
              <>
                <Text className="text-sm font-black text-gray-600">
                  {`${reviewedRecoveryGoalHabitIds.length} of ${recoveryGoalSnapshot.length} reviewed`}
                </Text>
                <ScrollView
                  ref={recoveryGoalChipScroller.scrollRef}
                  className="mt-3"
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  onLayout={recoveryGoalChipScroller.onViewportLayout}
                >
                  {recoveryGoalSnapshot.map((item) => {
                    const selected =
                      item.habit.id === activeRecoveryGoalHabitId;
                    const reviewed = reviewedRecoveryGoalHabitIds.includes(
                      item.habit.id,
                    );
                    return (
                      <Pressable
                        key={item.habit.id}
                        onLayout={(event) =>
                          recoveryGoalChipScroller.onChipLayout(
                            item.habit.id,
                            selected,
                            event,
                          )
                        }
                        onPress={() => {
                          void Haptics.selectionAsync();
                          setActiveRecoveryGoalHabitId(item.habit.id);
                        }}
                        className="mr-2 flex-row items-center rounded-full border px-3.5 py-2"
                        style={{
                          borderColor: selected ? item.habit.color : "#E5E7EB",
                          backgroundColor: selected
                            ? item.habit.color
                            : reviewed
                              ? "#EFF6FF"
                              : "#FFFFFF",
                        }}
                      >
                        {reviewed ? (
                          <Ionicons
                            name="checkmark-circle"
                            size={15}
                            color={selected ? "#FFFFFF" : "#2563EB"}
                          />
                        ) : null}
                        <Text
                          numberOfLines={1}
                          className={`font-black ${
                            reviewed ? "ml-1" : ""
                          } ${selected ? "text-white" : "text-black"}`}
                        >
                          {item.habit.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            ) : null}

            {allRecoveryGoalsReviewed && activeRecoveryGoalHabitId == null ? (
              <View className="mt-6 items-center rounded-[28px] border border-blue-200 bg-blue-50 p-6">
                <View className="h-14 w-14 items-center justify-center rounded-full bg-white">
                  <Ionicons name="checkmark-circle" size={30} color="#2563EB" />
                </View>
                <Text className="mt-3 text-xl font-black text-black">
                  All updates reviewed
                </Text>
                <Pressable
                  onPress={() => setRecoveryGoalReviewOpen(false)}
                  className="mt-5 w-full rounded-3xl bg-blue-600 px-5 py-4"
                >
                  <Text className="text-center text-base font-black text-white">
                    Done
                  </Text>
                </Pressable>
              </View>
            ) : activeRecoveryGoal ? (
              <View className="mt-5 rounded-[28px] border border-gray-200 bg-gray-50 p-4">
                <View className="flex-row items-center">
                  <View className="h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white">
                    <Ionicons
                      name={cleanHabitIcon(activeRecoveryGoal.habit.icon)}
                      size={22}
                      color={activeRecoveryGoal.habit.color}
                    />
                  </View>
                  <Text className="ml-3 flex-1 text-lg font-black text-black">
                    {activeRecoveryGoal.habit.name}
                  </Text>
                </View>

                <View className="mt-4 flex-row items-stretch gap-3">
                  <View className="flex-1 rounded-3xl border border-gray-200 bg-white p-4">
                    <Text className="text-xs font-black uppercase tracking-wide text-gray-500">
                      Previous Goal
                    </Text>
                    <Text className="mt-2 text-3xl font-black text-black">
                      {activeRecoveryGoal.previousAmount == null
                        ? "—"
                        : formatAverage(activeRecoveryGoal.previousAmount)}
                    </Text>
                    <Text className="mt-1 text-xs font-bold leading-4 text-gray-500">
                      {activeRecoveryGoal.previousAmount == null
                        ? "Not available"
                        : `${unitForValue(
                            activeRecoveryGoal.habit.unit,
                            activeRecoveryGoal.previousAmount,
                          )} ${periodRateLabel(activeRecoveryGoal.period)}`}
                    </Text>
                  </View>

                  <View className="flex-1 rounded-3xl border border-blue-200 bg-blue-50 p-4">
                    <Text className="text-xs font-black uppercase tracking-wide text-blue-700">
                      Updated Goal
                    </Text>
                    <Text className="mt-2 text-3xl font-black text-black">
                      {formatAverage(activeRecoveryGoal.amount)}
                    </Text>
                    <Text className="mt-1 text-xs font-bold leading-4 text-gray-600">
                      {`${unitForValue(
                        activeRecoveryGoal.habit.unit,
                        activeRecoveryGoal.amount,
                      )} ${periodRateLabel(activeRecoveryGoal.period)}`}
                    </Text>
                  </View>
                </View>

                <Text className="mt-4 text-sm font-semibold leading-5 text-gray-600">
                  Reflex adjusted this step to keep your plan realistic. You can
                  change it later from Edit Habit.
                </Text>

                <Pressable
                  onPress={() => {
                    if (
                      reviewedRecoveryGoalHabitIds.includes(
                        activeRecoveryGoal.habit.id,
                      )
                    ) {
                      const next = recoveryGoalSnapshot.find(
                        (item) =>
                          !reviewedRecoveryGoalHabitIds.includes(item.habit.id),
                      );
                      setActiveRecoveryGoalHabitId(next?.habit.id ?? null);
                      return;
                    }
                    void finishActiveRecoveryGoal();
                  }}
                  className="mt-5 rounded-3xl bg-blue-600 px-5 py-4"
                >
                  <Text className="text-center text-base font-black text-white">
                    {reviewedRecoveryGoalHabitIds.includes(
                      activeRecoveryGoal.habit.id,
                    )
                      ? "Done"
                      : "Got It"}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={nextGoalReviewOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setNextGoalReviewOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
          <View className="flex-row items-center justify-between border-b border-gray-200 px-5 py-4">
            <View className="flex-1 pr-4">
              <Text className="text-xs font-black uppercase tracking-widest text-green-600">
                Goal complete
              </Text>
              <Text className="mt-1 text-2xl font-black text-black">
                {nextGoalSnapshot.length === 1
                  ? "You Reached Your Goal!"
                  : `${nextGoalSnapshot.length} Goals Reached!`}
              </Text>
            </View>
            <Pressable
              onPress={() => setNextGoalReviewOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Close next goals"
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
            {nextGoalSnapshot.length > 1 ? (
              <>
                <Text className="text-sm font-black text-gray-600">
                  {`${reviewedNextGoalHabitIds.length} of ${nextGoalSnapshot.length} reviewed`}
                </Text>
                <ScrollView
                  ref={nextGoalChipScroller.scrollRef}
                  className="mt-3"
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  onLayout={nextGoalChipScroller.onViewportLayout}
                >
                  {nextGoalSnapshot.map((habit) => {
                    const selected = habit.id === activeNextGoalHabitId;
                    const reviewed = reviewedNextGoalHabitIds.includes(
                      habit.id,
                    );

                    return (
                      <Pressable
                        key={habit.id}
                        onLayout={(event) =>
                          nextGoalChipScroller.onChipLayout(
                            habit.id,
                            selected,
                            event,
                          )
                        }
                        onPress={() => {
                          void Haptics.selectionAsync();
                          setActiveNextGoalHabitId(habit.id);
                        }}
                        className="mr-2 flex-row items-center rounded-full border px-3.5 py-2"
                        style={{
                          borderColor: selected ? habit.color : "#E5E7EB",
                          backgroundColor: selected
                            ? habit.color
                            : reviewed
                              ? "#F0FDF4"
                              : "#FFFFFF",
                        }}
                      >
                        {reviewed ? (
                          <Ionicons
                            name="checkmark-circle"
                            size={15}
                            color={selected ? "#FFFFFF" : "#16A34A"}
                          />
                        ) : null}
                        <Text
                          numberOfLines={1}
                          className={`font-black ${
                            reviewed ? "ml-1" : ""
                          } ${selected ? "text-white" : "text-black"}`}
                        >
                          {habit.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            ) : null}

            {allNextGoalsReviewed && activeNextGoalHabitId == null ? (
              <View className="mt-6 items-center rounded-[28px] border border-green-200 bg-green-50 p-6">
                <View className="h-14 w-14 items-center justify-center rounded-full bg-white">
                  <Ionicons name="checkmark-circle" size={30} color="#16A34A" />
                </View>
                <Text className="mt-3 text-xl font-black text-black">
                  All goals reviewed
                </Text>
                <Text className="mt-1 text-center text-sm font-semibold leading-5 text-gray-600">
                  Your choices have been saved.
                </Text>
                <Pressable
                  onPress={() => setNextGoalReviewOpen(false)}
                  className="mt-5 w-full rounded-3xl bg-green-600 px-5 py-4"
                >
                  <Text className="text-center text-base font-black text-white">
                    Done
                  </Text>
                </Pressable>
              </View>
            ) : activeNextGoalHabit && activeNextGoalAmount != null ? (
              <View className="mt-5 rounded-[28px] border border-gray-200 bg-gray-50 p-4">
                <View className="flex-row items-center">
                  <View className="h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white">
                    <Ionicons
                      name={cleanHabitIcon(activeNextGoalHabit.icon)}
                      size={22}
                      color={activeNextGoalHabit.color}
                    />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-lg font-black text-black">
                      {activeNextGoalHabit.name}
                    </Text>
                    <Text className="mt-0.5 text-xs font-semibold text-gray-500">
                      Nice work! Your next step is ready
                    </Text>
                  </View>
                </View>

                <View className="mt-4 flex-row gap-3">
                  <View className="flex-1 rounded-3xl border border-gray-200 bg-white p-4">
                    <Text className="text-xs font-black uppercase tracking-wide text-gray-500">
                      Completed Goal
                    </Text>
                    <Text className="mt-2 text-3xl font-black text-black">
                      {formatAverage(activeNextGoalCurrentAmount)}
                    </Text>
                    <Text className="mt-1 text-xs font-bold leading-4 text-gray-500">
                      {`${unitForValue(
                        activeNextGoalHabit.unit,
                        activeNextGoalCurrentAmount,
                      )} ${periodRateLabel(
                        activeNextGoalHabit.currentGoalPeriod,
                      )}`}
                    </Text>
                  </View>

                  <View className="flex-1 rounded-3xl border border-green-200 bg-green-50 p-4">
                    <Text className="text-xs font-black uppercase tracking-wide text-green-700">
                      Next Goal
                    </Text>
                    <Text className="mt-2 text-3xl font-black text-black">
                      {formatAverage(activeNextGoalAmount)}
                    </Text>
                    <Text className="mt-1 text-xs font-bold leading-4 text-gray-600">
                      {`${unitForValue(
                        activeNextGoalHabit.unit,
                        activeNextGoalAmount,
                      )} ${periodRateLabel(
                        activeNextGoalHabit.currentGoalPeriod,
                      )}`}
                    </Text>
                  </View>
                </View>

                <Text className="mt-4 text-sm font-semibold leading-5 text-gray-600">
                  {activeNextGoalHabit.pendingGoalReason ??
                    "This smaller next step keeps you moving toward your long-term goal."}
                </Text>

                {activeNextGoalDecision ? (
                  <>
                    <View className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
                      <Text className="text-center text-sm font-black text-green-700">
                        {activeNextGoalDecision === "approve"
                          ? "Goal applied"
                          : "Saved for later"}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        const next = nextGoalSnapshot.find(
                          (habit) =>
                            !reviewedNextGoalHabitIds.includes(habit.id),
                        );
                        setActiveNextGoalHabitId(next?.id ?? null);
                      }}
                      className="mt-3 rounded-2xl bg-green-600 px-4 py-3"
                    >
                      <Text className="text-center text-sm font-black text-white">
                        Done
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <View className="mt-5 flex-row gap-3">
                    <Pressable
                      disabled={nextGoalActionBusy}
                      onPress={() => void finishActiveNextGoal("later")}
                      className={`flex-1 rounded-2xl border border-gray-300 bg-white px-4 py-3 ${
                        nextGoalActionBusy ? "opacity-50" : ""
                      }`}
                    >
                      <Text className="text-center text-sm font-black text-black">
                        Not Now
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={nextGoalActionBusy}
                      onPress={() => void finishActiveNextGoal("approve")}
                      className={`flex-1 rounded-2xl bg-green-600 px-4 py-3 ${
                        nextGoalActionBusy ? "opacity-50" : ""
                      }`}
                    >
                      <Text className="text-center text-sm font-black text-white">
                        Use This Goal
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
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
                {calculatedNoticeSnapshot.length === 1
                  ? "Your Calculated Average"
                  : "Your Calculated Averages"}
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
            {calculatedNoticeSnapshot.length > 1 ? (
              <>
                <Text className="text-sm font-black text-gray-600">
                  {`${reviewedCalculatedHabitIds.length} of ${calculatedNoticeSnapshot.length} reviewed`}
                </Text>
                <ScrollView
                  ref={calculatedNoticeChipScroller.scrollRef}
                  className="mt-3"
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  onLayout={calculatedNoticeChipScroller.onViewportLayout}
                >
                  {calculatedNoticeSnapshot.map((habit) => {
                    const selected = habit.id === activeCalculatedHabitId;
                    const reviewed = reviewedCalculatedHabitIds.includes(
                      habit.id,
                    );
                    return (
                      <Pressable
                        key={habit.id}
                        onLayout={(event) =>
                          calculatedNoticeChipScroller.onChipLayout(
                            habit.id,
                            selected,
                            event,
                          )
                        }
                        onPress={() => {
                          void Haptics.selectionAsync();
                          setActiveCalculatedHabitId(habit.id);
                        }}
                        className="mr-2 flex-row items-center rounded-full border px-3.5 py-2"
                        style={{
                          borderColor: selected ? habit.color : "#E5E7EB",
                          backgroundColor: selected
                            ? habit.color
                            : reviewed
                              ? "#FAF5FF"
                              : "#FFFFFF",
                        }}
                      >
                        {reviewed ? (
                          <Ionicons
                            name="checkmark-circle"
                            size={15}
                            color={selected ? "#FFFFFF" : "#7C3AED"}
                          />
                        ) : null}
                        <Text
                          numberOfLines={1}
                          className={`font-black ${
                            reviewed ? "ml-1" : ""
                          } ${selected ? "text-white" : "text-black"}`}
                        >
                          {habit.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            ) : null}

            {allCalculatedHabitsReviewed && activeCalculatedHabitId == null ? (
              <View className="mt-6 items-center rounded-[28px] border border-purple-200 bg-purple-50 p-6">
                <View className="h-14 w-14 items-center justify-center rounded-full bg-white">
                  <Ionicons name="checkmark-circle" size={30} color="#7C3AED" />
                </View>
                <Text className="mt-3 text-xl font-black text-black">
                  All averages reviewed
                </Text>
                <Pressable
                  onPress={dismissCalculatedNotice}
                  className="mt-5 w-full rounded-3xl bg-purple-600 px-5 py-4"
                >
                  <Text className="text-center text-base font-black text-white">
                    Done
                  </Text>
                </Pressable>
              </View>
            ) : (
              <>
                {activeCalculatedHabit ? (
                  <View className="mt-5 gap-3">
                    {[activeCalculatedHabit].map((habit) => {
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
                      const habitGoalChanges = goalHistory.filter(
                        (entry) => entry.habitId === habit.id,
                      );
                      const calibrationGoalIndex = habitGoalChanges.findIndex(
                        (entry) => entry.reason === "calibration",
                      );
                      const calibrationGoal =
                        calibrationGoalIndex >= 0
                          ? habitGoalChanges[calibrationGoalIndex]
                          : null;
                      const previousStepGoal =
                        calibrationGoalIndex >= 0
                          ? (habitGoalChanges[calibrationGoalIndex + 1] ?? null)
                          : null;
                      const previewFinalTarget = habit.finalTarget ?? 0;
                      const previewEstimatedStep = calculateInitialCurrentGoal(
                        estimatedAmount ?? 10,
                        habit.baselinePeriod,
                        previewFinalTarget,
                        habit.goalPeriod,
                        habit.measurementType,
                      );
                      const previewCalculatedStep = calculateInitialCurrentGoal(
                        calculatedAmount ?? 8,
                        habit.baselinePeriod,
                        previewFinalTarget,
                        habit.goalPeriod,
                        habit.measurementType,
                      );
                      const previewStepSize =
                        habit.measurementType === "minutes" ? 5 : 1;
                      const displayedPreviousStepGoal = bannerPreviewActive
                        ? {
                            amount:
                              Math.abs(
                                previewEstimatedStep - previewCalculatedStep,
                              ) > 0.0001
                                ? previewEstimatedStep
                                : previewCalculatedStep + previewStepSize,
                            period: habit.goalPeriod,
                          }
                        : previousStepGoal;
                      const displayedCalibrationGoal = bannerPreviewActive
                        ? {
                            amount: previewCalculatedStep,
                            period: habit.goalPeriod,
                          }
                        : calibrationGoal;
                      const stepGoalChanged =
                        displayedCalibrationGoal != null &&
                        displayedPreviousStepGoal != null &&
                        Math.abs(
                          displayedCalibrationGoal.amount -
                            displayedPreviousStepGoal.amount,
                        ) > 0.0001;

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
                            <View className="ml-3 flex-1">
                              <Text className="text-lg font-black text-black">
                                {habit.name}
                              </Text>
                              <Text className="mt-0.5 text-xs font-semibold text-gray-500">
                                Based on your recent tracking
                              </Text>
                            </View>
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

                          {stepGoalChanged &&
                          displayedCalibrationGoal &&
                          displayedPreviousStepGoal ? (
                            <View className="mt-3 rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3">
                              <Text className="text-sm font-bold leading-5 text-gray-700">
                                {`Step goal updated: ${formatAverage(
                                  displayedPreviousStepGoal.amount,
                                )} ${unitForValue(
                                  habit.unit,
                                  displayedPreviousStepGoal.amount,
                                )} ${periodRateLabel(
                                  displayedPreviousStepGoal.period,
                                )} → ${formatAverage(
                                  displayedCalibrationGoal.amount,
                                )} ${unitForValue(
                                  habit.unit,
                                  displayedCalibrationGoal.amount,
                                )} ${periodRateLabel(
                                  displayedCalibrationGoal.period,
                                )}`}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                <Pressable
                  onPress={() => {
                    if (
                      activeCalculatedHabit &&
                      reviewedCalculatedHabitIds.includes(
                        activeCalculatedHabit.id,
                      )
                    ) {
                      const next = calculatedNoticeSnapshot.find(
                        (habit) =>
                          !reviewedCalculatedHabitIds.includes(habit.id),
                      );
                      setActiveCalculatedHabitId(next?.id ?? null);
                      return;
                    }
                    void finishActiveCalculatedHabit();
                  }}
                  className="mt-5 rounded-3xl bg-purple-600 px-5 py-4"
                >
                  <Text className="text-center text-base font-black text-white">
                    {activeCalculatedHabit &&
                    reviewedCalculatedHabitIds.includes(
                      activeCalculatedHabit.id,
                    )
                      ? "Done"
                      : "Got It"}
                  </Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}
