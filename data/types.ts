import type React from "react";

export type Habit = {
  id: number;
  name: string;
  isCustom: 0 | 1;
  hidden: 0 | 1;
};
export type Cue = { id: number; name: string; isCustom: 0 | 1; hidden: 0 | 1 };
export type Place = {
  id: number;
  name: string;
  isCustom: 0 | 1;
  hidden: 0 | 1;
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
  intensity: number | null;
  count: number;
  didResist: 0 | 1;
  notes: string | null;
  createdAt: number;
  selectedActionId: number | null;
  selectedActionTitle: string | null;
};

export type ReplacementAction = {
  id: number;
  title: string;
  category: string | null;
  isCustom: 0 | 1;
  hidden: 0 | 1;
};

export type AddLogInput = {
  habitId: number;
  cueId?: number | null;
  locationId?: number | null;
  intensity?: number | null;
  count?: number;
  didResist?: boolean;
  notes?: string;
  selectedActionId?: number | null;
};

export type UpdateLogInput = {
  habitId: number;
  cueId?: number | null;
  locationId?: number | null;
  intensity?: number | null;
  count?: number;
  didResist?: boolean;
  notes?: string;
  selectedActionId?: number | null;
  createdAt: number;
};

export type AddActionInput = {
  title: string;
  category?: string;
  isCustom?: boolean;
};

export type DailyReminderOption = "off" | "morning" | "evening" | "custom";

export type DailyReminderSettings = {
  option: DailyReminderOption;
  hour: number;
  minute: number;
};

export type DataContextType = {
  initializing: boolean;

  profileName: string;
  profilePhotoUri: string | null;
  hasCompletedLocalProfile: boolean;
  completeLocalProfile: (
    name: string,
    photoUri: string | null,
  ) => Promise<void>;
  clearLocalProfile: () => Promise<void>;

  appLockEnabled: boolean;
  setAppLockEnabled: (value: boolean) => Promise<void>;

  dailyReminder: DailyReminderSettings;
  setDailyReminder: (settings: DailyReminderSettings) => Promise<void>;

  habits: Habit[];
  cues: Cue[];
  locations: Place[];

  selectedHabits: SelectedHabit[];
  selectedCues: SelectedCue[];
  selectedLocations: SelectedPlace[];

  hasOnboarded: boolean;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;

  setSelectedHabits: (habitIds: number[]) => Promise<void>;
  setSelectedCues: (cueIds: number[]) => Promise<void>;
  setSelectedLocations: (locationIds: number[]) => Promise<void>;

  addCustomHabit: (name: string, autoSelect?: boolean) => Promise<void>;
  addCustomCue: (name: string, autoSelect?: boolean) => Promise<void>;
  addCustomLocation: (name: string, autoSelect?: boolean) => Promise<void>;

  renameCustomHabit: (habitId: number, name: string) => Promise<void>;
  renameCustomCue: (cueId: number, name: string) => Promise<void>;
  renameCustomLocation: (locationId: number, name: string) => Promise<void>;
  deleteCustomHabit: (habitId: number) => Promise<"deleted" | "hidden">;
  deleteCustomCue: (cueId: number) => Promise<"deleted" | "hidden">;
  deleteCustomLocation: (locationId: number) => Promise<"deleted" | "hidden">;

  logs: LogEntry[];
  addLog: (input: AddLogInput) => Promise<number | null>;
  updateLog: (logId: number, input: UpdateLogInput) => Promise<void>;
  deleteLog: (logId: number) => Promise<void>;
  updateLogSelectedAction: (
    logId: number,
    selectedActionId: number | null,
  ) => Promise<void>;

  actions: ReplacementAction[];
  addAction: (input: AddActionInput) => Promise<void>;
  renameCustomAction: (
    actionId: number,
    title: string,
    category?: string,
  ) => Promise<void>;
  deleteCustomAction: (actionId: number) => Promise<"deleted" | "hidden">;

  selectedActionIds: number[];
  toggleSelectedAction: (actionId: number) => Promise<void>;
  clearSelectedActions: () => Promise<void>;

  exportData: () => Promise<void>;
  importData: (fileUri: string) => Promise<void>;
  resetAll: () => Promise<void>;

  refresh: () => Promise<void>;
  resetDbForDev?: () => Promise<void>;
};

export type DataProviderProps = {
  children: React.ReactNode;
};
