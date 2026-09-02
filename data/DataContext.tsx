import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Notifications from "expo-notifications";
import type {
  Habit,
  Cue,
  Place,
  SelectedHabit,
  SelectedCue,
  SelectedPlace,
  LogEntry,
  ReplacementAction,
  AddLogInput,
  AddActionInput,
  UpdateLogInput,
  DailyReminderSettings,
  HabitPlanInput,
  HabitMeasurementType,
  HabitPeriod,
  DataContextType,
  DataProviderProps,
  GoalHistoryEntry,
  GoalChangeReason,
  TrackingConfirmation,
  TrackingPeriod,
  TrackingStatus,
  CycleHistoryEntry,
} from "./types";
import {
  db,
  normalizeName,
  initDb,
  seedDefaultHabitsIfEmpty,
  seedDefaultCuesIfEmpty,
  seedDefaultLocationsIfEmpty,
  seedDefaultActionsIfEmpty,
  dropAllDataTables,
  recreateDataTables,
  loadHabits,
  loadCues,
  loadLocations,
  loadSelectedHabits,
  loadSelectedCues,
  loadSelectedLocations,
  loadLogs,
  loadActions,
  loadSelectedActionIds,
  replaceSelectedHabits,
  replaceSelectedCues,
  replaceSelectedLocations,
  insertCustomHabit,
  insertCustomCue,
  insertCustomLocation,
  insertLog,
  updateLogInDb,
  deleteLogInDb,
  updateLogSelectedActionInDb,
  insertAction,
  getHabitById,
  getCueById,
  getLocationById,
  getActionById,
  renameCustomHabitInDb,
  updateHabitInDb,
  updateHabitPlanInDb,
  renameCustomCueInDb,
  renameCustomLocationInDb,
  renameCustomActionInDb,
  deleteOrHideCustomHabitInDb,
  deleteOrHideCustomCueInDb,
  deleteOrHideCustomLocationInDb,
  deleteOrHideCustomActionInDb,
  selectedActionExists,
  removeSelectedAction,
  addSelectedAction,
  clearAllSelectedActions,
  loadGoalHistory,
  setCurrentGoalInDb,
  setPendingGoalInDb,
  clearPendingGoalInDb,
  setCalibrationStartedAtInDb,
  saveCalibratedBaselineInDb,
  resetHabitBaselineInDb,
  loadTrackingConfirmations,
  loadCycleHistory,
  upsertTrackingConfirmation,
  replaceCycleHistory,
} from "./db";
import {
  loadOnboardedFlag,
  saveOnboardedFlag,
  loadProfileName,
  saveProfileName,
  loadProfilePhotoUri,
  saveProfilePhotoUri,
  loadProfileDoneFlag,
  saveProfileDoneFlag,
  loadAppLockEnabledFlag,
  saveAppLockEnabledFlag,
  loadDailyReminderSettings,
  saveDailyReminderSettings,
  loadDailyReminderNotificationId,
  saveDailyReminderNotificationId,
  deleteManagedProfilePhoto,
  normalizeStoredProfilePhotoUri,
} from "./profileStorage";
import { cleanHabitIcon } from "./habitIcons";
import {
  getBaselineSummary,
  getCalibrationCandidate,
  startOfLocalDay,
} from "./baselines";
import {
  calculateEasierGoal,
  calculateInitialCurrentGoal,
  calculateNextReductionGoal,
  consecutiveDifficultCycles,
  goalChangeExplanation,
  normalizeGoalAmount,
} from "./goals";
import { getCompletedCycleHistory, getLatestCycleReview } from "./tracking";

export type {
  Habit,
  Cue,
  Place,
  SelectedHabit,
  SelectedCue,
  SelectedPlace,
  LogEntry,
  ReplacementAction,
  AddLogInput,
  AddActionInput,
  UpdateLogInput,
  DailyReminderSettings,
  HabitPlanInput,
  HabitMeasurementType,
  HabitPeriod,
  DataContextType,
  GoalHistoryEntry,
  GoalChangeReason,
  TrackingConfirmation,
  TrackingPeriod,
  TrackingStatus,
} from "./types";

type BackupNamedEntity = {
  id: number;
  name: string;
  isCustom: 0 | 1;
  hidden: 0 | 1;
  color: string;
  icon: string;
  measurementType: "times" | "amount" | "minutes" | "custom";
  unit: string;
  estimatedBaseline: number | null;
  calibratedBaseline: number | null;
  calibrationStartedAt: number | null;
  calibratedAt: number | null;
  rebaselineStartedAt: number | null;
  baselinePeriod: "day" | "week" | "28_days";
  finalTarget: number | null;
  goalPeriod: "day" | "week" | "28_days";
  currentGoal: number | null;
  currentGoalPeriod: "day" | "week" | "28_days";
  pendingGoal: number | null;
  pendingGoalPeriod: "day" | "week" | "28_days";
  pendingGoalReason: string | null;
};

type BackupGoalHistory = GoalHistoryEntry;
type BackupTrackingConfirmation = TrackingConfirmation;

type BackupActionEntity = {
  id: number;
  title: string;
  category: string | null;
  isCustom: 0 | 1;
  hidden: 0 | 1;
};

type BackupLog = {
  id: number;
  habitId: number;
  cueId: number | null;
  cueIds: number[];
  locationId: number | null;
  intensity: number | null;
  count: number;
  didResist: 0 | 1;
  notes: string | null;
  createdAt: number;
  selectedActionId: number | null;
  habitName: string | null;
  cueName: string | null;
  cueNames: string[];
  locationName: string | null;
  selectedActionTitle: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanNullableString(value: unknown) {
  const clean = cleanString(value);
  return clean.length > 0 ? clean : null;
}

function cleanColor(value: unknown) {
  const clean = cleanString(value);
  return /^#[0-9A-Fa-f]{6}$/.test(clean) ? clean.toUpperCase() : "#16A34A";
}

function cleanInt(value: unknown, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n);
}

