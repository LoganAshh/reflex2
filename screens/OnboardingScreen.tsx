import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  Alert,
  ScrollView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useData, type Habit, type Cue, type Place } from "../data/DataContext";

const CHIP_BOX_MAX_HEIGHT = 120;

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
  onInputFocus: () => void;
  onInputBlur: () => void;
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
  onInputFocus,
  onInputBlur,
}: ChipListProps<T>) {
  const [chipContentHeight, setChipContentHeight] = useState(0);

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
          <Text className="mt-0.5 text-xs font-semibold text-gray-500">
            Tap any item to add it to your Log screen.
          </Text>
        </View>
      </View>

      <View className="mt-3 max-h-[120px] rounded-[20px] border border-gray-200 bg-white p-2">
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
                    className={`text-xs font-black ${
                      isSelected ? "text-white" : "text-black"
                    }`}
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
            <Text className="mt-0.5 text-xs font-semibold text-gray-500">
              Create one that fits your real life.
            </Text>
          </View>
        </View>

        <View className="mt-3 flex-row items-center gap-2">
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#9CA3AF"
            className="flex-1 rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-black"
            returnKeyType="done"
            onFocus={onInputFocus}
            onBlur={onInputBlur}
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

  const scrollViewRef = useRef<ScrollView | null>(null);
  const didLoadInitialSelectionsRef = useRef(false);

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
  const [customInputFocused, setCustomInputFocused] = useState(false);

  const buzz = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const scrollCustomInputIntoView = () => {
    setCustomInputFocused(true);

    const setupIndex = step - setupStartIndex;
    const scrollY = setupIndex === 0 ? 250 : 180;

    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: scrollY,
        animated: true,
      });
    }, 250);
  };

  const stopCustomInputScroll = () => {
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
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setCustomInputFocused(false);
    });

    return () => {
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (didLoadInitialSelectionsRef.current) return;

    setHabitIds(selectedHabits.map((h) => h.id));
    setCueIds(selectedCues.map((c) => c.id));
    setLocationIds(selectedLocations.map((l) => l.id));
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
            body="Choose the habits you want to track first. You can always add more later."
            icon="list"
          />

          <View className="mt-3 rounded-[24px] border border-gray-200 bg-gray-50 p-3 shadow-sm">
            <View className="flex-row items-center">
              <View className="h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white">
                <Ionicons name="bulb" size={21} color="#000000" />
              </View>

              <View className="ml-3 flex-1">
                <Text className="text-sm font-black text-black">
                  Tip: Start small
                </Text>

                <Text className="mt-0.5 text-xs font-semibold leading-4 text-gray-500">
                  It’s easier to focus on one or two habits at first.
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
            onInputFocus={scrollCustomInputIntoView}
            onInputBlur={stopCustomInputScroll}
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
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <View className="flex-1 bg-white px-5">
        <ProgressBar />

        <ScrollView
          ref={scrollViewRef}
          className="flex-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          scrollEnabled={customInputFocused}
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: 8,
            paddingBottom: customInputFocused ? 110 : 8,
          }}
        >
          {renderContent()}
        </ScrollView>

        <BottomNav />
      </View>
    </KeyboardAvoidingView>
  );
}
