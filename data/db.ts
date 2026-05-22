import * as SQLite from "expo-sqlite";
import type {
  Habit,
  Cue,
  Place,
  SelectedHabit,
  SelectedCue,
  SelectedPlace,
  LogEntry,
  ReplacementAction,
} from "./types";

export const db = SQLite.openDatabaseSync("reflex.db");

const DEFAULT_HABIT_COLOR = "#16A34A";

const PRESET_HABIT_COLORS: Record<string, string> = {
  "Social Media": "#2563EB",
  "Junk Food": "#F97316",
  Caffeine: "#92400E",
  Shopping: "#DB2777",
  "Video Games": "#7C3AED",
  Alcohol: "#7F1D1D",
  Nicotine: "#64748B",
  Streaming: "#DC2626",
  Porn: "#BE123C",
  Weed: "#16A34A",
  Gambling: "#EAB308",
  Prescriptions: "#0EA5E9",
};

export function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

export async function ensureLocalSchemaColumns() {
  const tableColumns = async (table: string) =>
    db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table});`);

  const ensureColumn = async (table: string, column: string, sql: string) => {
    const columns = await tableColumns(table);
    const exists = columns.some((col) => col.name === column);
    if (!exists) {
      await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${sql};`);
    }
  };

  await ensureColumn("habits", "hidden", "hidden INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(
    "habits",
    "color",
    `color TEXT NOT NULL DEFAULT '${DEFAULT_HABIT_COLOR}'`,
  );
  await ensureColumn("cues", "hidden", "hidden INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(
    "locations",
    "hidden",
    "hidden INTEGER NOT NULL DEFAULT 0",
  );
  await ensureColumn("actions", "hidden", "hidden INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(
    "logs",
    "selectedActionId",
    "selectedActionId INTEGER REFERENCES actions(id) ON DELETE SET NULL",
  );
  await ensureColumn("logs", "habitName", "habitName TEXT");
  await ensureColumn("logs", "cueName", "cueName TEXT");
  await ensureColumn("logs", "locationName", "locationName TEXT");
  await ensureColumn("logs", "selectedActionTitle", "selectedActionTitle TEXT");

  await db.execAsync(`
    UPDATE logs
    SET habitName = (SELECT name FROM habits WHERE habits.id = logs.habitId)
    WHERE habitName IS NULL;

    UPDATE logs
    SET cueName = (SELECT name FROM cues WHERE cues.id = logs.cueId)
    WHERE cueName IS NULL AND cueId IS NOT NULL;

    UPDATE logs
    SET locationName = (SELECT name FROM locations WHERE locations.id = logs.locationId)
    WHERE locationName IS NULL AND locationId IS NOT NULL;

    UPDATE logs
    SET selectedActionTitle = (SELECT title FROM actions WHERE actions.id = logs.selectedActionId)
    WHERE selectedActionTitle IS NULL AND selectedActionId IS NOT NULL;
  `);

  for (const [name, color] of Object.entries(PRESET_HABIT_COLORS)) {
    await db.runAsync(
      `UPDATE habits SET color = ? WHERE name = ? AND isCustom = 0 AND (color IS NULL OR color = ?);`,
      [color, name, DEFAULT_HABIT_COLOR],
    );
  }
}