function cleanOptionalInt(value: unknown) {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

function cleanOptionalNumber(value: unknown) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function daysInHabitPeriod(period: HabitPeriod) {
  if (period === "week") return 7;
  if (period === "28_days") return 28;
  return 1;
}

function cleanBoolean(value: unknown) {
  return value === true || value === "true" || value === 1;
}

function cleanIsCustom(value: unknown): 0 | 1 {
  return cleanBoolean(value) ? 1 : 0;
}

function validateBackupPayload(value: unknown) {
  if (!isRecord(value)) {
    throw new Error("That backup file is not valid JSON data.");
  }

  if (value.app !== "Reflex") {
    throw new Error("That file does not look like a Reflex backup.");
  }

  const habits = asArray(value.habits);
  const cues = asArray(value.cues);
  const locations = asArray(value.locations);
  const actions = asArray(value.actions);
  const logs = asArray(value.logs);

  for (const list of [habits, cues, locations, actions, logs]) {
    if (!list.every(isRecord)) {
      throw new Error("That backup file has invalid data inside it.");
    }
  }

  return value;
}

function sanitizeNamedEntities(items: unknown[]): BackupNamedEntity[] {
  const result: BackupNamedEntity[] = [];

  for (const item of items) {
    if (!isRecord(item)) continue;

    const id = cleanInt(item.id);
    const name = cleanString(item.name);

    if (id <= 0 || !name) continue;

    result.push({
      id,
      name,
      isCustom: cleanIsCustom(item.isCustom),
      hidden: cleanIsCustom(item.hidden),
      color: cleanColor(item.color),
      icon: cleanHabitIcon(item.icon),
      measurementType:
        item.measurementType === "amount" ||
        item.measurementType === "minutes" ||
        item.measurementType === "custom"
          ? item.measurementType
          : "times",
      unit: cleanString(item.unit) || "times",
      estimatedBaseline: cleanOptionalNumber(item.estimatedBaseline),
      calibratedBaseline: cleanOptionalNumber(item.calibratedBaseline),
      calibrationStartedAt: cleanOptionalInt(item.calibrationStartedAt),
      calibratedAt: cleanOptionalInt(item.calibratedAt),
      rebaselineStartedAt: cleanOptionalInt(item.rebaselineStartedAt),
      baselinePeriod:
        item.baselinePeriod === "week" || item.baselinePeriod === "28_days"
          ? item.baselinePeriod
          : "day",
      finalTarget: cleanOptionalNumber(item.finalTarget),
      goalPeriod:
        item.goalPeriod === "week" || item.goalPeriod === "28_days"
          ? item.goalPeriod
          : item.baselinePeriod === "week" || item.baselinePeriod === "28_days"
            ? item.baselinePeriod
            : "day",
      currentGoal: cleanOptionalNumber(item.currentGoal),
      currentGoalPeriod:
        item.currentGoalPeriod === "week" ||
        item.currentGoalPeriod === "28_days"
          ? item.currentGoalPeriod
          : item.goalPeriod === "week" || item.goalPeriod === "28_days"
            ? item.goalPeriod
            : "day",
      pendingGoal: cleanOptionalNumber(item.pendingGoal),
      pendingGoalPeriod:
        item.pendingGoalPeriod === "week" ||
        item.pendingGoalPeriod === "28_days"
          ? item.pendingGoalPeriod
          : item.goalPeriod === "week" || item.goalPeriod === "28_days"
            ? item.goalPeriod
            : "day",
      pendingGoalReason: cleanNullableString(item.pendingGoalReason),
    });
  }

  return result;
}

function sanitizeGoalHistory(items: unknown[]): BackupGoalHistory[] {
  const allowedReasons = new Set<GoalChangeReason>([
    "initial",
    "plan_updated",
    "approved_step",
    "manual_easier",
    "manual_harder",
    "recovery",
  ]);
  return items.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = cleanInt(item.id);
    const habitId = cleanInt(item.habitId);
    const amount = cleanOptionalNumber(item.amount);
    const createdAt = cleanInt(item.createdAt);
    const reason = cleanString(item.reason) as GoalChangeReason;
    if (
      id <= 0 ||
      habitId <= 0 ||
      amount == null ||
      createdAt <= 0 ||
      !allowedReasons.has(reason)
    ) {
      return [];
    }
    const period: HabitPeriod =
      item.period === "week" || item.period === "28_days" ? item.period : "day";
    return [{ id, habitId, amount, period, reason, createdAt }];
  });
}

function sanitizeTrackingConfirmations(
  items: unknown[],
): BackupTrackingConfirmation[] {
  return items.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = cleanInt(item.id);
    const habitId = cleanInt(item.habitId);
    const periodStart = cleanInt(item.periodStart);
    const updatedAt = cleanInt(item.updatedAt, periodStart);
    const period: TrackingPeriod =
      item.period === "week" || item.period === "28_days" ? item.period : "day";
    const status = cleanString(item.status) as TrackingStatus;
    if (
      id <= 0 ||
      habitId <= 0 ||
      periodStart <= 0 ||
      !["everything_logged", "nothing_happened", "not_yet"].includes(status)
    ) {
      return [];
    }
    return [{ id, habitId, period, periodStart, status, updatedAt }];
  });
}

function sanitizeActions(items: unknown[]): BackupActionEntity[] {
  const result: BackupActionEntity[] = [];

  for (const item of items) {
    if (!isRecord(item)) continue;

    const id = cleanInt(item.id);
    const title = cleanString(item.title);

    if (id <= 0 || !title) continue;

    result.push({
      id,
      title,
      category: cleanNullableString(item.category),
      isCustom: cleanIsCustom(item.isCustom),
      hidden: cleanIsCustom(item.hidden),
    });
  }

  return result;
}

function sanitizeSelectedIds(items: unknown[], key: string) {
  return Array.from(
    new Set(
      items
        .map((item) => {
          if (typeof item === "number") return cleanInt(item);
          if (!isRecord(item)) return 0;
          return cleanInt(item[key]);
        })
        .filter((id) => id > 0),
    ),
  );
}

function sanitizeLogs(items: unknown[]): BackupLog[] {
  const result: BackupLog[] = [];

  for (const item of items) {
    if (!isRecord(item)) continue;

    const id = cleanInt(item.id);
    const habitId = cleanInt(item.habitId);
    const createdAt = cleanInt(item.createdAt);

    if (id <= 0 || habitId <= 0 || createdAt <= 0) continue;

    const intensity = cleanOptionalInt(item.intensity);

    const legacyCueId = cleanOptionalInt(item.cueId);
    const legacyCueName = cleanNullableString(item.cueName);
    const cueIds = Array.from(
      new Set(
        asArray(item.cueIds)
          .map((value) => cleanInt(value))
          .filter((value) => value > 0),
      ),
    );
    const cueNames = asArray(item.cueNames)
      .map(cleanString)
      .filter((value) => value.length > 0);

    result.push({
      id,
      habitId,
      cueId: legacyCueId,
      cueIds:
        cueIds.length > 0 ? cueIds : legacyCueId == null ? [] : [legacyCueId],
      locationId: cleanOptionalInt(item.locationId),
      intensity:
        intensity == null ? null : Math.min(10, Math.max(1, intensity)),
      count: Math.min(999999, Math.max(0, cleanInt(item.count, 1))),
      didResist: cleanBoolean(item.didResist) ? 1 : 0,
      notes: cleanNullableString(item.notes),
      createdAt,
      selectedActionId: cleanOptionalInt(item.selectedActionId),
      habitName: cleanNullableString(item.habitName),
      cueName: legacyCueName,
      cueNames:
        cueNames.length > 0
          ? cueNames
          : legacyCueName == null
            ? []
            : [legacyCueName],
      locationName: cleanNullableString(item.locationName),
      selectedActionTitle: cleanNullableString(item.selectedActionTitle),
    });
  }

  return result;
}

const DataContext = createContext<DataContextType | null>(null);

const DEFAULT_DAILY_REMINDER: DailyReminderSettings = {
  option: "off",
  hour: 20,
  minute: 0,
};

async function cancelDailyReminderNotification() {
  const notificationId = await loadDailyReminderNotificationId();

  if (notificationId) {
    await Notifications.cancelScheduledNotificationAsync(notificationId).catch(
      () => {},
    );
  }

  await saveDailyReminderNotificationId("");
}

async function scheduleDailyReminderNotification(
  settings: DailyReminderSettings,
) {
  await cancelDailyReminderNotification();

  if (settings.option === "off") return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("daily-reflection", {
      name: "Daily reflection",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Check in with Reflex?",
      body: "Take a minute to reflect on your urges and wins today.",
      sound: "default",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: settings.hour,
      minute: settings.minute,
      channelId: "daily-reflection",
    },
  });

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  if (
    !scheduled.some(
      (notification) => notification.identifier === notificationId,
    )
  ) {
    throw new Error(
      "The daily reminder could not be scheduled on this device.",
    );
  }

  await saveDailyReminderNotificationId(notificationId);
}

async function resetDbForDev() {
  const savedPhoto = await loadProfilePhotoUri();
  await deleteManagedProfilePhoto(savedPhoto ?? "");

  await dropAllDataTables();
  await initDb();
  await seedDefaultHabitsIfEmpty();
  await seedDefaultCuesIfEmpty();
  await seedDefaultLocationsIfEmpty();
  await seedDefaultActionsIfEmpty();
  await saveOnboardedFlag(false);
  await saveProfileName("");
  await saveProfilePhotoUri("");
  await saveProfileDoneFlag(false);
  await saveAppLockEnabledFlag(false);
  await saveDailyReminderSettings(DEFAULT_DAILY_REMINDER);
  await cancelDailyReminderNotification();
}

