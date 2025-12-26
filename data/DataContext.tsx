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
  category: string | null; // Physical | Mental | Social | Creative (for presets)
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
  // master lists (NOT alphabetical; preserve seed/insertion order)
  habits: Habit[];
  cues: Cue[];
  locations: Place[];

  // user-selected lists (NOT alphabetical; preserve selection insertion order)
  selectedHabits: SelectedHabit[];
  selectedCues: SelectedCue[];
  selectedLocations: SelectedPlace[];

  // onboarding completion (SEPARATE FLAG — not derived from selectedHabits)
  hasOnboarded: boolean;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;

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

// ---------- Onboarding flag helpers ----------
const ONBOARD_KEY = "hasOnboarded";

async function loadOnboardedFlag(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(ONBOARD_KEY);
    return v === "true";
  } catch {
    return false;
  }
}

async function saveOnboardedFlag(value: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(ONBOARD_KEY, value ? "true" : "false");
  } catch {
    // ignore (simulator / platform edge cases)
  }
}

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
    INSERT OR IGNORE INTO habits (name, isCustom) VALUES ('Alcohol', 0);
    INSERT OR IGNORE INTO habits (name, isCustom) VALUES ('Doomscrolling', 0);
    INSERT OR IGNORE INTO habits (name, isCustom) VALUES ('Nicotine', 0);
    INSERT OR IGNORE INTO habits (name, isCustom) VALUES ('Binge eating', 0);
    INSERT OR IGNORE INTO habits (name, isCustom) VALUES ('Caffeine', 0);
    INSERT OR IGNORE INTO habits (name, isCustom) VALUES ('Weed', 0);
    INSERT OR IGNORE INTO habits (name, isCustom) VALUES ('Gambling', 0);
    INSERT OR IGNORE INTO habits (name, isCustom) VALUES ('Video Games', 0);
    INSERT OR IGNORE INTO habits (name, isCustom) VALUES ('Porn', 0);
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
    -- Physical (5+)
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Do 10 push-ups', 'Physical', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Go for a 5-min walk', 'Physical', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Stretch for 2 minutes', 'Physical', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('20 jumping jacks', 'Physical', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Drink a full glass of water', 'Physical', 0);

    -- Mental (5+)
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Deep breathing (60s)', 'Mental', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Name 5 things you can see', 'Mental', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Write 3 lines of journaling', 'Mental', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Set a 2-min timer and do nothing', 'Mental', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Read 1 page of a book', 'Mental', 0);

    -- Social (5+)
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Text a friend', 'Social', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Call someone for 2 minutes', 'Social', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Send a “how are you?” message', 'Social', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Reply to one message you’ve been avoiding', 'Social', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Step outside and say hi to someone', 'Social', 0);

    -- Creative (5+)
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Write one paragraph', 'Creative', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Sketch for 2 minutes', 'Creative', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Make a quick playlist', 'Creative', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Take 3 photos of anything', 'Creative', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Brain-dump 10 ideas', 'Creative', 0);
  `);
}

/**
 * DEV ONLY: Recreate tables when you change schema.
 * Use once, then remove the call.
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

  // If you're wiping DB in dev, you usually want to re-run onboarding too.
  await saveOnboardedFlag(false);
}

// ---------- Loaders (NO alphabetical sorting) ----------
async function loadHabits(): Promise<Habit[]> {
  return db.getAllAsync<Habit>(
    "SELECT * FROM habits ORDER BY isCustom ASC, id ASC;"
  );
}

async function loadCues(): Promise<Cue[]> {
  return db.getAllAsync<Cue>(
    "SELECT * FROM cues ORDER BY isCustom ASC, id ASC;"
  );
}

async function loadLocations(): Promise<Place[]> {
  return db.getAllAsync<Place>(
    "SELECT * FROM locations ORDER BY isCustom ASC, id ASC;"
  );
}

async function loadSelectedHabits(): Promise<SelectedHabit[]> {
  return db.getAllAsync<SelectedHabit>(`
    SELECT h.*
    FROM user_habits uh
    JOIN habits h ON h.id = uh.habitId
    ORDER BY uh.rowid ASC;
  `);
}

async function loadSelectedCues(): Promise<SelectedCue[]> {
  return db.getAllAsync<SelectedCue>(`
    SELECT c.*
    FROM user_cues uc
    JOIN cues c ON c.id = uc.cueId
    ORDER BY uc.rowid ASC;
  `);
}

async function loadSelectedLocations(): Promise<SelectedPlace[]> {
  return db.getAllAsync<SelectedPlace>(`
    SELECT l.*
    FROM user_locations ul
    JOIN locations l ON l.id = ul.locationId
    ORDER BY ul.rowid ASC;
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
    "SELECT * FROM actions ORDER BY isCustom ASC, id ASC;"
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

  // IMPORTANT: onboarding completion is its own flag
  const [hasOnboarded, setHasOnboarded] = useState(false);

  useEffect(() => {
    (async () => {
      // If you are still iterating on schema, keep this.
      // When you stop iterating, remove the resetDbForDev() call.
      await resetDbForDev();

      setHasOnboarded(await loadOnboardedFlag());
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

  // ---------- Onboarding controls ----------
  const completeOnboarding = async () => {
    await saveOnboardedFlag(true);
    setHasOnboarded(true);
  };

  const resetOnboarding = async () => {
    await saveOnboardedFlag(false);
    setHasOnboarded(false);
  };

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
  // KEY CHANGE: these functions DO NOT flip hasOnboarded anymore.
  // They can auto-select, but onboarding completion is only via completeOnboarding().
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
    const updatedHabits = await loadHabits();
    setHabits(updatedHabits);

    if (!autoSelect) return;

    const match = updatedHabits.find(
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
    const updatedCues = await loadCues();
    setCues(updatedCues);

    if (!autoSelect) return;

    const match = updatedCues.find(
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
    const updatedLocations = await loadLocations();
    setLocations(updatedLocations);

    if (!autoSelect) return;

    const match = updatedLocations.find(
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

  const value = useMemo(
    () => ({
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
      hasOnboarded,
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
