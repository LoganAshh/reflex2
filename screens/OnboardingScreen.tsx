import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  Alert,
  ScrollView,
  Keyboard,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
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
    <View className="mt-5 w-full rounded-[28px] border border-gray-200 bg-gray-50 p-5 shadow-sm">
      <View className="flex-row items-center">
        <View className="h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white">
          <Ionicons name={getTypeIcon(type)} size={23} color="#000000" />
        </View>

        <View className="ml-3 flex-1">
          <Text className="text-base font-black text-black">
            {getTypeTitle(type)}
          </Text>
          <Text className="mt-1 text-sm font-semibold text-gray-500">
            Tap any item to add it to your Log screen.
          </Text>
        </View>
      </View>

      <View className="mt-4 flex-row flex-wrap gap-2">
        {data.map((item) => {
          const isSelected = selected.has(item.id);

          return (
            <Pressable
              key={item.id}
              onPress={() => toggle(item.id, type)}
              className={`rounded-full border px-4 py-2.5 ${
                isSelected
                  ? "border-green-600 bg-green-600"
                  : "border-gray-200 bg-white"
              }`}
            >
              <Text
                className={`text-sm font-black ${
                  isSelected ? "text-white" : "text-black"
                }`}
              >
                {item.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="mt-5 rounded-[24px] border border-gray-200 bg-white p-4">
        <View className="flex-row items-center">
          <View className="h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white">
            <Ionicons name="add-circle" size={22} color="#000000" />
          </View>

          <View className="ml-3 flex-1">
            <Text className="text-sm font-black text-black">Add custom</Text>
            <Text className="mt-0.5 text-xs font-semibold text-gray-500">
              Create one that fits your real life.
            </Text>
          </View>
        </View>

        <View className="mt-3 flex-row items-center gap-3">
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#9CA3AF"
            className="flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-black"
            returnKeyType="done"
            onSubmitEditing={() => {
              if (canAdd) onAddCustom(type);
            }}
          />

          <Pressable
            onPress={() => {
              if (!canAdd) return;
              Keyboard.dismiss();
              onAddCustom(type);
            }}
            disabled={!canAdd}
            className={`rounded-2xl px-4 py-3 ${
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
            <Text className="text-base font-black text-white">Add</Text>
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

  const [habitIds, setHabitIds] = useState<number[]>([]);
  const [cueIds, setCueIds] = useState<number[]>([]);
  const [locationIds, setLocationIds] = useState<number[]>([]);

  const [customHabit, setCustomHabit] = useState("");
  const [customCue, setCustomCue] = useState("");
  const [customLocation, setCustomLocation] = useState("");

  const [pendingHabitName, setPendingHabitName] = useState<string | null>(null);
  const [pendingCueName, setPendingCueName] = useState<string | null>(null);
  const [pendingLocationName, setPendingLocationName] = useState<string | null>(
    null,
  );

  const buzz = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
        body: "Most habit apps focus on streaks, punishment, or motivation. They tell you what you did, but not why.",
        icon: "close-circle",
      },
      {
        title: "Patterns over Perfection",
        body: "Reflex helps you understand the triggers behind the urge, not shame you for having one.",
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
  const totalSteps = infoSteps.length + 3;
  const [step, setStep] = useState(0);

  useEffect(() => {
    setHabitIds(selectedHabits.map((h) => h.id));
    setCueIds(selectedCues.map((c) => c.id));
    setLocationIds(selectedLocations.map((l) => l.id));
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
        "Select one or more habits to continue.",
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
      <View className="pb-8 pt-4">
        <View className="flex-row items-center gap-3">
          {!isFirst ? (
            <Pressable
              onPress={() => {
                buzz();
                goBack();
              }}
              className="flex-1 rounded-3xl border border-gray-200 bg-white px-5 py-4 shadow-sm"
              style={({ pressed }) => ({
                shadowColor: "#000",
                shadowOffset: { width: 0, height: pressed ? 1 : 4 },
                shadowOpacity: 0.12,
                shadowRadius: pressed ? 2 : 4,
                elevation: pressed ? 2 : 5,
                transform: [{ translateY: pressed ? 1 : 0 }],
              })}
            >
              <Text className="text-center text-lg font-black text-black">
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
            className={`rounded-3xl bg-green-600 px-5 py-4 ${
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
                size={22}
                color="#FFFFFF"
              />

              <Text className="ml-2 text-center text-lg font-black text-white">
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

      <Text className="mt-5 text-center text-lg font-semibold leading-7 text-gray-500">
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
      <View className="rounded-full border-4 border-green-600 bg-white p-5 shadow-sm">
        <Ionicons name={icon} size={54} color="#000000" />
      </View>

      <Text className="mt-8 text-center text-4xl font-black leading-[44px] text-black">
        {title}
      </Text>

      <Text className="mt-5 text-center text-lg font-semibold leading-7 text-gray-500">
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
            body="Choose the habits you want to track first. You can always add more later."
            icon="list"
          />

          <View className="mt-6 rounded-[28px] border border-gray-200 bg-gray-50 p-5 shadow-sm">
            <View className="flex-row items-center">
              <View className="h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white">
                <Ionicons name="bulb" size={24} color="#000000" />
              </View>

              <View className="ml-3 flex-1">
                <Text className="text-base font-black text-black">
                  Tip: Start small
                </Text>

                <Text className="mt-1 text-sm leading-5 text-gray-500">
                  It’s usually easier to focus on one or two habits at first.
                </Text>
              </View>
            </View>
          </View>

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
      );
    }

    if (setupIndex === 1) {
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
            customCue={customCue}
            setCustomCue={setCustomCue}
            customLocation={customLocation}
            setCustomLocation={setCustomLocation}
            onAddCustom={onAddCustom}
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
          customCue={customCue}
          setCustomCue={setCustomCue}
          customLocation={customLocation}
          setCustomLocation={setCustomLocation}
          onAddCustom={onAddCustom}
        />
      </View>
    );
  };

  return (
    <View className="flex-1 bg-white px-5">
      <ProgressBar />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: 12,
          paddingBottom: 12,
        }}
      >
        {renderContent()}
      </ScrollView>

      <BottomNav />
    </View>
  );
}