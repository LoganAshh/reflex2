import { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  Alert,
} from "react-native";
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

  // Local selections (user can toggle freely then persist on Continue)
  const [habitIds, setHabitIds] = useState<number[]>([]);
  const [cueIds, setCueIds] = useState<number[]>([]);
  const [locationIds, setLocationIds] = useState<number[]>([]);

  // Custom inputs
  const [customHabit, setCustomHabit] = useState("");
  const [customCue, setCustomCue] = useState("");
  const [customLocation, setCustomLocation] = useState("");

  // Which section is currently expanded (keeps page compact)
  const [open, setOpen] = useState<Section>("habits");

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
      // Optimistically keep local selection consistent by selecting the matching item if present
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

  const onContinue = async () => {
    if (habitIds.length === 0) {
      Alert.alert(
        "Pick at least one habit",
        "Select one or more habits to continue."
      );
      setOpen("habits");
      return;
    }

    // Persist selections
    await setSelectedHabits(habitIds);
    await setSelectedCues(cueIds);
    await setSelectedLocations(locationIds);
    // App.tsx gate will switch to tabs automatically via hasOnboarded
  };

  const SectionHeader = ({
    title,
    subtitle,
    count,
    type,
  }: {
    title: string;
    subtitle: string;
    count: number;
    type: Section;
  }) => (
    <Pressable
      onPress={() => setOpen(type)}
      className={`mt-4 w-full rounded-2xl border px-4 py-4 ${
        open === type
          ? "border-green-600 bg-green-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <View className="flex-row items-center justify-between">
        <View className="pr-4">
          <Text className="text-base font-semibold text-gray-900">{title}</Text>
          <Text className="mt-1 text-xs text-gray-600">{subtitle}</Text>
        </View>

        <View className="items-end">
          <Text className="text-sm font-bold text-gray-900">{count}</Text>
          <Text className="text-xs text-gray-500">selected</Text>
        </View>
      </View>
    </Pressable>
  );

  const ChipList = <T extends { id: number; name: string; isCustom: 0 | 1 }>({
    data,
    selected,
    type,
  }: {
    data: T[];
    selected: Set<number>;
    type: Section;
  }) => (
    <View className="mt-3 w-full rounded-2xl border border-gray-200 bg-white p-4">
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
                  ? "bg-green-600 border-green-600"
                  : "bg-white border-gray-200"
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

  // For compactness: show one section expanded at a time.
  return (
    <View className="flex-1 bg-white px-6 pt-12">
      <Text className="text-3xl font-bold text-gray-900">Set up</Text>
      <Text className="mt-2 text-gray-600">
        Choose what you want to track. You can change these later.
      </Text>

      {/* Habits */}
      <SectionHeader
        title="Habits"
        subtitle="Required (pick at least 1)"
        count={habitIds.length}
        type="habits"
      />
      {open === "habits" ? (
        <ChipList<Habit> data={habits} selected={habitSet} type="habits" />
      ) : null}

      {/* Cues */}
      <SectionHeader
        title="Cues"
        subtitle="Optional (common triggers)"
        count={cueIds.length}
        type="cues"
      />
      {open === "cues" ? (
        <ChipList<Cue> data={cues} selected={cueSet} type="cues" />
      ) : null}

      {/* Locations */}
      <SectionHeader
        title="Locations"
        subtitle="Optional (where it happens)"
        count={locationIds.length}
        type="locations"
      />
      {open === "locations" ? (
        <ChipList<Place>
          data={locations}
          selected={locationSet}
          type="locations"
        />
      ) : null}

      {/* Continue */}
      <Pressable
        onPress={onContinue}
        className="mb-8 mt-6 w-full rounded-2xl bg-green-600 px-5 py-4"
      >
        <Text className="text-center text-lg font-semibold text-white">
          Continue
        </Text>
      </Pressable>

      <Text className="mb-6 text-center text-xs text-gray-500">
        Data stays on-device (SQLite). You can add export/backup later.
      </Text>
    </View>
  );
}
