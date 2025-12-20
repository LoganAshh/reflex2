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

export type SelectedHabit = Habit;

export type LogEntry = {
  id: number;
  habitId: number;
  habitName: string; // joined from habits table
  cue: string | null;
  location: string | null;
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

// ---------- Open DB (new API) ----------
const db = SQLite.openDatabaseSync("reflex.db");

// ---------- Context ----------
type AddLogInput = {
  habitId: number;
  cue?: string;
  location?: string;
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
  // onboarding/habits
  habits: Habit[];
  selectedHabits: SelectedHabit[];
  hasOnboarded: boolean;
  setSelectedHabits: (habitIds: number[]) => Promise<void>;
  addCustomHabit: (name: string, autoSelect?: boolean) => Promise<void>;

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

    -- MVP assumes a single user on one device, so user_habits is just a selection table.
    CREATE TABLE IF NOT EXISTS user_habits (
      habitId INTEGER NOT NULL UNIQUE,
      FOREIGN KEY (habitId) REFERENCES habits(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      habitId INTEGER NOT NULL,
      cue TEXT,
      location TEXT,
      intensity INTEGER NOT NULL DEFAULT 5,
      didResist INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (habitId) REFERENCES habits(id) ON DELETE CASCADE
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
  const count = rows?.[0]?.count ?? 0;
  if (count > 0) return;

  // Edit this list freely
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

async function seedDefaultActionsIfEmpty() {
  const rows = await db.getAllAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM actions;"
  );
  const count = rows?.[0]?.count ?? 0;
  if (count > 0) return;

  // Preset actions (isCustom=0)
  await db.execAsync(`
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Drink water', 'Quick reset', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Go for a 5-min walk', 'Movement', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Deep breathing (60s)', 'Calming', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Text a friend', 'Social', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Do 10 push-ups', 'Movement', 0);
  `);
}

/**
 * DEV ONLY: nuke + recreate tables.
 * Use once after schema changes (since CREATE TABLE IF NOT EXISTS won't add columns).
 */
async function resetDbForDev() {
  await db.execAsync(`
    DROP TABLE IF EXISTS logs;
    DROP TABLE IF EXISTS user_habits;
    DROP TABLE IF EXISTS habits;
    DROP TABLE IF EXISTS actions;
  `);

  await initDb();
  await seedDefaultHabitsIfEmpty();
  await seedDefaultActionsIfEmpty();
}

// ---------- Loaders ----------
async function loadHabits(): Promise<Habit[]> {
  return db.getAllAsync<Habit>(
    "SELECT * FROM habits ORDER BY isCustom ASC, name ASC;"
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

async function loadLogs(): Promise<LogEntry[]> {
  return db.getAllAsync<LogEntry>(`
    SELECT
      l.id,
      l.habitId,
      h.name as habitName,
      l.cue,
      l.location,
      l.intensity,
      l.didResist,
      l.notes,
      l.createdAt
    FROM logs l
    JOIN habits h ON h.id = l.habitId
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
  const [selectedHabits, setSelectedHabitsState] = useState<SelectedHabit[]>(
    []
  );
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [actions, setActions] = useState<ReplacementAction[]>([]);

  useEffect(() => {
    (async () => {
      await initDb();
      await seedDefaultHabitsIfEmpty();
      await seedDefaultActionsIfEmpty();
      await refresh();
    })();
  }, []);

  const refresh = async () => {
    const [h, sh, l, a] = await Promise.all([
      loadHabits(),
      loadSelectedHabits(),
      loadLogs(),
      loadActions(),
    ]);

    setHabits(h);
    setSelectedHabitsState(sh);
    setLogs(l);
    setActions(a);
  };

  // ---------- Onboarding / Habits ----------
  const hasOnboarded = selectedHabits.length > 0;

  const setSelectedHabits: DataContextType["setSelectedHabits"] = async (
    habitIds
  ) => {
    // normalize + unique
    const uniqueIds = Array.from(new Set(habitIds)).filter((n) =>
      Number.isFinite(n)
    );

    await db.execAsync(`DELETE FROM user_habits;`);

    // Insert selected
    for (const id of uniqueIds) {
      await db.runAsync(
        `INSERT OR IGNORE INTO user_habits (habitId) VALUES (?);`,
        [id]
      );
    }

    setSelectedHabitsState(await loadSelectedHabits());
  };

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

    // find habit id and add to selection
    const match = updatedHabits.find(
      (h) => h.name.toLowerCase() === clean.toLowerCase()
    );
    if (!match) return;

    const currentSelected = await loadSelectedHabits();
    const nextIds = [...currentSelected.map((h) => h.id), match.id];
    await setSelectedHabits(nextIds);
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
      INSERT INTO logs (habitId, cue, location, intensity, didResist, notes, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?);
      `,
      [
        habitId,
        input.cue?.trim() ?? null,
        input.location?.trim() ?? null,
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
      selectedHabits,
      hasOnboarded,
      setSelectedHabits,
      addCustomHabit,
      logs,
      addLog,
      actions,
      addAction,
      refresh,
      resetDbForDev, // keep during development; remove later if you want
    }),
    [habits, selectedHabits, logs, actions]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// ---------- Hook ----------
export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
