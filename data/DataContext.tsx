import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
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
  DataContextType,
  DataProviderProps,
} from "./types";
import {
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
  selectedActionExists,
  removeSelectedAction,
  addSelectedAction,
  clearAllSelectedActions,
  replaceAllDataFromBackup,
  type RestorableData,
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
  DataContextType,
} from "./types";

const DataContext = createContext<DataContextType | null>(null);

type ReflexBackupPayload = {
  app?: unknown;
  localProfile?: {
    name?: unknown;
    isComplete?: unknown;
  };
  settings?: {
    appLockEnabled?: unknown;
  };
  hasOnboarded?: unknown;
  habits?: unknown;
  cues?: unknown;
  locations?: unknown;
  selectedHabits?: unknown;
  selectedCues?: unknown;
  selectedLocations?: unknown;
  logs?: unknown;
  actions?: unknown;
  selectedActionIds?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    Number.isFinite(value)
  );
}

function cleanOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : null;
}

function cleanRequiredString(value: unknown, label: string) {
  const clean = cleanOptionalString(value);
  if (!clean) throw new Error(`Invalid backup: ${label} is missing.`);
  return clean;
}

function cleanFlag(value: unknown, label: string): 0 | 1 {
  if (value === 0 || value === 1) return value;
  if (value === false) return 0;
  if (value === true) return 1;
  throw new Error(`Invalid backup: ${label} must be 0 or 1.`);
}

