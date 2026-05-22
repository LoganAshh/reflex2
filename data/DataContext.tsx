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
  DataContextType,
  DataProviderProps,
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
  DataContextType,
} from "./types";

type BackupNamedEntity = {
  id: number;
  name: string;
  isCustom: 0 | 1;
  hidden: 0 | 1;
  color: string;
};

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
  locationId: number | null;
  intensity: number | null;
  count: number;
  didResist: 0 | 1;
  notes: string | null;
  createdAt: number;
  selectedActionId: number | null;
  habitName: string | null;
  cueName: string | null;
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
    });
  }

  return result;
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

    result.push({
      id,
      habitId,
      cueId: cleanOptionalInt(item.cueId),
      locationId: cleanOptionalInt(item.locationId),
      intensity:
        intensity == null ? null : Math.min(10, Math.max(1, intensity)),
      count: Math.min(10, Math.max(0, cleanInt(item.count, 1))),
      didResist: cleanBoolean(item.didResist) ? 1 : 0,
      notes: cleanNullableString(item.notes),
      createdAt,
      selectedActionId: cleanOptionalInt(item.selectedActionId),
      habitName: cleanNullableString(item.habitName),
      cueName: cleanNullableString(item.cueName),
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
      sound: false,
    },
    trigger: {
      hour: settings.hour,
      minute: settings.minute,
      repeats: true,
      channelId: "daily-reflection",
    } as any,
  });

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
  const [hasOnboarded, setHasOnboarded] = useState(false);

  const refresh = async () => {
    const [h, c, loc, sh, sc, sl, l, a, selIds] = await Promise.all([
      loadHabits(),
      loadCues(),
      loadLocations(),
      loadSelectedHabits(),
      loadSelectedCues(),
      loadSelectedLocations(),
      loadLogs(),
      loadActions(),
      loadSelectedActionIds(),
    ]);

    setHabits(h);
    setCues(c);
    setLocations(loc);
    setSelectedHabitsState(sh);
    setSelectedCuesState(sc);
    setSelectedLocationsState(sl);
    setLogs(l);
    setActions(a);
    setSelectedActionIds(selIds);
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

        const cleanName = savedProfileName.trim();
        const cleanPhoto = savedProfilePhoto.trim();
        const normalizedProfileDone = profileDone && cleanName.length > 0;

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

    await insertCustomHabit(clean);
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
  ) => {
    const clean = name.trim();
    if (!clean || !Number.isFinite(habitId)) return;
    assertUniqueName(await loadHabits(), habitId, clean);
    await updateHabitInDb(habitId, clean, cleanColor(color));
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
    locationId?: number | null;
    selectedActionId?: number | null;
  }) => {
    const [habit, cue, location, action] = await Promise.all([
      getHabitById(input.habitId),
      input.cueId == null ? Promise.resolve(null) : getCueById(input.cueId),
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
      cueName: cue?.name ?? null,
      locationName: location?.name ?? null,
      selectedActionTitle: action?.title ?? null,
    };
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
    const count = Math.min(10, Math.max(0, Math.round(countIn)));

    const didResist: 0 | 1 = input.didResist ? 1 : 0;

    const selectedActionId =
      input.selectedActionId == null || !Number.isFinite(input.selectedActionId)
        ? null
        : input.selectedActionId;

    const names = await getLogNames({
      habitId,
      cueId: input.cueId ?? null,
      locationId: input.locationId ?? null,
      selectedActionId,
    });

    const newLogId = await insertLog({
      habitId,
      cueId: input.cueId ?? null,
      locationId: input.locationId ?? null,
      intensity,
      count,
      didResist,
      notes: input.notes?.trim() ?? null,
      selectedActionId,
      habitName: names.habitName,
      cueName: names.cueName,
      locationName: names.locationName,
      selectedActionTitle: names.selectedActionTitle,
    });

    setLogs(await loadLogs());
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
    const count = Math.min(10, Math.max(0, Math.round(countIn)));

    const selectedActionId =
      input.selectedActionId == null || !Number.isFinite(input.selectedActionId)
        ? null
        : input.selectedActionId;

    const names = await getLogNames({
      habitId: input.habitId,
      cueId: input.cueId ?? null,
      locationId: input.locationId ?? null,
      selectedActionId,
    });

    await updateLogInDb({
      logId,
      habitId: input.habitId,
      cueId: input.cueId ?? null,
      locationId: input.locationId ?? null,
      intensity,
      count,
      didResist: input.didResist ? 1 : 0,
      notes: input.notes?.trim() ?? null,
      createdAt: Math.round(input.createdAt),
      selectedActionId,
      habitName: names.habitName,
      cueName: names.cueName,
      locationName: names.locationName,
      selectedActionTitle: names.selectedActionTitle,
    });

    setLogs(await loadLogs());
  };

  const deleteLog: DataContextType["deleteLog"] = async (logId) => {
    if (!Number.isFinite(logId)) return;
    await deleteLogInDb(logId);
    setLogs(await loadLogs());
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

    setActions(await loadActions());
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

    const importedHabits = sanitizeNamedEntities(asArray(parsed.habits));
    const importedCues = sanitizeNamedEntities(asArray(parsed.cues));
    const importedLocations = sanitizeNamedEntities(asArray(parsed.locations));
    const importedActions = sanitizeActions(asArray(parsed.actions));
    const importedLogs = sanitizeLogs(asArray(parsed.logs));

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
    const restoredProfileDone =
      cleanBoolean(profile.isComplete) && restoredProfileName.length > 0;
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
    const previousPhoto = (profilePhotoUri ?? "").trim();

    if (previousPhoto) {
      await deleteManagedProfilePhoto(previousPhoto);
    }

    await dropAllDataTables();
    await initDb();

    for (const habit of importedHabits) {
      await db.runAsync(
        `INSERT OR IGNORE INTO habits (id, name, isCustom, hidden, color) VALUES (?, ?, ?, ?, ?);`,
        [habit.id, habit.name, habit.isCustom, habit.hidden, habit.color],
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
      await db.runAsync(`INSERT OR IGNORE INTO user_cues (cueId) VALUES (?);`, [
        id,
      ]);
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
          locationName,
          selectedActionTitle
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
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
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
