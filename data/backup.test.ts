import { describe, expect, test } from "@jest/globals";
import {
  sanitizeActions,
  sanitizeLogs,
  sanitizeNamedEntities,
  sanitizeSelectedIds,
  validateBackupPayload,
} from "./backup";

describe("backup validation", () => {
  test("accepts a Reflex backup with valid collection fields", () => {
    const backup = {
      app: "Reflex",
      habits: [],
      cues: [],
      locations: [],
      actions: [],
      logs: [],
    };

    expect(validateBackupPayload(backup)).toBe(backup);
  });

  test.each([
    null,
    [],
    {},
    { app: "Another app" },
    { app: "Reflex", habits: ["not an object"] },
  ])("rejects malformed backup data: %p", (backup) => {
    expect(() => validateBackupPayload(backup)).toThrow();
  });
});

describe("backup sanitizing", () => {
  test("keeps valid named items and normalizes unsafe values", () => {
    expect(
      sanitizeNamedEntities([
        {
          id: 4.4,
          name: "  Social Media  ",
          isCustom: true,
          hidden: false,
          color: "#aabbcc",
        },
        { id: 0, name: "Invalid" },
        { id: 5, name: "   " },
      ]),
    ).toEqual([
      {
        id: 4,
        name: "Social Media",
        isCustom: 1,
        hidden: 0,
        color: "#AABBCC",
      },
    ]);
  });

  test("uses a safe default when an imported color is invalid", () => {
    const [habit] = sanitizeNamedEntities([
      { id: 1, name: "Habit", color: "red" },
    ]);

    expect(habit.color).toBe("#16A34A");
  });

  test("removes invalid actions and trims valid action text", () => {
    expect(
      sanitizeActions([
        { id: 2, title: "  Take a walk ", category: " Physical " },
        { id: -1, title: "Invalid" },
      ]),
    ).toEqual([
      {
        id: 2,
        title: "Take a walk",
        category: "Physical",
        isCustom: 0,
        hidden: 0,
      },
    ]);
  });

  test("deduplicates selected IDs and removes invalid IDs", () => {
    expect(
      sanitizeSelectedIds(
        [{ id: 2 }, { id: 2 }, { id: -1 }, 3, "invalid"],
        "id",
      ),
    ).toEqual([2, 3]);
  });

  test("clamps imported log values to supported ranges", () => {
    const [log] = sanitizeLogs([
      {
        id: 1,
        habitId: 2,
        createdAt: 1000,
        intensity: 99,
        count: -4,
        didResist: true,
        notes: "  note  ",
      },
    ]);

    expect(log).toMatchObject({
      id: 1,
      habitId: 2,
      intensity: 10,
      count: 0,
      didResist: 1,
      notes: "note",
      createdAt: 1000,
    });
  });

  test("drops logs without a usable identity, habit, or date", () => {
    expect(
      sanitizeLogs([
        { id: 0, habitId: 1, createdAt: 1000 },
        { id: 1, habitId: 0, createdAt: 1000 },
        { id: 1, habitId: 1, createdAt: 0 },
      ]),
    ).toEqual([]);
  });
});
