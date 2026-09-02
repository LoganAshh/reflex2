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
  HabitPlanInput,
  HabitPeriod,
  GoalHistoryEntry,
  GoalChangeReason,
  TrackingConfirmation,
  TrackingPeriod,
  TrackingStatus,
  CycleHistoryEntry,
} from "./types";
import {
  DEFAULT_HABIT_ICON,
  PRESET_HABIT_ICONS,
  cleanHabitIcon,
} from "./habitIcons";

export const db = SQLite.openDatabaseSync("reflex.db");

const DEFAULT_HABIT_COLOR = "#16A34A";

const PRESET_ACTION_TITLE_UPDATES: ReadonlyArray<
  readonly [oldTitle: string, newTitle: string]
> = [
  ["Splash cold water on your face", "Splash your face with water"],
  ["Write down what you’re feeling", "Write down how you feel"],
  ["List 3 reasons to stay on track", "List 3 reasons to continue"],
  ["Write your future self a note", "Write a note to future you"],
  ["Reply to one message you’ve been avoiding", "Reply to an avoided message"],
  ["Step outside and say hi to someone", "Say hi to someone outside"],
  ["Text your accountability person", "Text your support person"],
  ["Join a group chat conversation", "Join a group chat"],
  ["Put your phone in another room for 10 minutes", "Put phone away for 10 min"],
  ["Leave the triggering environment", "Leave the situation"],
  ["Put on shoes and get out of the house", "Put on shoes and go outside"],
  ["Do one small task you’ve been avoiding", "Do one avoided task"],
];

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

