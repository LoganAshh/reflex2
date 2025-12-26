import React, { useMemo, useState, useEffect } from "react";
import { View, Text, Pressable, TextInput, Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { useData, type Habit, type Cue, type Place } from "../data/DataContext";

type ChipListProps<T extends { id: number; name: string; isCustom: 0 | 1 }> = {
  data: T[];
  selected: Set<number>;
  type: "habits" | "cues" | "locations";
  toggle: (id: number, type: "habits" | "cues" | "locations") => void;

  customHabit: string;
  setCustomHabit: (v: string) => void;
  customCue: string;
  setCustomCue: (v: string) => void;
  customLocation: string;
  setCustomLocation: (v: string) => void;

  onAddCustom: (type: "habits" | "cues" | "locations") => void;
};

function ChipList<T extends { id: number; name: string; isCustom: 0 | 1 }>({
  data,
  selected,
  type,
  toggle,
  customHabit,
  setCustomHabit,
  customCue,
  setCustomCue,
  customLocation,
  setCustomLocation,
  onAddCustom,
}: ChipListProps<T>) {
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

  const canAdd = value.trim().length > 0;

  return (
    <View className="w-full rounded-2xl border border-gray-200 bg-white p-4">
      <Text className="text-sm font-semibold text-gray-900">Tap to select</Text>

      <View className="mt-3 flex-row flex-wrap gap-2">
        {data.map((item) => {
          const isSelected = selected.has(item.id);
          return (
            <Pressable
              key={item.id}
              onPress={() => toggle(item.id, type)}
              className={`rounded-full border px-3 py-2 ${
                isSelected
                  ? "border-green-600 bg-green-600"
                  : "border-gray-200 bg-white"
              }`}
            >
              <Text
                className={`${
                  isSelected ? "text-white" : "text-gray-900"
                } text-sm font-semibold`}
              >
                {item.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="mt-4">
        <Text className="text-xs font-semibold text-gray-700">Add custom</Text>

        <View className="mt-2 flex-row items-center gap-3">
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#9CA3AF"
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900"
            returnKeyType="done"
          />

          <Pressable
            onPress={() => {
              if (!canAdd) return;
              onAddCustom(type);
            }}
            disabled={!canAdd}
            className={`rounded-xl px-4 py-3 ${
              canAdd ? "bg-gray-900" : "bg-white border border-gray-200"
            }`}
            style={({ pressed }) => ({
              shadowColor: canAdd ? "#000" : "transparent",
              shadowOffset: { width: 0, height: pressed ? 2 : 4 },
              shadowOpacity: canAdd ? 0.2 : 0,
              shadowRadius: pressed ? 3 : 4,
              elevation: canAdd ? (pressed ? 4 : 6) : 0,
              transform: [{ translateY: canAdd && pressed ? 1 : 0 }],
            })}
          >
            <Text
              className={`text-base font-bold ${
                canAdd ? "text-white" : "text-gray-400"
              }`}
            >
              Add
            </Text>
          </Pressable>
        </View>
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
    completeOnboarding,
  } = useData();

  // Local selections (user can toggle freely then persist at the end)
  const [habitIds, setHabitIds] = useState<number[]>([]);
  const [cueIds, setCueIds] = useState<number[]>([]);
  const [locationIds, setLocationIds] = useState<number[]>([]);

  // Custom inputs
  const [customHabit, setCustomHabit] = useState("");
  const [customCue, setCustomCue] = useState("");
  const [customLocation, setCustomLocation] = useState("");

  const [pendingHabitName, setPendingHabitName] = useState<string | null>(null);
  const [pendingCueName, setPendingCueName] = useState<string | null>(null);
  const [pendingLocationName, setPendingLocationName] = useState<string | null>(
    null
  );

  // Haptics
  const buzz = () => {
    Haptics.selectionAsync();
  };

  // Multi-step flow
  const infoSteps = useMemo(
    () => [
      {
        title: "Welcome to Reflex!",
        body: "Congratulations! You have just taken the first step towards breaking your bad habits!",
      },
      {
        title: "Did you know?",
        body: "Over time, your habits can become so automatic that you do them without even thinking, just like your body's reflexes.",
      },
      {
        title: "Why most apps\ndon’t work",
        body: "Most habit apps focus on streaks, punishment, or motivation. They tell you what you did, but not why.",
      },
      {
        title: "Patterns over Perfection",
        body: "Reflex helps you understand the triggers behind the urge, not shame you for having one.",
      },
      {
        title: "Your Privacy Matters",
        body: "Your data is stored locally on your phone. We never collect or share your personal information.",
      },
      {
        title: "Free Forever",
        body: "Reflex's essential tracking and insights will always remain 100% free. Subscriptions will be offered for optional advanced features.",
      },
    ],
    []
  );

  const setupStartIndex = infoSteps.length;
  const totalSteps = infoSteps.length + 3;
  const [step, setStep] = useState(0);

  // Initialize local selections from stored selections
  useEffect(() => {
    setHabitIds(selectedHabits.map((h) => h.id));
    setCueIds(selectedCues.map((c) => c.id));
    setLocationIds(selectedLocations.map((l) => l.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pendingHabitName) return;
    const match = habits.find(
      (h) => h.name.toLowerCase() === pendingHabitName.toLowerCase()
    );
    if (!match) return;
    setHabitIds((prev) => Array.from(new Set([...prev, match.id])));
    setPendingHabitName(null);
  }, [habits, pendingHabitName]);

  useEffect(() => {
    if (!pendingCueName) return;
    const match = cues.find(
      (c) => c.name.toLowerCase() === pendingCueName.toLowerCase()
    );
    if (!match) return;
    setCueIds((prev) => Array.from(new Set([...prev, match.id])));
    setPendingCueName(null);
  }, [cues, pendingCueName]);

  useEffect(() => {
    if (!pendingLocationName) return;
    const match = locations.find(
      (l) => l.name.toLowerCase() === pendingLocationName.toLowerCase()
    );
    if (!match) return;
    setLocationIds((prev) => Array.from(new Set([...prev, match.id])));
    setPendingLocationName(null);
  }, [locations, pendingLocationName]);

  const habitSet = useMemo(() => new Set(habitIds), [habitIds]);
  const cueSet = useMemo(() => new Set(cueIds), [cueIds]);
  const locationSet = useMemo(() => new Set(locationIds), [locationIds]);

  const toggle = (id: number, type: "habits" | "cues" | "locations") => {
    const updater =
      type === "habits"
        ? setHabitIds
        : type === "cues"
          ? setCueIds
          : setLocationIds;

    updater((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const onAddCustom = async (type: "habits" | "cues" | "locations") => {
    if (type === "habits") {
      const name = customHabit.trim();
      if (!name) return;

      setPendingHabitName(name);
      setCustomHabit("");
      await addCustomHabit(name, true);
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
  };

  const validateBeforeNext = () => {
    const habitsStepIndex = setupStartIndex;
    if (step === habitsStepIndex && habitIds.length === 0) {
      Alert.alert(
        "Pick at least one habit",
        "Select one or more habits to continue."
      );
      return false;
    }
    return true;
  };

  const goNext = () => {
    if (!validateBeforeNext()) return;
    setStep((s) => Math.min(totalSteps - 1, s + 1));
  };

  const goBack = () => setStep((s) => Math.max(0, s - 1));
  const skipToSetup = () => setStep(setupStartIndex);

  const onFinish = async () => {
    if (habitIds.length === 0) {
      Alert.alert(
        "Pick at least one habit",
        "Select one or more habits to continue."
      );
      setStep(setupStartIndex);
      return;
    }
    await setSelectedHabits(habitIds);
    await setSelectedCues(cueIds);
    await setSelectedLocations(locationIds);
    await completeOnboarding();
  };

  const ProgressBar = () => {
    const pct = ((step + 1) / totalSteps) * 100;

    return (
      <View className="mt-10">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-gray-700">
            Step {step + 1} of {totalSteps}
          </Text>

          {step < setupStartIndex ? (
            <Pressable
              onPress={() => {
                buzz();
                skipToSetup();
              }}
              className="rounded-full px-4 py-1.5"
            >
              <Text className="text-sm font-semibold text-gray-700">
                Skip to setup
              </Text>
            </Pressable>
          ) : (
            <View />
          )}
        </View>

        <View className="h-4 w-full overflow-hidden rounded-full bg-gray-200">
          <View
            style={{ width: `${pct}%` }}
            className="h-4 rounded-full bg-green-600"
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
      <View className="pb-8 pt-4 mb-10">
        <View className="flex-row items-center gap-3">
          {!isFirst ? (
            <Pressable
              onPress={() => {
                buzz();
                goBack();
              }}
              className="flex-1 rounded-2xl border border-gray-200 bg-white px-5 py-4"
              style={({ pressed }) => ({
                shadowColor: "#000",
                shadowOffset: { width: 0, height: pressed ? 1 : 4 },
                shadowOpacity: 0.18,
                shadowRadius: pressed ? 2 : 4,
                elevation: pressed ? 2 : 5,
                transform: [{ translateY: pressed ? 1 : 0 }],
              })}
            >
              <Text className="text-center text-lg font-bold text-gray-900">
                Back
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => {
              buzz();
              onPrimary();
            }}
            className={`rounded-2xl bg-green-600 px-5 py-4 ${
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
            <Text className="text-center text-lg font-bold text-white">
              {primaryText}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderContent = () => {
    if (step < infoSteps.length) {
      const s = infoSteps[step];
      return (
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-center text-4xl font-bold text-gray-900">
            {s.title}
          </Text>
          <Text className="mt-5 text-center text-lg leading-7 text-gray-700">
            {s.body}
          </Text>
        </View>
      );
    }

    const setupIndex = step - setupStartIndex;

    if (setupIndex === 0) {
      return (
        <View className="flex-1">
          <Text className="text-3xl font-bold text-gray-900">Pick habits</Text>

          <Text className="mt-3 text-sm font-semibold text-gray-700">
            Tip: Start small
          </Text>
          <Text className="mt-1 text-sm leading-6 text-gray-600">
            It’s usually easier to focus on one or two habits at first. You can
            always add more later.
          </Text>

          <View className="mt-4 flex-1">
            <ChipList<Habit>
              data={habits}
              selected={habitSet}
              type="habits"
              toggle={toggle}
              customHabit={customHabit}
              setCustomHabit={setCustomHabit}
              customCue={customCue}
              setCustomCue={setCustomCue}
              customLocation={customLocation}
              setCustomLocation={setCustomLocation}
              onAddCustom={onAddCustom}
            />
          </View>
        </View>
      );
    }

    if (setupIndex === 1) {
      return (
        <View className="flex-1">
          <Text className="text-3xl font-bold text-gray-900">Pick cues</Text>
          <Text className="mt-2 text-gray-600">
            Optional — common triggers that lead to the habit.
          </Text>

          <View className="mt-4 flex-1">
            <ChipList<Cue>
              data={cues}
              selected={cueSet}
              type="cues"
              toggle={toggle}
              customHabit={customHabit}
              setCustomHabit={setCustomHabit}
              customCue={customCue}
              setCustomCue={setCustomCue}
              customLocation={customLocation}
              setCustomLocation={setCustomLocation}
              onAddCustom={onAddCustom}
            />
          </View>
        </View>
      );
    }

    return (
      <View className="flex-1">
        <Text className="text-3xl font-bold text-gray-900">Pick locations</Text>
        <Text className="mt-2 text-gray-600">
          Optional — where it usually happens.
        </Text>

        <View className="mt-4 flex-1">
          <ChipList<Place>
            data={locations}
            selected={locationSet}
            type="locations"
            toggle={toggle}
            customHabit={customHabit}
            setCustomHabit={setCustomHabit}
            customCue={customCue}
            setCustomCue={setCustomCue}
            customLocation={customLocation}
            setCustomLocation={setCustomLocation}
            onAddCustom={onAddCustom}
          />
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-white px-6 pt-12">
      <ProgressBar />
      <View className="flex-1 pt-6">{renderContent()}</View>
      <BottomNav />
    </View>
  );
}
