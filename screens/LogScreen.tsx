import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Switch,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import {
  useData,
  type SelectedHabit,
  type SelectedCue,
  type SelectedPlace,
} from "../data/DataContext";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type ChipItem = {
  key: string;
  label: string;
  id: number | null;
  kind: "value" | "none" | "add";
};

function moveIdToFront<T extends { id: number }>(
  items: T[],
  pinnedId: number | null
) {
  if (pinnedId == null) return items;
  const idx = items.findIndex((x) => x.id === pinnedId);
  if (idx <= 0) return items; // already first or not found
  const picked = items[idx];
  return [picked, ...items.slice(0, idx), ...items.slice(idx + 1)];
}

export default function LogScreen() {
  const navigation = useNavigation<Nav>();
  const { selectedHabits, selectedCues, selectedLocations, addLog } = useData();

  const [habitId, setHabitId] = useState<number | null>(null);
  const [cueId, setCueId] = useState<number | null>(null);
  const [locationId, setLocationId] = useState<number | null>(null);

  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [intensity, setIntensity] = useState<number>(5);
  const [didResist, setDidResist] = useState<boolean>(false);

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // "Pinned" = last successfully submitted selection (reorders ONLY after submit).
  const [pinnedHabitId, setPinnedHabitId] = useState<number | null>(null);
  const [pinnedCueId, setPinnedCueId] = useState<number | null>(null);
  const [pinnedLocationId, setPinnedLocationId] = useState<number | null>(null);

  const orderedHabits = useMemo(
    () => moveIdToFront(selectedHabits, pinnedHabitId),
    [selectedHabits, pinnedHabitId]
  );
  const orderedCues = useMemo(
    () => moveIdToFront(selectedCues, pinnedCueId),
    [selectedCues, pinnedCueId]
  );
  const orderedLocations = useMemo(
    () => moveIdToFront(selectedLocations, pinnedLocationId),
    [selectedLocations, pinnedLocationId]
  );

  useEffect(() => {
    if (habitId == null && selectedHabits.length > 0) {
      setHabitId(selectedHabits[0].id);
    }
  }, [selectedHabits, habitId]);

  const resetForm = () => {
    setCueId(null);
    setLocationId(null);
    setNotes("");
    setShowNotes(false);
    setIntensity(5);
    setDidResist(false);
  };

  const onSave = async () => {
    setErrorMsg(null);
    setSavedMsg(null);

    if (habitId == null) {
      setErrorMsg("Select a habit.");
      return;
    }

    // Capture what was selected for THIS submission (so we can reorder after success).
    const submittedHabitId = habitId;
    const submittedCueId = cueId;
    const submittedLocationId = locationId;

    try {
      setSaving(true);
      await addLog({
        habitId: submittedHabitId,
        cueId: submittedCueId,
        locationId: submittedLocationId,
        intensity,
        didResist,
        notes: notes.trim() || undefined,
      });

      // Reorder only AFTER submit.
      setPinnedHabitId(submittedHabitId);

      // Exclude "None" (null) from pinning; "None" chips always stay far left.
      if (submittedCueId != null) setPinnedCueId(submittedCueId);
      if (submittedLocationId != null) setPinnedLocationId(submittedLocationId);

      resetForm();
      setSavedMsg("Saved ✅");
      setTimeout(() => setSavedMsg(null), 900);
    } catch {
      setErrorMsg("Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const IntensityRow = () => (
    <View className="mt-3 w-full flex-row items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3">
      <Text className="text-sm font-semibold text-gray-900">Intensity</Text>

      <View className="flex-row items-center">
        <Pressable
          disabled={intensity <= 1}
          onPress={() => setIntensity((v) => Math.max(1, v - 1))}
          className={`rounded-xl px-3 py-2 ${
            intensity <= 1 ? "bg-gray-200" : "bg-gray-900"
          }`}
        >
          <Text
            className={`${
              intensity <= 1 ? "text-gray-600" : "text-white"
            } font-semibold`}
          >
            −
          </Text>
        </Pressable>

        <Text className="mx-3 text-base font-bold text-gray-900">
          {intensity}
        </Text>

        <Pressable
          disabled={intensity >= 10}
          onPress={() => setIntensity((v) => Math.min(10, v + 1))}
          className={`rounded-xl px-3 py-2 ${
            intensity >= 10 ? "bg-gray-200" : "bg-gray-900"
          }`}
        >
          <Text
            className={`${
              intensity >= 10 ? "text-gray-600" : "text-white"
            } font-semibold`}
          >
            +
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const ChipRow = <T extends { id: number; name: string }>({
    title,
    items,
    selectedId,
    onSelect,
    allowNone,
    addType,
  }: {
    title: string;
    items: T[];
    selectedId: number | null;
    onSelect: (id: number | null) => void;
    allowNone?: boolean;
    addType: "habits" | "cues" | "locations";
  }) => {
    const data: ChipItem[] = [
      ...(allowNone
        ? [{ key: "none", label: "None", id: null, kind: "none" as const }]
        : []),
      ...items.map((x) => ({
        key: `v-${x.id}`,
        label: x.name,
        id: x.id,
        kind: "value" as const,
      })),
      { key: "add", label: "+ Add", id: null, kind: "add" as const },
    ];

    const renderItem = ({ item }: { item: ChipItem }) => {
      const isSelected =
        item.kind === "none"
          ? selectedId == null
          : item.kind === "value"
            ? item.id === selectedId
            : false;

      const base = "mr-2 rounded-full border px-4 py-2";
      const selected = "bg-green-600 border-green-600";
      const unselected = "bg-white border-gray-200";
      const addStyle = "bg-white border-gray-200";

      return (
        <Pressable
          onPress={() => {
            if (item.kind === "add") {
              navigation.navigate("ManageList", { type: addType });
              return;
            }
            onSelect(item.id);
          }}
          className={`${base} ${
            item.kind === "add" ? addStyle : isSelected ? selected : unselected
          }`}
        >
          <Text
            className={`text-sm font-semibold ${
              item.kind === "add"
                ? "text-gray-900"
                : isSelected
                  ? "text-white"
                  : "text-gray-900"
            }`}
            numberOfLines={1}
          >
            {item.label}
          </Text>
        </Pressable>
      );
    };

    return (
      <View className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3">
        <Text className="text-sm font-semibold text-gray-900">{title}</Text>

        <FlatList
          className="mt-2"
          horizontal
          showsHorizontalScrollIndicator={false}
          data={data}
          keyExtractor={(x) => x.key}
          renderItem={renderItem}
        />
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-white"
    >
      <View className="flex-1 px-5 pt-8">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-gray-900">Log</Text>
        </View>

        <View className="mt-4 w-full rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <ChipRow<SelectedHabit>
            title="Habit"
            items={orderedHabits}
            selectedId={habitId}
            onSelect={setHabitId}
            addType="habits"
          />

          <ChipRow<SelectedCue>
            title="Cue"
            items={orderedCues}
            selectedId={cueId}
            onSelect={setCueId}
            allowNone
            addType="cues"
          />

          <ChipRow<SelectedPlace>
            title="Location"
            items={orderedLocations}
            selectedId={locationId}
            onSelect={setLocationId}
            allowNone
            addType="locations"
          />

          <IntensityRow />

          <View className="mt-3 w-full flex-row items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3">
            <Text className="text-sm font-semibold text-gray-900">
              Resisted?
            </Text>
            <Switch value={didResist} onValueChange={setDidResist} />
          </View>

          <Pressable
            onPress={() => setShowNotes((v) => !v)}
            className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3"
          >
            <Text className="text-sm font-semibold text-gray-900">
              {showNotes ? "Hide notes" : "Add notes (optional)"}
            </Text>
          </Pressable>

          {showNotes ? (
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything useful to remember…"
              placeholderTextColor="#9CA3AF"
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-gray-900"
            />
          ) : null}

          {errorMsg ? (
            <Text className="mt-2 text-sm font-semibold text-red-600">
              {errorMsg}
            </Text>
          ) : null}

          {savedMsg ? (
            <Text className="mt-2 text-sm font-semibold text-green-700">
              {savedMsg}
            </Text>
          ) : null}

          <Pressable
            onPress={onSave}
            disabled={saving}
            className={`mt-3 w-full rounded-2xl px-5 py-3.5 ${
              saving ? "bg-green-300" : "bg-green-600"
            }`}
          >
            <Text className="text-center text-base font-semibold text-white">
              {saving ? "Saving..." : "Save"}
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