export async function initDb() {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      isCustom INTEGER NOT NULL DEFAULT 0,
      hidden INTEGER NOT NULL DEFAULT 0,
      color TEXT NOT NULL DEFAULT '#16A34A'
    );

    CREATE TABLE IF NOT EXISTS user_habits (
      habitId INTEGER NOT NULL UNIQUE,
      FOREIGN KEY (habitId) REFERENCES habits(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      isCustom INTEGER NOT NULL DEFAULT 0,
      hidden INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS user_cues (
      cueId INTEGER NOT NULL UNIQUE,
      FOREIGN KEY (cueId) REFERENCES cues(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      isCustom INTEGER NOT NULL DEFAULT 0,
      hidden INTEGER NOT NULL DEFAULT 0
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
      intensity INTEGER,
      count INTEGER NOT NULL DEFAULT 1,
      didResist INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      createdAt INTEGER NOT NULL,
      selectedActionId INTEGER,
      habitName TEXT,
      cueName TEXT,
      locationName TEXT,
      selectedActionTitle TEXT,
      FOREIGN KEY (habitId) REFERENCES habits(id) ON DELETE CASCADE,
      FOREIGN KEY (cueId) REFERENCES cues(id) ON DELETE SET NULL,
      FOREIGN KEY (locationId) REFERENCES locations(id) ON DELETE SET NULL,
      FOREIGN KEY (selectedActionId) REFERENCES actions(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL UNIQUE,
      category TEXT,
      isCustom INTEGER NOT NULL DEFAULT 0,
      hidden INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS selected_actions (
      actionId INTEGER NOT NULL UNIQUE,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (actionId) REFERENCES actions(id) ON DELETE CASCADE
    );
  `);

  await ensureLocalSchemaColumns();
}

export async function seedDefaultHabitsIfEmpty() {
  await db.execAsync(`
    INSERT OR IGNORE INTO habits (name, isCustom, color) VALUES ('Social Media', 0, '#2563EB');
    INSERT OR IGNORE INTO habits (name, isCustom, color) VALUES ('Junk Food', 0, '#F97316');
    INSERT OR IGNORE INTO habits (name, isCustom, color) VALUES ('Caffeine', 0, '#92400E');
    INSERT OR IGNORE INTO habits (name, isCustom, color) VALUES ('Shopping', 0, '#DB2777');
    INSERT OR IGNORE INTO habits (name, isCustom, color) VALUES ('Video Games', 0, '#7C3AED');
    INSERT OR IGNORE INTO habits (name, isCustom, color) VALUES ('Alcohol', 0, '#7F1D1D');
    INSERT OR IGNORE INTO habits (name, isCustom, color) VALUES ('Nicotine', 0, '#64748B');
    INSERT OR IGNORE INTO habits (name, isCustom, color) VALUES ('Streaming', 0, '#DC2626');
    INSERT OR IGNORE INTO habits (name, isCustom, color) VALUES ('Porn', 0, '#BE123C');
    INSERT OR IGNORE INTO habits (name, isCustom, color) VALUES ('Weed', 0, '#16A34A');
    INSERT OR IGNORE INTO habits (name, isCustom, color) VALUES ('Gambling', 0, '#EAB308');
    INSERT OR IGNORE INTO habits (name, isCustom, color) VALUES ('Prescriptions', 0, '#0EA5E9');
  `);
}

export async function seedDefaultCuesIfEmpty() {
  await db.execAsync(`
    INSERT OR IGNORE INTO cues (name, isCustom) VALUES ('Stress', 0);
    INSERT OR IGNORE INTO cues (name, isCustom) VALUES ('Boredom', 0);
    INSERT OR IGNORE INTO cues (name, isCustom) VALUES ('Anxiety', 0);
    INSERT OR IGNORE INTO cues (name, isCustom) VALUES ('Social pressure', 0);
    INSERT OR IGNORE INTO cues (name, isCustom) VALUES ('Loneliness', 0);
    INSERT OR IGNORE INTO cues (name, isCustom) VALUES ('Tired', 0);
    INSERT OR IGNORE INTO cues (name, isCustom) VALUES ('Celebration', 0);
    INSERT OR IGNORE INTO cues (name, isCustom) VALUES ('Habit / routine', 0);
    INSERT OR IGNORE INTO cues (name, isCustom) VALUES ('Craving', 0);
    INSERT OR IGNORE INTO cues (name, isCustom) VALUES ('Avoidance', 0);
  `);
}

export async function seedDefaultLocationsIfEmpty() {
  await db.execAsync(`
    INSERT OR IGNORE INTO locations (name, isCustom) VALUES ('Home', 0);
    INSERT OR IGNORE INTO locations (name, isCustom) VALUES ('Work', 0);
    INSERT OR IGNORE INTO locations (name, isCustom) VALUES ('School', 0);
    INSERT OR IGNORE INTO locations (name, isCustom) VALUES ('Car', 0);
    INSERT OR IGNORE INTO locations (name, isCustom) VALUES ('Bed', 0);
    INSERT OR IGNORE INTO locations (name, isCustom) VALUES ('Bathroom', 0);
    INSERT OR IGNORE INTO locations (name, isCustom) VALUES ('Gym', 0);
    INSERT OR IGNORE INTO locations (name, isCustom) VALUES ('Outside', 0);
    INSERT OR IGNORE INTO locations (name, isCustom) VALUES ('Friend''s house', 0);
    INSERT OR IGNORE INTO locations (name, isCustom) VALUES ('Restaurant', 0);
  `);
}

export async function seedDefaultActionsIfEmpty() {
  await db.execAsync(`
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Do 10 push-ups', 'Physical', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Go for a 5-min walk', 'Physical', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Stretch for 2 minutes', 'Physical', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Drink a glass of water', 'Physical', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Take 10 deep breaths', 'Physical', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Splash cold water on your face', 'Physical', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Brush your teeth', 'Physical', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Make tea', 'Physical', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Do jumping jacks', 'Physical', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Take a quick shower', 'Physical', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Eat a piece of fruit', 'Physical', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Step outside for fresh air', 'Physical', 0);

    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Meditate for 2 minutes', 'Mental', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Write down what you’re feeling', 'Mental', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Read one page of a book', 'Mental', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Do one tiny task', 'Mental', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Journal for 5 minutes', 'Mental', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Repeat a calming phrase', 'Mental', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('List 3 reasons not to give in', 'Mental', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Set a 10-min timer and wait', 'Mental', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Pray', 'Mental', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Write your future self a note', 'Mental', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Do a brain dump', 'Mental', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Read your goals out loud', 'Mental', 0);

    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Call a friend', 'Social', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Text someone', 'Social', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Reply to one message you’ve been avoiding', 'Social', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Ask someone to hang out', 'Social', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Step outside and say hi to someone', 'Social', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Text your accountability person', 'Social', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Join a group chat conversation', 'Social', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Sit near other people', 'Social', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Voice memo a friend', 'Social', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Give someone a compliment', 'Social', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Ask for support directly', 'Social', 0);

    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Listen to one song', 'Creative', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Make a quick playlist', 'Creative', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Write one paragraph', 'Creative', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Sketch for 2 minutes', 'Creative', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Take 3 photos of anything', 'Creative', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Brain-dump 10 ideas', 'Creative', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Doodle on paper', 'Creative', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Write a note to yourself', 'Creative', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Make a 3-item to-do list', 'Creative', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Organize your notes', 'Creative', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Learn one new chord', 'Creative', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Write one funny caption', 'Creative', 0);

    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Put your phone in another room for 10 minutes', 'Other', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Clean one small surface', 'Other', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Make your bed', 'Other', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Set a 5-min tidy timer', 'Other', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Change rooms', 'Other', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Leave the triggering environment', 'Other', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Delete the app for now', 'Other', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Turn on Do Not Disturb', 'Other', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Put on shoes and get out of the house', 'Other', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Start a 10-min focus timer', 'Other', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Do one small task you’ve been avoiding', 'Other', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Reset your space', 'Other', 0);
  `);
}

export async function dropAllDataTables() {
  await db.execAsync(`
    DROP TABLE IF EXISTS selected_actions;
    DROP TABLE IF EXISTS logs;
    DROP TABLE IF EXISTS user_locations;
    DROP TABLE IF EXISTS locations;
    DROP TABLE IF EXISTS user_cues;
    DROP TABLE IF EXISTS cues;
    DROP TABLE IF EXISTS user_habits;
    DROP TABLE IF EXISTS habits;
    DROP TABLE IF EXISTS actions;
  `);
}

export async function loadHabits(): Promise<Habit[]> {
  return db.getAllAsync<Habit>(
    "SELECT * FROM habits WHERE hidden = 0 ORDER BY isCustom ASC, id ASC;",
  );
}

export async function loadCues(): Promise<Cue[]> {
  return db.getAllAsync<Cue>(
    "SELECT * FROM cues WHERE hidden = 0 ORDER BY isCustom ASC, id ASC;",
  );
}

export async function loadLocations(): Promise<Place[]> {
  return db.getAllAsync<Place>(
    "SELECT * FROM locations WHERE hidden = 0 ORDER BY isCustom ASC, id ASC;",
  );
}

export async function loadSelectedHabits(): Promise<SelectedHabit[]> {
  return db.getAllAsync<SelectedHabit>(`
    SELECT h.*
    FROM user_habits uh
    JOIN habits h ON h.id = uh.habitId
    WHERE h.hidden = 0
    ORDER BY uh.rowid ASC;
  `);
}

export async function loadSelectedCues(): Promise<SelectedCue[]> {
  return db.getAllAsync<SelectedCue>(`
    SELECT c.*
    FROM user_cues uc
    JOIN cues c ON c.id = uc.cueId
    WHERE c.hidden = 0
    ORDER BY uc.rowid ASC;
  `);
}

export async function loadSelectedLocations(): Promise<SelectedPlace[]> {
  return db.getAllAsync<SelectedPlace>(`
    SELECT l.*
    FROM user_locations ul
    JOIN locations l ON l.id = ul.locationId
    WHERE l.hidden = 0
    ORDER BY ul.rowid ASC;
  `);
}

export async function loadLogs(): Promise<LogEntry[]> {
  return db.getAllAsync<LogEntry>(`
    SELECT
      l.id,
      l.habitId,
      COALESCE(l.habitName, h.name) AS habitName,
      l.cueId,
      COALESCE(l.cueName, c.name) AS cueName,
      l.locationId,
      COALESCE(l.locationName, loc.name) AS locationName,
      l.intensity,
      l.count,
      l.didResist,
      l.notes,
      l.createdAt,
      l.selectedActionId,
      COALESCE(l.selectedActionTitle, a.title) AS selectedActionTitle
    FROM logs l
    JOIN habits h ON h.id = l.habitId
    LEFT JOIN cues c ON c.id = l.cueId
    LEFT JOIN locations loc ON loc.id = l.locationId
    LEFT JOIN actions a ON a.id = l.selectedActionId
    ORDER BY l.createdAt DESC;
  `);
}

export async function loadActions(): Promise<ReplacementAction[]> {
  return db.getAllAsync<ReplacementAction>(
    "SELECT * FROM actions WHERE hidden = 0 ORDER BY isCustom ASC, id ASC;",
  );
}

export async function loadSelectedActionIds(): Promise<number[]> {
  const rows = await db.getAllAsync<{ actionId: number }>(`
    SELECT s.actionId
    FROM selected_actions s
    JOIN actions a ON a.id = s.actionId
    WHERE a.hidden = 0
    ORDER BY s.createdAt DESC;
  `);
  return rows.map((r) => r.actionId).filter((n) => Number.isFinite(n));
}

export async function replaceSelectedHabits(habitIds: number[]) {
  const uniqueIds = Array.from(new Set(habitIds)).filter((n) =>
    Number.isFinite(n),
  );

  await db.execAsync(`DELETE FROM user_habits;`);
  for (const id of uniqueIds) {
    await db.runAsync(
      `INSERT OR IGNORE INTO user_habits (habitId) VALUES (?);`,
      [id],
    );
  }
}

export async function replaceSelectedCues(cueIds: number[]) {
  const uniqueIds = Array.from(new Set(cueIds)).filter((n) =>
    Number.isFinite(n),
  );

  await db.execAsync(`DELETE FROM user_cues;`);
  for (const id of uniqueIds) {
    await db.runAsync(`INSERT OR IGNORE INTO user_cues (cueId) VALUES (?);`, [
      id,
    ]);
  }
}

export async function replaceSelectedLocations(locationIds: number[]) {
  const uniqueIds = Array.from(new Set(locationIds)).filter((n) =>
    Number.isFinite(n),
  );

  await db.execAsync(`DELETE FROM user_locations;`);
  for (const id of uniqueIds) {
    await db.runAsync(
      `INSERT OR IGNORE INTO user_locations (locationId) VALUES (?);`,
      [id],
    );
  }
}

export async function insertCustomHabit(name: string) {
  const result = await db.runAsync(
    `INSERT OR IGNORE INTO habits (name, isCustom, color) VALUES (?, 1, ?);`,
    [name, DEFAULT_HABIT_COLOR],
  );

  return Number(result.lastInsertRowId ?? 0);
}

export async function insertCustomCue(name: string) {
  const result = await db.runAsync(
    `INSERT OR IGNORE INTO cues (name, isCustom) VALUES (?, 1);`,
    [name],
  );

  return Number(result.lastInsertRowId ?? 0);
}

export async function insertCustomLocation(name: string) {
  const result = await db.runAsync(
    `INSERT OR IGNORE INTO locations (name, isCustom) VALUES (?, 1);`,
    [name],
  );

  return Number(result.lastInsertRowId ?? 0);
}

export async function insertLog(params: {
  habitId: number;
  cueId: number | null;
  locationId: number | null;
  intensity: number | null;
  count: number;
  didResist: 0 | 1;
  notes: string | null;
  selectedActionId: number | null;
  habitName: string;
  cueName: string | null;
  locationName: string | null;
  selectedActionTitle: string | null;
}) {
  const result = await db.runAsync(
    `
    INSERT INTO logs (
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
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      params.habitId,
      params.cueId,
      params.locationId,
      params.intensity,
      params.count,
      params.didResist,
      params.notes,
      Date.now(),
      params.selectedActionId,
      params.habitName,
      params.cueName,
      params.locationName,
      params.selectedActionTitle,
    ],
  );

  return Number(result.lastInsertRowId ?? 0);
}

export async function updateLogInDb(params: {
  logId: number;
  habitId: number;
  cueId: number | null;
  locationId: number | null;
  intensity: number | null;
  count: number;
  didResist: 0 | 1;
  notes: string | null;
  createdAt: number;
  selectedActionId: number | null;
  habitName: string;
  cueName: string | null;
  locationName: string | null;
  selectedActionTitle: string | null;
}) {
  await db.runAsync(
    `
    UPDATE logs
    SET
      habitId = ?,
      cueId = ?,
      locationId = ?,
      intensity = ?,
      count = ?,
      didResist = ?,
      notes = ?,
      createdAt = ?,
      selectedActionId = ?,
      habitName = ?,
      cueName = ?,
      locationName = ?,
      selectedActionTitle = ?
    WHERE id = ?;
    `,
    [
      params.habitId,
      params.cueId,
      params.locationId,
      params.intensity,
      params.count,
      params.didResist,
      params.notes,
      params.createdAt,
      params.selectedActionId,
      params.habitName,
      params.cueName,
      params.locationName,
      params.selectedActionTitle,
      params.logId,
    ],
  );
}

export async function deleteLogInDb(logId: number) {
  await db.runAsync(`DELETE FROM logs WHERE id = ?;`, [logId]);
}

export async function updateLogSelectedActionInDb(
  logId: number,
  selectedActionId: number | null,
  selectedActionTitle: string | null,
) {
  await db.runAsync(
    `UPDATE logs SET selectedActionId = ?, selectedActionTitle = ? WHERE id = ?;`,
    [selectedActionId, selectedActionTitle, logId],
  );
}

export async function insertAction(params: {
  title: string;
  category: string | null;
  isCustom: 0 | 1;
}) {
  await db.runAsync(
    `INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES (?, ?, ?);`,
    [params.title, params.category, params.isCustom],
  );
}

export async function getHabitById(id: number) {
  return db.getFirstAsync<Habit>(`SELECT * FROM habits WHERE id = ?;`, [id]);
}

export async function getCueById(id: number) {
  return db.getFirstAsync<Cue>(`SELECT * FROM cues WHERE id = ?;`, [id]);
}

export async function getLocationById(id: number) {
  return db.getFirstAsync<Place>(`SELECT * FROM locations WHERE id = ?;`, [id]);
}

export async function getActionById(id: number) {
  return db.getFirstAsync<ReplacementAction>(
    `SELECT * FROM actions WHERE id = ?;`,
    [id],
  );
}

export async function renameCustomHabitInDb(id: number, name: string) {
  await db.runAsync(
    `UPDATE habits SET name = ? WHERE id = ? AND isCustom = 1 AND hidden = 0;`,
    [name, id],
  );
}

export async function updateHabitInDb(id: number, name: string, color: string) {
  await db.runAsync(
    `UPDATE habits
     SET name = CASE WHEN isCustom = 1 THEN ? ELSE name END,
         color = ?
     WHERE id = ? AND hidden = 0;`,
    [name, color, id],
  );
}

export async function renameCustomCueInDb(id: number, name: string) {
  await db.runAsync(
    `UPDATE cues SET name = ? WHERE id = ? AND isCustom = 1 AND hidden = 0;`,
    [name, id],
  );
}

export async function renameCustomLocationInDb(id: number, name: string) {
  await db.runAsync(
    `UPDATE locations SET name = ? WHERE id = ? AND isCustom = 1 AND hidden = 0;`,
    [name, id],
  );
}

export async function renameCustomActionInDb(
  id: number,
  title: string,
  category: string | null,
) {
  await db.runAsync(
    `UPDATE actions SET title = ?, category = ? WHERE id = ? AND isCustom = 1 AND hidden = 0;`,
    [title, category, id],
  );
}

async function countLogsForColumn(column: string, id: number) {
  const rows = await db.getAllAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM logs WHERE ${column} = ?;`,
    [id],
  );
  return rows?.[0]?.c ?? 0;
}

export async function deleteOrHideCustomHabitInDb(
  id: number,
): Promise<"deleted" | "hidden"> {
  const usedCount = await countLogsForColumn("habitId", id);
  await db.runAsync(`DELETE FROM user_habits WHERE habitId = ?;`, [id]);
  if (usedCount > 0) {
    await db.runAsync(
      `UPDATE habits SET name = name || ' (hidden ' || id || ')', hidden = 1 WHERE id = ? AND isCustom = 1;`,
      [id],
    );
    return "hidden";
  }
  await db.runAsync(`DELETE FROM habits WHERE id = ? AND isCustom = 1;`, [id]);
  return "deleted";
}

export async function deleteOrHideCustomCueInDb(
  id: number,
): Promise<"deleted" | "hidden"> {
  const usedCount = await countLogsForColumn("cueId", id);
  await db.runAsync(`DELETE FROM user_cues WHERE cueId = ?;`, [id]);
  if (usedCount > 0) {
    await db.runAsync(
      `UPDATE cues SET name = name || ' (hidden ' || id || ')', hidden = 1 WHERE id = ? AND isCustom = 1;`,
      [id],
    );
    return "hidden";
  }
  await db.runAsync(`DELETE FROM cues WHERE id = ? AND isCustom = 1;`, [id]);
  return "deleted";
}

export async function deleteOrHideCustomLocationInDb(
  id: number,
): Promise<"deleted" | "hidden"> {
  const usedCount = await countLogsForColumn("locationId", id);
  await db.runAsync(`DELETE FROM user_locations WHERE locationId = ?;`, [id]);
  if (usedCount > 0) {
    await db.runAsync(
      `UPDATE locations SET name = name || ' (hidden ' || id || ')', hidden = 1 WHERE id = ? AND isCustom = 1;`,
      [id],
    );
    return "hidden";
  }
  await db.runAsync(`DELETE FROM locations WHERE id = ? AND isCustom = 1;`, [
    id,
  ]);
  return "deleted";
}

export async function deleteOrHideCustomActionInDb(
  id: number,
): Promise<"deleted" | "hidden"> {
  const usedCount = await countLogsForColumn("selectedActionId", id);
  await db.runAsync(`DELETE FROM selected_actions WHERE actionId = ?;`, [id]);
  if (usedCount > 0) {
    await db.runAsync(
      `UPDATE actions SET title = title || ' (hidden ' || id || ')', hidden = 1 WHERE id = ? AND isCustom = 1;`,
      [id],
    );
    return "hidden";
  }
  await db.runAsync(`DELETE FROM actions WHERE id = ? AND isCustom = 1;`, [id]);
  return "deleted";
}

export async function selectedActionExists(actionId: number) {
  const exists = await db.getAllAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM selected_actions WHERE actionId = ?;`,
    [actionId],
  );
  return (exists?.[0]?.c ?? 0) > 0;
}

export async function removeSelectedAction(actionId: number) {
  await db.runAsync(`DELETE FROM selected_actions WHERE actionId = ?;`, [
    actionId,
  ]);
}

export async function addSelectedAction(actionId: number) {
  await db.runAsync(
    `INSERT OR IGNORE INTO selected_actions (actionId, createdAt) VALUES (?, ?);`,
    [actionId, Date.now()],
  );
}

export async function clearAllSelectedActions() {
  await db.execAsync(`DELETE FROM selected_actions;`);
}
