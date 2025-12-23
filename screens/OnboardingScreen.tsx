import { useMemo, useState, useEffect } from "react";
import { View, Text, Pressable, TextInput, Alert } from "react-native";
import { useData, type Habit, type Cue, type Place } from "../data/DataContext";

type Section = "habits" | "cues" | "locations";

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
  } = useData();

  // Local selections (user can toggle freely then persist at the end)
  const [habitIds, setHabitIds] = useState<number[]>([]);
  const [cueIds, setCueIds] = useState<number[]>([]);
  const [locationIds, setLocationIds] = useState<number[]>([]);

  // Custom inputs
  const [customHabit, setCustomHabit] = useState("");
  const [customCue, setCustomCue] = useState("");
  const [customLocation, setCustomLocation] = useState("");

  // Multi-step flow
  const infoSteps = useMemo(
    () => [
      {
        title: "Welcome to Reflex",
        body: "Reflex is built for quick, low-friction logging. The goal is to catch patterns early — not make you fill out a survey every time you slip.",
      },
      {
        title: "Private by default",
        body: "Your data stays on your device (SQLite). No account required. You stay in control of sensitive logs and personal patterns.",
      },
      {
        title: "Pattern-first insights",
        body: "Instead of just counting streaks, Reflex helps you connect the dots: what you did, what triggered it, and where it happened — so you can actually change the system around you.",
      },
    ],
    []
  );

  const setupStartIndex = infoSteps.length; // first of last 3 steps
  const totalSteps = infoSteps.length + 3; // + habits, cues, locations
  const [step, setStep] = useState(0);

  // Initialize local selections from stored selections
  useEffect(() => {
    setHabitIds(selectedHabits.map((h) => h.id));
    setCueIds(selectedCues.map((c) => c.id));
    setLocationIds(selectedLocations.map((l) => l.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const habitSet = useMemo(() => new Set(habitIds), [habitIds]);
  const cueSet = useMemo(() => new Set(cueIds), [cueIds]);
  const locationSet = useMemo(() => new Set(locationIds), [locationIds]);

  const toggle = (id: number, type: Section) => {
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

  const onAddCustom = async (type: Section) => {
    if (type === "habits") {
      const name = customHabit.trim();
      if (!name) return;
      await addCustomHabit(name, true);
      setCustomHabit("");
      const match = habits.find(
        (h) => h.name.toLowerCase() === name.toLowerCase()
      );
      if (match)
        setHabitIds((prev) => Array.from(new Set([...prev, match.id])));
      return;
    }

    if (type === "cues") {
      const name = customCue.trim();
      if (!name) return;
      await addCustomCue(name, true);
      setCustomCue("");
      const match = cues.find(
        (c) => c.name.toLowerCase() === name.toLowerCase()
      );
      if (match) setCueIds((prev) => Array.from(new Set([...prev, match.id])));
      return;
    }

    const name = customLocation.trim();
    if (!name) return;
    await addCustomLocation(name, true);
    setCustomLocation("");
    const match = locations.find(
      (l) => l.name.toLowerCase() === name.toLowerCase()
    );
    if (match)
      setLocationIds((prev) => Array.from(new Set([...prev, match.id])));
  };

  const validateBeforeNext = () => {
    // Only enforce "at least one habit" once user reaches/leaves the Habits step
    const habitsStepIndex = setupStartIndex; // first setup step
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
    // App.tsx gate will switch to tabs automatically via hasOnboarded
  };

  const ProgressBar = () => {
    const pct = ((step + 1) / totalSteps) * 100;

    return (
      <View className="mb-6">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-semibold text-gray-600">
            Step {step + 1} of {totalSteps}
          </Text>

          {step < setupStartIndex ? (
            <Pressable onPress={skipToSetup} className="rounded-full px-3 py-1">
              <Text className="text-xs font-semibold text-gray-900">
                Skip to setup
              </Text>
            </Pressable>
          ) : (
            <View />
          )}
        </View>

        <View className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <View
            style={{ width: `${pct}%` }}
            className="h-2 rounded-full bg-green-600"
          />
        </View>

        {step >= setupStartIndex ? (
          <Text className="mt-2 text-xs text-gray-500">
            Setup remaining: {totalSteps - step} step
            {totalSteps - step === 1 ? "" : "s"}
          </Text>
        ) : null}
      </View>
    );
  };

  const ChipList = <T extends { id: number; name: string; isCustom: 0 | 1 }>({
    data,
    selected,
    type,
  }: {
    data: T[];
    selected: Set<number>;
    type: Section;
  }) => (
    <View className="mt-4 w-full rounded-2xl border border-gray-200 bg-white p-4">
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
                className={`${isSelected ? "text-white" : "text-gray-900"} text-sm font-semibold`}
              >
                {item.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Add custom */}
      <View className="mt-4">
        <Text className="text-xs font-semibold text-gray-700">Add custom</Text>

        <View className="mt-2 flex-row items-center gap-3">
          <TextInput
            value={
              type === "habits"
                ? customHabit
                : type === "cues"
                  ? customCue
                  : customLocation
            }
            onChangeText={
              type === "habits"
                ? setCustomHabit
                : type === "cues"
                  ? setCustomCue
                  : setCustomLocation
            }
            placeholder={
              type === "habits"
                ? "e.g., nail biting"
                : type === "cues"
                  ? "e.g., after coffee"
                  : "e.g., office parking lot"
            }
            placeholderTextColor="#9CA3AF"
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900"
          />
          <Pressable
            onPress={() => onAddCustom(type)}
            className="rounded-xl bg-gray-900 px-4 py-3"
          >
            <Text className="font-semibold text-white">Add</Text>
          </Pressable>
        </View>

        <Text className="mt-2 text-xs text-gray-500">
          Custom items are saved locally on your device.
        </Text>
      </View>
    </View>
  );

  const StepNav = ({
    primaryText,
    onPrimary,
    showBack,
  }: {
    primaryText: string;
    onPrimary: () => void;
    showBack: boolean;
  }) => (
    <View className="mt-6 flex-row items-center gap-3">
      {showBack ? (
        <Pressable
          onPress={goBack}
          className="flex-1 rounded-2xl border border-gray-200 bg-white px-5 py-4"
        >
          <Text className="text-center text-base font-semibold text-gray-900">
            Back
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        onPress={onPrimary}
        className={`rounded-2xl bg-green-600 px-5 py-4 ${showBack ? "flex-1" : "w-full"}`}
      >
        <Text className="text-center text-base font-semibold text-white">
          {primaryText}
        </Text>
      </Pressable>
    </View>
  );

  const renderStep = () => {
    // Info steps (0..infoSteps.length-1)
    if (step < infoSteps.length) {
      const s = infoSteps[step];
      return (
        <View className="mt-4">
          <Text className="text-3xl font-bold text-gray-900">{s.title}</Text>
          <Text className="mt-3 text-base leading-6 text-gray-600">
            {s.body}
          </Text>

          <View className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <Text className="text-sm font-semibold text-gray-900">
              What you’ll do next
            </Text>
            <Text className="mt-2 text-sm text-gray-600">
              Pick the habits you want to track, then optionally add cues and
              locations to make patterns obvious.
            </Text>
          </View>

          <StepNav
            primaryText={step === infoSteps.length - 1 ? "Start setup" : "Next"}
            onPrimary={step === infoSteps.length - 1 ? skipToSetup : goNext}
            showBack={step !== 0}
          />
        </View>
      );
    }

    // Setup steps
    const setupIndex = step - setupStartIndex; // 0=habits, 1=cues, 2=locations

    if (setupIndex === 0) {
      return (
        <View className="mt-2">
          <Text className="text-3xl font-bold text-gray-900">Pick habits</Text>
          <Text className="mt-2 text-gray-600">
            Required — choose at least one.
          </Text>

          <ChipList<Habit> data={habits} selected={habitSet} type="habits" />

          <Text className="mt-3 text-xs text-gray-500">
            Tip: start small. You can always add more later.
          </Text>

          <StepNav primaryText="Next" onPrimary={goNext} showBack />
        </View>
      );
    }

    if (setupIndex === 1) {
      return (
        <View className="mt-2">
          <Text className="text-3xl font-bold text-gray-900">Pick cues</Text>
          <Text className="mt-2 text-gray-600">
            Optional — common triggers that lead to the habit.
          </Text>

          <ChipList<Cue> data={cues} selected={cueSet} type="cues" />

          <StepNav primaryText="Next" onPrimary={goNext} showBack />
        </View>
      );
    }

    // setupIndex === 2
    return (
      <View className="mt-2">
        <Text className="text-3xl font-bold text-gray-900">Pick locations</Text>
        <Text className="mt-2 text-gray-600">
          Optional — where it usually happens.
        </Text>

        <ChipList<Place>
          data={locations}
          selected={locationSet}
          type="locations"
        />

        <Pressable
          onPress={onFinish}
          className="mt-6 w-full rounded-2xl bg-green-600 px-5 py-4"
        >
          <Text className="text-center text-lg font-semibold text-white">
            Finish
          </Text>
        </Pressable>

        <Pressable
          onPress={goBack}
          className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-5 py-4"
        >
          <Text className="text-center text-base font-semibold text-gray-900">
            Back
          </Text>
        </Pressable>

        <Text className="mb-6 mt-4 text-center text-xs text-gray-500">
          Data stays on-device (SQLite). You can add export/backup later.
        </Text>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-white px-6 pt-12">
      <ProgressBar />
      {renderStep()}
    </View>
  );
}