const CREATE_DATA_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    isCustom INTEGER NOT NULL DEFAULT 0,
    hidden INTEGER NOT NULL DEFAULT 0,
    color TEXT NOT NULL DEFAULT '#16A34A',
    icon TEXT NOT NULL DEFAULT 'ellipse',
    measurementType TEXT NOT NULL DEFAULT 'times',
    unit TEXT NOT NULL DEFAULT 'times',
    estimatedBaseline REAL,
    calibratedBaseline REAL,
    calibrationStartedAt INTEGER,
    calibratedAt INTEGER,
    rebaselineStartedAt INTEGER,
    baselinePeriod TEXT NOT NULL DEFAULT 'day',
    finalTarget REAL,
    goalPeriod TEXT NOT NULL DEFAULT 'day',
    currentGoal REAL,
    currentGoalPeriod TEXT NOT NULL DEFAULT 'day',
    pendingGoal REAL,
    pendingGoalPeriod TEXT NOT NULL DEFAULT 'day',
    pendingGoalReason TEXT
  );

  CREATE TABLE IF NOT EXISTS user_habits (
    habitId INTEGER NOT NULL UNIQUE,
    FOREIGN KEY (habitId) REFERENCES habits(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS goal_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habitId INTEGER NOT NULL,
    amount REAL NOT NULL,
    period TEXT NOT NULL,
    reason TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    FOREIGN KEY (habitId) REFERENCES habits(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tracking_confirmations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habitId INTEGER NOT NULL,
    period TEXT NOT NULL,
    periodStart INTEGER NOT NULL,
    status TEXT NOT NULL,
    updatedAt INTEGER NOT NULL,
    UNIQUE(habitId, period, periodStart),
    FOREIGN KEY (habitId) REFERENCES habits(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS cycle_history (
    id TEXT PRIMARY KEY,
    habitId INTEGER NOT NULL,
    period TEXT NOT NULL,
    startAt INTEGER NOT NULL,
    endAtExclusive INTEGER NOT NULL,
    confirmedCount INTEGER NOT NULL,
    requiredConfirmations INTEGER NOT NULL,
    actualQuantity REAL NOT NULL,
    baseline REAL,
    baselineSource TEXT NOT NULL,
    currentGoal REAL,
    reductionFromBaseline REAL,
    stepProgressPercent REAL,
    resistedUrges INTEGER NOT NULL,
    activityLogs INTEGER NOT NULL,
    result TEXT NOT NULL,
    recommendedGoal REAL,
    goalAlreadyAdvanced INTEGER NOT NULL DEFAULT 0,
    UNIQUE(habitId, period, startAt),
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
    cueIdsJson TEXT,
    cueNamesJson TEXT,
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
`;

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
  const habitColumnsBeforeIcon = await tableColumns("habits");
  const hadHabitIcon = habitColumnsBeforeIcon.some(
    (column) => column.name === "icon",
  );
  await ensureColumn(
    "habits",
    "icon",
    `icon TEXT NOT NULL DEFAULT '${DEFAULT_HABIT_ICON}'`,
  );
  await ensureColumn(
    "habits",
    "measurementType",
    "measurementType TEXT NOT NULL DEFAULT 'times'",
  );
  await ensureColumn("habits", "unit", "unit TEXT NOT NULL DEFAULT 'times'");
  await ensureColumn("habits", "estimatedBaseline", "estimatedBaseline REAL");
  await ensureColumn("habits", "calibratedBaseline", "calibratedBaseline REAL");
  await ensureColumn(
    "habits",
    "calibrationStartedAt",
    "calibrationStartedAt INTEGER",
  );
  await ensureColumn("habits", "calibratedAt", "calibratedAt INTEGER");
  await ensureColumn(
    "habits",
    "rebaselineStartedAt",
    "rebaselineStartedAt INTEGER",
  );
  await ensureColumn(
    "habits",
    "baselinePeriod",
    "baselinePeriod TEXT NOT NULL DEFAULT 'day'",
  );
  await ensureColumn("habits", "finalTarget", "finalTarget REAL");
  const habitColumnsBeforeGoalPeriod = await tableColumns("habits");
  const hadGoalPeriod = habitColumnsBeforeGoalPeriod.some(
    (column) => column.name === "goalPeriod",
  );
  await ensureColumn(
    "habits",
    "goalPeriod",
    "goalPeriod TEXT NOT NULL DEFAULT 'day'",
  );
  if (!hadGoalPeriod) {
    await db.execAsync(`UPDATE habits SET goalPeriod = baselinePeriod;`);
  }
  const habitColumnsBeforeCurrentGoalPeriod = await tableColumns("habits");
  const hadCurrentGoalPeriod = habitColumnsBeforeCurrentGoalPeriod.some(
    (column) => column.name === "currentGoalPeriod",
  );
  await ensureColumn("habits", "currentGoal", "currentGoal REAL");
  await ensureColumn(
    "habits",
    "currentGoalPeriod",
    "currentGoalPeriod TEXT NOT NULL DEFAULT 'day'",
  );
  if (!hadCurrentGoalPeriod) {
    await db.execAsync(`UPDATE habits SET currentGoalPeriod = goalPeriod;`);
  }
  await ensureColumn("habits", "pendingGoal", "pendingGoal REAL");
  await ensureColumn(
    "habits",
    "pendingGoalPeriod",
    "pendingGoalPeriod TEXT NOT NULL DEFAULT 'day'",
  );
  await ensureColumn("habits", "pendingGoalReason", "pendingGoalReason TEXT");
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
  await ensureColumn("logs", "cueIdsJson", "cueIdsJson TEXT");
  await ensureColumn("logs", "cueNamesJson", "cueNamesJson TEXT");
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

    UPDATE actions
    SET title = 'List 3 reasons to stay on track'
    WHERE title = 'List 3 reasons not to give in'
      AND isCustom = 0
      AND NOT EXISTS (
        SELECT 1 FROM actions AS existing
        WHERE existing.title = 'List 3 reasons to stay on track'
      );

    UPDATE logs
    SET selectedActionTitle = 'List 3 reasons to stay on track'
    WHERE selectedActionTitle = 'List 3 reasons not to give in';
  `);

  for (const [oldTitle, newTitle] of PRESET_ACTION_TITLE_UPDATES) {
    await db.runAsync(
      `UPDATE actions
       SET title = ?
       WHERE title = ?
         AND isCustom = 0
         AND NOT EXISTS (
           SELECT 1 FROM actions AS existing WHERE existing.title = ?
         );`,
      [newTitle, oldTitle, newTitle],
    );
  }

  for (const [name, color] of Object.entries(PRESET_HABIT_COLORS)) {
    await db.runAsync(
      `UPDATE habits SET color = ? WHERE name = ? AND isCustom = 0 AND (color IS NULL OR color = ?);`,
      [color, name, DEFAULT_HABIT_COLOR],
    );
  }
  if (!hadHabitIcon) {
    for (const [name, icon] of Object.entries(PRESET_HABIT_ICONS)) {
      await db.runAsync(
        `UPDATE habits SET icon = ? WHERE name = ? AND isCustom = 0;`,
        [icon, name],
      );
    }
  }
}

export async function initDb() {
  await db.execAsync(`PRAGMA journal_mode = WAL;`);
  await db.execAsync(`PRAGMA foreign_keys = ON;`);
  await db.execAsync(CREATE_DATA_TABLES_SQL);

  await ensureLocalSchemaColumns();
}

export async function seedDefaultHabitsIfEmpty() {
  await db.execAsync(`
    INSERT OR IGNORE INTO habits (name, isCustom, color, icon) VALUES ('Social Media', 0, '#2563EB', 'phone-portrait');
    INSERT OR IGNORE INTO habits (name, isCustom, color, icon) VALUES ('Junk Food', 0, '#F97316', 'fast-food');
    INSERT OR IGNORE INTO habits (name, isCustom, color, icon) VALUES ('Caffeine', 0, '#92400E', 'cafe');
    INSERT OR IGNORE INTO habits (name, isCustom, color, icon) VALUES ('Shopping', 0, '#DB2777', 'cart');
    INSERT OR IGNORE INTO habits (name, isCustom, color, icon) VALUES ('Video Games', 0, '#7C3AED', 'game-controller');
    INSERT OR IGNORE INTO habits (name, isCustom, color, icon) VALUES ('Alcohol', 0, '#7F1D1D', 'wine');
    INSERT OR IGNORE INTO habits (name, isCustom, color, icon) VALUES ('Nicotine', 0, '#64748B', 'flame');
    INSERT OR IGNORE INTO habits (name, isCustom, color, icon) VALUES ('Streaming', 0, '#DC2626', 'tv');
    INSERT OR IGNORE INTO habits (name, isCustom, color, icon) VALUES ('Porn', 0, '#BE123C', 'eye-off');
    INSERT OR IGNORE INTO habits (name, isCustom, color, icon) VALUES ('Weed', 0, '#16A34A', 'leaf');
    INSERT OR IGNORE INTO habits (name, isCustom, color, icon) VALUES ('Gambling', 0, '#EAB308', 'dice');
    INSERT OR IGNORE INTO habits (name, isCustom, color, icon) VALUES ('Prescriptions', 0, '#0EA5E9', 'medical');

    UPDATE habits
    SET measurementType = 'minutes', unit = 'minutes'
    WHERE isCustom = 0
      AND name IN ('Social Media', 'Video Games', 'Streaming')
      AND estimatedBaseline IS NULL
      AND measurementType = 'times'
      AND unit = 'times';
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
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Splash your face with water', 'Physical', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Brush your teeth', 'Physical', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Make tea', 'Physical', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Do jumping jacks', 'Physical', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Take a quick shower', 'Physical', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Eat a piece of fruit', 'Physical', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Step outside for fresh air', 'Physical', 0);

    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Meditate for 2 minutes', 'Mental', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Write down how you feel', 'Mental', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Read one page of a book', 'Mental', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Do one tiny task', 'Mental', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Journal for 5 minutes', 'Mental', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Repeat a calming phrase', 'Mental', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('List 3 reasons to continue', 'Mental', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Set a 10-min timer and wait', 'Mental', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Pray', 'Mental', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Write a note to future you', 'Mental', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Do a brain dump', 'Mental', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Read your goals out loud', 'Mental', 0);

    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Call a friend', 'Social', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Text someone', 'Social', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Reply to an avoided message', 'Social', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Ask someone to hang out', 'Social', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Say hi to someone outside', 'Social', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Text your support person', 'Social', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Join a group chat', 'Social', 0);
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

    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Put phone away for 10 min', 'Other', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Clean one small surface', 'Other', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Make your bed', 'Other', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Set a 5-min tidy timer', 'Other', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Change rooms', 'Other', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Leave the situation', 'Other', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Delete the app for now', 'Other', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Turn on Do Not Disturb', 'Other', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Put on shoes and go outside', 'Other', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Start a 10-min focus timer', 'Other', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Do one avoided task', 'Other', 0);
    INSERT OR IGNORE INTO actions (title, category, isCustom) VALUES ('Reset your space', 'Other', 0);
  `);
}

export async function dropAllDataTables() {
  await db.execAsync(`
    DROP TABLE IF EXISTS selected_actions;
    DROP TABLE IF EXISTS cycle_history;
    DROP TABLE IF EXISTS tracking_confirmations;
    DROP TABLE IF EXISTS goal_history;
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

export async function recreateDataTables() {
  await dropAllDataTables();
  await db.execAsync(CREATE_DATA_TABLES_SQL);
}

export async function loadHabits(): Promise<Habit[]> {
  return db.getAllAsync<Habit>(
    "SELECT * FROM habits WHERE hidden = 0 ORDER BY isCustom ASC, id ASC;",
  );
}

export async function loadGoalHistory(): Promise<GoalHistoryEntry[]> {
  return db.getAllAsync<GoalHistoryEntry>(
    "SELECT * FROM goal_history ORDER BY createdAt DESC, id DESC;",
  );
}

export async function loadTrackingConfirmations(): Promise<
  TrackingConfirmation[]
> {
  return db.getAllAsync<TrackingConfirmation>(
    `SELECT * FROM tracking_confirmations ORDER BY periodStart DESC, id DESC;`,
  );
}

export async function loadCycleHistory(): Promise<CycleHistoryEntry[]> {
  const rows = await db.getAllAsync<
    Omit<CycleHistoryEntry, "goalAlreadyAdvanced"> & {
      goalAlreadyAdvanced: number;
    }
  >(`SELECT * FROM cycle_history ORDER BY startAt ASC, habitId ASC;`);
  return rows.map((row) => ({
    ...row,
    eligible: true,
    complete: true,
    goalAlreadyAdvanced: row.goalAlreadyAdvanced === 1,
  }));
}

export async function replaceCycleHistory(
  entries: CycleHistoryEntry[],
  activePeriods: Array<{ habitId: number; period: HabitPeriod }>,
) {
  await db.withTransactionAsync(async () => {
    for (const scope of activePeriods) {
      await db.runAsync(
        "DELETE FROM cycle_history WHERE habitId = ? AND period = ?;",
        [scope.habitId, scope.period],
      );
    }
    for (const entry of entries) {
      await db.runAsync(
        `INSERT INTO cycle_history (
          id, habitId, period, startAt, endAtExclusive, confirmedCount,
          requiredConfirmations, actualQuantity, baseline, baselineSource,
          currentGoal, reductionFromBaseline, stepProgressPercent,
          resistedUrges, activityLogs, result, recommendedGoal,
          goalAlreadyAdvanced
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          entry.id,
          entry.habitId,
          entry.period,
          entry.startAt,
          entry.endAtExclusive,
          entry.confirmedCount,
          entry.requiredConfirmations,
          entry.actualQuantity,
          entry.baseline,
          entry.baselineSource,
          entry.currentGoal,
          entry.reductionFromBaseline,
          entry.stepProgressPercent,
          entry.resistedUrges,
          entry.activityLogs,
          entry.result,
          entry.recommendedGoal,
          entry.goalAlreadyAdvanced ? 1 : 0,
        ],
      );
    }
  });
}