function requireArray(value: unknown, label: string) {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid backup: ${label} must be an array.`);
  }
  return value;
}

function uniqueNumbers(
  values: unknown[],
  validIds: Set<number>,
  label: string,
) {
  const ids: number[] = [];

  for (const value of values) {
    if (!isFiniteInteger(value) || !validIds.has(value)) {
      throw new Error(`Invalid backup: ${label} contains an unknown id.`);
    }
    if (!ids.includes(value)) ids.push(value);
  }

  return ids;
}

function validateCollectionItemIds<T extends { id: number }>(
  items: T[],
  label: string,
) {
  const ids = new Set<number>();

  for (const item of items) {
    if (ids.has(item.id)) {
      throw new Error(`Invalid backup: ${label} contains duplicate ids.`);
    }
    ids.add(item.id);
  }

  return ids;
}

function validateBackupPayload(raw: unknown) {
  if (!isObject(raw)) {
    throw new Error("Invalid backup: expected a JSON object.");
  }

  const payload = raw as ReflexBackupPayload;

  if (payload.app !== "Reflex") {
    throw new Error(
      "Invalid backup: this does not look like a Reflex backup file.",
    );
  }

  const habits = requireArray(payload.habits, "habits").map((item, index) => {
    if (!isObject(item))
      throw new Error(`Invalid backup: habit ${index + 1} is invalid.`);
    if (!isFiniteInteger(item.id) || item.id <= 0)
      throw new Error(`Invalid backup: habit ${index + 1} has an invalid id.`);
    return {
      id: item.id,
      name: cleanRequiredString(item.name, `habit ${index + 1} name`),
      isCustom: cleanFlag(item.isCustom, `habit ${index + 1} isCustom`),
    };
  });

  const cues = requireArray(payload.cues, "cues").map((item, index) => {
    if (!isObject(item))
      throw new Error(`Invalid backup: cue ${index + 1} is invalid.`);
    if (!isFiniteInteger(item.id) || item.id <= 0)
      throw new Error(`Invalid backup: cue ${index + 1} has an invalid id.`);
    return {
      id: item.id,
      name: cleanRequiredString(item.name, `cue ${index + 1} name`),
      isCustom: cleanFlag(item.isCustom, `cue ${index + 1} isCustom`),
    };
  });

  const locations = requireArray(payload.locations, "locations").map(
    (item, index) => {
      if (!isObject(item))
        throw new Error(`Invalid backup: location ${index + 1} is invalid.`);
      if (!isFiniteInteger(item.id) || item.id <= 0)
        throw new Error(
          `Invalid backup: location ${index + 1} has an invalid id.`,
        );
      return {
        id: item.id,
        name: cleanRequiredString(item.name, `location ${index + 1} name`),
        isCustom: cleanFlag(item.isCustom, `location ${index + 1} isCustom`),
      };
    },
  );

  const actions = requireArray(payload.actions, "actions").map(
    (item, index) => {
      if (!isObject(item))
        throw new Error(`Invalid backup: action ${index + 1} is invalid.`);
      if (!isFiniteInteger(item.id) || item.id <= 0)
        throw new Error(
          `Invalid backup: action ${index + 1} has an invalid id.`,
        );
      return {
        id: item.id,
        title: cleanRequiredString(item.title, `action ${index + 1} title`),
        category: cleanOptionalString(item.category),
        isCustom: cleanFlag(item.isCustom, `action ${index + 1} isCustom`),
      };
    },
  );

  const habitIds = validateCollectionItemIds(habits, "habits");
  const cueIds = validateCollectionItemIds(cues, "cues");
  const locationIds = validateCollectionItemIds(locations, "locations");
  const actionIds = validateCollectionItemIds(actions, "actions");

  const selectedHabitIds = uniqueNumbers(
    requireArray(payload.selectedHabits, "selectedHabits").map((item) =>
      isObject(item) ? item.id : item,
    ),
    habitIds,
    "selectedHabits",
  );

  const selectedCueIds = uniqueNumbers(
    requireArray(payload.selectedCues, "selectedCues").map((item) =>
      isObject(item) ? item.id : item,
    ),
    cueIds,
    "selectedCues",
  );

  const selectedLocationIds = uniqueNumbers(
    requireArray(payload.selectedLocations, "selectedLocations").map((item) =>
      isObject(item) ? item.id : item,
    ),
    locationIds,
    "selectedLocations",
  );

  const selectedActionIds = uniqueNumbers(
    requireArray(payload.selectedActionIds, "selectedActionIds"),
    actionIds,
    "selectedActionIds",
  );

  const logs = requireArray(payload.logs, "logs").map((item, index) => {
    if (!isObject(item))
      throw new Error(`Invalid backup: log ${index + 1} is invalid.`);
    if (!isFiniteInteger(item.id) || item.id <= 0)
      throw new Error(`Invalid backup: log ${index + 1} has an invalid id.`);
    if (!isFiniteInteger(item.habitId) || !habitIds.has(item.habitId))
      throw new Error(
        `Invalid backup: log ${index + 1} references an unknown habit.`,
      );

    const cueId = item.cueId == null ? null : item.cueId;
    const locationId = item.locationId == null ? null : item.locationId;
    const selectedActionId =
      item.selectedActionId == null ? null : item.selectedActionId;
    const intensity = item.intensity == null ? null : item.intensity;
    const count = item.count == null ? 1 : item.count;

    if (cueId !== null && (!isFiniteInteger(cueId) || !cueIds.has(cueId)))
      throw new Error(
        `Invalid backup: log ${index + 1} references an unknown cue.`,
      );
    if (
      locationId !== null &&
      (!isFiniteInteger(locationId) || !locationIds.has(locationId))
    )
      throw new Error(
        `Invalid backup: log ${index + 1} references an unknown location.`,
      );
    if (
      selectedActionId !== null &&
      (!isFiniteInteger(selectedActionId) || !actionIds.has(selectedActionId))
    )
      throw new Error(
        `Invalid backup: log ${index + 1} references an unknown action.`,
      );
    if (
      intensity !== null &&
      (!isFiniteInteger(intensity) || intensity < 1 || intensity > 10)
    )
      throw new Error(
        `Invalid backup: log ${index + 1} has an invalid intensity.`,
      );
    if (!isFiniteInteger(count) || count < 0 || count > 10)
      throw new Error(`Invalid backup: log ${index + 1} has an invalid count.`);
    if (!isFiniteInteger(item.createdAt) || item.createdAt <= 0)
      throw new Error(`Invalid backup: log ${index + 1} has an invalid date.`);

    return {
      id: item.id,
      habitId: item.habitId,
      cueId,
      locationId,
      intensity,
      count,
      didResist: cleanFlag(item.didResist, `log ${index + 1} didResist`),
      notes: typeof item.notes === "string" ? item.notes.trim() || null : null,
      createdAt: item.createdAt,
      selectedActionId,
    };
  });

  validateCollectionItemIds(logs, "logs");

  const data: RestorableData = {
    habits,
    cues,
    locations,
    actions,
    selectedHabitIds,
    selectedCueIds,
    selectedLocationIds,
    selectedActionIds,
    logs,
  };

  const localProfile = isObject(payload.localProfile)
    ? payload.localProfile
    : {};
  const settings = isObject(payload.settings) ? payload.settings : {};

  return {
    data,
    profileName:
      typeof localProfile.name === "string" ? localProfile.name.trim() : "",
    hasOnboarded: payload.hasOnboarded === true,
    appLockEnabled: settings.appLockEnabled === true,
  };
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
}

export function DataProvider({ children }: DataProviderProps) {
  const [initializing, setInitializing] = useState(true);

  const [profileName, setProfileName] = useState("");
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);
  const [hasCompletedLocalProfile, setHasCompletedLocalProfile] =
    useState(false);
  const [appLockEnabled, setAppLockEnabledState] = useState(false);

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
          rawSavedProfilePhoto,
          profileDone,
          savedAppLockEnabled,
        ] = await Promise.all([
          loadOnboardedFlag(),
          loadProfileName(),
          loadProfilePhotoUri(),
          loadProfileDoneFlag(),
          loadAppLockEnabledFlag(),
        ]);

        const savedProfilePhoto = await normalizeStoredProfilePhotoUri(
          rawSavedProfilePhoto ?? "",
        );

        if (savedProfilePhoto !== (rawSavedProfilePhoto ?? "").trim()) {
          await saveProfilePhotoUri(savedProfilePhoto);
          if (!savedProfilePhoto) {
            await saveProfileDoneFlag(false);
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

    const newLogId = await insertLog({
      habitId,
      cueId: input.cueId ?? null,
      locationId: input.locationId ?? null,
      intensity,
      count,
      didResist,
      notes: input.notes?.trim() ?? null,
      selectedActionId,
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

      await updateLogSelectedActionInDb(logId, cleanSelectedActionId);
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

  const importData: DataContextType["importData"] = async (backupFileUri) => {
    const file = new FileSystem.File(backupFileUri);
    const text = await file.text();
    const parsed = JSON.parse(text);
    const restored = validateBackupPayload(parsed);

    const storedPhoto = await loadProfilePhotoUri();
    const savedPhoto = ((profilePhotoUri ?? "").trim() || storedPhoto) ?? "";
    await deleteManagedProfilePhoto(savedPhoto);

    await replaceAllDataFromBackup(restored.data);

    await Promise.all([
      saveOnboardedFlag(restored.hasOnboarded),
      saveProfileName(restored.profileName),
      saveProfilePhotoUri(""),
      saveProfileDoneFlag(false),
      saveAppLockEnabledFlag(restored.appLockEnabled),
    ]);

    setHasOnboarded(restored.hasOnboarded);
    setProfileName(restored.profileName);
    setProfilePhotoUri(null);
    setHasCompletedLocalProfile(false);
    setAppLockEnabledState(restored.appLockEnabled);

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

    await Promise.all([
      saveOnboardedFlag(false),
      saveProfileName(""),
      saveProfilePhotoUri(""),
      saveProfileDoneFlag(false),
      saveAppLockEnabledFlag(false),
    ]);

    setHasOnboarded(false);
    setProfileName("");
    setProfilePhotoUri(null);
    setHasCompletedLocalProfile(false);
    setAppLockEnabledState(false);

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
      logs,
      addLog,
      updateLog,
      deleteLog,
      updateLogSelectedAction,
      actions,
      addAction,
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
