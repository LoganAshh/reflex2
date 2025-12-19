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
  urge: string;
  cue: string | null;
  location: string | null;
  createdAt: number;
};

export type ReplacementAction = {
  id: number;
  title: string;
};

// ---------- Open DB (new API) ----------
const db = SQLite.openDatabaseSync("reflex.db");

// ---------- Context ----------
type DataContextType = {
  logs: UrgeLog[];
  actions: ReplacementAction[];
  addLog: (input: {
    urge: string;
    cue?: string;
    location?: string;
  }) => Promise<void>;
  addAction: (title: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const DataContext = createContext<DataContextType | null>(null);

// ---------- Helpers ----------
async function initDb() {
  // Create tables
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      urge TEXT NOT NULL,
      cue TEXT,
      location TEXT,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL UNIQUE
    );
  `);
}

async function seedDefaultActionsIfEmpty() {
  const rows = await db.getAllAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM actions;"
  );
  const count = rows?.[0]?.count ?? 0;
  if (count > 0) return;

  const defaults = ["Drink water", "Go for a walk", "Deep breathing"];
  // Use a single transaction-like exec for speed
  await db.execAsync(`
    INSERT OR IGNORE INTO actions (title) VALUES ('Drink water');
    INSERT OR IGNORE INTO actions (title) VALUES ('Go for a walk');
    INSERT OR IGNORE INTO actions (title) VALUES ('Deep breathing');
  `);
}

async function loadLogs(): Promise<UrgeLog[]> {
  return db.getAllAsync<UrgeLog>("SELECT * FROM logs ORDER BY createdAt DESC;");
}

async function loadActions(): Promise<ReplacementAction[]> {
  return db.getAllAsync<ReplacementAction>(
    "SELECT * FROM actions ORDER BY id ASC;"
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

  const addLog: DataContextType["addLog"] = async ({ urge, cue, location }) => {
    const cleanUrge = urge.trim();
    if (!cleanUrge) return;

    await db.runAsync(
      `INSERT INTO logs (urge, cue, location, createdAt) VALUES (?, ?, ?, ?);`,
      [cleanUrge, cue?.trim() ?? null, location?.trim() ?? null, Date.now()]
    );

    // Refresh only logs for speed
    setLogs(await loadLogs());
  };

  const addAction: DataContextType["addAction"] = async (title) => {
    const clean = title.trim();
    if (!clean) return;

    await db.runAsync(`INSERT OR IGNORE INTO actions (title) VALUES (?);`, [
      clean,
    ]);
    setActions(await loadActions());
  };

  // SecureStore is here for later (tokens/keys/app-lock). Not used for logs.
  // Example:
  // await SecureStore.setItemAsync("authToken", token);

  const value = useMemo(
    () => ({ logs, actions, addLog, addAction, refresh }),
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
