import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  Alert,
  ScrollView,
  Keyboard,
  Platform,
  ActionSheetIOS,
  Modal,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { DEFAULT_HABIT_ICON, type HabitIconName } from "../data/habitIcons";
import { HabitIconPicker } from "../components/HabitIconPicker";
import { Screen } from "../components/Screen";
import {
  useData,
  type Habit,
  type Cue,
  type Place,
  type HabitPeriod,
} from "../data/DataContext";

const CHIP_BOX_MAX_HEIGHT = 136;

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

type OnboardingHabitPlan = {
  measurementType: "times" | "minutes";
  currentAmount: string;
  goalAmount: string;
  currentPeriod: HabitPeriod;
  goalPeriod: HabitPeriod;
};

const MEASUREMENT_OPTIONS = ["times", "minutes"] as const;

const PERIOD_OPTIONS: HabitPeriod[] = ["day", "week", "28_days"];

function periodLabel(period: HabitPeriod) {
  if (period === "28_days") return "Month";
  return period === "week" ? "Week" : "Day";
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

function measurementLabel(
  measurement: (typeof MEASUREMENT_OPTIONS)[number],
  amount: string,
) {
  if (Number(amount) === 1) {
    return measurement === "minutes" ? "Minute" : "Time";
  }
  return measurement === "minutes" ? "Minutes" : "Times";
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

function daysInPeriod(period: HabitPeriod) {
  if (period === "week") return 7;
  if (period === "28_days") return 28;
  return 1;
}

type ChipListProps<T extends { id: number; name: string; isCustom: 0 | 1 }> = {
  data: T[];
  selected: Set<number>;
  type: "habits" | "cues" | "locations";
  toggle: (id: number, type: "habits" | "cues" | "locations") => void;

  customHabit: string;
  setCustomHabit: (v: string) => void;
  customHabitIcon: HabitIconName;
  setCustomHabitIcon: (icon: HabitIconName) => void;
  customHabitColor: string;
  setCustomHabitColor: (color: string) => void;
  customCue: string;
  setCustomCue: (v: string) => void;
  customLocation: string;
  setCustomLocation: (v: string) => void;

  onAddCustom: (type: "habits" | "cues" | "locations") => void;
  onInputFocus: (input: TextInput | null) => void;
  onInputBlur: (input: TextInput | null) => void;
};

function getTypeIcon(
  type: "habits" | "cues" | "locations",
): keyof typeof Ionicons.glyphMap {
  if (type === "habits") return "radio-button-on";
  if (type === "cues") return "alert-circle";
  return "location";
}

function getTypeTitle(type: "habits" | "cues" | "locations") {
  if (type === "habits") return "Choose your habits";
  if (type === "cues") return "Choose your cues";
  return "Choose your locations";
}

function ChipList<T extends { id: number; name: string; isCustom: 0 | 1 }>({
  data,
  selected,
  type,
  toggle,
  customHabit,
  setCustomHabit,
  customHabitIcon,
  setCustomHabitIcon,
  customHabitColor,
  setCustomHabitColor,
  customCue,
  setCustomCue,
  customLocation,
  setCustomLocation,
  onAddCustom,
  onInputFocus,
  onInputBlur,
}: ChipListProps<T>) {
  const [chipContentHeight, setChipContentHeight] = useState(0);
  const [habitPicker, setHabitPicker] = useState<"icon" | "color" | null>(null);
  const customInputRef = useRef<TextInput | null>(null);

  const value =
    type === "habits"
      ? customHabit
      : type === "cues"
        ? customCue
        : customLocation;

  const onChangeText =
    type === "habits"
      ? setCustomHabit
      : type === "cues"
        ? setCustomCue
        : setCustomLocation;

  const placeholder =
    type === "habits"
      ? "e.g., Nail Biting"
      : type === "cues"
        ? "e.g., After coffee"
        : "e.g., Office parking lot";

  const visibleData = useMemo(() => {
    const originalRank = new Map<number, number>();

    data.forEach((item, index) => {
      originalRank.set(item.id, index);
    });

    return [...data].sort((a, b) => {
      if (a.isCustom !== b.isCustom) {
        return b.isCustom - a.isCustom;
      }

      if (a.isCustom === 1 && b.isCustom === 1) {
        return b.id - a.id;
      }

      return (originalRank.get(a.id) ?? 0) - (originalRank.get(b.id) ?? 0);
    });
  }, [data]);

  const canAdd = value.trim().length > 0;
  const hasHiddenOptions = chipContentHeight > CHIP_BOX_MAX_HEIGHT + 4;

  return (
    <View className="mt-3 w-full rounded-[26px] border border-gray-200 bg-gray-50 p-4 shadow-sm">
      <View className="flex-row items-center">
        <View className="h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white">
          <Ionicons name={getTypeIcon(type)} size={21} color="#000000" />
        </View>

        <View className="ml-3 flex-1">
          <Text className="text-base font-black text-black">
            {getTypeTitle(type)}
          </Text>
        </View>
      </View>

      <View className="mt-3 max-h-[136px] rounded-[20px] border border-gray-200 bg-white p-2">
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator={hasHiddenOptions}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={(_, height) => {
            setChipContentHeight(height);
          }}
        >
          <View className="flex-row flex-wrap gap-2 pb-1">
            {visibleData.map((item) => {
              const isSelected = selected.has(item.id);
              const selectedHabitColor =
                isSelected &&
                type === "habits" &&
                "color" in item &&
                typeof item.color === "string"
                  ? item.color
                  : null;

              return (
                <Pressable
                  key={item.id}
                  onPress={() => toggle(item.id, type)}
                  className={`flex-row items-center rounded-full border px-3 py-2 ${
                    isSelected
                      ? selectedHabitColor
                        ? ""
                        : "border-green-600 bg-green-600"
                      : "border-gray-200 bg-white"
                  }`}
                  style={
                    selectedHabitColor
                      ? {
                          backgroundColor: selectedHabitColor,
                          borderColor: selectedHabitColor,
                        }
                      : undefined
                  }
                >
                  {type === "habits" && "icon" in item ? (
                    <Ionicons
                      name={item.icon as keyof typeof Ionicons.glyphMap}
                      size={14}
                      color={isSelected ? "#FFFFFF" : "#000000"}
                    />
                  ) : null}
                  <Text
                    className={`text-xs font-black ${
                      type === "habits" ? "ml-1.5" : ""
                    } ${isSelected ? "text-white" : "text-black"}`}
                  >
                    {item.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {hasHiddenOptions ? (
        <View className="mt-2 flex-row items-center justify-center">
          <Ionicons name="chevron-down" size={14} color="#6B7280" />
          <Text className="ml-1 text-xs font-bold text-gray-500">
            Scroll inside the box to see more options
          </Text>
        </View>
      ) : null}

      <View className="mt-3 rounded-[22px] border border-gray-200 bg-white p-3">
        <View className="flex-row items-center">
          <View className="h-9 w-9 items-center justify-center rounded-2xl border border-gray-200 bg-white">
            <Ionicons name="add-circle" size={20} color="#000000" />
          </View>

          <View className="ml-3 flex-1">
            <Text className="text-sm font-black text-black">Add custom</Text>
          </View>
        </View>

        {type === "habits" ? (
          <Modal
            visible={habitPicker !== null}
            transparent
            animationType="fade"
            onRequestClose={() => setHabitPicker(null)}
          >
            <View className="flex-1 justify-center bg-black/50 px-6">
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
                      selectedIcon={customHabitIcon}
                      color={customHabitColor}
                      onSelect={(icon) => {
                        setCustomHabitIcon(icon);
                        setHabitPicker(null);
                      }}
                    />
                  </View>
                ) : (
                  <View className="mt-5 flex-row flex-wrap gap-4">
                    {HABIT_COLOR_OPTIONS.map((color) => {
                      const selected = customHabitColor === color;

                      return (
                        <Pressable
                          key={color}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setCustomHabitColor(color);
                            setHabitPicker(null);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`Choose ${HABIT_COLOR_NAMES[color]}`}
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
          </Modal>
        ) : null}

        <View className="mt-3 flex-row items-center gap-2">
          <TextInput
            ref={customInputRef}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#9CA3AF"
            className="flex-1 rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-black"
            returnKeyType="done"
            onFocus={() => onInputFocus(customInputRef.current)}
            onBlur={() => onInputBlur(customInputRef.current)}
            onSubmitEditing={() => {
              Keyboard.dismiss();
              if (type !== "habits" && canAdd) onAddCustom(type);
            }}
          />

          <Pressable
            onPress={() => {
              if (!canAdd) return;
              Keyboard.dismiss();
              if (type === "habits") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              onAddCustom(type);
            }}
            disabled={!canAdd}
            className={`rounded-2xl px-4 py-2.5 ${
              canAdd ? "bg-green-600" : "bg-gray-300"
            }`}
            style={({ pressed }) => ({
              shadowColor: canAdd ? "#000" : "transparent",
              shadowOffset: { width: 0, height: pressed ? 2 : 5 },
              shadowOpacity: canAdd ? 0.2 : 0,
              shadowRadius: pressed ? 3 : 5,
              elevation: canAdd ? (pressed ? 3 : 7) : 0,
              transform: [{ translateY: canAdd && pressed ? 1 : 0 }],
            })}
          >
            <Text className="text-sm font-black text-white">Add</Text>
          </Pressable>
        </View>

        {type === "habits" ? (
          <View className="mt-3 flex-row flex-wrap gap-2">
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                Haptics.selectionAsync();
                setHabitPicker("icon");
              }}
              accessibilityRole="button"
              accessibilityLabel="Change custom habit icon"
              className="flex-row items-center rounded-full border border-gray-200 bg-white px-3 py-2"
            >
              <Ionicons
                name={customHabitIcon}
                size={14}
                color={customHabitColor}
              />
              <Text className="ml-1.5 text-xs font-black text-black">
                Change icon
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                Haptics.selectionAsync();
                setHabitPicker("color");
              }}
              accessibilityRole="button"
              accessibilityLabel="Change custom habit color"
              className="flex-row items-center rounded-full border border-gray-200 bg-white px-3 py-2"
            >
              <View
                className="h-3.5 w-3.5 rounded-full"
                style={{ backgroundColor: customHabitColor }}
              />
              <Text className="ml-1.5 text-xs font-black text-black">
                Change color
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
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
    addCustomCue,
    addCustomLocation,
    updateHabitPlan,
    completeOnboarding,
  } = useData();

  const scrollViewRef = useRef<ScrollView | null>(null);
  const focusedCustomInputRef = useRef<TextInput | null>(null);
  const scrollOffsetRef = useRef(0);
  const amountInputRefs = useRef<Record<string, TextInput | null>>({});
  const didLoadInitialSelectionsRef = useRef(false);

  const [habitIds, setHabitIds] = useState<number[]>([]);
  const [cueIds, setCueIds] = useState<number[]>([]);
  const [locationIds, setLocationIds] = useState<number[]>([]);
  const [habitPlans, setHabitPlans] = useState<
    Record<number, OnboardingHabitPlan>
  >({});

  const [customHabit, setCustomHabit] = useState("");
  const [customHabitIcon, setCustomHabitIcon] =
    useState<HabitIconName>(DEFAULT_HABIT_ICON);
  const [customHabitColor, setCustomHabitColor] = useState("#16A34A");
  const [customCue, setCustomCue] = useState("");
  const [customLocation, setCustomLocation] = useState("");

  const [pendingHabitName, setPendingHabitName] = useState<string | null>(null);
  const [pendingCueName, setPendingCueName] = useState<string | null>(null);
  const [pendingLocationName, setPendingLocationName] = useState<string | null>(
    null,
  );
  const [customInputFocused, setCustomInputFocused] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const buzz = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const revealFocusedCustomInput = (keyboardTop: number) => {
    requestAnimationFrame(() => {
      focusedCustomInputRef.current?.measureInWindow(
        (_x, inputTop, _width, inputHeight) => {
          const clearance = 20;
          const overlap = inputTop + inputHeight + clearance - keyboardTop;

          if (overlap <= 0) return;

          scrollViewRef.current?.scrollTo({
            y: Math.max(0, scrollOffsetRef.current + overlap),
            animated: true,
          });
        },
      );
    });
  };

  const scrollCustomInputIntoView = (input: TextInput | null) => {
    focusedCustomInputRef.current = input;
    setCustomInputFocused(true);

    const keyboard = Keyboard.metrics();
    if (keyboard) revealFocusedCustomInput(keyboard.screenY);
  };

  const stopCustomInputScroll = (input: TextInput | null) => {
    if (focusedCustomInputRef.current === input) {
      focusedCustomInputRef.current = null;
    }
    setCustomInputFocused(false);
  };

  const infoSteps = useMemo(
    () => [
      {
        title: "Welcome to Reflex!",
        body: "Congratulations! You have just taken the first step toward building more intentional habits!",
        icon: "flash",
      },
      {
        title: "Did you know?",
        body: "Over time, your habits can become so automatic that you do them without even thinking, just like your body's reflexes.",
        icon: "bulb",
      },
      {
        title: "Why most apps\ndon’t work",
        body: "Most habit apps focus on streaks, punishment, or motivation. They tell you what you did, but not why it happens or how to stop.",
        icon: "close-circle",
      },
      {
        title: "Patterns over Perfection",
        body: "Reflex helps you understand what triggers the urge and gives you practical ways to respond, so you can reduce and eventually quit the habit.",
        icon: "analytics",
      },
      {
        title: "Your Privacy Matters",
        body: "Your data is stored locally on your phone. We never collect or share your personal information.",
        icon: "lock-closed",
      },
      {
        title: "Free Forever",
        body: "Reflex's essential tracking and insights will always remain 100% free. Subscriptions will be offered for optional advanced features.",
        icon: "gift",
      },
    ],
    [],
  );

  const setupStartIndex = infoSteps.length;
  const totalSteps = infoSteps.length + 4;
  const [step, setStep] = useState(0);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const showSub = Keyboard.addListener(showEvent, (event) => {
      Keyboard.scheduleLayoutAnimation(event);
      setKeyboardVisible(true);
      revealFocusedCustomInput(event.endCoordinates.screenY);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      focusedCustomInputRef.current = null;
      setCustomInputFocused(false);
      setKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (didLoadInitialSelectionsRef.current) return;

    setHabitIds(selectedHabits.map((h) => h.id));
    setCueIds(selectedCues.map((c) => c.id));
    setLocationIds(selectedLocations.map((l) => l.id));
    setHabitPlans(
      Object.fromEntries(
        selectedHabits.map((habit) => [
          habit.id,
          {
            measurementType:
              habit.measurementType === "minutes" ? "minutes" : "times",
            currentAmount: habit.estimatedBaseline?.toString() ?? "",
            goalAmount: habit.finalTarget?.toString() ?? "",
            currentPeriod: habit.baselinePeriod ?? "day",
            goalPeriod: habit.goalPeriod ?? habit.baselinePeriod ?? "day",
          },
        ]),
      ),
    );
    didLoadInitialSelectionsRef.current = true;
  }, [selectedHabits, selectedCues, selectedLocations]);

  useEffect(() => {
    if (!pendingHabitName) return;

    const match = habits.find(
      (h) => h.name.toLowerCase() === pendingHabitName.toLowerCase(),
    );

    if (!match) return;

    setHabitIds((prev) => Array.from(new Set([...prev, match.id])));
    setPendingHabitName(null);
  }, [habits, pendingHabitName]);

  useEffect(() => {
    if (!pendingCueName) return;

    const match = cues.find(
      (c) => c.name.toLowerCase() === pendingCueName.toLowerCase(),
    );

    if (!match) return;

    setCueIds((prev) => Array.from(new Set([...prev, match.id])));
    setPendingCueName(null);
  }, [cues, pendingCueName]);

  useEffect(() => {
    if (!pendingLocationName) return;

    const match = locations.find(
      (l) => l.name.toLowerCase() === pendingLocationName.toLowerCase(),
    );

    if (!match) return;

    setLocationIds((prev) => Array.from(new Set([...prev, match.id])));
    setPendingLocationName(null);
  }, [locations, pendingLocationName]);

  const habitSet = useMemo(() => new Set(habitIds), [habitIds]);
  const cueSet = useMemo(() => new Set(cueIds), [cueIds]);
  const locationSet = useMemo(() => new Set(locationIds), [locationIds]);
  const selectedHabitDetails = useMemo(
    () =>
      habitIds
        .map((id) => habits.find((habit) => habit.id === id))
        .filter((habit): habit is Habit => habit != null),
    [habitIds, habits],
  );

  const getHabitPlan = (habit: Habit): OnboardingHabitPlan =>
    habitPlans[habit.id] ?? {
      measurementType:
        habit.measurementType === "minutes" ? "minutes" : "times",
      currentAmount: habit.estimatedBaseline?.toString() ?? "",
      goalAmount: habit.finalTarget?.toString() ?? "",
      currentPeriod: habit.baselinePeriod ?? "day",
      goalPeriod: habit.goalPeriod ?? habit.baselinePeriod ?? "day",
    };

  const updateHabitPlanDraft = (
    habit: Habit,
    patch: Partial<OnboardingHabitPlan>,
  ) => {
    setHabitPlans((current) => {
      const existing = current[habit.id] ?? {
        measurementType:
          habit.measurementType === "minutes" ? "minutes" : "times",
        currentAmount: habit.estimatedBaseline?.toString() ?? "",
        goalAmount: habit.finalTarget?.toString() ?? "",
        currentPeriod: habit.baselinePeriod ?? "day",
        goalPeriod: habit.goalPeriod ?? habit.baselinePeriod ?? "day",
      };

      return {
        ...current,
        [habit.id]: { ...existing, ...patch },
      };
    });
  };

  const advanceAmountInput = (
    habitIndex: number,
    field: "current" | "goal",
  ) => {
    const currentHabit = selectedHabitDetails[habitIndex];
    if (!currentHabit) {
      Keyboard.dismiss();
      return;
    }

    const nextKey =
      field === "current"
        ? `${currentHabit.id}-goal`
        : selectedHabitDetails[habitIndex + 1]
          ? `${selectedHabitDetails[habitIndex + 1].id}-current`
          : null;

    if (!nextKey) {
      Keyboard.dismiss();
      return;
    }

    amountInputRefs.current[nextKey]?.focus();
  };

  const toggle = (id: number, type: "habits" | "cues" | "locations") => {
    buzz();

    const updater =
      type === "habits"
        ? setHabitIds
        : type === "cues"
          ? setCueIds
          : setLocationIds;

    updater((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const onAddCustom = async (type: "habits" | "cues" | "locations") => {
    try {
      if (type === "habits") {
        const name = customHabit.trim();
        if (!name) return;
        setPendingHabitName(name);
        setCustomHabit("");
        await addCustomHabit(name, true, customHabitIcon, customHabitColor);
        setCustomHabitIcon(DEFAULT_HABIT_ICON);
        setCustomHabitColor("#16A34A");
        return;
      }

      if (type === "cues") {
        const name = customCue.trim();
        if (!name) return;
        setPendingCueName(name);
        setCustomCue("");
        await addCustomCue(name, true);
        return;
      }

      const name = customLocation.trim();
      if (!name) return;
      setPendingLocationName(name);
      setCustomLocation("");
      await addCustomLocation(name, true);
    } catch (e: any) {
      Alert.alert("Already exists", e?.message ?? "That item already exists.");
    }
  };

  const validateBeforeNext = () => {
    if (step === setupStartIndex && habitIds.length === 0) {
      Alert.alert(
        "Pick at least one habit",
        "Select one or more habits to continue.",
      );
      return false;
    }

    if (step === setupStartIndex + 1) {
      for (const habit of selectedHabitDetails) {
        const plan = getHabitPlan(habit);
        const currentAmount = Number(plan.currentAmount);
        const goalAmount = Number(plan.goalAmount);

        if (
          !plan.currentAmount.trim() ||
          !Number.isFinite(currentAmount) ||
          currentAmount < 0
        ) {
          Alert.alert(
            "Add a current amount",
            `Enter a valid current amount for ${habit.name}.`,
          );
          return false;
        }

        if (
          !plan.goalAmount.trim() ||
          !Number.isFinite(goalAmount) ||
          goalAmount < 0
        ) {
          Alert.alert(
            "Add a goal amount",
            `Enter a valid goal amount for ${habit.name}.`,
          );
          return false;
        }

        const currentDaily = currentAmount / daysInPeriod(plan.currentPeriod);
        const goalDaily = goalAmount / daysInPeriod(plan.goalPeriod);
        if (goalDaily > currentDaily) {
          Alert.alert(
            "Check the goal rate",
            `${habit.name}'s goal cannot represent a higher rate than its current amount.`,
          );
          return false;
        }
      }
    }

    return true;
  };

  const resetScrollPosition = () => {
    setCustomInputFocused(false);

    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    });
  };

  const goNext = () => {
    if (!validateBeforeNext()) return;
    Keyboard.dismiss();
    setStep((s) => Math.min(totalSteps - 1, s + 1));
    resetScrollPosition();
  };

  const goBack = () => {
    Keyboard.dismiss();
    setStep((s) => Math.max(0, s - 1));
    resetScrollPosition();
  };

  const skipToSetup = () => {
    Keyboard.dismiss();
    setStep(setupStartIndex);
    resetScrollPosition();
  };

  const onFinish = async () => {
    if (habitIds.length === 0) {
      Alert.alert(
        "Pick at least one habit",
        "Select one or more habits to continue.",
      );
      setStep(setupStartIndex);
      return;
    }

    try {
      await setSelectedHabits(habitIds);
      for (const habit of selectedHabitDetails) {
        const plan = getHabitPlan(habit);
        await updateHabitPlan(habit.id, {
          measurementType: plan.measurementType,
          unit: plan.measurementType,
          estimatedBaseline: Number(plan.currentAmount),
          baselinePeriod: plan.currentPeriod,
          finalTarget: Number(plan.goalAmount),
          goalPeriod: plan.goalPeriod,
        });
      }
      await setSelectedCues(cueIds);
      await setSelectedLocations(locationIds);
      await completeOnboarding();
    } catch (error) {
      Alert.alert(
        "Could not finish setup",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  const ProgressBar = () => {
    const pct = ((step + 1) / totalSteps) * 100;

    return (
      <View className="pt-16">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-sm font-black uppercase tracking-wide text-green-600">
            Step {step + 1} of {totalSteps}
          </Text>

          {step < setupStartIndex ? (
            <Pressable
              onPress={() => {
                buzz();
                skipToSetup();
              }}
              className="rounded-full border border-gray-200 bg-white px-4 py-2 shadow-sm"
            >
              <Text className="text-sm font-black text-black">Skip setup</Text>
            </Pressable>
          ) : (
            <View className="rounded-full border border-gray-200 bg-white px-4 py-2 shadow-sm">
              <Text className="text-sm font-black text-green-600">Setup</Text>
            </View>
          )}
        </View>

        <View className="h-5 w-full overflow-hidden rounded-full bg-gray-200">
          <View
            style={{ width: `${pct}%` }}
            className="h-5 rounded-full bg-green-600"
          />
        </View>
      </View>
    );
  };

  const BottomNav = () => {
    const isFirst = step === 0;
    const isLast = step === totalSteps - 1;

    const primaryText =
      step === 0
        ? "Get Started!"
        : isLast
          ? "Finish"
          : step === infoSteps.length - 1
            ? "Start setup"
            : "Next";

    const onPrimary = isLast
      ? onFinish
      : step === infoSteps.length - 1
        ? skipToSetup
        : goNext;

    return (
      <View className="pb-8 pt-3">
        <View className="flex-row items-center gap-3">
          {!isFirst ? (
            <Pressable
              onPress={() => {
                buzz();
                goBack();
              }}
              className="flex-1 rounded-3xl border border-gray-200 bg-white px-5 py-3.5 shadow-sm"
              style={({ pressed }) => ({
                shadowColor: "#000",
                shadowOffset: { width: 0, height: pressed ? 1 : 4 },
                shadowOpacity: 0.12,
                shadowRadius: pressed ? 2 : 4,
                elevation: pressed ? 2 : 5,
                transform: [{ translateY: pressed ? 1 : 0 }],
              })}
            >
              <Text className="text-center text-base font-black text-black">
                Back
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => {
              if (isLast) {
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
              } else {
                buzz();
              }
              onPrimary();
            }}
            className={`rounded-3xl bg-green-600 px-5 py-3.5 ${
              !isFirst ? "flex-1" : "w-full"
            }`}
            style={({ pressed }) => ({
              shadowColor: "#000",
              shadowOffset: { width: 0, height: pressed ? 2 : 6 },
              shadowOpacity: 0.25,
              shadowRadius: pressed ? 3 : 6,
              elevation: pressed ? 3 : 8,
              transform: [{ translateY: pressed ? 2 : 0 }],
            })}
          >
            <View className="flex-row items-center justify-center">
              <Ionicons
                name={isLast ? "checkmark-circle" : "arrow-forward-circle"}
                size={21}
                color="#FFFFFF"
              />

              <Text className="ml-2 text-center text-base font-black text-white">
                {primaryText}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>
    );
  };

  const InfoStepCard = ({
    title,
    body,
    icon,
  }: {
    title: string;
    body: string;
    icon: keyof typeof Ionicons.glyphMap;
  }) => (
    <View className="items-center">
      <View className="rounded-full border-4 border-green-600 bg-white p-5 shadow-sm">
        <Ionicons name={icon} size={54} color="#000000" />
      </View>

      <Text className="mt-8 text-center text-4xl font-black leading-[44px] text-black">
        {title}
      </Text>

      <Text className="mt-5 px-5 text-center text-lg font-semibold leading-7 text-gray-500">
        {body}
      </Text>
    </View>
  );

  const SetupTitle = ({
    title,
    body,
    icon,
  }: {
    title: string;
    body: string;
    icon: keyof typeof Ionicons.glyphMap;
  }) => (
    <View className="items-center">
      <View className="rounded-full border-4 border-green-600 bg-white p-4 shadow-sm">
        <Ionicons name={icon} size={42} color="#000000" />
      </View>

      <Text className="mt-4 text-center text-3xl font-black leading-[36px] text-black">
        {title}
      </Text>

      <Text className="mt-2 text-center text-base font-semibold leading-6 text-gray-500">
        {body}
      </Text>
    </View>
  );

  const renderContent = () => {
    if (step < infoSteps.length) {
      const s = infoSteps[step];

      return (
        <View className="flex-1 justify-center">
          <InfoStepCard
            title={s.title}
            body={s.body}
            icon={s.icon as keyof typeof Ionicons.glyphMap}
          />
        </View>
      );
    }

    const setupIndex = step - setupStartIndex;

    if (setupIndex === 0) {
      return (
        <View className="flex-1 justify-center">
          <SetupTitle
            title="Pick habits"
            body="Tip: Start small. It’s easier to focus on one or two habits at first, and you can always add more later."
            icon="list"
          />

          <ChipList<Habit>
            data={habits}
            selected={habitSet}
            type="habits"
            toggle={toggle}
            customHabit={customHabit}
            setCustomHabit={setCustomHabit}
            customHabitIcon={customHabitIcon}
            setCustomHabitIcon={setCustomHabitIcon}
            customHabitColor={customHabitColor}
            setCustomHabitColor={setCustomHabitColor}
            customCue={customCue}
            setCustomCue={setCustomCue}
            customLocation={customLocation}
            setCustomLocation={setCustomLocation}
            onAddCustom={onAddCustom}
            onInputFocus={scrollCustomInputIntoView}
            onInputBlur={stopCustomInputScroll}
          />
        </View>
      );
    }

    if (setupIndex === 1) {
      return (
        <View className="flex-1 pt-4">
          <SetupTitle
            title="Set your starting point"
            body="Add a current and goal amount for each habit. You can change these later."
            icon="flag"
          />

          <View className="mt-5 gap-4 pb-4">
            {selectedHabitDetails.map((habit, habitIndex) => {
              const plan = getHabitPlan(habit);

              return (
                <View
                  key={habit.id}
                  className="rounded-[26px] border border-gray-200 bg-gray-50 p-4 shadow-sm"
                >
                  <View className="flex-row items-center">
                    <View
                      className="h-11 w-11 items-center justify-center rounded-2xl border bg-white"
                      style={{ borderColor: habit.color }}
                    >
                      <Ionicons
                        name={habit.icon as keyof typeof Ionicons.glyphMap}
                        size={22}
                        color={habit.color}
                      />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-base font-black text-black">
                        {habit.name}
                      </Text>
                    </View>
                  </View>

                  <View className="mt-4 gap-3">
                    <View>
                      <Text className="mb-2 text-xs font-black uppercase tracking-wide text-gray-500">
                        Current amount
                      </Text>
                      <View className="flex-row items-center rounded-2xl border border-gray-200 bg-white p-2">
                        <TextInput
                          ref={(input) => {
                            amountInputRefs.current[`${habit.id}-current`] =
                              input;
                          }}
                          value={plan.currentAmount}
                          onChangeText={(currentAmount) =>
                            updateHabitPlanDraft(habit, { currentAmount })
                          }
                          placeholder="0"
                          placeholderTextColor="#9CA3AF"
                          keyboardType={
                            Platform.OS === "ios"
                              ? "numbers-and-punctuation"
                              : "decimal-pad"
                          }
                          returnKeyType="done"
                          blurOnSubmit={false}
                          onSubmitEditing={() =>
                            advanceAmountInput(habitIndex, "current")
                          }
                          className="w-16 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-center text-black"
                        />
                        <Pressable
                          onPress={() =>
                            showMeasurementMenu(
                              plan.measurementType,
                              (measurementType) =>
                                updateHabitPlanDraft(habit, {
                                  measurementType,
                                }),
                            )
                          }
                          className="ml-2 flex-row items-center rounded-xl border border-gray-200 bg-gray-50 px-2 py-2"
                        >
                          <Text className="text-xs font-black text-black">
                            {measurementLabel(
                              plan.measurementType,
                              plan.currentAmount,
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
                            showPeriodMenu(
                              plan.currentPeriod,
                              (currentPeriod) =>
                                updateHabitPlanDraft(habit, { currentPeriod }),
                            )
                          }
                          className="w-20 flex-row items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-2 py-2"
                        >
                          <Text className="text-xs font-black text-black">
                            {periodLabel(plan.currentPeriod)}
                          </Text>
                          <Ionicons
                            name="chevron-down"
                            size={14}
                            color="#6B7280"
                          />
                        </Pressable>
                      </View>
                    </View>

                    <View>
                      <Text className="mb-2 text-xs font-black uppercase tracking-wide text-gray-500">
                        Goal amount
                      </Text>
                      <View className="flex-row items-center rounded-2xl border border-gray-200 bg-white p-2">
                        <TextInput
                          ref={(input) => {
                            amountInputRefs.current[`${habit.id}-goal`] = input;
                          }}
                          value={plan.goalAmount}
                          onChangeText={(goalAmount) =>
                            updateHabitPlanDraft(habit, { goalAmount })
                          }
                          placeholder="0"
                          placeholderTextColor="#9CA3AF"
                          keyboardType={
                            Platform.OS === "ios"
                              ? "numbers-and-punctuation"
                              : "decimal-pad"
                          }
                          returnKeyType="done"
                          blurOnSubmit={false}
                          onSubmitEditing={() =>
                            advanceAmountInput(habitIndex, "goal")
                          }
                          className="w-16 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-center text-black"
                        />
                        <Pressable
                          onPress={() =>
                            showMeasurementMenu(
                              plan.measurementType,
                              (measurementType) =>
                                updateHabitPlanDraft(habit, {
                                  measurementType,
                                }),
                            )
                          }
                          className="ml-2 flex-row items-center rounded-xl border border-gray-200 bg-gray-50 px-2 py-2"
                        >
                          <Text className="text-xs font-black text-black">
                            {measurementLabel(
                              plan.measurementType,
                              plan.goalAmount,
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
                            showPeriodMenu(plan.goalPeriod, (goalPeriod) =>
                              updateHabitPlanDraft(habit, { goalPeriod }),
                            )
                          }
                          className="w-20 flex-row items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-2 py-2"
                        >
                          <Text className="text-xs font-black text-black">
                            {periodLabel(plan.goalPeriod)}
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
                </View>
              );
            })}
          </View>
        </View>
      );
    }

    if (setupIndex === 2) {
      return (
        <View className="flex-1 justify-center">
          <SetupTitle
            title="Pick cues"
            body="Cues are the triggers that usually show up before the urge."
            icon="alert-circle"
          />

          <ChipList<Cue>
            data={cues}
            selected={cueSet}
            type="cues"
            toggle={toggle}
            customHabit={customHabit}
            setCustomHabit={setCustomHabit}
            customHabitIcon={customHabitIcon}
            setCustomHabitIcon={setCustomHabitIcon}
            customHabitColor={customHabitColor}
            setCustomHabitColor={setCustomHabitColor}
            customCue={customCue}
            setCustomCue={setCustomCue}
            customLocation={customLocation}
            setCustomLocation={setCustomLocation}
            onAddCustom={onAddCustom}
            onInputFocus={scrollCustomInputIntoView}
            onInputBlur={stopCustomInputScroll}
          />
        </View>
      );
    }

    return (
      <View className="flex-1 justify-center">
        <SetupTitle
          title="Pick locations"
          body="Locations help you see where certain patterns happen most often."
          icon="location"
        />

        <ChipList<Place>
          data={locations}
          selected={locationSet}
          type="locations"
          toggle={toggle}
          customHabit={customHabit}
          setCustomHabit={setCustomHabit}
          customHabitIcon={customHabitIcon}
          setCustomHabitIcon={setCustomHabitIcon}
          customHabitColor={customHabitColor}
          setCustomHabitColor={setCustomHabitColor}
          customCue={customCue}
          setCustomCue={setCustomCue}
          customLocation={customLocation}
          setCustomLocation={setCustomLocation}
          onAddCustom={onAddCustom}
          onInputFocus={scrollCustomInputIntoView}
          onInputBlur={stopCustomInputScroll}
        />
      </View>
    );
  };

  return (
    <Screen
      keyboardAvoiding
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      className="px-5"
    >
      <ProgressBar />

      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        scrollEnabled={step >= setupStartIndex}
        scrollEventThrottle={16}
        onScroll={(event) => {
          scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
        }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: 8,
          paddingBottom: customInputFocused ? 30 : 8,
        }}
      >
        {renderContent()}
      </ScrollView>

      {!keyboardVisible ? (
        <BottomNav />
      ) : Platform.OS === "ios" && step === setupStartIndex + 1 ? (
        <View className="flex-row justify-end border-t border-gray-200 bg-gray-50 px-4 py-2">
          <Pressable
            onPress={() => Keyboard.dismiss()}
            accessibilityRole="button"
            accessibilityLabel="Dismiss keyboard"
            className="flex-row items-center rounded-xl px-3 py-1.5"
          >
            <Ionicons name="chevron-down" size={18} color="#007AFF" />
            <Text
              className="ml-1 text-base font-bold"
              style={{ color: "#007AFF" }}
            >
              Hide Keyboard
            </Text>
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}
