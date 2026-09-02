import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  ScrollView,
  ActionSheetIOS,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  CommonActions,
  useRoute,
  useNavigation,
} from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type {
  ManageListSelection,
  ManageListType,
  RootStackParamList,
} from "../App";
import * as Haptics from "expo-haptics";
import {
  useData,
  type Habit,
  type Cue,
  type Place,
  type HabitPeriod,
} from "../data/DataContext";
import { DEFAULT_HABIT_ICON, type HabitIconName } from "../data/habitIcons";
import { HabitIconPicker } from "../components/HabitIconPicker";
import { Screen } from "../components/Screen";
import { normalizeGoalAmount } from "../data/goals";
import DraggableFlatList from "react-native-draggable-flatlist";

type ManageRoute = RouteProp<RootStackParamList, "ManageList">;
type Nav = NativeStackNavigationProp<RootStackParamList>;
type Filter = "selected" | "preset" | "custom";
type ManageItem = Habit | Cue | Place;
type PendingAddedItem = { type: ManageListType; name: string };

function HabitDragHandle({
  disabled,
  onLongPress,
}: {
  disabled: boolean;
  onLongPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      delayLongPress={180}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel="Hold and drag to reorder habit"
      className="ml-1 h-12 w-8 items-center justify-center rounded-xl"
    >
      <Ionicons name="reorder-three" size={30} color="#6B7280" />
    </Pressable>
  );
}

const HABIT_COLOR_OPTIONS = [
  "#16A34A",
  "#2563EB",
  "#F97316",
  "#92400E",
  "#DB2777",
  "#7C3AED",
  "#7F1D1D",
  "#64748B",
  "#DC2626",
  "#BE123C",
  "#EAB308",
  "#0EA5E9",
] as const;

const HABIT_COLOR_NAMES: Record<(typeof HABIT_COLOR_OPTIONS)[number], string> =
  {
    "#16A34A": "Green",
    "#2563EB": "Blue",
    "#F97316": "Orange",
    "#92400E": "Brown",
    "#DB2777": "Pink",
    "#7C3AED": "Purple",
    "#7F1D1D": "Burgundy",
    "#64748B": "Slate",
    "#DC2626": "Red",
    "#BE123C": "Rose",
    "#EAB308": "Yellow",
    "#0EA5E9": "Sky Blue",
  };

const PERIOD_OPTIONS: HabitPeriod[] = ["day", "week", "28_days"];
const MEASUREMENT_OPTIONS = ["times", "minutes"] as const;

function periodLabel(period: HabitPeriod) {
  if (period === "28_days") return "Month";
  return period === "week" ? "Week" : "Day";
}

function daysInPeriod(period: HabitPeriod) {
  if (period === "week") return 7;
  if (period === "28_days") return 28;
  return 1;
}

function measurementUnitForAmount(unit: string, amount: string) {
  if (Number(amount) !== 1) return unit;
  if (unit === "times") return "time";
  if (unit === "minutes") return "minute";
  return unit;
}

function formatLevel(value: number | null | undefined) {
  if (value == null) return "Not available yet";
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function formatLevelWithPeriod(
  value: number | null | undefined,
  unit: string,
  period: HabitPeriod,
) {
  if (value == null) return "Not available yet";
  const valueText = formatLevel(value);
  const unitText = measurementUnitForAmount(unit, `${value}`);
  return `${valueText} ${unitText} per ${periodLabel(period).toLowerCase()}`;
}

function habitNeedsPlan(habit: Habit) {
  return (
    habit.estimatedBaseline == null ||
    habit.finalTarget == null ||
    habit.currentGoal == null
  );
}

function startingPeriodFor(habit: Habit): HabitPeriod {
  return habit.estimatedBaseline == null ? "week" : habit.baselinePeriod;
}

function goalPeriodForSetup(habit: Habit): HabitPeriod {
  return habit.finalTarget == null
    ? startingPeriodFor(habit)
    : habit.goalPeriod;
}

function showMeasurementMenu(
  selectedMeasurement: (typeof MEASUREMENT_OPTIONS)[number],
  onSelect: (measurement: (typeof MEASUREMENT_OPTIONS)[number]) => void,
) {
  const labels = ["Times", "Minutes"];
  Keyboard.dismiss();

  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...labels, "Cancel"],
        cancelButtonIndex: labels.length,
        title: "Choose measurement",
      },
      (buttonIndex) => {
        const measurement = MEASUREMENT_OPTIONS[buttonIndex];
        if (measurement) onSelect(measurement);
      },
    );
    return;
  }

  Alert.alert(
    "Choose measurement",
    `Currently ${selectedMeasurement === "minutes" ? "Minutes" : "Times"}`,
    [
      ...MEASUREMENT_OPTIONS.map((measurement) => ({
        text: measurement === "minutes" ? "Minutes" : "Times",
        onPress: () => onSelect(measurement),
      })),
      { text: "Cancel", style: "cancel" as const },
    ],
  );
}

function showPeriodMenu(
  selectedPeriod: HabitPeriod,
  onSelect: (period: HabitPeriod) => void,
) {
  const labels = PERIOD_OPTIONS.map(periodLabel);
  Keyboard.dismiss();

  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...labels, "Cancel"],
        cancelButtonIndex: labels.length,
        title: "Choose frequency",
      },
      (buttonIndex) => {
        const period = PERIOD_OPTIONS[buttonIndex];
        if (period) onSelect(period);
      },
    );
    return;
  }

  Alert.alert("Choose frequency", `Currently ${periodLabel(selectedPeriod)}`, [
    ...PERIOD_OPTIONS.map((period) => ({
      text: periodLabel(period),
      onPress: () => onSelect(period),
    })),
    { text: "Cancel", style: "cancel" as const },
  ]);
}

