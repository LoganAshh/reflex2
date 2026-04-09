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
  insertAction,
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
  DataContextType,
} from "./types";

const DataContext = createContext<DataContextType | null>(null);

async function resetDbForDev() {
  const savedPhoto = await loadProfilePhotoUri();
  await deleteManagedProfilePhoto(savedPhoto);

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
}

export function DataProvider({ children }: DataProviderProps) {
  const [initializing, setInitializing] = useState(true);

  const [profileName, setProfileName] = useState("");
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);
  const [hasCompletedLocalProfile, setHasCompletedLocalProfile] =
    useState(false);

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

        const [onboarded, savedProfileName, rawSavedProfilePhoto, profileDone] =
          await Promise.all([
            loadOnboardedFlag(),
            loadProfileName(),
            loadProfilePhotoUri(),
            loadProfileDoneFlag(),
          ]);

        const savedProfilePhoto =
          await normalizeStoredProfilePhotoUri(rawSavedProfilePhoto);

        if (savedProfilePhoto !== rawSavedProfilePhoto.trim()) {
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

  const completeLocalProfile: DataContextType["completeLocalProfile"] = async (
    name,
    photoUri,
  ) => {
    const cleanName = name.trim();
    const cleanPhoto = (photoUri ?? "").trim();

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
    setProfilePhotoUri(cleanPhoto);
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
    if (!Number.isFinite(habitId)) return;

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

    await insertLog({
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

  const resetAll: DataContextType["resetAll"] = async () => {
    const savedPhoto =
      (profilePhotoUri ?? "").trim() || (await loadProfilePhotoUri());
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
    ]);

    setHasOnboarded(false);
    setProfileName("");
    setProfilePhotoUri(null);
    setHasCompletedLocalProfile(false);

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
      actions,
      addAction,
      selectedActionIds,
      toggleSelectedAction,
      clearSelectedActions,
      exportData,
      resetAll,
      refresh,
      resetDbForDev,
    }),
    [
      initializing,
      profileName,
      profilePhotoUri,
      hasCompletedLocalProfile,
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
