import type React from "react";

export type Habit = {
  id: number;
  name: string;
  isCustom: 0 | 1;
  hidden: 0 | 1;
  color: string;
  icon: string;
  measurementType: HabitMeasurementType;
  unit: string;
  estimatedBaseline: number | null;
  calibratedBaseline: number | null;
  calibrationStartedAt: number | null;
  calibratedAt: number | null;
  rebaselineStartedAt: number | null;
  baselinePeriod: HabitPeriod;
  finalTarget: number | null;
  goalPeriod: HabitPeriod;
  currentGoal: number | null;
  currentGoalPeriod: HabitPeriod;
  pendingGoal: number | null;
  pendingGoalPeriod: HabitPeriod;
  pendingGoalReason: string | null;
};

export type HabitMeasurementType = "times" | "amount" | "minutes" | "custom";
export type HabitPeriod = "day" | "week" | "28_days";

export type BaselineSummary = {
  status: "not_started" | "collecting" | "calibrated";
  estimated: number | null;
  calibrated: number | null;
  recent: number | null;
  priorRecent: number | null;
  returningFromGap: boolean;
  period: HabitPeriod;
  observedDays: number;
  requiredObservedDays: number;
  elapsedDays: number;
  requiredElapsedDays: number;
};

export type HabitPlanInput = {
  measurementType: HabitMeasurementType;
  unit: string;
  estimatedBaseline: number;
  baselinePeriod: HabitPeriod;
  finalTarget: number;
  goalPeriod: HabitPeriod;
};

export type GoalChangeReason =
  | "initial"
  | "plan_updated"
  | "approved_step"
  | "manual_easier"
  | "manual_harder"
  | "recovery";

export type GoalHistoryEntry = {
  id: number;
  habitId: number;
  amount: number;
  period: HabitPeriod;
  reason: GoalChangeReason;
  createdAt: number;
};

export type GoalCycleResult =
  | "goal_achieved"
  | "improved_but_missed"
  | "held_below_baseline"
  | "returned_to_previous_level"
  | "incomplete_data"
  | "dramatically_exceeded";

export type TrackingPeriod = "day" | "week" | "28_days";
export type TrackingStatus =
  | "everything_logged"
  | "nothing_happened"
  | "not_yet";

export type TrackingConfirmation = {
  id: number;
  habitId: number;
  period: TrackingPeriod;
  periodStart: number;
  status: TrackingStatus;
  updatedAt: number;
};

export type CycleReview = {
  habitId: number;
  startAt: number;
  endAtExclusive: number;
  period: HabitPeriod;
  eligible: boolean;
  complete: boolean;
  confirmedCount: number;
  requiredConfirmations: number;
  actualQuantity: number | null;
  baseline: number | null;
  baselineSource: "calibrated" | "estimated" | "unavailable";
  currentGoal: number | null;
  reductionFromBaseline: number | null;
  stepProgressPercent: number | null;
  resistedUrges: number;
  activityLogs: number;
  result: GoalCycleResult;
  recommendedGoal: number | null;
  goalAlreadyAdvanced: boolean;
};

export type CycleHistoryEntry = CycleReview & {
  /** Stable across recalculation, export, and future reward processing. */
  id: string;
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
  cueIds: number[];
  cueNames: string[];
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
  createdAt?: number;
  cueId?: number | null;
  cueIds?: number[];
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
  cueIds?: number[];
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

  addCustomHabit: (
    name: string,
    autoSelect?: boolean,
    icon?: string,
    color?: string,
  ) => Promise<void>;
  addCustomCue: (name: string, autoSelect?: boolean) => Promise<void>;
  addCustomLocation: (name: string, autoSelect?: boolean) => Promise<void>;

  renameCustomHabit: (habitId: number, name: string) => Promise<void>;
  updateHabit: (
    habitId: number,
    name: string,
    color: string,
    icon: string,
  ) => Promise<void>;
  updateHabitPlan: (habitId: number, input: HabitPlanInput) => Promise<void>;
  baselineSummaries: Record<number, BaselineSummary>;
  rebaselineHabit: (habitId: number) => Promise<void>;
  goalHistory: GoalHistoryEntry[];
  acknowledgedRecoveryGoalHistoryIds: number[];
  acknowledgeRecoveryGoal: (goalHistoryId: number) => Promise<void>;
  trackingConfirmations: TrackingConfirmation[];
  cycleReviews: Record<number, CycleReview>;
  cycleHistory: CycleHistoryEntry[];
  setTrackingConfirmation: (
    habitId: number,
    period: TrackingPeriod,
    periodStart: number,
    status: TrackingStatus,
  ) => Promise<void>;
  setTrackingConfirmationsBatch: (
    confirmations: Array<{
      habitId: number;
      period: TrackingPeriod;
      periodStart: number;
      status: TrackingStatus;
    }>,
  ) => Promise<void>;
  proposeNextGoal: (habitId: number) => Promise<void>;
  approveProposedGoal: (habitId: number) => Promise<void>;
  dismissProposedGoal: (habitId: number) => Promise<void>;
  adjustCurrentGoal: (
    habitId: number,
    direction: "easier" | "harder",
  ) => Promise<void>;
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