function getScreenIcon(type: ManageListType): keyof typeof Ionicons.glyphMap {
  if (type === "habits") return "radio-button-on";
  if (type === "cues") return "alert-circle";
  return "location";
}

function getFilterIcon(filter: Filter): keyof typeof Ionicons.glyphMap {
  if (filter === "selected") return "checkmark-circle";
  if (filter === "preset") return "sparkles";
  return "create";
}

function getHabitColor(item: ManageItem) {
  if ("color" in item && typeof item.color === "string") {
    return item.color;
  }

  return "#16A34A";
}

export default function ManageListScreen() {
  const route = useRoute<ManageRoute>();
  const navigation = useNavigation<Nav>();
  const type = route.params.type;

  const {
    habits,
    cues,
    locations,
    selectedHabits,
    selectedCues,
    selectedLocations,
    setSelectedHabits,
    setSelectedCues,
    setSelectedLocations,
    addCustomHabit,
    updateHabit,
    updateHabitPlan,
    cycleReviews,
    goalHistory,
    proposeNextGoal,
    approveProposedGoal,
    dismissProposedGoal,
    adjustCurrentGoal,
    addCustomCue,
    addCustomLocation,
    renameCustomCue,
    renameCustomLocation,
    deleteCustomHabit,
    deleteCustomCue,
    deleteCustomLocation,
  } = useData();

  const [text, setText] = useState("");
  const [filter, setFilter] = useState<Filter>("selected");
  const [editingItem, setEditingItem] = useState<ManageItem | null>(null);
  const [editText, setEditText] = useState("");
  const [editColor, setEditColor] = useState("#16A34A");
  const [editIcon, setEditIcon] = useState<HabitIconName>(DEFAULT_HABIT_ICON);
  const [habitPicker, setHabitPicker] = useState<"icon" | "color" | null>(null);
  const [goalAdjustmentsOpen, setGoalAdjustmentsOpen] = useState(false);
  const [measurementType, setMeasurementType] = useState<"times" | "minutes">(
    "times",
  );
  const [estimatedBaseline, setEstimatedBaseline] = useState("");
  const [baselinePeriod, setBaselinePeriod] = useState<HabitPeriod>("week");
  const [finalTarget, setFinalTarget] = useState("");
  const [goalPeriod, setGoalPeriod] = useState<HabitPeriod>("week");
  const [returnSelection, setReturnSelection] =
    useState<ManageListSelection | null>(null);
  const [pendingAddedItem, setPendingAddedItem] =
    useState<PendingAddedItem | null>(null);
  const [selectAfterSaveId, setSelectAfterSaveId] = useState<number | null>(
    null,
  );
  const [deferredDeselectedIds, setDeferredDeselectedIds] = useState<
    Set<number>
  >(new Set());
  const [upgradeSetupActive, setUpgradeSetupActive] = useState(
    route.params.setupMissingPlans === true,
  );
  const [savingHabitOrder, setSavingHabitOrder] = useState(false);
  const [habitOrderPreviewIds, setHabitOrderPreviewIds] = useState<
    number[] | null
  >(null);

  const didSetInitialFilter = useRef(false);
  const openedGoalHabitIdRef = useRef<number | null>(null);
  const editModalScrollRef = useRef<ScrollView | null>(null);
  const goalAmountInputRef = useRef<TextInput | null>(null);

  const { items, selectedIds, title, singularTitle } = useMemo(() => {
    if (type === "habits") {
      return {
        items: habits,
        selectedIds: new Set(selectedHabits.map((h) => h.id)),
        title: "Habits",
        singularTitle: "habit",
      };
    }

    if (type === "cues") {
      return {
        items: cues,
        selectedIds: new Set(selectedCues.map((c) => c.id)),
        title: "Cues",
        singularTitle: "cue",
      };
    }

    return {
      items: locations,
      selectedIds: new Set(selectedLocations.map((l) => l.id)),
      title: "Locations",
      singularTitle: "location",
    };
  }, [
    type,
    habits,
    cues,
    locations,
    selectedHabits,
    selectedCues,
    selectedLocations,
  ]);

  const editingIsCustom = editingItem?.isCustom === 1;
  const editingPresetHabit =
    type === "habits" && !!editingItem && !editingIsCustom;
  const measurementUnitLabel =
    measurementType === "minutes" ? "minutes" : "times";
  const editingHabit =
    type === "habits" && editingItem
      ? (habits.find((habit) => habit.id === editingItem.id) ??
        (editingItem as Habit))
      : null;
  const startingAmountLocked = editingHabit?.calibratedBaseline != null;
  const editingCycleReview = editingHabit
    ? cycleReviews[editingHabit.id]
    : null;
  const canAdvanceCurrentGoal =
    editingCycleReview?.complete === true &&
    editingCycleReview.result === "goal_achieved" &&
    !editingCycleReview.goalAlreadyAdvanced;
  const latestEditingGoalChange = editingHabit
    ? goalHistory.find((entry) => entry.habitId === editingHabit.id)
    : null;
  const recoveryGoalActive = latestEditingGoalChange?.reason === "recovery";
  const finalGoalInCurrentPeriod =
    editingHabit?.finalTarget == null || editingHabit.currentGoal == null
      ? null
      : normalizeGoalAmount(
          editingHabit.finalTarget,
          editingHabit.goalPeriod,
          editingHabit.currentGoalPeriod,
        );

  useEffect(() => {
    if (didSetInitialFilter.current) return;

    didSetInitialFilter.current = true;

    if (type !== "habits" && selectedIds.size === 0) {
      setFilter("preset");
      return;
    }

    setFilter("selected");
  }, [type, selectedIds.size]);

  useEffect(() => {
    const habitId = route.params.habitId;
    if (
      type !== "habits" ||
      (!route.params.openGoal && !route.params.setupMissingPlans) ||
      habitId == null ||
      openedGoalHabitIdRef.current === habitId
    ) {
      return;
    }
    const habit = habits.find((item) => item.id === habitId);
    if (!habit) return;
    openedGoalHabitIdRef.current = habitId;
    setUpgradeSetupActive(route.params.setupMissingPlans === true);
    openEdit(habit);
    setGoalAdjustmentsOpen(route.params.openGoal === true);
  }, [
    habits,
    route.params.habitId,
    route.params.openGoal,
    route.params.setupMissingPlans,
    type,
  ]);

  useEffect(() => {
    if (!pendingAddedItem) return;
    if (pendingAddedItem.type !== type) return;

    const match = items.find(
      (item) =>
        item.name.trim().toLowerCase() ===
        pendingAddedItem.name.trim().toLowerCase(),
    );

    if (!match) return;

    setPendingAddedItem(null);

    if (type === "habits") {
      openEdit(match, true);
      return;
    }

    setReturnSelection({ type, id: match.id, token: Date.now() });
  }, [items, pendingAddedItem, type]);

  const filteredItems = useMemo(() => {
    if (filter === "selected") {
      if (type === "habits") {
        const previewHabits = habitOrderPreviewIds
          ? habitOrderPreviewIds.flatMap((habitId) => {
              const habit = selectedHabits.find((item) => item.id === habitId);
              return habit ? [habit] : [];
            })
          : selectedHabits;
        const deferredItems = items.filter(
          (item) =>
            deferredDeselectedIds.has(item.id) && !selectedIds.has(item.id),
        );
        return [...previewHabits, ...deferredItems];
      }

      return items.filter(
        (it) => selectedIds.has(it.id) || deferredDeselectedIds.has(it.id),
      );
    }

    if (filter === "preset") {
      return items.filter((it) => !it.isCustom);
    }

    return items.filter((it) => !!it.isCustom);
  }, [
    items,
    selectedIds,
    deferredDeselectedIds,
    filter,
    selectedHabits,
    habitOrderPreviewIds,
    type,
  ]);

  const setLogReturnSelectionParam = (selection: ManageListSelection) => {
    const rootState = navigation.getState();
    const mainRoute = rootState.routes.find((r) => r.name === "Main");
    const tabState = mainRoute?.state as
      | {
          key?: string;
          routes?: Array<{ key: string; name: string }>;
        }
      | undefined;

    const logRoute = tabState?.routes?.find((r) => r.name === "Log");

    if (!tabState?.key || !logRoute?.key) return false;

    navigation.dispatch({
      ...CommonActions.setParams({
        manageListSelection: selection,
      }),
      source: logRoute.key,
      target: tabState.key,
    });

    return true;
  };

  const toggleSelected = async (id: number) => {
    const wasSelected = selectedIds.has(id);

    if (type === "habits" && wasSelected && selectedIds.size === 1) {
      Alert.alert("Keep one habit", "You need at least one habit selected.");
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (type === "habits" && !wasSelected) {
      const habit = habits.find((item) => item.id === id);
      const hasPlan =
        habit?.estimatedBaseline != null &&
        habit.finalTarget != null &&
        habit.currentGoal != null;

      if (habit && !hasPlan) {
        openEdit(habit, true);
        return;
      }
    }

    const ids = Array.from(selectedIds);
    const next = wasSelected ? ids.filter((x) => x !== id) : [...ids, id];

    if (type === "habits") await setSelectedHabits(next);
    else if (type === "cues") await setSelectedCues(next);
    else await setSelectedLocations(next);

    setDeferredDeselectedIds((current) => {
      const updated = new Set(current);

      if (wasSelected && filter === "selected") updated.add(id);
      else updated.delete(id);

      return updated;
    });

    if (!wasSelected) {
      setReturnSelection({
        type,
        id,
        token: Date.now(),
      });
    }
  };

  const persistSelectedHabitOrder = async (nextIds: number[]) => {
    if (savingHabitOrder) return;
    setSavingHabitOrder(true);
    try {
      await setSelectedHabits(nextIds);
      await Haptics.selectionAsync();
    } finally {
      setSavingHabitOrder(false);
    }
  };

  const onAdd = async () => {
    const name = text.trim();
    if (!name) return;

    Keyboard.dismiss();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (type === "habits") await addCustomHabit(name, false);
      else if (type === "cues") await addCustomCue(name, true);
      else await addCustomLocation(name, true);

      setPendingAddedItem({ type, name });
      setText("");
      setFilter("custom");
    } catch (e: any) {
      Alert.alert("Already exists", e?.message ?? "That item already exists.");
    }
  };

  function openEdit(item: ManageItem, selectAfterSave = false) {
    if (type !== "habits" && !item.isCustom) return;

    setSelectAfterSaveId(selectAfterSave ? item.id : null);
    setEditingItem(item);
    setEditText(item.name);
    setEditColor(getHabitColor(item));
    if (type === "habits") {
      const habit = item as Habit;
      setEditIcon((habit.icon as HabitIconName) ?? DEFAULT_HABIT_ICON);
      setMeasurementType(
        habit.measurementType === "minutes" ? "minutes" : "times",
      );
      setEstimatedBaseline(
        (habit.calibratedBaseline ?? habit.estimatedBaseline)?.toString() ?? "",
      );
      setBaselinePeriod(startingPeriodFor(habit));
      setFinalTarget(habit.finalTarget?.toString() ?? "");
      setGoalPeriod(goalPeriodForSetup(habit));
    }
  }

  const closeEdit = () => {
    Keyboard.dismiss();
    setEditingItem(null);
    setEditText("");
    setEditColor("#16A34A");
    setEditIcon(DEFAULT_HABIT_ICON);
    setHabitPicker(null);
    setGoalAdjustmentsOpen(false);
    setMeasurementType("times");
    setEstimatedBaseline("");
    setBaselinePeriod("day");
    setFinalTarget("");
    setGoalPeriod("day");
    setSelectAfterSaveId(null);
  };

  const onSaveEdit = async () => {
    if (!editingItem) return;

    const name = editingPresetHabit ? editingItem.name : editText.trim();
    if (!name) return;

    try {
      Keyboard.dismiss();

      const nextUpgradeHabit =
        upgradeSetupActive && type === "habits"
          ? (selectedHabits.find(
              (habit) => habit.id !== editingItem.id && habitNeedsPlan(habit),
            ) ?? null)
          : null;

      if (type === "habits") {
        const currentAmount = Number(estimatedBaseline);
        const goalAmount = Number(finalTarget);

        if (
          !estimatedBaseline.trim() ||
          !Number.isFinite(currentAmount) ||
          currentAmount < 0
        ) {
          Alert.alert(
            "Add an estimated current amount",
            `Enter a valid estimated current amount for ${name}.`,
          );
          return;
        }

        if (
          !finalTarget.trim() ||
          !Number.isFinite(goalAmount) ||
          goalAmount < 0
        ) {
          Alert.alert(
            "Add a long-term goal amount",
            `Enter a valid long-term goal amount for ${name}.`,
          );
          return;
        }

        if (
          goalAmount / daysInPeriod(goalPeriod) >
          currentAmount / daysInPeriod(baselinePeriod)
        ) {
          Alert.alert(
            "Check the goal rate",
            `${name}'s goal cannot represent a higher rate than its ${
              startingAmountLocked ? "calculated" : "estimated"
            } current amount.`,
          );
          return;
        }

        await updateHabit(editingItem.id, name, editColor, editIcon);
        await updateHabitPlan(editingItem.id, {
          measurementType: startingAmountLocked
            ? editingHabit?.measurementType === "minutes"
              ? "minutes"
              : "times"
            : measurementType,
          unit: startingAmountLocked
            ? (editingHabit?.unit ?? measurementType)
            : measurementType,
          estimatedBaseline: startingAmountLocked
            ? (editingHabit?.estimatedBaseline ?? currentAmount)
            : currentAmount,
          baselinePeriod: startingAmountLocked
            ? (editingHabit?.baselinePeriod ?? baselinePeriod)
            : baselinePeriod,
          finalTarget: goalAmount,
          goalPeriod,
        });

        if (selectAfterSaveId === editingItem.id) {
          const nextIds = Array.from(new Set([...selectedIds, editingItem.id]));
          await setSelectedHabits(nextIds);
          setReturnSelection({
            type: "habits",
            id: editingItem.id,
            token: Date.now(),
          });
        }
      } else if (type === "cues") await renameCustomCue(editingItem.id, name);
      else await renameCustomLocation(editingItem.id, name);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeEdit();
      if (upgradeSetupActive) {
        if (nextUpgradeHabit) {
          openEdit(nextUpgradeHabit);
        } else if (navigation.canGoBack()) {
          navigation.goBack();
        }
      }
    } catch (e: any) {
      Alert.alert("Could not save", e?.message ?? "That name is already used.");
    }
  };

  const onDelete = () => {
    if (!editingItem || !editingItem.isCustom) return;

    Alert.alert(
      `Delete ${singularTitle}?`,
      `This removes “${editingItem.name}” from future logging. If old logs use it, those logs will keep their saved text.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!editingItem) return;

            const deletedId = editingItem.id;

            const result =
              type === "habits"
                ? await deleteCustomHabit(deletedId)
                : type === "cues"
                  ? await deleteCustomCue(deletedId)
                  : await deleteCustomLocation(deletedId);

            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            );

            if (returnSelection?.id === deletedId) {
              setReturnSelection(null);
            }

            closeEdit();

            if (
              type !== "habits" &&
              selectedIds.has(deletedId) &&
              selectedIds.size === 1
            ) {
              setFilter("preset");
            }

            if (result === "hidden") {
              Alert.alert(
                "Hidden from logging",
                "This item was used in old logs, so it was hidden instead of fully deleted. Historical logs still keep the original text.",
              );
            }
          },
        },
      ],
    );
  };

  const onAdjustCurrentGoal = (direction: "easier" | "harder") => {
    if (!editingHabit) return;
    const easier = direction === "easier";
    Alert.alert(
      easier ? "Make this step easier?" : "Make this step harder?",
      easier
        ? "This raises the current-step goal slightly toward your starting level. Your long-term goal will not change."
        : "This lowers the current-step goal by one normal reduction step. Your long-term goal will not change.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: easier ? "Make Easier" : "Make Harder",
          onPress: async () => {
            await adjustCurrentGoal(editingHabit.id, direction);
            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            );
          },
        },
      ],
    );
  };

  const onDone = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (type === "habits") {
      const incompleteHabit = selectedHabits.find(
        (habit) =>
          habit.estimatedBaseline == null ||
          habit.finalTarget == null ||
          habit.currentGoal == null,
      );

      if (incompleteHabit) {
        Alert.alert(
          "Finish habit setup",
          `Add an estimated current amount and a long-term goal amount for ${incompleteHabit.name} before leaving.`,
        );
        openEdit(incompleteHabit);
        return;
      }
    }

    if (returnSelection) {
      setLogReturnSelectionParam(returnSelection);
    }

    navigation.goBack();
  };

  const renderFilterChip = (label: string, value: Filter) => {
    const active = filter === value;

    return (
      <Pressable
        key={value}
        onPress={() => {
          Haptics.selectionAsync();

          if (filter === "selected" && value !== "selected") {
            setDeferredDeselectedIds(new Set());
          }

          setFilter(value);
        }}
        className={`mr-2 flex-row items-center rounded-full border px-4 py-2.5 ${
          active ? "border-green-600 bg-green-600" : "border-gray-200 bg-white"
        }`}
      >
        <Ionicons
          name={getFilterIcon(value)}
          size={16}
          color={active ? "#FFFFFF" : "#000000"}
        />

        <Text
          className={`ml-1.5 text-sm font-black ${
            active ? "text-white" : "text-black"
          }`}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  const listHeader = (
    <View className="px-5 pt-10">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-4">
          <Text className="text-sm font-black uppercase tracking-widest text-green-600">
            Manage
          </Text>

          <Text className="mt-1 text-3xl font-black text-black">{title}</Text>
        </View>

        <View className="h-16 w-16 items-center justify-center rounded-full border-4 border-green-600 bg-white shadow-sm">
          <Ionicons name={getScreenIcon(type)} size={29} color="#000000" />
        </View>
      </View>

      <View className="mt-5 flex-row">
        {renderFilterChip("Selected", "selected")}
        {renderFilterChip("Preset", "preset")}
        {renderFilterChip("Custom", "custom")}
      </View>

      {filter === "custom" ? (
        <View className="mt-5 rounded-[32px] border border-gray-200 bg-gray-50 p-5 shadow-sm">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-xl font-black text-black">
                Add custom {singularTitle}
              </Text>

              <Text className="mt-1 text-sm font-semibold text-gray-500">
                Add something specific to your own routine.
              </Text>
            </View>

            <View className="h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white">
              <Ionicons name="add-circle" size={25} color="#000000" />
            </View>
          </View>

          <View className="mt-4 flex-row items-center gap-3">
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={`New ${singularTitle}...`}
              placeholderTextColor="#9CA3AF"
              className="flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-black"
              multiline={false}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={onAdd}
            />

            <Pressable
              onPress={onAdd}
              disabled={!text.trim()}
              className={`rounded-2xl px-4 py-3 ${
                text.trim() ? "bg-green-600" : "bg-gray-300"
              }`}
            >
              <Text className="font-black text-white">Add</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View className="mb-4 mt-6 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-black text-black">
            {filter === "selected"
              ? "Selected"
              : filter === "preset"
                ? "Preset"
                : "Custom"}
          </Text>

          <Text className="mt-1 text-sm font-semibold text-gray-500">
            Tap Select to show an item on the Log screen.
          </Text>
        </View>

        <View className="rounded-full border border-gray-200 bg-white px-3 py-2 shadow-sm">
          <Text className="text-sm font-black text-green-600">
            {filteredItems.length}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <>
      <Screen>
        <Modal visible={!!editingItem} transparent animationType="fade">
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1 justify-center bg-black/40 px-6"
          >
            <View className="max-h-[90%] rounded-[32px] bg-white p-5">
              <ScrollView
                ref={editModalScrollRef}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={
                  Platform.OS === "ios" ? "interactive" : "on-drag"
                }
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-4">
                    <Text className="text-xl font-black text-black">
                      {selectAfterSaveId === editingItem?.id
                        ? `Set up ${singularTitle}`
                        : `Edit ${singularTitle}`}
                    </Text>
                  </View>
                  <Pressable
                    onPress={closeEdit}
                    accessibilityRole="button"
                    accessibilityLabel="Close edit habit"
                    className="h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-gray-50"
                  >
                    <Ionicons name="close" size={20} color="#000000" />
                  </Pressable>
                </View>

                {editingPresetHabit ? (
                  <View className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5">
                    <Text className="text-xs font-black uppercase tracking-wide text-gray-500">
                      Preset habit
                    </Text>

                    <Text className="mt-1 text-base font-black text-black">
                      {editingItem?.name}
                    </Text>
                  </View>
                ) : (
                  <TextInput
                    value={editText}
                    onChangeText={setEditText}
                    placeholder={singularTitle}
                    placeholderTextColor="#9CA3AF"
                    className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-black"
                    multiline={false}
                    returnKeyType="done"
                    blurOnSubmit
                    onSubmitEditing={() => Keyboard.dismiss()}
                  />
                )}

                {type === "habits" ? (
                  <View className="mt-4">
                    <View className="flex-row gap-3">
                      <View className="flex-1">
                        <Text className="text-xs font-black uppercase tracking-wide text-gray-500">
                          Habit icon
                        </Text>

                        <Pressable
                          onPress={() => {
                            Keyboard.dismiss();
                            Haptics.selectionAsync();
                            setHabitPicker("icon");
                          }}
                          accessibilityRole="button"
                          accessibilityLabel="Change habit icon"
                          className="mt-2 flex-row items-center rounded-2xl border border-gray-200 bg-gray-50 p-2"
                        >
                          <View
                            className="h-9 w-9 items-center justify-center rounded-xl border bg-white"
                            style={{ borderColor: editColor }}
                          >
                            <Ionicons
                              name={editIcon}
                              size={22}
                              color={editColor}
                            />
                          </View>
                          <Text
                            className="ml-2 flex-1 text-xs font-black capitalize text-black"
                            numberOfLines={2}
                          >
                            {editIcon.replaceAll("-", " ")}
                          </Text>
                        </Pressable>
                      </View>

                      <View className="flex-1">
                        <Text className="text-xs font-black uppercase tracking-wide text-gray-500">
                          Habit color
                        </Text>

                        <Pressable
                          onPress={() => {
                            Keyboard.dismiss();
                            Haptics.selectionAsync();
                            setHabitPicker("color");
                          }}
                          accessibilityRole="button"
                          accessibilityLabel="Change habit color"
                          className="mt-2 flex-row items-center rounded-2xl border border-gray-200 bg-gray-50 p-2"
                        >
                          <View
                            className="h-9 w-9 rounded-full border-4 border-white"
                            style={{ backgroundColor: editColor }}
                          />
                          <Text
                            className="ml-2 flex-1 text-xs font-black text-black"
                            numberOfLines={2}
                          >
                            {HABIT_COLOR_NAMES[
                              editColor as keyof typeof HABIT_COLOR_NAMES
                            ] ?? "Custom color"}
                          </Text>
                        </Pressable>
                      </View>
                    </View>

                    <View className="mt-4 border-t border-gray-200 pt-4">
                      <Text className="text-lg font-black text-black">
                        Reduction setup
                      </Text>

                      <View className="mt-4 gap-3">
                        <View>
                          <Text className="mb-2 text-xs font-black uppercase tracking-wide text-gray-500">
                            {startingAmountLocked
                              ? "Calculated current amount"
                              : "Estimated current amount"}
                          </Text>
                          <View className="flex-row items-center rounded-2xl border border-gray-200 bg-gray-50 p-2">
                            <TextInput
                              value={estimatedBaseline}
                              onChangeText={setEstimatedBaseline}
                              editable={!startingAmountLocked}
                              placeholder="5"
                              placeholderTextColor="#9CA3AF"
                              keyboardType={
                                Platform.OS === "ios"
                                  ? "numbers-and-punctuation"
                                  : "decimal-pad"
                              }
                              returnKeyType="done"
                              blurOnSubmit={false}
                              onSubmitEditing={() =>
                                goalAmountInputRef.current?.focus()
                              }
                              className={`w-16 rounded-xl border border-gray-200 px-3 py-2 text-center text-black ${
                                startingAmountLocked
                                  ? "bg-gray-100"
                                  : "bg-white"
                              }`}
                            />
                            <Pressable
                              disabled={startingAmountLocked}
                              onPress={() =>
                                showMeasurementMenu(
                                  measurementType === "minutes"
                                    ? "minutes"
                                    : "times",
                                  setMeasurementType,
                                )
                              }
                              className={`ml-2 flex-row items-center rounded-xl border border-gray-200 bg-white px-2 py-2 ${
                                startingAmountLocked ? "opacity-60" : ""
                              }`}
                            >
                              <Text className="text-xs font-black text-black">
                                {measurementUnitForAmount(
                                  measurementUnitLabel,
                                  estimatedBaseline,
                                )}
                              </Text>
                              <Ionicons
                                name="chevron-down"
                                size={12}
                                color="#6B7280"
                              />
                            </Pressable>
                            <Text className="mx-1.5 text-xs font-bold text-gray-500">
                              per
                            </Text>
                            <Pressable
                              disabled={startingAmountLocked}
                              onPress={() =>
                                showPeriodMenu(
                                  baselinePeriod,
                                  setBaselinePeriod,
                                )
                              }
                              className={`w-20 flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-2 py-2 ${
                                startingAmountLocked ? "opacity-60" : ""
                              }`}
                            >
                              <Text className="text-xs font-black text-black">
                                {periodLabel(baselinePeriod)}
                              </Text>
                              <Ionicons
                                name="chevron-down"
                                size={14}
                                color="#6B7280"
                              />
                            </Pressable>
                          </View>
                          <Text className="mt-2 text-xs font-semibold leading-4 text-gray-500">
                            {startingAmountLocked
                              ? "Calculated from early tracking."
                              : "Used until enough data is collected."}
                          </Text>
                        </View>

                        <View>
                          <Text className="mb-2 text-xs font-black uppercase tracking-wide text-gray-500">
                            Long-term goal amount
                          </Text>
                          <View className="flex-row items-center rounded-2xl border border-gray-200 bg-gray-50 p-2">
                            <TextInput
                              ref={goalAmountInputRef}
                              value={finalTarget}
                              onChangeText={setFinalTarget}
                              placeholder="0"
                              placeholderTextColor="#9CA3AF"
                              keyboardType={
                                Platform.OS === "ios"
                                  ? "numbers-and-punctuation"
                                  : "decimal-pad"
                              }
                              returnKeyType="done"
                              blurOnSubmit
                              onSubmitEditing={() => Keyboard.dismiss()}
                              onFocus={() => {
                                requestAnimationFrame(() => {
                                  editModalScrollRef.current?.scrollToEnd({
                                    animated: true,
                                  });
                                });
                              }}
                              className="w-16 rounded-xl border border-gray-200 bg-white px-3 py-2 text-center text-black"
                            />
                            <Pressable
                              disabled={startingAmountLocked}
                              onPress={() =>
                                showMeasurementMenu(
                                  measurementType === "minutes"
                                    ? "minutes"
                                    : "times",
                                  setMeasurementType,
                                )
                              }
                              className={`ml-2 flex-row items-center rounded-xl border border-gray-200 bg-white px-2 py-2 ${
                                startingAmountLocked ? "opacity-60" : ""
                              }`}
                            >
                              <Text className="text-xs font-black text-black">
                                {measurementUnitForAmount(
                                  measurementUnitLabel,
                                  finalTarget,
                                )}
                              </Text>
                              <Ionicons
                                name="chevron-down"
                                size={12}
                                color="#6B7280"
                              />
                            </Pressable>
                            <Text className="mx-1.5 text-xs font-bold text-gray-500">
                              per
                            </Text>
                            <Pressable
                              onPress={() =>
                                showPeriodMenu(goalPeriod, setGoalPeriod)
                              }
                              className="w-20 flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-2 py-2"
                            >
                              <Text className="text-xs font-black text-black">
                                {periodLabel(goalPeriod)}
                              </Text>
                              <Ionicons
                                name="chevron-down"
                                size={14}
                                color="#6B7280"
                              />
                            </Pressable>
                          </View>
                        </View>
                      </View>

                      {editingHabit?.currentGoal != null ? (
                        <Pressable
                          onPress={() => setGoalAdjustmentsOpen(true)}
                          className="mt-4 flex-row items-center rounded-2xl border border-green-200 bg-green-50 px-4 py-3"
                        >
                          <View className="flex-1">
                            <Text className="text-xs font-black uppercase tracking-wide text-green-700">
                              Current step goal
                            </Text>
                            <Text className="mt-1 text-base font-black text-black">
                              {formatLevelWithPeriod(
                                editingHabit.currentGoal,
                                measurementUnitLabel,
                                editingHabit.currentGoalPeriod,
                              )}
                            </Text>
                          </View>
                          <Ionicons
                            name="chevron-forward"
                            size={19}
                            color="#15803D"
                          />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ) : null}

                <Pressable
                  onPress={onSaveEdit}
                  className="mt-4 rounded-3xl bg-green-600 py-4 active:bg-green-700"
                >
                  <Text className="text-center text-base font-black text-white">
                    {selectAfterSaveId === editingItem?.id
                      ? "Add Habit"
                      : "Save Changes"}
                  </Text>
                </Pressable>

                {editingItem?.isCustom ? (
                  <Pressable onPress={onDelete} className="mt-3 py-2">
                    <Text className="text-center text-sm font-black text-red-600">
                      Delete Custom Item
                    </Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            </View>

            {habitPicker !== null ? (
              <View className="absolute inset-0 justify-center bg-black/50 px-6">
                <View className="rounded-[30px] bg-white p-5 shadow-lg">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 pr-4">
                      <Text className="text-xl font-black text-black">
                        {habitPicker === "icon"
                          ? "Choose an icon"
                          : "Choose a color"}
                      </Text>
                      <Text className="mt-1 text-sm font-semibold text-gray-500">
                        Tap an option to select it.
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setHabitPicker(null)}
                      accessibilityRole="button"
                      accessibilityLabel="Close picker"
                      className="h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-gray-50"
                    >
                      <Ionicons name="close" size={22} color="#000000" />
                    </Pressable>
                  </View>

                  {habitPicker === "icon" ? (
                    <View className="mt-5">
                      <HabitIconPicker
                        selectedIcon={editIcon}
                        color={editColor}
                        onSelect={(icon) => {
                          setEditIcon(icon);
                          setHabitPicker(null);
                        }}
                      />
                    </View>
                  ) : (
                    <View className="mt-5 flex-row flex-wrap gap-4">
                      {HABIT_COLOR_OPTIONS.map((color) => {
                        const selected = editColor === color;

                        return (
                          <Pressable
                            key={color}
                            onPress={() => {
                              Haptics.selectionAsync();
                              setEditColor(color);
                              setHabitPicker(null);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Choose color ${color}`}
                            className="h-12 w-12 items-center justify-center rounded-full border bg-white"
                            style={{
                              borderColor: selected ? color : "#E5E7EB",
                              borderWidth: selected ? 3 : 1,
                            }}
                          >
                            <View
                              className="h-8 w-8 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              </View>
            ) : null}

            {goalAdjustmentsOpen && editingHabit?.currentGoal != null ? (
              <View className="absolute inset-0 justify-center bg-black/50 px-6">
                <View className="max-h-[85%] rounded-[30px] bg-white p-5 shadow-lg">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xl font-black text-black">
                      Current step goal
                    </Text>
                    <Pressable
                      onPress={() => setGoalAdjustmentsOpen(false)}
                      accessibilityRole="button"
                      accessibilityLabel="Close current goal adjustments"
                      className="h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-gray-50"
                    >
                      <Ionicons name="close" size={22} color="#000000" />
                    </Pressable>
                  </View>

                  <ScrollView
                    className="mt-4"
                    showsVerticalScrollIndicator={false}
                  >
                    <View className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
                      <Text className="text-lg font-black text-black">
                        {formatLevelWithPeriod(
                          editingHabit.currentGoal,
                          measurementUnitLabel,
                          editingHabit.currentGoalPeriod,
                        )}
                      </Text>
                    </View>

                    {recoveryGoalActive ? (
                      <View className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                        <Text className="text-sm font-black text-black">
                          Goal adjustment
                        </Text>
                        <Text className="mt-1 text-xs font-semibold leading-4 text-gray-600">
                          Reflex adjusted this step to keep your plan realistic.
                          You can change it whenever you’re ready.
                        </Text>
                      </View>
                    ) : null}

                    {editingHabit.pendingGoal != null ? (
                      <View className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                        <Text className="text-sm font-black text-black">
                          Suggested next step
                        </Text>
                        <Text className="mt-1 text-base font-black text-black">
                          {formatLevelWithPeriod(
                            editingHabit.pendingGoal,
                            measurementUnitLabel,
                            editingHabit.pendingGoalPeriod,
                          )}
                        </Text>
                        <Text className="mt-2 text-xs font-semibold leading-4 text-gray-600">
                          {editingHabit.pendingGoalReason}
                        </Text>
                        {!canAdvanceCurrentGoal ? (
                          <Text className="mt-2 text-xs font-bold leading-4 text-gray-600">
                            Complete the tracking review on Home before
                            approving this change.
                          </Text>
                        ) : null}
                        <View className="mt-3 flex-row gap-2">
                          <Pressable
                            onPress={() => dismissProposedGoal(editingHabit.id)}
                            className="flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2.5"
                          >
                            <Text className="text-center text-xs font-black text-black">
                              Not Now
                            </Text>
                          </Pressable>
                          <Pressable
                            disabled={!canAdvanceCurrentGoal}
                            onPress={async () => {
                              await approveProposedGoal(editingHabit.id);
                              await Haptics.notificationAsync(
                                Haptics.NotificationFeedbackType.Success,
                              );
                            }}
                            className={`flex-1 rounded-xl bg-green-600 px-3 py-2.5 ${
                              canAdvanceCurrentGoal ? "" : "opacity-40"
                            }`}
                          >
                            <Text className="text-center text-xs font-black text-white">
                              Use This Goal
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : canAdvanceCurrentGoal &&
                      finalGoalInCurrentPeriod != null &&
                      editingHabit.currentGoal > finalGoalInCurrentPeriod ? (
                      <Pressable
                        onPress={() => proposeNextGoal(editingHabit.id)}
                        className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3"
                      >
                        <Text className="text-center text-sm font-black text-blue-700">
                          Preview Next Step
                        </Text>
                      </Pressable>
                    ) : finalGoalInCurrentPeriod != null &&
                      editingHabit.currentGoal > finalGoalInCurrentPeriod ? (
                      <Text className="mt-3 text-xs font-semibold leading-4 text-gray-500">
                        Once your tracking is confirmed and you meet this goal,
                        your next step will be ready.
                      </Text>
                    ) : null}

                    <View className="mt-4 flex-row gap-2">
                      <Pressable
                        onPress={() => onAdjustCurrentGoal("easier")}
                        className="flex-1 rounded-2xl border border-gray-300 bg-white px-3 py-3"
                      >
                        <Text className="text-center text-xs font-black text-black">
                          Make Easier
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => onAdjustCurrentGoal("harder")}
                        className="flex-1 rounded-2xl border border-gray-300 bg-white px-3 py-3"
                      >
                        <Text className="text-center text-xs font-black text-black">
                          Make Harder
                        </Text>
                      </Pressable>
                    </View>
                  </ScrollView>

                  <Pressable
                    onPress={() => setGoalAdjustmentsOpen(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Done reviewing current goal"
                    className="mt-4 rounded-2xl bg-green-600 px-4 py-3"
                  >
                    <Text className="text-center text-sm font-black text-white">
                      Done
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </KeyboardAvoidingView>
        </Modal>

        <DraggableFlatList
          data={filteredItems}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item, drag, isActive }) => {
            const isSelected = selectedIds.has(item.id);
            const isCustom = item.isCustom === 1;
            const habitColor =
              type === "habits" ? getHabitColor(item) : "#16A34A";

            return (
              <View
                style={
                  isActive
                    ? {
                        zIndex: 50,
                        elevation: 10,
                        opacity: 0.97,
                      }
                    : undefined
                }
                className={`mx-5 mb-3 rounded-[28px] border p-4 shadow-sm ${
                  isSelected
                    ? "border-gray-200 bg-gray-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 flex-row items-center pr-2">
                    <View
                      className="h-12 w-12 items-center justify-center rounded-2xl border bg-white"
                      style={{
                        borderColor: type === "habits" ? habitColor : "#E5E7EB",
                      }}
                    >
                      <Ionicons
                        name={
                          type === "habits"
                            ? ((item as Habit)
                                .icon as keyof typeof Ionicons.glyphMap)
                            : isCustom
                              ? "create"
                              : "sparkles"
                        }
                        size={24}
                        color={type === "habits" ? habitColor : "#000000"}
                      />
                    </View>

                    <View className="ml-3 flex-1">
                      <Text
                        className="text-base font-black text-black"
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>

                      <Text className="mt-1 text-xs font-bold uppercase tracking-wide text-gray-500">
                        {isCustom ? "Custom" : "Preset"}
                      </Text>
                    </View>
                  </View>

                  {type === "habits" || isCustom ? (
                    <Pressable
                      onPress={() => openEdit(item)}
                      className="mr-2 rounded-2xl border border-gray-300 bg-white px-3 py-2.5"
                    >
                      <Text className="font-black text-black">Edit</Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    onPress={() => toggleSelected(item.id)}
                    className={`rounded-2xl border px-3 py-2.5 ${
                      isSelected
                        ? "border-gray-300 bg-white"
                        : "border-green-600 bg-green-600"
                    }`}
                  >
                    <Text
                      className={`font-black ${
                        isSelected ? "text-black" : "text-white"
                      }`}
                    >
                      {isSelected ? "Selected" : "Select"}
                    </Text>
                  </Pressable>

                  {type === "habits" &&
                  filter === "selected" &&
                  isSelected &&
                  selectedHabits.length > 1 ? (
                    <HabitDragHandle
                      disabled={savingHabitOrder}
                      onLongPress={drag}
                    />
                  ) : null}
                </View>
              </View>
            );
          }}
          onDragBegin={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
          onDragEnd={({ data, from, to }) => {
            if (type !== "habits" || filter !== "selected" || from === to) {
              return;
            }
            const nextIds = data
              .filter((item) => selectedIds.has(item.id))
              .map((item) => item.id);
            setHabitOrderPreviewIds(nextIds);
            const save = async () => {
              await persistSelectedHabitOrder(nextIds);
              setHabitOrderPreviewIds(null);
            };
            void save();
          }}
          activationDistance={8}
          autoscrollThreshold={80}
          autoscrollSpeed={120}
          removeClippedSubviews={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={listHeader}
          contentContainerStyle={{ paddingBottom: 116 }}
          ListEmptyComponent={
            <View className="mx-5 rounded-[28px] border border-gray-200 bg-gray-50 p-5 shadow-sm">
              <View className="h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white">
                <Ionicons name="leaf" size={24} color="#000000" />
              </View>

              <Text className="mt-4 text-lg font-black text-black">
                Nothing here yet
              </Text>

              <Text className="mt-2 text-sm leading-5 text-gray-500">
                {filter === "selected"
                  ? "Select items from Preset or Custom to see them here."
                  : filter === "preset"
                    ? "No preset items found."
                    : "Add your first custom item above."}
              </Text>
            </View>
          }
        />

        <View className="absolute bottom-0 left-0 right-0 border-t border-gray-200 bg-white px-5 pb-6 pt-4">
          <Pressable
            onPress={onDone}
            className="w-full rounded-3xl bg-green-600 py-4 shadow-sm active:bg-green-700"
          >
            <View className="flex-row items-center justify-center">
              <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />

              <Text className="ml-2 text-center text-base font-black text-white">
                Done
              </Text>
            </View>
          </Pressable>
        </View>
      </Screen>
    </>
  );
}