export async function upsertTrackingConfirmation(params: {
  habitId: number;
  period: TrackingPeriod;
  periodStart: number;
  status: TrackingStatus;
}) {
  await db.runAsync(
    `INSERT INTO tracking_confirmations (
      habitId, period, periodStart, status, updatedAt
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(habitId, period, periodStart)
    DO UPDATE SET status = excluded.status, updatedAt = excluded.updatedAt;`,
    [
      params.habitId,
      params.period,
      params.periodStart,
      params.status,
      Date.now(),
    ],
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
  const rows = await db.getAllAsync<
    Omit<LogEntry, "cueIds" | "cueNames"> & {
      cueIdsJson: string | null;
      cueNamesJson: string | null;
    }
  >(`
    SELECT
      l.id,
      l.habitId,
      COALESCE(l.habitName, h.name) AS habitName,
      l.cueId,
      COALESCE(l.cueName, c.name) AS cueName,
      l.cueIdsJson,
      l.cueNamesJson,
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

  return rows.map(({ cueIdsJson, cueNamesJson, ...row }) => {
    let cueIds: number[] = [];
    let cueNames: string[] = [];

    try {
      const parsed = JSON.parse(cueIdsJson ?? "[]");
      if (Array.isArray(parsed)) {
        cueIds = parsed.filter(
          (value): value is number => Number.isFinite(value) && value > 0,
        );
      }
    } catch {}

    try {
      const parsed = JSON.parse(cueNamesJson ?? "[]");
      if (Array.isArray(parsed)) {
        cueNames = parsed.filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0,
        );
      }
    } catch {}

    if (cueIds.length === 0 && row.cueId != null) cueIds = [row.cueId];
    if (cueNames.length === 0 && row.cueName) cueNames = [row.cueName];

    return { ...row, cueIds, cueNames };
  });
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

export async function insertCustomHabit(
  name: string,
  icon: string = DEFAULT_HABIT_ICON,
  color = DEFAULT_HABIT_COLOR,
) {
  const result = await db.runAsync(
    `INSERT OR IGNORE INTO habits (name, isCustom, color, icon) VALUES (?, 1, ?, ?);`,
    [name, color, cleanHabitIcon(icon)],
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
  createdAt: number;
  cueId: number | null;
  cueIds: number[];
  locationId: number | null;
  intensity: number | null;
  count: number;
  didResist: 0 | 1;
  notes: string | null;
  selectedActionId: number | null;
  habitName: string;
  cueName: string | null;
  cueNames: string[];
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
      cueIdsJson,
      cueNamesJson,
      locationName,
      selectedActionTitle
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
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
      JSON.stringify(params.cueIds),
      JSON.stringify(params.cueNames),
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
  cueIds: number[];
  locationId: number | null;
  intensity: number | null;
  count: number;
  didResist: 0 | 1;
  notes: string | null;
  createdAt: number;
  selectedActionId: number | null;
  habitName: string;
  cueName: string | null;
  cueNames: string[];
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
      cueIdsJson = ?,
      cueNamesJson = ?,
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
      JSON.stringify(params.cueIds),
      JSON.stringify(params.cueNames),
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

export async function updateHabitInDb(
  id: number,
  name: string,
  color: string,
  icon: string,
) {
  await db.runAsync(
    `UPDATE habits
     SET name = CASE WHEN isCustom = 1 THEN ? ELSE name END,
         color = ?,
         icon = ?
     WHERE id = ? AND hidden = 0;`,
    [name, color, cleanHabitIcon(icon), id],
  );
}

export async function updateHabitPlanInDb(id: number, input: HabitPlanInput) {
  const newPeriodDays =
    input.baselinePeriod === "week"
      ? 7
      : input.baselinePeriod === "28_days"
        ? 28
        : 1;
  await db.runAsync(
    `UPDATE habits
     SET measurementType = ?, unit = ?, estimatedBaseline = ?,
         calibratedBaseline = CASE
           WHEN calibratedBaseline IS NULL THEN NULL
           ELSE calibratedBaseline /
             CASE baselinePeriod WHEN 'week' THEN 7 WHEN '28_days' THEN 28 ELSE 1 END * ?
         END,
         baselinePeriod = ?, finalTarget = ?, goalPeriod = ?
     WHERE id = ? AND hidden = 0;`,
    [
      input.measurementType,
      input.unit,
      input.estimatedBaseline,
      newPeriodDays,
      input.baselinePeriod,
      input.finalTarget,
      input.goalPeriod,
      id,
    ],
  );
}

export async function setCurrentGoalInDb(
  habitId: number,
  amount: number,
  period: HabitPlanInput["goalPeriod"],
  reason: GoalChangeReason,
) {
  const createdAt = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE habits
       SET currentGoal = ?, currentGoalPeriod = ?, pendingGoal = NULL,
           pendingGoalReason = NULL
       WHERE id = ? AND hidden = 0;`,
      [amount, period, habitId],
    );
    await db.runAsync(
      `INSERT INTO goal_history (habitId, amount, period, reason, createdAt)
       VALUES (?, ?, ?, ?, ?);`,
      [habitId, amount, period, reason, createdAt],
    );
  });
}

