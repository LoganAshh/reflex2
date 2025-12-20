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
export type UrgeLog = {
  id: number;
  habit: string;
  urge: string;
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
  habit: string;
  urge: string;
  cue?: string;
  location?: string;
  intensity?: number; // default 5
  didResist?: boolean; // default false
  notes?: string;
};

type AddActionInput = {
  title: string;
  category?: string;
  isCustom?: boolean; // default true when user creates one
};

type DataContextType = {
  logs: UrgeLog[];
  actions: ReplacementAction[];
  addLog: (input: AddLogInput) => Promise<void>;
  addAction: (input: AddActionInput) => Promise<void>;
  refresh: () => Promise<void>;
  // optional dev helper (see Step 2)
  resetDbForDev?: () => Promise<void>;
};

const DataContext = createContext<DataContextType | null>(null);

// ---------- Helpers ----------
async function initDb() {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      habit TEXT NOT NULL,
      urge TEXT NOT NULL,
      cue TEXT,
      location TEXT,
      intensity INTEGER NOT NULL DEFAULT 5,
      didResist INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL UNIQUE,
      category TEXT,
      isCustom INTEGER NOT NULL DEFAULT 0
    );
  `);
}

/**
 * DEV ONLY: Recreate tables to match latest schema.
 * Use this once when you're iterating on schema and don't care about old data.
 */
async function resetDbForDev() {
  await db.execAsync(`
    DROP TABLE IF EXISTS logs;
    DROP TABLE IF EXISTS actions;
  `);
  await initDb();
  await seedDefaultActionsIfEmpty();
}

async function seedDefaultActionsIfEmpty() {
  const rows = await db.getAllAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM actions;"
  );
  const count = rows?.[0]?.count ?? 0;
  if (count > 0) return;

  // Preset actions (isCustom=0)
  const defaults: Array<{ title: string; category: string }> = [
    { title: "Drink water", category: "Quick reset" },
    { title: "Go for a walk", category: "Movement" },
    { title: "Deep breathing (60s)", category: "Calming" },
  ];

  // Insert presets
  await db.execAsync(`
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Drink water', 'Quick reset', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Go for a walk', 'Movement', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Deep breathing (60s)', 'Calming', 0);
  `);
}

async function loadLogs(): Promise<UrgeLog[]> {
  return db.getAllAsync<UrgeLog>("SELECT * FROM logs ORDER BY createdAt DESC;");
}

async function loadActions(): Promise<ReplacementAction[]> {
  return db.getAllAsync<ReplacementAction>(
    "SELECT * FROM actions ORDER BY isCustom ASC, title ASC;"
  );
}

// ---------- Provider ----------
export function DataProvider({ children }: { children: React.ReactNode }) {
  const [logs, setLogs] = useState<UrgeLog[]>([]);
  const [actions, setActions] = useState<ReplacementAction[]>([]);

  useEffect(() => {
    (async () => {
      await initDb();
      await seedDefaultActionsIfEmpty();
      await refresh();
    })();
  }, []);

  const refresh = async () => {
    const [l, a] = await Promise.all([loadLogs(), loadActions()]);
    setLogs(l);
    setActions(a);
  };

  const addLog: DataContextType["addLog"] = async (input) => {
    const habit = input.habit.trim();
    const urge = input.urge.trim();
    if (!habit || !urge) return;

    const intensityRaw = input.intensity ?? 5;
    const intensity = Math.min(10, Math.max(1, Math.round(intensityRaw)));
    const didResist: 0 | 1 = input.didResist ? 1 : 0;

    await db.runAsync(
      `
      INSERT INTO logs (habit, urge, cue, location, intensity, didResist, notes, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
      `,
      [
        habit,
        urge,
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
      logs,
      actions,
      addLog,
      addAction,
      refresh,
      resetDbForDev, // optional, can remove later
    }),
    [logs, actions]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// ---------- Hook ----------
export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
