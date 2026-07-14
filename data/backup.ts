export type BackupNamedEntity = {
  id: number;
  name: string;
  isCustom: 0 | 1;
  hidden: 0 | 1;
  color: string;
};

export type BackupActionEntity = {
  id: number;
  title: string;
  category: string | null;
  isCustom: 0 | 1;
  hidden: 0 | 1;
};

export type BackupLog = {
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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanNullableString(value: unknown): string | null {
  const clean = cleanString(value);
  return clean.length > 0 ? clean : null;
}

export function cleanColor(value: unknown): string {
  const clean = cleanString(value);
  return /^#[0-9A-Fa-f]{6}$/.test(clean) ? clean.toUpperCase() : "#16A34A";
}

export function cleanInt(value: unknown, fallback = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n);
}

function cleanOptionalInt(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

export function cleanBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === 1;
}

function cleanIsCustom(value: unknown): 0 | 1 {
  return cleanBoolean(value) ? 1 : 0;
}

export function validateBackupPayload(value: unknown): Record<string, unknown> {
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

export function sanitizeNamedEntities(items: unknown[]): BackupNamedEntity[] {
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

export function sanitizeActions(items: unknown[]): BackupActionEntity[] {
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

export function sanitizeSelectedIds(items: unknown[], key: string): number[] {
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

export function sanitizeLogs(items: unknown[]): BackupLog[] {
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