export async function setPendingGoalInDb(
  habitId: number,
  amount: number,
  period: HabitPlanInput["goalPeriod"],
  reason: string,
) {
  await db.runAsync(
    `UPDATE habits
     SET pendingGoal = ?, pendingGoalPeriod = ?, pendingGoalReason = ?
     WHERE id = ? AND hidden = 0;`,
    [amount, period, reason, habitId],
  );
}

export async function clearPendingGoalInDb(habitId: number) {
  await db.runAsync(
    `UPDATE habits
     SET pendingGoal = NULL, pendingGoalReason = NULL
     WHERE id = ?;`,
    [habitId],
  );
}

export async function setCalibrationStartedAtInDb(
  id: number,
  startedAt: number,
) {
  await db.runAsync(
    `UPDATE habits
     SET calibrationStartedAt = ?
     WHERE id = ? AND calibratedBaseline IS NULL AND calibrationStartedAt IS NULL;`,
    [startedAt, id],
  );
}

export async function saveCalibratedBaselineInDb(
  id: number,
  value: number,
  startedAt: number,
  calibratedAt: number,
) {
  await db.runAsync(
    `UPDATE habits
     SET calibratedBaseline = ?, calibrationStartedAt = ?, calibratedAt = ?,
         rebaselineStartedAt = NULL
     WHERE id = ? AND (calibratedBaseline IS NULL OR rebaselineStartedAt IS NOT NULL);`,
    [value, startedAt, calibratedAt, id],
  );
}

export async function resetHabitBaselineInDb(id: number, startedAt: number) {
  await db.runAsync(
    `UPDATE habits
     SET rebaselineStartedAt = ?
     WHERE id = ? AND hidden = 0;`,
    [startedAt, id],
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
