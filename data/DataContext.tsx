import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as SQLite from "expo-sqlite";
import * as SecureStore from "expo-secure-store";

// ---------- Types ----------
export type Habit = {
  id: number;
  name: string;
  isCustom: 0 | 1;
};

export type Cue = {
  id: number;
  name: string;
  isCustom: 0 | 1;
};

export type Place = {
  id: number;
  name: string;
  isCustom: 0 | 1;
};

export type SelectedHabit = Habit;
export type SelectedCue = Cue;
export type SelectedPlace = Place;

export type LogEntry = {
  id: number;

  habitId: number;
  habitName: string;

  cueId: number | null;
  cueName: string | null;

  locationId: number | null;
  locationName: string | null;

  intensity: number; // 1–10
  didResist: 0 | 1; // SQLite-friendly boolean
  notes: string | null;
  createdAt: number;
};

export type ReplacementAction = {
  id: number;
  title: string;
  category: string | null;
  isCustom: 0 | 1;
};

// ---------- Open DB ----------
const db = SQLite.openDatabaseSync("reflex.db");

// ---------- Context ----------
type AddLogInput = {
  habitId: number;
  cueId?: number | null;
  locationId?: number | null;
  intensity?: number; // default 5
  didResist?: boolean; // default false
  notes?: string;
};

type AddActionInput = {
  title: string;
  category?: string;
  isCustom?: boolean; // default true for user-created
};

type DataContextType = {
  // master lists
  habits: Habit[];
  cues: Cue[];
  locations: Place[];

  // user-selected lists (onboarding)
  selectedHabits: SelectedHabit[];
  selectedCues: SelectedCue[];
  selectedLocations: SelectedPlace[];

  // onboarding completion (require at least 1 habit)
  hasOnboarded: boolean;

  // selection setters
  setSelectedHabits: (habitIds: number[]) => Promise<void>;
  setSelectedCues: (cueIds: number[]) => Promise<void>;
  setSelectedLocations: (locationIds: number[]) => Promise<void>;

  // custom creators
  addCustomHabit: (name: string, autoSelect?: boolean) => Promise<void>;
  addCustomCue: (name: string, autoSelect?: boolean) => Promise<void>;
  addCustomLocation: (name: string, autoSelect?: boolean) => Promise<void>;

  // logs
  logs: LogEntry[];
  addLog: (input: AddLogInput) => Promise<void>;

  // actions
  actions: ReplacementAction[];
  addAction: (input: AddActionInput) => Promise<void>;

  // utils
  refresh: () => Promise<void>;
  resetDbForDev?: () => Promise<void>;
};

const DataContext = createContext<DataContextType | null>(null);