export function DataProvider({ children }: DataProviderProps) {
  const [initializing, setInitializing] = useState(true);

  const [profileName, setProfileName] = useState("");
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);
  const [hasCompletedLocalProfile, setHasCompletedLocalProfile] =
    useState(false);
  const [appLockEnabled, setAppLockEnabledState] = useState(false);
  const [dailyReminder, setDailyReminderState] =
    useState<DailyReminderSettings>(DEFAULT_DAILY_REMINDER);

  const [habits, setHabits] = useState<Habit[]>([]);
  const [cues, setCues] = useState<Cue[]>([]);
  const [locations, setLocations] = useState<Place[]>([]);

  const [selectedHabits, setSelectedHabitsState] = useState<SelectedHabit[]>(
    [],
  );
  const [selectedCues, setSelectedCuesState] = useState<SelectedCue[]>([]);
  const [selectedLocations, setSelectedLocationsState] = useState<
    SelectedPlace[]
  >([]);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [actions, setActions] = useState<ReplacementAction[]>([]);
  const [selectedActionIds, setSelectedActionIds] = useState<number[]>([]);
  const [goalHistory, setGoalHistory] = useState<GoalHistoryEntry[]>([]);
  const [trackingConfirmations, setTrackingConfirmations] = useState<
    TrackingConfirmation[]
  >([]);
  const [cycleHistory, setCycleHistory] = useState<CycleHistoryEntry[]>([]);
  const [hasOnboarded, setHasOnboarded] = useState(false);

  const baselineSummaries = useMemo(
    () =>
      Object.fromEntries(
        habits.map((habit) => [
          habit.id,
          getBaselineSummary(habit, logs, Date.now(), trackingConfirmations),
        ]),
      ),
    [habits, logs, trackingConfirmations],
  );

  const cycleReviews = useMemo(
    () =>
      Object.fromEntries(
        habits.map((habit) => [
          habit.id,
          getLatestCycleReview(habit, logs, trackingConfirmations, goalHistory),
        ]),
      ),
    [habits, logs, trackingConfirmations, goalHistory],
  );

  const reconcileBaselines = async (
    currentHabits: Habit[],
    currentLogs: LogEntry[],
    currentConfirmations: TrackingConfirmation[],
    currentSelectedHabits: SelectedHabit[],
  ) => {
    let changed = false;
    const now = Date.now();
    const selectedIds = new Set(currentSelectedHabits.map((habit) => habit.id));

    for (const habit of currentHabits) {
      if (
        selectedIds.has(habit.id) &&
        habit.calibrationStartedAt == null &&
        habit.rebaselineStartedAt == null
      ) {
        const startedAt = startOfLocalDay(now);
        await setCalibrationStartedAtInDb(habit.id, startedAt);
        habit.calibrationStartedAt = startedAt;
        changed = true;
      }
      if (
        habit.calibratedBaseline != null &&
        habit.rebaselineStartedAt == null
      ) {
        continue;
      }
      const habitLogs = currentLogs.filter((log) => log.habitId === habit.id);
      const habitConfirmations = currentConfirmations.filter(
        (confirmation) =>
          confirmation.habitId === habit.id &&
          confirmation.status !== "not_yet",
      );
      if (habitLogs.length === 0 && habitConfirmations.length === 0) continue;
      const firstObservedAt = Math.min(
        ...habitLogs.map((log) => log.createdAt),
        ...habitConfirmations.map((confirmation) => confirmation.periodStart),
      );
      const startedAt =
        habit.rebaselineStartedAt ??
        habit.calibrationStartedAt ??
        startOfLocalDay(firstObservedAt);

      if (
        habit.calibrationStartedAt == null &&
        habit.rebaselineStartedAt == null
      ) {
        await setCalibrationStartedAtInDb(habit.id, startedAt);
        habit.calibrationStartedAt = startedAt;
        changed = true;
      }

      const candidate = getCalibrationCandidate(
        habit,
        currentLogs,
        now,
        currentConfirmations,
      );
      if (candidate != null) {
        await saveCalibratedBaselineInDb(habit.id, candidate, startedAt, now);
        changed = true;
      }
    }

    return changed;
  };

  const reconcileGoals = async (currentHabits: Habit[]) => {
    let changed = false;
    for (const habit of currentHabits) {
      if (
        habit.currentGoal != null ||
        habit.finalTarget == null ||
        habit.estimatedBaseline == null
      ) {
        continue;
      }
      const baseline = habit.calibratedBaseline ?? habit.estimatedBaseline;
      const amount = calculateInitialCurrentGoal(
        baseline,
        habit.baselinePeriod,
        habit.finalTarget,
        habit.goalPeriod,
        habit.measurementType,
      );
      await setCurrentGoalInDb(habit.id, amount, habit.goalPeriod, "initial");
      changed = true;
    }
    return changed;
  };

  const reconcileRecoveryGoals = async (
    currentHabits: Habit[],
    currentHistory: GoalHistoryEntry[],
    completedCycles: CycleHistoryEntry[],
  ) => {
    let changed = false;
    for (const habit of currentHabits) {
      const cycles = completedCycles.filter(
        (cycle) => cycle.habitId === habit.id,
      );
      if (consecutiveDifficultCycles(cycles) < 2) continue;
      const latest = cycles.at(-1);
      if (!latest) continue;

      // A goal change after this result means the difficult pair has already
      // been handled (automatically or by the user).
      const goalChangedAfterCycle = currentHistory.some(
        (entry) =>
          entry.habitId === habit.id &&
          entry.createdAt >= latest.endAtExclusive,
      );
      if (
        goalChangedAfterCycle ||
        habit.currentGoal == null ||
        habit.finalTarget == null ||
        latest.baseline == null
      ) {
        continue;
      }

      const finalTarget = normalizeGoalAmount(
        habit.finalTarget,
        habit.goalPeriod,
        habit.currentGoalPeriod,
      );
      const easierGoal = calculateEasierGoal(
        habit.currentGoal,
        latest.baseline,
        finalTarget,
        habit.measurementType,
      );
      if (easierGoal <= habit.currentGoal) continue;
      await setCurrentGoalInDb(
        habit.id,
        easierGoal,
        habit.currentGoalPeriod,
        "recovery",
      );
      changed = true;
    }
    return changed;
  };

  const refresh = async () => {
    let [h, c, loc, sh, sc, sl, l, a, selIds, history, confirmations] =
      await Promise.all([
        loadHabits(),
        loadCues(),
        loadLocations(),
        loadSelectedHabits(),
        loadSelectedCues(),
        loadSelectedLocations(),
        loadLogs(),
        loadActions(),
        loadSelectedActionIds(),
        loadGoalHistory(),
        loadTrackingConfirmations(),
      ]);

    if (await reconcileBaselines(h, l, confirmations, sh)) {
      [h, sh] = await Promise.all([loadHabits(), loadSelectedHabits()]);
    }
    if (await reconcileGoals(h)) {
      [h, sh, history] = await Promise.all([
        loadHabits(),
        loadSelectedHabits(),
        loadGoalHistory(),
      ]);
    }

    let completedCycles = h.flatMap((habit) =>
      getCompletedCycleHistory(habit, l, confirmations, history),
    );
    if (await reconcileRecoveryGoals(h, history, completedCycles)) {
      [h, sh, history] = await Promise.all([
        loadHabits(),
        loadSelectedHabits(),
        loadGoalHistory(),
      ]);
      completedCycles = h.flatMap((habit) =>
        getCompletedCycleHistory(habit, l, confirmations, history),
      );
    }
    await replaceCycleHistory(
      completedCycles,
      h.map((habit) => ({
        habitId: habit.id,
        period: habit.currentGoalPeriod,
      })),
    );
    const storedCycles = await loadCycleHistory();

    setHabits(h);
    setCues(c);
    setLocations(loc);
    setSelectedHabitsState(sh);
    setSelectedCuesState(sc);
    setSelectedLocationsState(sl);
    setLogs(l);
    setActions(a);
    setSelectedActionIds(selIds);
    setGoalHistory(history);
    setTrackingConfirmations(confirmations);
    setCycleHistory(storedCycles);
  };

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        await initDb();
        await seedDefaultHabitsIfEmpty();
        await seedDefaultCuesIfEmpty();
        await seedDefaultLocationsIfEmpty();
        await seedDefaultActionsIfEmpty();

        const [
          onboarded,
          savedProfileName,
          savedProfilePhoto,
          profileDone,
          savedAppLockEnabled,
          savedDailyReminder,
        ] = await Promise.all([
          loadOnboardedFlag(),
          loadProfileName(),
          loadProfilePhotoUri(),
          loadProfileDoneFlag(),
          loadAppLockEnabledFlag(),
          loadDailyReminderSettings(),
        ]);

        await saveProfilePhotoUri(savedProfilePhoto);

        if (savedDailyReminder.option !== "off") {
          const permission = await Notifications.getPermissionsAsync();
          if (permission.status === "granted") {
            await scheduleDailyReminderNotification(savedDailyReminder).catch(
              (error) => {
                console.warn("Failed to restore daily reminder:", error);
              },
            );
          }
        }

        const cleanName = savedProfileName.trim();
        const cleanPhoto = savedProfilePhoto.trim();
        const normalizedProfileDone =
          profileDone && cleanName.length > 0 && cleanPhoto.length > 0;

        if (mounted) {
          setHasOnboarded(onboarded);
          setProfileName(cleanName);
          setProfilePhotoUri(cleanPhoto || null);
          setHasCompletedLocalProfile(normalizedProfileDone);
          setAppLockEnabledState(savedAppLockEnabled);
          setDailyReminderState(savedDailyReminder);
        }

        await refresh();
      } catch (error) {
        console.error("Failed to initialize local database:", error);
      } finally {
        if (mounted) {
          setInitializing(false);
        }
      }
    };

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  const completeOnboarding = async () => {
    await saveOnboardedFlag(true);
    setHasOnboarded(true);
  };

  const resetOnboarding = async () => {
    await saveOnboardedFlag(false);
    setHasOnboarded(false);
  };

  const setAppLockEnabled: DataContextType["setAppLockEnabled"] = async (
    value,
  ) => {
    await saveAppLockEnabledFlag(value);
    setAppLockEnabledState(value);
  };

  const setDailyReminder: DataContextType["setDailyReminder"] = async (
    settings,
  ) => {
    const cleanSettings: DailyReminderSettings = {
      option: settings.option,
      hour: Math.min(23, Math.max(0, Math.round(settings.hour))),
      minute: Math.min(59, Math.max(0, Math.round(settings.minute))),
    };

    await saveDailyReminderSettings(cleanSettings);
    await scheduleDailyReminderNotification(cleanSettings);
    setDailyReminderState(cleanSettings);
  };

  const completeLocalProfile: DataContextType["completeLocalProfile"] = async (
    name,
    photoUri,
  ) => {
    const cleanName = name.trim();
    const normalizedPhoto = await normalizeStoredProfilePhotoUri(
      photoUri ?? "",
    );
    const cleanPhoto = normalizedPhoto.trim();

    if (!cleanName || !cleanPhoto) {
      throw new Error("Name and profile photo are required.");
    }

    const previousPhoto = (profilePhotoUri ?? "").trim();

    if (previousPhoto && previousPhoto !== cleanPhoto) {
      await deleteManagedProfilePhoto(previousPhoto);
    }

    await Promise.all([
      saveProfileName(cleanName),
      saveProfilePhotoUri(cleanPhoto),
      saveProfileDoneFlag(true),
    ]);

    setProfileName(cleanName);
    setProfilePhotoUri(cleanPhoto || null);
    setHasCompletedLocalProfile(true);
  };

  const clearLocalProfile: DataContextType["clearLocalProfile"] = async () => {
    const previousPhoto = (profilePhotoUri ?? "").trim();

    await deleteManagedProfilePhoto(previousPhoto);

    await Promise.all([
      saveProfileName(""),
      saveProfilePhotoUri(""),
      saveProfileDoneFlag(false),
    ]);

    setProfileName("");
    setProfilePhotoUri(null);
    setHasCompletedLocalProfile(false);
  };

  const setSelectedHabits: DataContextType["setSelectedHabits"] = async (
    habitIds,
  ) => {
    await replaceSelectedHabits(habitIds);
    setSelectedHabitsState(await loadSelectedHabits());
  };

  const setSelectedCues: DataContextType["setSelectedCues"] = async (
    cueIds,
  ) => {
    await replaceSelectedCues(cueIds);
    setSelectedCuesState(await loadSelectedCues());
  };

  const setSelectedLocations: DataContextType["setSelectedLocations"] = async (
    locationIds,
  ) => {
    await replaceSelectedLocations(locationIds);
    setSelectedLocationsState(await loadSelectedLocations());
  };

  const addCustomHabit: DataContextType["addCustomHabit"] = async (
    name,
    autoSelect = true,
    icon,
    color,
  ) => {
    const clean = name.trim();
    if (!clean) return;

    const existingHabits = await loadHabits();
    const duplicate = existingHabits.find(
      (h) => normalizeName(h.name) === normalizeName(clean),
    );
    if (duplicate) {
      throw new Error(`"${clean}" already exists.`);
    }

    await insertCustomHabit(clean, icon, cleanColor(color));
    const updatedHabits = await loadHabits();
    setHabits(updatedHabits);

    if (!autoSelect) return;

    const match = updatedHabits.find(
      (h) => h.name.toLowerCase() === clean.toLowerCase(),
    );
    if (!match) return;

    const currentSelected = await loadSelectedHabits();
    const nextIds = [...currentSelected.map((h) => h.id), match.id];
    await setSelectedHabits(nextIds);
  };

  const addCustomCue: DataContextType["addCustomCue"] = async (
    name,
    autoSelect = true,
  ) => {
    const clean = name.trim();
    if (!clean) return;

    const existingCues = await loadCues();
    const duplicate = existingCues.find(
      (c) => normalizeName(c.name) === normalizeName(clean),
    );
    if (duplicate) {
      throw new Error(`"${clean}" already exists.`);
    }

    await insertCustomCue(clean);
    const updatedCues = await loadCues();
    setCues(updatedCues);

    if (!autoSelect) return;

    const match = updatedCues.find(
      (c) => c.name.toLowerCase() === clean.toLowerCase(),
    );
    if (!match) return;

    const currentSelected = await loadSelectedCues();
    const nextIds = [...currentSelected.map((c) => c.id), match.id];
    await setSelectedCues(nextIds);
  };

  const addCustomLocation: DataContextType["addCustomLocation"] = async (
    name,
    autoSelect = true,
  ) => {
    const clean = name.trim();
    if (!clean) return;

    const existingLocations = await loadLocations();
    const duplicate = existingLocations.find(
      (l) => normalizeName(l.name) === normalizeName(clean),
    );
    if (duplicate) {
      throw new Error(`"${clean}" already exists.`);
    }

    await insertCustomLocation(clean);
    const updatedLocations = await loadLocations();
    setLocations(updatedLocations);

    if (!autoSelect) return;

    const match = updatedLocations.find(
      (l) => l.name.toLowerCase() === clean.toLowerCase(),
    );
    if (!match) return;

    const currentSelected = await loadSelectedLocations();
    const nextIds = [...currentSelected.map((l) => l.id), match.id];
    await setSelectedLocations(nextIds);
  };

  const assertUniqueName = <T extends { id: number; name: string }>(
    items: T[],
    id: number,
    name: string,
  ) => {
    const duplicate = items.find(
      (item) =>
        item.id !== id && normalizeName(item.name) === normalizeName(name),
    );
    if (duplicate) {
      throw new Error(`"${name}" already exists.`);
    }
  };

  const assertUniqueActionTitle = (
    items: ReplacementAction[],
    id: number,
    title: string,
  ) => {
    const duplicate = items.find(
      (item) =>
        item.id !== id && normalizeName(item.title) === normalizeName(title),
    );
    if (duplicate) {
      throw new Error(`"${title}" already exists.`);
    }
  };

  const renameCustomHabit: DataContextType["renameCustomHabit"] = async (
    habitId,
    name,
  ) => {
    const clean = name.trim();
    if (!clean || !Number.isFinite(habitId)) return;
    assertUniqueName(await loadHabits(), habitId, clean);
    await renameCustomHabitInDb(habitId, clean);
    await refresh();
  };

  const updateHabit: DataContextType["updateHabit"] = async (
    habitId,
    name,
    color,
    icon,
  ) => {
    const clean = name.trim();
    if (!clean || !Number.isFinite(habitId)) return;
    assertUniqueName(await loadHabits(), habitId, clean);
    await updateHabitInDb(
      habitId,
      clean,
      cleanColor(color),
      cleanHabitIcon(icon),
    );
    await refresh();
  };

  const updateHabitPlan: DataContextType["updateHabitPlan"] = async (
    habitId,
    input,
  ) => {
    if (!Number.isFinite(habitId)) return;
    const estimatedBaseline = Number(input.estimatedBaseline);
    const finalTarget = Number(input.finalTarget);
    if (!Number.isFinite(estimatedBaseline) || estimatedBaseline < 0) {
      throw new Error("Estimated current amount must be zero or greater.");
    }
    if (!Number.isFinite(finalTarget) || finalTarget < 0) {
      throw new Error("Long-term goal amount must be zero or greater.");
    }
    const currentDaily =
      estimatedBaseline / daysInHabitPeriod(input.baselinePeriod);
    const goalDaily = finalTarget / daysInHabitPeriod(input.goalPeriod);
    if (goalDaily > currentDaily) {
      throw new Error("Goal rate cannot be higher than the starting rate.");
    }

    const unit = input.unit.trim();
    if (!unit) throw new Error("Add a unit for this habit.");

    const existingHabit = await getHabitById(habitId);

    await updateHabitPlanInDb(habitId, {
      ...input,
      unit,
      estimatedBaseline,
      finalTarget,
    });

    if (existingHabit) {
      const baselineChangedWithoutCalibration =
        existingHabit.calibratedBaseline == null &&
        (existingHabit.estimatedBaseline !== estimatedBaseline ||
          existingHabit.baselinePeriod !== input.baselinePeriod);
      const goalPlanChanged =
        existingHabit.currentGoal == null ||
        existingHabit.finalTarget !== finalTarget ||
        existingHabit.goalPeriod !== input.goalPeriod ||
        existingHabit.measurementType !== input.measurementType ||
        baselineChangedWithoutCalibration;

      if (goalPlanChanged) {
        const baseline = existingHabit.calibratedBaseline ?? estimatedBaseline;
        const baselinePeriod =
          existingHabit.calibratedBaseline == null
            ? input.baselinePeriod
            : existingHabit.baselinePeriod;
        const currentGoal = calculateInitialCurrentGoal(
          baseline,
          baselinePeriod,
          finalTarget,
          input.goalPeriod,
          input.measurementType,
        );
        await setCurrentGoalInDb(
          habitId,
          currentGoal,
          input.goalPeriod,
          existingHabit.currentGoal == null ? "initial" : "plan_updated",
        );
      }
    }
    await refresh();
  };

  const proposeNextGoal: DataContextType["proposeNextGoal"] = async (
    habitId,
  ) => {
    const habit = await getHabitById(habitId);
    if (!habit || habit.currentGoal == null || habit.finalTarget == null)
      return;
    const review = getLatestCycleReview(
      habit,
      logs,
      trackingConfirmations,
      goalHistory,
    );
    if (
      !review.complete ||
      review.result !== "goal_achieved" ||
      review.goalAlreadyAdvanced
    ) {
      return;
    }
    const finalTarget = normalizeGoalAmount(
      habit.finalTarget,
      habit.goalPeriod,
      habit.currentGoalPeriod,
    );
    const next = calculateNextReductionGoal(
      habit.currentGoal,
      finalTarget,
      habit.measurementType,
    );
    if (next >= habit.currentGoal) return;
    await setPendingGoalInDb(
      habitId,
      next,
      habit.currentGoalPeriod,
      goalChangeExplanation(habit.currentGoal, next, finalTarget),
    );
    await refresh();
  };

  const setTrackingConfirmation: DataContextType["setTrackingConfirmation"] =
    async (habitId, period, periodStart, status) => {
      if (!Number.isFinite(habitId) || !Number.isFinite(periodStart)) return;
      await upsertTrackingConfirmation({
        habitId,
        period,
        periodStart: startOfLocalDay(periodStart),
        status,
      });
      await refresh();
    };

  const setTrackingConfirmationsBatch: DataContextType["setTrackingConfirmationsBatch"] =
    async (confirmations) => {
      if (confirmations.length === 0) return;
      await db.withTransactionAsync(async () => {
        for (const confirmation of confirmations) {
          if (
            !Number.isFinite(confirmation.habitId) ||
            !Number.isFinite(confirmation.periodStart)
          ) {
            continue;
          }
          await upsertTrackingConfirmation({
            ...confirmation,
            periodStart: startOfLocalDay(confirmation.periodStart),
          });
        }
      });
      await refresh();
    };

  const approveProposedGoal: DataContextType["approveProposedGoal"] = async (
    habitId,
  ) => {
    const habit = await getHabitById(habitId);
    if (!habit || habit.pendingGoal == null) return;
    const review = getLatestCycleReview(
      habit,
      logs,
      trackingConfirmations,
      goalHistory,
    );
    if (
      !review.complete ||
      review.result !== "goal_achieved" ||
      review.goalAlreadyAdvanced
    ) {
      return;
    }
    await setCurrentGoalInDb(
      habitId,
      habit.pendingGoal,
      habit.pendingGoalPeriod,
      "approved_step",
    );
    await refresh();
  };

  const dismissProposedGoal: DataContextType["dismissProposedGoal"] = async (
    habitId,
  ) => {
    await clearPendingGoalInDb(habitId);
    await refresh();
  };

  const adjustCurrentGoal: DataContextType["adjustCurrentGoal"] = async (
    habitId,
    direction,
  ) => {
    const habit = await getHabitById(habitId);
    if (
      !habit ||
      habit.currentGoal == null ||
      habit.finalTarget == null ||
      habit.estimatedBaseline == null
    ) {
      return;
    }
    const finalTarget = normalizeGoalAmount(
      habit.finalTarget,
      habit.goalPeriod,
      habit.currentGoalPeriod,
    );
    const baseline = normalizeGoalAmount(
      habit.calibratedBaseline ?? habit.estimatedBaseline,
      habit.baselinePeriod,
      habit.currentGoalPeriod,
    );
    const next =
      direction === "harder"
        ? calculateNextReductionGoal(
            habit.currentGoal,
            finalTarget,
            habit.measurementType,
          )
        : calculateEasierGoal(
            habit.currentGoal,
            baseline,
            finalTarget,
            habit.measurementType,
          );
    if (next === habit.currentGoal) return;
    await setCurrentGoalInDb(
      habitId,
      next,
      habit.currentGoalPeriod,
      direction === "harder" ? "manual_harder" : "manual_easier",
    );
    await refresh();
  };

  const rebaselineHabit: DataContextType["rebaselineHabit"] = async (
    habitId,
  ) => {
    if (!Number.isFinite(habitId)) return;
    await resetHabitBaselineInDb(habitId, startOfLocalDay(Date.now()));
    await refresh();
  };

  const renameCustomCue: DataContextType["renameCustomCue"] = async (
    cueId,
    name,
  ) => {
    const clean = name.trim();
    if (!clean || !Number.isFinite(cueId)) return;
    assertUniqueName(await loadCues(), cueId, clean);
    await renameCustomCueInDb(cueId, clean);
    await refresh();
  };

  const renameCustomLocation: DataContextType["renameCustomLocation"] = async (
    locationId,
    name,
  ) => {
    const clean = name.trim();
    if (!clean || !Number.isFinite(locationId)) return;
    assertUniqueName(await loadLocations(), locationId, clean);
    await renameCustomLocationInDb(locationId, clean);
    await refresh();
  };

  const deleteCustomHabit: DataContextType["deleteCustomHabit"] = async (
    habitId,
  ) => {
    if (!Number.isFinite(habitId)) return "deleted";
    const result = await deleteOrHideCustomHabitInDb(habitId);
    await refresh();
    return result;
  };

  const deleteCustomCue: DataContextType["deleteCustomCue"] = async (cueId) => {
    if (!Number.isFinite(cueId)) return "deleted";
    const result = await deleteOrHideCustomCueInDb(cueId);
    await refresh();
    return result;
  };

  const deleteCustomLocation: DataContextType["deleteCustomLocation"] = async (
    locationId,
  ) => {
    if (!Number.isFinite(locationId)) return "deleted";
    const result = await deleteOrHideCustomLocationInDb(locationId);
    await refresh();
    return result;
  };

  const getLogNames = async (input: {
    habitId: number;
    cueId?: number | null;
    cueIds?: number[];
    locationId?: number | null;
    selectedActionId?: number | null;
  }) => {
    const cueIds = Array.from(
      new Set(
        (input.cueIds ?? (input.cueId == null ? [] : [input.cueId])).filter(
          (id) => Number.isFinite(id),
        ),
      ),
    );
    const [habit, cues, location, action] = await Promise.all([
      getHabitById(input.habitId),
      Promise.all(cueIds.map((cueId) => getCueById(cueId))),
      input.locationId == null
        ? Promise.resolve(null)
        : getLocationById(input.locationId),
      input.selectedActionId == null
        ? Promise.resolve(null)
        : getActionById(input.selectedActionId),
    ]);

    if (!habit) {
      throw new Error("Selected habit was not found.");
    }

    return {
      habitName: habit.name,
      cueIds,
      cueNames: cues.flatMap((cue) => (cue ? [cue.name] : [])),
      cueName: cues[0]?.name ?? null,
      locationName: location?.name ?? null,
      selectedActionTitle: action?.title ?? null,
    };
  };

  const invalidateConfirmationsForMoment = async (
    habitId: number,
    timestamp: number,
  ) => {
    const confirmations = await loadTrackingConfirmations();
    for (const confirmation of confirmations) {
      if (
        confirmation.habitId !== habitId ||
        confirmation.status === "not_yet"
      ) {
        continue;
      }
      const days =
        confirmation.period === "week"
          ? 7
          : confirmation.period === "28_days"
            ? 28
            : 1;
      const end = new Date(confirmation.periodStart);
      end.setDate(end.getDate() + days);
      if (timestamp >= confirmation.periodStart && timestamp < end.getTime()) {
        await upsertTrackingConfirmation({
          habitId,
          period: confirmation.period,
          periodStart: confirmation.periodStart,
          status: "not_yet",
        });
      }
    }
  };

  const addLog: DataContextType["addLog"] = async (input) => {
    const habitId = input.habitId;
    if (!Number.isFinite(habitId)) return null;

    const intensityIn = input.intensity ?? null;
    const intensity: number | null =
      intensityIn == null
        ? null
        : Math.min(10, Math.max(1, Math.round(intensityIn)));

    const countIn = input.count ?? 1;
    const count = Math.min(999999, Math.max(0, Math.round(countIn)));
    const didResist: 0 | 1 = input.didResist ? 1 : 0;
    const createdAt = Number.isFinite(input.createdAt)
      ? Math.round(input.createdAt as number)
      : Date.now();

    const selectedActionId =
      input.selectedActionId == null || !Number.isFinite(input.selectedActionId)
        ? null
        : input.selectedActionId;

    const names = await getLogNames({
      habitId,
      cueId: input.cueId ?? null,
      cueIds: input.cueIds,
      locationId: input.locationId ?? null,
      selectedActionId,
    });

    const newLogId = await insertLog({
      habitId,
      createdAt,
      cueId: names.cueIds[0] ?? null,
      cueIds: names.cueIds,
      locationId: input.locationId ?? null,
      intensity,
      count,
      didResist,
      notes: input.notes?.trim() ?? null,
      selectedActionId,
      habitName: names.habitName,
      cueName: names.cueName,
      cueNames: names.cueNames,
      locationName: names.locationName,
      selectedActionTitle: names.selectedActionTitle,
    });

    await invalidateConfirmationsForMoment(habitId, createdAt);

    await refresh();
    return newLogId > 0 ? newLogId : null;
  };

  const updateLog: DataContextType["updateLog"] = async (logId, input) => {
    if (!Number.isFinite(logId)) return;
    if (!Number.isFinite(input.habitId)) return;
    if (!Number.isFinite(input.createdAt)) return;

    const intensityIn = input.intensity ?? null;
    const intensity: number | null =
      intensityIn == null
        ? null
        : Math.min(10, Math.max(1, Math.round(intensityIn)));

    const countIn = input.count ?? 1;
    const selectedActionId =
      input.selectedActionId == null || !Number.isFinite(input.selectedActionId)
        ? null
        : input.selectedActionId;

    const names = await getLogNames({
      habitId: input.habitId,
      cueId: input.cueId ?? null,
      cueIds: input.cueIds,
      locationId: input.locationId ?? null,
      selectedActionId,
    });

    const count = Math.min(999999, Math.max(0, Math.round(countIn)));

    const previousLog = logs.find((log) => log.id === logId);

    await updateLogInDb({
      logId,
      habitId: input.habitId,
      cueId: names.cueIds[0] ?? null,
      cueIds: names.cueIds,
      locationId: input.locationId ?? null,
      intensity,
      count,
      didResist: input.didResist ? 1 : 0,
      notes: input.notes?.trim() ?? null,
      createdAt: Math.round(input.createdAt),
      selectedActionId,
      habitName: names.habitName,
      cueName: names.cueName,
      cueNames: names.cueNames,
      locationName: names.locationName,
      selectedActionTitle: names.selectedActionTitle,
    });

    if (previousLog) {
      await invalidateConfirmationsForMoment(
        previousLog.habitId,
        previousLog.createdAt,
      );
    }
    await invalidateConfirmationsForMoment(
      input.habitId,
      Math.round(input.createdAt),
    );

    await refresh();
  };

  const deleteLog: DataContextType["deleteLog"] = async (logId) => {
    if (!Number.isFinite(logId)) return;
    const previousLog = logs.find((log) => log.id === logId);
    await deleteLogInDb(logId);
    if (previousLog) {
      await invalidateConfirmationsForMoment(
        previousLog.habitId,
        previousLog.createdAt,
      );
    }
    await refresh();
  };

  const updateLogSelectedAction: DataContextType["updateLogSelectedAction"] =
    async (logId, selectedActionId) => {
      if (!Number.isFinite(logId)) return;

      const cleanSelectedActionId =
        selectedActionId == null || !Number.isFinite(selectedActionId)
          ? null
          : selectedActionId;

      const action =
        cleanSelectedActionId == null
          ? null
          : await getActionById(cleanSelectedActionId);

      await updateLogSelectedActionInDb(
        logId,
        cleanSelectedActionId,
        action?.title ?? null,
      );
      setLogs(await loadLogs());
    };

  const addAction: DataContextType["addAction"] = async (input) => {
    const title = input.title.trim();
    if (!title) return;

    const existingActions = await loadActions();
    const duplicate = existingActions.find(
      (a) => normalizeName(a.title) === normalizeName(title),
    );
    if (duplicate) {
      throw new Error(`"${title}" already exists.`);
    }

    const category = input.category?.trim() ?? null;
    const isCustom: 0 | 1 = (input.isCustom ?? true) ? 1 : 0;

    await insertAction({
      title,
      category,
      isCustom,
    });

    const updatedActions = await loadActions();
    const addedAction = updatedActions.find(
      (action) => normalizeName(action.title) === normalizeName(title),
    );

    if (addedAction && !(await selectedActionExists(addedAction.id))) {
      await addSelectedAction(addedAction.id);
    }

    setActions(updatedActions);
    setSelectedActionIds(await loadSelectedActionIds());
  };

  const renameCustomAction: DataContextType["renameCustomAction"] = async (
    actionId,
    title,
    category,
  ) => {
    const cleanTitle = title.trim();
    if (!cleanTitle || !Number.isFinite(actionId)) return;
    assertUniqueActionTitle(await loadActions(), actionId, cleanTitle);
    await renameCustomActionInDb(
      actionId,
      cleanTitle,
      category?.trim() || null,
    );
    await refresh();
  };

  const deleteCustomAction: DataContextType["deleteCustomAction"] = async (
    actionId,
  ) => {
    if (!Number.isFinite(actionId)) return "deleted";
    const result = await deleteOrHideCustomActionInDb(actionId);
    await refresh();
    return result;
  };

  const toggleSelectedAction: DataContextType["toggleSelectedAction"] = async (
    actionId,
  ) => {
    if (!Number.isFinite(actionId)) return;

    const exists = await selectedActionExists(actionId);

    if (exists) {
      await removeSelectedAction(actionId);
    } else {
      await addSelectedAction(actionId);
    }

    setSelectedActionIds(await loadSelectedActionIds());
  };

  const clearSelectedActions: DataContextType["clearSelectedActions"] =
    async () => {
      await clearAllSelectedActions();
      setSelectedActionIds([]);
    };

  const exportData: DataContextType["exportData"] = async () => {
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      throw new Error("Sharing is not available on this device.");
    }

    const payload = {
      app: "Reflex",
      exportedAt: new Date().toISOString(),
      localProfile: {
        name: profileName,
        photoUri: profilePhotoUri,
        isComplete: hasCompletedLocalProfile,
      },
      settings: {
        appLockEnabled,
        dailyReminder,
      },
      hasOnboarded,
      habits,
      cues,
      locations,
      selectedHabits,
      selectedCues,
      selectedLocations,
      logs,
      goalHistory,
      trackingConfirmations,
      actions,
      selectedActionIds,
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = new FileSystem.File(
      FileSystem.Paths.cache,
      `reflex-backup-${timestamp}.json`,
    );

    await file.write(JSON.stringify(payload, null, 2));

    await Sharing.shareAsync(file.uri, {
      mimeType: "application/json",
      dialogTitle: "Export Reflex data",
      UTI: "public.json",
    });
  };

  const importData: DataContextType["importData"] = async (fileUri) => {
    const file = new FileSystem.File(fileUri);
    const text = await file.text();
    const parsed = validateBackupPayload(JSON.parse(text));

    const importedHabits = sanitizeNamedEntities(asArray(parsed.habits)).map(
      (habit) => {
        if (habit.finalTarget == null) return habit;
        const finalForCurrent = normalizeGoalAmount(
          habit.finalTarget,
          habit.goalPeriod,
          habit.currentGoalPeriod,
        );
        return {
          ...habit,
          currentGoal:
            habit.currentGoal == null
              ? null
              : Math.max(finalForCurrent, habit.currentGoal),
          pendingGoal:
            habit.pendingGoal == null
              ? null
              : Math.max(
                  normalizeGoalAmount(
                    habit.finalTarget,
                    habit.goalPeriod,
                    habit.pendingGoalPeriod,
                  ),
                  habit.pendingGoal,
                ),
        };
      },
    );
    const importedCues = sanitizeNamedEntities(asArray(parsed.cues));
    const importedLocations = sanitizeNamedEntities(asArray(parsed.locations));
    const importedActions = sanitizeActions(asArray(parsed.actions));
    const importedLogs = sanitizeLogs(asArray(parsed.logs));
    const importedGoalHistory = sanitizeGoalHistory(
      asArray(parsed.goalHistory),
    );
    const importedTrackingConfirmations = sanitizeTrackingConfirmations(
      asArray(parsed.trackingConfirmations),
    );

    if (importedHabits.length === 0) {
      throw new Error("That backup does not contain any valid habits.");
    }

    const habitIds = new Set(importedHabits.map((item) => item.id));
    const cueIds = new Set(importedCues.map((item) => item.id));
    const locationIds = new Set(importedLocations.map((item) => item.id));
    const actionIds = new Set(importedActions.map((item) => item.id));

    const selectedHabitIds = sanitizeSelectedIds(
      asArray(parsed.selectedHabits),
      "id",
    ).filter((id) => habitIds.has(id));
    const selectedCueIds = sanitizeSelectedIds(
      asArray(parsed.selectedCues),
      "id",
    ).filter((id) => cueIds.has(id));
    const selectedLocationIds = sanitizeSelectedIds(
      asArray(parsed.selectedLocations),
      "id",
    ).filter((id) => locationIds.has(id));
    const importedSelectedActionIds = sanitizeSelectedIds(
      asArray(parsed.selectedActionIds),
      "actionId",
    ).filter((id) => actionIds.has(id));

    const validLogs = importedLogs.filter((log) => habitIds.has(log.habitId));
    const profile = isRecord(parsed.localProfile) ? parsed.localProfile : {};
    const settings = isRecord(parsed.settings) ? parsed.settings : {};
    const restoredProfileName = cleanString(profile.name);
    // Backup files contain only the old device's photo URI, not the photo itself.
    // Keep the restored name, but require the user to choose a new local photo.
    const restoredProfileDone = false;
    const restoredAppLockEnabled = cleanBoolean(settings.appLockEnabled);
    const restoredDailyReminder = isRecord(settings.dailyReminder)
      ? {
          option: ["off", "morning", "evening", "custom"].includes(
            settings.dailyReminder.option as string,
          )
            ? (settings.dailyReminder.option as DailyReminderSettings["option"])
            : "off",
          hour: Math.min(
            23,
            Math.max(0, cleanInt(settings.dailyReminder.hour, 20)),
          ),
          minute: Math.min(
            59,
            Math.max(0, cleanInt(settings.dailyReminder.minute, 0)),
          ),
        }
      : DEFAULT_DAILY_REMINDER;
    const restoredHasOnboarded = cleanBoolean(parsed.hasOnboarded);
    await db.withTransactionAsync(async () => {
      await recreateDataTables();

      for (const habit of importedHabits) {
        await db.runAsync(
          `INSERT OR IGNORE INTO habits (
            id, name, isCustom, hidden, color, icon, measurementType, unit,
            estimatedBaseline, calibratedBaseline, calibrationStartedAt,
            calibratedAt, rebaselineStartedAt, baselinePeriod, finalTarget,
            goalPeriod, currentGoal, currentGoalPeriod, pendingGoal,
            pendingGoalPeriod, pendingGoalReason
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            habit.id,
            habit.name,
            habit.isCustom,
            habit.hidden,
            habit.color,
            habit.icon,
            habit.measurementType,
            habit.unit,
            habit.estimatedBaseline,
            habit.calibratedBaseline,
            habit.calibrationStartedAt,
            habit.calibratedAt,
            habit.rebaselineStartedAt,
            habit.baselinePeriod,
            habit.finalTarget,
            habit.goalPeriod,
            habit.currentGoal,
            habit.currentGoalPeriod,
            habit.pendingGoal,
            habit.pendingGoalPeriod,
            habit.pendingGoalReason,
          ],
        );
      }

      for (const entry of importedGoalHistory) {
        if (!habitIds.has(entry.habitId)) continue;
        await db.runAsync(
          `INSERT OR IGNORE INTO goal_history
           (id, habitId, amount, period, reason, createdAt)
           VALUES (?, ?, ?, ?, ?, ?);`,
          [
            entry.id,
            entry.habitId,
            entry.amount,
            entry.period,
            entry.reason,
            entry.createdAt,
          ],
        );
      }

      for (const confirmation of importedTrackingConfirmations) {
        if (!habitIds.has(confirmation.habitId)) continue;
        await db.runAsync(
          `INSERT OR IGNORE INTO tracking_confirmations
           (id, habitId, period, periodStart, status, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?);`,
          [
            confirmation.id,
            confirmation.habitId,
            confirmation.period,
            confirmation.periodStart,
            confirmation.status,
            confirmation.updatedAt,
          ],
        );
      }

      for (const cue of importedCues) {
        await db.runAsync(
          `INSERT OR IGNORE INTO cues (id, name, isCustom, hidden) VALUES (?, ?, ?, ?);`,
          [cue.id, cue.name, cue.isCustom, cue.hidden],
        );
      }

      for (const location of importedLocations) {
        await db.runAsync(
          `INSERT OR IGNORE INTO locations (id, name, isCustom, hidden) VALUES (?, ?, ?, ?);`,
          [location.id, location.name, location.isCustom, location.hidden],
        );
      }

      for (const action of importedActions) {
        await db.runAsync(
          `INSERT OR IGNORE INTO actions (id, title, category, isCustom, hidden) VALUES (?, ?, ?, ?, ?);`,
          [
            action.id,
            action.title,
            action.category,
            action.isCustom,
            action.hidden,
          ],
        );
      }

      const finalSelectedHabitIds =
        selectedHabitIds.length > 0 ? selectedHabitIds : [importedHabits[0].id];

      for (const id of finalSelectedHabitIds) {
        await db.runAsync(
          `INSERT OR IGNORE INTO user_habits (habitId) VALUES (?);`,
          [id],
        );
      }

      for (const id of selectedCueIds) {
        await db.runAsync(
          `INSERT OR IGNORE INTO user_cues (cueId) VALUES (?);`,
          [id],
        );
      }

      for (const id of selectedLocationIds) {
        await db.runAsync(
          `INSERT OR IGNORE INTO user_locations (locationId) VALUES (?);`,
          [id],
        );
      }

      for (const log of validLogs) {
        const selectedActionId =
          log.selectedActionId != null && actionIds.has(log.selectedActionId)
            ? log.selectedActionId
            : null;

        await db.runAsync(
          `
        INSERT OR IGNORE INTO logs (
          id,
          habitId,
          cueId,
          locationId,
          intensity,
          count,
          didResist,
          notes,
          createdAt,
          selectedActionId,
          habitName,
          cueName,
          cueIdsJson,
          cueNamesJson,
          locationName,
          selectedActionTitle
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `,
          [
            log.id,
            log.habitId,
            log.cueId != null && cueIds.has(log.cueId) ? log.cueId : null,
            log.locationId != null && locationIds.has(log.locationId)
              ? log.locationId
              : null,
            log.intensity,
            log.count,
            log.didResist,
            log.notes,
            log.createdAt,
            selectedActionId,
            log.habitName,
            log.cueName,
            JSON.stringify(log.cueIds.filter((id) => cueIds.has(id))),
            JSON.stringify(log.cueNames),
            log.locationName,
            log.selectedActionTitle,
          ],
        );
      }

      for (const actionId of importedSelectedActionIds) {
        await db.runAsync(
          `INSERT OR IGNORE INTO selected_actions (actionId, createdAt) VALUES (?, ?);`,
          [actionId, Date.now()],
        );
      }
    });

    await Promise.all([
      saveOnboardedFlag(restoredHasOnboarded),
      saveProfileName(restoredProfileName),
      saveProfilePhotoUri(""),
      saveProfileDoneFlag(restoredProfileDone),
      saveAppLockEnabledFlag(restoredAppLockEnabled),
      saveDailyReminderSettings(restoredDailyReminder),
    ]);

    await scheduleDailyReminderNotification(restoredDailyReminder);

    setHasOnboarded(restoredHasOnboarded);
    setProfileName(restoredProfileName);
    setProfilePhotoUri(null);
    setHasCompletedLocalProfile(restoredProfileDone);
    setAppLockEnabledState(restoredAppLockEnabled);
    setDailyReminderState(restoredDailyReminder);

    await refresh();
  };

  const resetAll: DataContextType["resetAll"] = async () => {
    setInitializing(true);

    try {
      const storedPhoto = await loadProfilePhotoUri();
      const savedPhoto = ((profilePhotoUri ?? "").trim() || storedPhoto) ?? "";
      await deleteManagedProfilePhoto(savedPhoto);

      await dropAllDataTables();
      await initDb();
      await seedDefaultHabitsIfEmpty();
      await seedDefaultCuesIfEmpty();
      await seedDefaultLocationsIfEmpty();
      await seedDefaultActionsIfEmpty();

      setSelectedHabitsState([]);
      setSelectedCuesState([]);
      setSelectedLocationsState([]);
      setLogs([]);
      setSelectedActionIds([]);
      setGoalHistory([]);
      setTrackingConfirmations([]);
      setCycleHistory([]);

      await Promise.all([
        saveOnboardedFlag(false),
        saveProfileName(""),
        saveProfilePhotoUri(""),
        saveProfileDoneFlag(false),
        saveAppLockEnabledFlag(false),
        saveDailyReminderSettings(DEFAULT_DAILY_REMINDER),
      ]);

      await cancelDailyReminderNotification();

      setHasOnboarded(false);
      setProfileName("");
      setProfilePhotoUri(null);
      setHasCompletedLocalProfile(false);
      setAppLockEnabledState(false);
      setDailyReminderState(DEFAULT_DAILY_REMINDER);

      await refresh();
    } finally {
      setInitializing(false);
    }
  };

  const value = useMemo(
    () => ({
      initializing,
      profileName,
      profilePhotoUri,
      hasCompletedLocalProfile,
      completeLocalProfile,
      clearLocalProfile,
      appLockEnabled,
      setAppLockEnabled,
      dailyReminder,
      setDailyReminder,
      habits,
      cues,
      locations,
      selectedHabits,
      selectedCues,
      selectedLocations,
      hasOnboarded,
      completeOnboarding,
      resetOnboarding,
      setSelectedHabits,
      setSelectedCues,
      setSelectedLocations,
      addCustomHabit,
      addCustomCue,
      addCustomLocation,
      renameCustomHabit,
      updateHabit,
      updateHabitPlan,
      baselineSummaries,
      rebaselineHabit,
      goalHistory,
      trackingConfirmations,
      cycleReviews,
      cycleHistory,
      setTrackingConfirmation,
      setTrackingConfirmationsBatch,
      proposeNextGoal,
      approveProposedGoal,
      dismissProposedGoal,
      adjustCurrentGoal,
      renameCustomCue,
      renameCustomLocation,
      deleteCustomHabit,
      deleteCustomCue,
      deleteCustomLocation,
      logs,
      addLog,
      updateLog,
      deleteLog,
      updateLogSelectedAction,
      actions,
      addAction,
      renameCustomAction,
      deleteCustomAction,
      selectedActionIds,
      toggleSelectedAction,
      clearSelectedActions,
      exportData,
      importData,
      resetAll,
      refresh,
      resetDbForDev,
    }),
    [
      initializing,
      profileName,
      profilePhotoUri,
      hasCompletedLocalProfile,
      appLockEnabled,
      dailyReminder,
      habits,
      cues,
      locations,
      selectedHabits,
      selectedCues,
      selectedLocations,
      logs,
      actions,
      selectedActionIds,
      hasOnboarded,
      baselineSummaries,
      goalHistory,
      trackingConfirmations,
      cycleReviews,
      cycleHistory,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
