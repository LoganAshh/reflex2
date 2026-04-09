import type React from "react";

export type Habit = { id: number; name: string; isCustom: 0 | 1 };
export type Cue = { id: number; name: string; isCustom: 0 | 1 };
export type Place = { id: number; name: string; isCustom: 0 | 1 };

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

export type AddActionInput = {
  title: string;
  category?: string;
  isCustom?: boolean;
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

  logs: LogEntry[];
  addLog: (input: AddLogInput) => Promise<void>;

  actions: ReplacementAction[];
  addAction: (input: AddActionInput) => Promise<void>;

  selectedActionIds: number[];
  toggleSelectedAction: (actionId: number) => Promise<void>;
  clearSelectedActions: () => Promise<void>;

  exportData: () => Promise<void>;
  resetAll: () => Promise<void>;

  refresh: () => Promise<void>;
  resetDbForDev?: () => Promise<void>;
};

export type DataProviderProps = {
  children: React.ReactNode;
};
