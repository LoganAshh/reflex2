import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { WeeklyReviewLogRequest } from "../App";
import LogScreen from "../screens/LogScreen";
import { useData, type Habit, type TrackingStatus } from "../data/DataContext";
import { startOfLocalDay } from "../data/baselines";
import { getPreviousCycleBounds } from "../data/tracking";

function addDays(timestamp: number, days: number) {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

function dateRange(startAt: number, endAtExclusive: number) {
  const end = new Date(endAtExclusive);
  end.setDate(end.getDate() - 1);
  return `${new Date(startAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}–${end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
}

export function TrackingReviewCard({
  habits,
  onAddMissingLog,
  onDone,
  initialHabitId = null,
}: {
  habits: Habit[];
  onAddMissingLog?: (habitId: number, dayStart: number) => void;
  onDone?: () => void;
  initialHabitId?: number | null;
}) {
  const { logs, trackingConfirmations, setTrackingConfirmationsBatch } =
    useData();
  const [habitId, setHabitId] = useState<number | null>(
    initialHabitId ?? habits[0]?.id ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [reviewingGaps, setReviewingGaps] = useState(false);
  const [reviewedThisSession, setReviewedThisSession] = useState<number[]>([]);
  const [allReviewsComplete, setAllReviewsComplete] = useState(false);
  const [gapChoices, setGapChoices] = useState<
    Record<number, "nothing_happened" | "not_yet">
  >({});

  useEffect(() => {
    if (habitId != null && habits.some((habit) => habit.id === habitId)) {
      return;
    }
    setHabitId(habits[0]?.id ?? null);
  }, [habitId, habits]);

  useEffect(() => {
    setReviewingGaps(false);
    setGapChoices({});
  }, [habitId]);

  const habit = useMemo(
    () => habits.find((item) => item.id === habitId) ?? habits[0] ?? null,
    [habitId, habits],
  );

  const previousWeek = getPreviousCycleBounds("week");
  const weekDays = useMemo(() => {
    if (!habit) return [];
    return Array.from({ length: 7 }, (_, index) => {
      const startAt = addDays(previousWeek.startAt, index);
      const endAtExclusive = addDays(startAt, 1);
      const dayLogs = logs.filter(
        (log) =>
          log.habitId === habit.id &&
          log.createdAt >= startAt &&
          log.createdAt < endAtExclusive,
      );
      const confirmation = trackingConfirmations.find(
        (item) =>
          item.habitId === habit.id &&
          item.period === "day" &&
          item.periodStart === startAt,
      );
      return { startAt, endAtExclusive, logs: dayLogs, confirmation };
    });
  }, [habit, logs, previousWeek.startAt, trackingConfirmations]);
  const trackingStarts = habit
    ? [
        habit.calibrationStartedAt,
        ...logs
          .filter((log) => log.habitId === habit.id)
          .map((log) => log.createdAt),
        ...trackingConfirmations
          .filter(
            (item) => item.habitId === habit.id && item.status !== "not_yet",
          )
          .map((item) => item.periodStart),
      ].filter((value): value is number => value != null)
    : [];
  const canReviewPreviousWeek =
    trackingStarts.length > 0 &&
    startOfLocalDay(Math.min(...trackingStarts)) <= previousWeek.startAt;
  const weeklyConfirmation = habit
    ? trackingConfirmations.find(
        (item) =>
          item.habitId === habit.id &&
          item.period === "week" &&
          item.periodStart === previousWeek.startAt,
      )
    : null;
  const weekIsConfirmed =
    weeklyConfirmation?.status === "everything_logged" ||
    weeklyConfirmation?.status === "nothing_happened";

  const isHabitReviewed = (id: number) => {
    if (reviewedThisSession.includes(id)) return true;
    const confirmation = trackingConfirmations.find(
      (item) =>
        item.habitId === id &&
        item.period === "week" &&
        item.periodStart === previousWeek.startAt,
    );
    return (
      confirmation?.status === "everything_logged" ||
      confirmation?.status === "nothing_happened"
    );
  };
  const reviewedCount = habits.filter((item) =>
    isHabitReviewed(item.id),
  ).length;

  if (!habit) return null;

  const finishHabitReview = async () => {
    const completedIds = new Set([...reviewedThisSession, habit.id]);
    setReviewedThisSession([...completedIds]);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const nextHabit = habits.find(
      (item) => item.id !== habit.id && !isHabitReviewed(item.id),
    );
    if (nextHabit) {
      setHabitId(nextHabit.id);
    } else {
      setAllReviewsComplete(true);
    }
  };

  const confirmWholeWeek = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const hasAnyLogs = weekDays.some((day) => day.logs.length > 0);
      await setTrackingConfirmationsBatch([
        ...weekDays.map((day) => ({
          habitId: habit.id,
          period: "day" as const,
          periodStart: day.startAt,
          status: (day.logs.length > 0
            ? "everything_logged"
            : "nothing_happened") as TrackingStatus,
        })),
        {
          habitId: habit.id,
          period: "week",
          periodStart: previousWeek.startAt,
          status: hasAnyLogs ? "everything_logged" : "nothing_happened",
        },
      ]);
      setReviewingGaps(false);
      await finishHabitReview();
    } finally {
      setSaving(false);
    }
  };

  const confirmKnownDays = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const daily = weekDays.map((day) => ({
        habitId: habit.id,
        period: "day" as const,
        periodStart: day.startAt,
        status: (day.logs.length > 0
          ? "everything_logged"
          : (gapChoices[day.startAt] ??
            (day.confirmation?.status === "nothing_happened"
              ? "nothing_happened"
              : day.confirmation?.status === "not_yet"
                ? "not_yet"
                : "nothing_happened"))) as TrackingStatus,
      }));
      const hasAnyLogs = weekDays.some((day) => day.logs.length > 0);
      await setTrackingConfirmationsBatch([
        ...daily,
        {
          habitId: habit.id,
          period: "week",
          periodStart: previousWeek.startAt,
          status: hasAnyLogs ? "everything_logged" : "nothing_happened",
        },
      ]);
      setReviewingGaps(false);
      await finishHabitReview();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="mt-5 rounded-[28px] border border-gray-200 bg-gray-50 p-4 shadow-sm">
      <View className="flex-row items-center">
        <View className="h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white">
          <Ionicons name="checkmark-done" size={21} color={habit.color} />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-lg font-black text-black">Tracking review</Text>
          <Text className="mt-0.5 text-xs font-semibold leading-4 text-gray-500">
            {reviewedCount} of {habits.length} reviewed
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-3"
      >
        {habits.map((item: Habit) => {
          const selected = item.id === habit.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => {
                Haptics.selectionAsync();
                setAllReviewsComplete(false);
                setHabitId(item.id);
              }}
              className="mr-2 flex-row items-center rounded-full border px-3 py-2"
              style={{
                borderColor: selected ? item.color : "#E5E7EB",
                backgroundColor: selected ? item.color : "#FFFFFF",
              }}
            >
              <Text
                className={`text-xs font-black ${selected ? "text-white" : "text-black"}`}
              >
                {item.name}
              </Text>
              {isHabitReviewed(item.id) ? (
                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color={selected ? "#FFFFFF" : "#16A34A"}
                  style={{ marginLeft: 5 }}
                />
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {allReviewsComplete ? (
        <View className="mt-3 items-center rounded-3xl border border-green-200 bg-green-50 p-5">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-green-600">
            <Ionicons name="checkmark-done" size={28} color="#FFFFFF" />
          </View>
          <Text className="mt-3 text-xl font-black text-black">
            All reviews complete
          </Text>
          <Pressable
            onPress={onDone}
            className="mt-4 w-full rounded-2xl bg-green-600 px-4 py-3"
          >
            <Text className="text-center text-sm font-black text-white">
              Done
            </Text>
          </Pressable>
        </View>
      ) : canReviewPreviousWeek ? (
        <View className="mt-3 rounded-3xl border border-gray-200 bg-white p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-base font-black text-black">
                Does last week look complete?
              </Text>
              <Text className="mt-1 text-xs font-semibold text-gray-500">
                {dateRange(previousWeek.startAt, previousWeek.endAtExclusive)}
              </Text>
            </View>
            {weekIsConfirmed ? (
              <View className="rounded-full bg-green-100 px-3 py-1.5">
                <Text className="text-xs font-black text-green-700">
                  Reviewed
                </Text>
              </View>
            ) : null}
          </View>

          <View className="mt-3 gap-2">
            {weekDays.map((day) => {
              const activity = day.logs.reduce(
                (sum, log) =>
                  sum + (log.didResist === 1 ? 0 : Math.max(0, log.count)),
                0,
              );
              const resisted = day.logs.filter(
                (log) => log.didResist === 1,
              ).length;
              const emptyChoice =
                gapChoices[day.startAt] ??
                (day.confirmation?.status === "nothing_happened"
                  ? "nothing_happened"
                  : day.confirmation?.status === "not_yet"
                    ? "not_yet"
                    : "nothing_happened");
              return (
                <View
                  key={day.startAt}
                  className="rounded-2xl bg-gray-50 px-3 py-2.5"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-black text-black">
                      {new Date(day.startAt).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                    <Text className="text-xs font-bold text-gray-500">
                      {day.logs.length > 0
                        ? `${activity} activity · ${resisted} resisted`
                        : emptyChoice === "nothing_happened"
                          ? "Nothing happened"
                          : "Empty · unknown"}
                    </Text>
                  </View>
                  {reviewingGaps ? (
                    <View className="mt-2 gap-2">
                      {day.logs.length === 0 ? (
                        <View className="flex-row gap-2">
                          <Pressable
                            onPress={() =>
                              setGapChoices((current) => ({
                                ...current,
                                [day.startAt]: "nothing_happened",
                              }))
                            }
                            className={`flex-1 rounded-xl border px-2 py-2 ${
                              emptyChoice === "nothing_happened"
                                ? "border-green-600 bg-green-600"
                                : "border-gray-200 bg-white"
                            }`}
                          >
                            <Text
                              className={`text-center text-[11px] font-black ${emptyChoice === "nothing_happened" ? "text-white" : "text-black"}`}
                            >
                              Nothing happened
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() =>
                              setGapChoices((current) => ({
                                ...current,
                                [day.startAt]: "not_yet",
                              }))
                            }
                            className={`flex-1 rounded-xl border px-2 py-2 ${
                              emptyChoice === "not_yet"
                                ? "border-gray-700 bg-gray-700"
                                : "border-gray-200 bg-white"
                            }`}
                          >
                            <Text
                              className={`text-center text-[11px] font-black ${emptyChoice === "not_yet" ? "text-white" : "text-black"}`}
                            >
                              Forgot or unsure
                            </Text>
                          </Pressable>
                        </View>
                      ) : null}

                      {onAddMissingLog ? (
                        <Pressable
                          onPress={() => onAddMissingLog(habit.id, day.startAt)}
                          className="flex-row items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-2"
                        >
                          <Ionicons
                            name="add-circle-outline"
                            size={16}
                            color="#111827"
                          />
                          <Text className="ml-1.5 text-[11px] font-black text-black">
                            {day.logs.length === 0
                              ? "Add missing log"
                              : "Add another log"}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>

          {reviewingGaps ? (
            <Pressable
              disabled={saving}
              onPress={confirmKnownDays}
              className="mt-3 rounded-2xl bg-green-600 px-4 py-3"
            >
              <Text className="text-center text-sm font-black text-white">
                Save known days
              </Text>
            </Pressable>
          ) : weekIsConfirmed ? (
            <Pressable
              disabled={saving}
              onPress={() => setReviewingGaps(true)}
              className="mt-3 rounded-2xl border border-gray-200 bg-white px-4 py-3"
            >
              <Text className="text-center text-sm font-black text-black">
                Edit reviewed days
              </Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                disabled={saving}
                onPress={confirmWholeWeek}
                className="mt-3 rounded-2xl bg-green-600 px-4 py-3"
              >
                <Text className="text-center text-sm font-black text-white">
                  Yes, this looks complete
                </Text>
              </Pressable>
              <Pressable
                disabled={saving}
                onPress={() => setReviewingGaps(true)}
                className="mt-2 rounded-2xl border border-gray-200 bg-white px-4 py-3"
              >
                <Text className="text-center text-sm font-black text-black">
                  Review days
                </Text>
              </Pressable>
            </>
          )}
        </View>
      ) : (
        <View className="mt-3 rounded-3xl border border-gray-200 bg-white p-4">
          <Text className="text-sm font-black text-black">
            Your first weekly review is building
          </Text>
          <Text className="mt-1 text-xs font-semibold leading-4 text-gray-500">
            It will appear after your first full Monday–Sunday tracking week.
          </Text>
        </View>
      )}
    </View>
  );
}

function WeeklyReviewLogOverlay({
  request,
  onClose,
}: {
  request: WeeklyReviewLogRequest;
  onClose: () => void;
}) {
  const screenWidth = Dimensions.get("window").width;
  const translateX = useRef(new Animated.Value(screenWidth)).current;
  const closingRef = useRef(false);

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [translateX]);

  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;

    Animated.timing(translateX, {
      toValue: screenWidth,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(onClose);
  };

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 20,
        elevation: 20,
        backgroundColor: "#FFFFFF",
        transform: [{ translateX }],
      }}
    >
      <LogScreen
        weeklyReviewLogOverride={request}
        onWeeklyReviewReturn={close}
      />
    </Animated.View>
  );
}

export function TrackingReviewLauncher({
  placement,
  habitId = null,
}: {
  placement: "home" | "analytics";
  habitId?: number | null;
}) {
  const { selectedHabits, logs, trackingConfirmations } = useData();
  const [open, setOpen] = useState(false);
  const [activeReviewLog, setActiveReviewLog] =
    useState<WeeklyReviewLogRequest | null>(null);
  const [modalHabitIds, setModalHabitIds] = useState<number[]>([]);
  const [modalInitialHabitId, setModalInitialHabitId] = useState<number | null>(
    null,
  );
  const previousWeek = getPreviousCycleBounds("week");
  const scopedHabits =
    habitId != null
      ? selectedHabits.filter((habit) => habit.id === habitId)
      : selectedHabits;
  const reviewableHabits = scopedHabits.filter((habit) => {
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
      startOfLocalDay(Math.min(...starts)) <= previousWeek.startAt;
    return hasFullWeek;
  });
  const dueHabits = reviewableHabits.filter((habit) => {
    const confirmation = trackingConfirmations.find(
      (item) =>
        item.habitId === habit.id &&
        item.period === "week" &&
        item.periodStart === previousWeek.startAt,
    );
    const complete =
      confirmation?.status === "everything_logged" ||
      confirmation?.status === "nothing_happened";
    return !complete;
  });
  const hasDueReview = dueHabits.length > 0;
  const visibleHabits = placement === "home" ? dueHabits : reviewableHabits;
  const modalHabits = useMemo(
    () =>
      modalHabitIds
        .map((id) => selectedHabits.find((habit) => habit.id === id))
        .filter((habit): habit is Habit => habit != null),
    [modalHabitIds, selectedHabits],
  );

  const openReview = () => {
    if (visibleHabits.length === 0) return;
    setModalHabitIds(visibleHabits.map((habit) => habit.id));
    setModalInitialHabitId(dueHabits[0]?.id ?? visibleHabits[0]?.id ?? null);
    setOpen(true);
  };

  const addMissingLog = (missingHabitId: number, dayStart: number) => {
    const now = new Date();
    const selectedDay = new Date(dayStart);
    selectedDay.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
    const token = Date.now();
    setActiveReviewLog({
      token,
      habitId: missingHabitId,
      createdAt: selectedDay.getTime(),
    });
  };

  useEffect(() => {
    if (open && modalHabitIds.length > 0 && modalHabits.length === 0) {
      setOpen(false);
    }
  }, [modalHabitIds.length, modalHabits.length, open]);

  if (placement === "home" && !hasDueReview && !open) return null;
  if (placement === "analytics" && reviewableHabits.length === 0 && !open) {
    return null;
  }

  return (
    <>
      {placement === "home" ? (
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            openReview();
          }}
          className="mt-3 flex-row items-center rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3"
        >
          <View className="h-9 w-9 items-center justify-center rounded-xl bg-white">
            <Ionicons name="calendar-outline" size={19} color="#0F766E" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-sm font-black text-black">
              {dueHabits.length === 1
                ? "Last week is ready to review"
                : `${dueHabits.length} weekly reviews are ready`}
            </Text>
            <Text className="mt-0.5 text-xs font-semibold text-gray-500">
              About 1 minute
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#0F766E" />
        </Pressable>
      ) : (
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            openReview();
          }}
          className="mt-5 flex-row items-center rounded-[28px] border border-gray-200 bg-gray-50 p-4 shadow-sm"
        >
          <View className="h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white">
            <Ionicons name="checkmark-done" size={22} color="#16A34A" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-base font-black text-black">
              Weekly tracking reviews
            </Text>
            <Text className="mt-1 text-xs font-semibold leading-4 text-gray-500">
              {hasDueReview
                ? `${dueHabits.length} ${dueHabits.length === 1 ? "review is" : "reviews are"} ready.`
                : "Review provisional days or correct a forgotten day."}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#6B7280" />
        </Pressable>
      )}

      {open ? (
        <Modal
          visible
          animationType="slide"
          presentationStyle="pageSheet"
          allowSwipeDismissal={activeReviewLog == null}
          onRequestClose={() => {
            if (!activeReviewLog) setOpen(false);
          }}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
            <View className="flex-row items-center justify-between border-b border-gray-200 px-5 py-4">
              <View className="flex-1 pr-4">
                <Text className="text-xs font-black uppercase tracking-widest text-teal-700">
                  Tracking
                </Text>
                <Text className="mt-1 text-2xl font-black text-black">
                  Weekly review
                </Text>
              </View>
              <Pressable
                onPress={() => setOpen(false)}
                className="h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white"
              >
                <Ionicons name="close" size={20} color="#000000" />
              </Pressable>
            </View>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                flexGrow: 1,
                paddingHorizontal: 20,
                paddingBottom: 32,
              }}
              showsVerticalScrollIndicator={false}
            >
              <TrackingReviewCard
                key={`${placement}:${habitId ?? "overall"}:${modalHabitIds.join(",")}`}
                habits={modalHabits}
                onAddMissingLog={addMissingLog}
                initialHabitId={modalInitialHabitId}
                onDone={() => setOpen(false)}
              />
            </ScrollView>

            {activeReviewLog ? (
              <WeeklyReviewLogOverlay
                request={activeReviewLog}
                onClose={() => setActiveReviewLog(null)}
              />
            ) : null}
          </SafeAreaView>
        </Modal>
      ) : null}
    </>
  );
}