// ---------- DB Init / Seed ----------
async function initDb() {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      isCustom INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS user_habits (
      habitId INTEGER NOT NULL UNIQUE,
      FOREIGN KEY (habitId) REFERENCES habits(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      isCustom INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS user_cues (
      cueId INTEGER NOT NULL UNIQUE,
      FOREIGN KEY (cueId) REFERENCES cues(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      isCustom INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS user_locations (
      locationId INTEGER NOT NULL UNIQUE,
      FOREIGN KEY (locationId) REFERENCES locations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      habitId INTEGER NOT NULL,
      cueId INTEGER,
      locationId INTEGER,
      intensity INTEGER NOT NULL DEFAULT 5,
      didResist INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (habitId) REFERENCES habits(id) ON DELETE CASCADE,
      FOREIGN KEY (cueId) REFERENCES cues(id) ON DELETE SET NULL,
      FOREIGN KEY (locationId) REFERENCES locations(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL UNIQUE,
      category TEXT,
      isCustom INTEGER NOT NULL DEFAULT 0
    );
  `);
}

async function seedDefaultHabitsIfEmpty() {
  const rows = await db.getAllAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM habits;"
  );
  if ((rows?.[0]?.count ?? 0) > 0) return;

  await db.execAsync(`
    INSERT OR IGNORE INTO habits (name, isCustom) VALUES ('Nicotine', 0);
    INSERT OR IGNORE INTO habits (name, isCustom) VALUES ('Doomscrolling', 0);
    INSERT OR IGNORE INTO habits (name, isCustom) VALUES ('Porn', 0);
    INSERT OR IGNORE INTO habits (name, isCustom) VALUES ('Binge eating', 0);
    INSERT OR IGNORE INTO habits (name, isCustom) VALUES ('Weed', 0);
    INSERT OR IGNORE INTO habits (name, isCustom) VALUES ('Alcohol', 0);
    INSERT OR IGNORE INTO habits (name, isCustom) VALUES ('Gambling', 0);
    INSERT OR IGNORE INTO habits (name, isCustom) VALUES ('Caffeine', 0);
  `);
}

async function seedDefaultCuesIfEmpty() {
  const rows = await db.getAllAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM cues;"
  );
  if ((rows?.[0]?.count ?? 0) > 0) return;

  await db.execAsync(`
    INSERT OR IGNORE INTO cues (name, isCustom) VALUES ('Stress', 0);
    INSERT OR IGNORE INTO cues (name, isCustom) VALUES ('Boredom', 0);
    INSERT OR IGNORE INTO cues (name, isCustom) VALUES ('Anxiety', 0);
    INSERT OR IGNORE INTO cues (name, isCustom) VALUES ('Loneliness', 0);
    INSERT OR IGNORE INTO cues (name, isCustom) VALUES ('Social pressure', 0);
    INSERT OR IGNORE INTO cues (name, isCustom) VALUES ('Tired', 0);
    INSERT OR IGNORE INTO cues (name, isCustom) VALUES ('Anger', 0);
    INSERT OR IGNORE INTO cues (name, isCustom) VALUES ('Celebration', 0);
    INSERT OR IGNORE INTO cues (name, isCustom) VALUES ('After eating', 0);
    INSERT OR IGNORE INTO cues (name, isCustom) VALUES ('After work', 0);
  `);
}

async function seedDefaultLocationsIfEmpty() {
  const rows = await db.getAllAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM locations;"
  );
  if ((rows?.[0]?.count ?? 0) > 0) return;

  await db.execAsync(`
    INSERT OR IGNORE INTO locations (name, isCustom) VALUES ('Bedroom', 0);
    INSERT OR IGNORE INTO locations (name, isCustom) VALUES ('Bathroom', 0);
    INSERT OR IGNORE INTO locations (name, isCustom) VALUES ('Car', 0);
    INSERT OR IGNORE INTO locations (name, isCustom) VALUES ('Work', 0);
    INSERT OR IGNORE INTO locations (name, isCustom) VALUES ('School', 0);
    INSERT OR IGNORE INTO locations (name, isCustom) VALUES ('Gym', 0);
    INSERT OR IGNORE INTO locations (name, isCustom) VALUES ('Friend’s house', 0);
    INSERT OR IGNORE INTO locations (name, isCustom) VALUES ('Bar/Restaurant', 0);
    INSERT OR IGNORE INTO locations (name, isCustom) VALUES ('Living room', 0);
    INSERT OR IGNORE INTO locations (name, isCustom) VALUES ('Kitchen', 0);
  `);
}

async function seedDefaultActionsIfEmpty() {
  const rows = await db.getAllAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM actions;"
  );
  if ((rows?.[0]?.count ?? 0) > 0) return;

  await db.execAsync(`
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Drink water', 'Quick reset', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Go for a 5-min walk', 'Movement', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Deep breathing (60s)', 'Calming', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Text a friend', 'Social', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Do 10 push-ups', 'Movement', 0);
  `);
}

/**
 * DEV ONLY: Recreate tables when you change schema.
 * Use once (temporarily call it in provider init), then remove.
 */
async function resetDbForDev() {
  await db.execAsync(`
    DROP TABLE IF EXISTS logs;
    DROP TABLE IF EXISTS user_locations;
    DROP TABLE IF EXISTS locations;
    DROP TABLE IF EXISTS user_cues;
    DROP TABLE IF EXISTS cues;
    DROP TABLE IF EXISTS user_habits;
    DROP TABLE IF EXISTS habits;
    DROP TABLE IF EXISTS actions;
  `);

  await initDb();
  await seedDefaultHabitsIfEmpty();
  await seedDefaultCuesIfEmpty();
  await seedDefaultLocationsIfEmpty();
  await seedDefaultActionsIfEmpty();
}

// ---------- Loaders ----------
async function loadHabits(): Promise<Habit[]> {
  return db.getAllAsync<Habit>(
    "SELECT * FROM habits ORDER BY isCustom ASC, name ASC;"
  );
}

async function loadCues(): Promise<Cue[]> {
  return db.getAllAsync<Cue>(
    "SELECT * FROM cues ORDER BY isCustom ASC, name ASC;"
  );
}

async function loadLocations(): Promise<Place[]> {
  return db.getAllAsync<Place>(
    "SELECT * FROM locations ORDER BY isCustom ASC, name ASC;"
  );
}

async function loadSelectedHabits(): Promise<SelectedHabit[]> {
  return db.getAllAsync<SelectedHabit>(`
    SELECT h.*
    FROM user_habits uh
    JOIN habits h ON h.id = uh.habitId
    ORDER BY h.isCustom ASC, h.name ASC;
  `);
}

async function loadSelectedCues(): Promise<SelectedCue[]> {
  return db.getAllAsync<SelectedCue>(`
    SELECT c.*
    FROM user_cues uc
    JOIN cues c ON c.id = uc.cueId
    ORDER BY c.isCustom ASC, c.name ASC;
  `);
}

async function loadSelectedLocations(): Promise<SelectedPlace[]> {
  return db.getAllAsync<SelectedPlace>(`
    SELECT l.*
    FROM user_locations ul
    JOIN locations l ON l.id = ul.locationId
    ORDER BY l.isCustom ASC, l.name ASC;
  `);
}

async function loadLogs(): Promise<LogEntry[]> {
  return db.getAllAsync<LogEntry>(`
    SELECT
      l.id,
      l.habitId,
      h.name AS habitName,
      l.cueId,
      c.name AS cueName,
      l.locationId,
      loc.name AS locationName,
      l.intensity,
      l.didResist,
      l.notes,
      l.createdAt
    FROM logs l
    JOIN habits h ON h.id = l.habitId
    LEFT JOIN cues c ON c.id = l.cueId
    LEFT JOIN locations loc ON loc.id = l.locationId
    ORDER BY l.createdAt DESC;
  `);
}

async function loadActions(): Promise<ReplacementAction[]> {
  return db.getAllAsync<ReplacementAction>(
    "SELECT * FROM actions ORDER BY isCustom ASC, title ASC;"
  );
}

// ---------- Provider ----------
export function DataProvider({ children }: { children: React.ReactNode }) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [cues, setCues] = useState<Cue[]>([]);
  const [locations, setLocations] = useState<Place[]>([]);

  const [selectedHabits, setSelectedHabitsState] = useState<SelectedHabit[]>(
    []
  );
  const [selectedCues, setSelectedCuesState] = useState<SelectedCue[]>([]);
  const [selectedLocations, setSelectedLocationsState] = useState<
    SelectedPlace[]
  >([]);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [actions, setActions] = useState<ReplacementAction[]>([]);

  useEffect(() => {
    (async () => {
      await resetDbForDev();
      await refresh();
    })();
  }, []);

  const refresh = async () => {
    const [h, c, loc, sh, sc, sl, l, a] = await Promise.all([
      loadHabits(),
      loadCues(),
      loadLocations(),
      loadSelectedHabits(),
      loadSelectedCues(),
      loadSelectedLocations(),
      loadLogs(),
      loadActions(),
    ]);

    setHabits(h);
    setCues(c);
    setLocations(loc);

    setSelectedHabitsState(sh);
    setSelectedCuesState(sc);
    setSelectedLocationsState(sl);

    setLogs(l);
    setActions(a);
  };

  // Require at least 1 habit selected to consider onboarding complete
  const hasOnboarded = selectedHabits.length > 0;

  // ---------- Selection setters ----------
  const setSelectedHabits: DataContextType["setSelectedHabits"] = async (
    habitIds
  ) => {
    const uniqueIds = Array.from(new Set(habitIds)).filter((n) =>
      Number.isFinite(n)
    );

    await db.execAsync(`DELETE FROM user_habits;`);
    for (const id of uniqueIds) {
      await db.runAsync(
        `INSERT OR IGNORE INTO user_habits (habitId) VALUES (?);`,
        [id]
      );
    }
    setSelectedHabitsState(await loadSelectedHabits());
  };

  const setSelectedCues: DataContextType["setSelectedCues"] = async (
    cueIds
  ) => {
    const uniqueIds = Array.from(new Set(cueIds)).filter((n) =>
      Number.isFinite(n)
    );

    await db.execAsync(`DELETE FROM user_cues;`);
    for (const id of uniqueIds) {
      await db.runAsync(`INSERT OR IGNORE INTO user_cues (cueId) VALUES (?);`, [
        id,
      ]);
    }
    setSelectedCuesState(await loadSelectedCues());
  };

  const setSelectedLocations: DataContextType["setSelectedLocations"] = async (
    locationIds
  ) => {
    const uniqueIds = Array.from(new Set(locationIds)).filter((n) =>
      Number.isFinite(n)
    );

    await db.execAsync(`DELETE FROM user_locations;`);
    for (const id of uniqueIds) {
      await db.runAsync(
        `INSERT OR IGNORE INTO user_locations (locationId) VALUES (?);`,
        [id]
      );
    }
    setSelectedLocationsState(await loadSelectedLocations());
  };

  // ---------- Custom creators ----------
  const addCustomHabit: DataContextType["addCustomHabit"] = async (
    name,
    autoSelect = true
  ) => {
    const clean = name.trim();
    if (!clean) return;

    await db.runAsync(
      `INSERT OR IGNORE INTO habits (name, isCustom) VALUES (?, 1);`,
      [clean]
    );
    const updated = await loadHabits();
    setHabits(updated);

    if (!autoSelect) return;

    const match = updated.find(
      (h) => h.name.toLowerCase() === clean.toLowerCase()
    );
    if (!match) return;

    const currentSelected = await loadSelectedHabits();
    const nextIds = [...currentSelected.map((h) => h.id), match.id];
    await setSelectedHabits(nextIds);
  };

  const addCustomCue: DataContextType["addCustomCue"] = async (
    name,
    autoSelect = true
  ) => {
    const clean = name.trim();
    if (!clean) return;

    await db.runAsync(
      `INSERT OR IGNORE INTO cues (name, isCustom) VALUES (?, 1);`,
      [clean]
    );
    const updated = await loadCues();
    setCues(updated);

    if (!autoSelect) return;

    const match = updated.find(
      (c) => c.name.toLowerCase() === clean.toLowerCase()
    );
    if (!match) return;

    const currentSelected = await loadSelectedCues();
    const nextIds = [...currentSelected.map((c) => c.id), match.id];
    await setSelectedCues(nextIds);
  };

  const addCustomLocation: DataContextType["addCustomLocation"] = async (
    name,
    autoSelect = true
  ) => {
    const clean = name.trim();
    if (!clean) return;

    await db.runAsync(
      `INSERT OR IGNORE INTO locations (name, isCustom) VALUES (?, 1);`,
      [clean]
    );
    const updated = await loadLocations();
    setLocations(updated);

    if (!autoSelect) return;

    const match = updated.find(
      (l) => l.name.toLowerCase() === clean.toLowerCase()
    );
    if (!match) return;

    const currentSelected = await loadSelectedLocations();
    const nextIds = [...currentSelected.map((l) => l.id), match.id];
    await setSelectedLocations(nextIds);
  };

  // ---------- Logs ----------
  const addLog: DataContextType["addLog"] = async (input) => {
    const habitId = input.habitId;
    if (!Number.isFinite(habitId)) return;

    const intensityRaw = input.intensity ?? 5;
    const intensity = Math.min(10, Math.max(1, Math.round(intensityRaw)));
    const didResist: 0 | 1 = input.didResist ? 1 : 0;

    await db.runAsync(
      `
      INSERT INTO logs (habitId, cueId, locationId, intensity, didResist, notes, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?);
      `,
      [
        habitId,
        input.cueId ?? null,
        input.locationId ?? null,
        intensity,
        didResist,
        input.notes?.trim() ?? null,
        Date.now(),
      ]
    );

    setLogs(await loadLogs());
  };

  // ---------- Actions ----------
  const addAction: DataContextType["addAction"] = async (input) => {
    const title = input.title.trim();
    if (!title) return;

    const category = input.category?.trim() ?? null;
    const isCustom: 0 | 1 = (input.isCustom ?? true) ? 1 : 0;

    await db.runAsync(
      `INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES (?, ?, ?);`,
      [title, category, isCustom]
    );

    setActions(await loadActions());
  };

  // SecureStore is reserved for later (auth token, encryption key, app lock).
  // Example:
  // await SecureStore.setItemAsync("authToken", token);

  const value = useMemo(
    () => ({
      habits,
      cues,
      locations,
      selectedHabits,
      selectedCues,
      selectedLocations,
      hasOnboarded,
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
      refresh,
      resetDbForDev, // keep while iterating; remove later if you want
    }),
    [
      habits,
      cues,
      locations,
      selectedHabits,
      selectedCues,
      selectedLocations,
      logs,
      actions,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// ---------- Hook ----------
export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
