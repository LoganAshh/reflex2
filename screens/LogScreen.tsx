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
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { RootTabParamList } from "../App";
import {
  useData,
  type LogEntry,
  type SelectedHabit,
  type SelectedCue,
  type SelectedPlace,
} from "../data/DataContext";

type Nav = BottomTabNavigationProp<RootTabParamList>;

export default function LogScreen() {
  const navigation = useNavigation<Nav>();

  const {
    selectedHabits,
    selectedCues,
    selectedLocations,
    logs,
    addLog,
    addCustomCue,
    addCustomLocation,
  } = useData();

  // ----- required selection -----
  const [habitId, setHabitId] = useState<number | null>(null);

  // ----- optional selections -----
  const [cueId, setCueId] = useState<number | null>(null);
  const [locationId, setLocationId] = useState<number | null>(null);

  // ---- Form State ----
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [intensity, setIntensity] = useState<number>(5);
  const [didResist, setDidResist] = useState<boolean>(false);

  // ---- UX State ----
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showRecent, setShowRecent] = useState(false);

  // custom cue/location
  const [showAddCue, setShowAddCue] = useState(false);
  const [customCue, setCustomCue] = useState("");
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [customLocation, setCustomLocation] = useState("");

  const recentLogs = useMemo(() => logs.slice(0, 10), [logs]);

  // Set defaults once lists load
  useEffect(() => {
    if (habitId == null && selectedHabits.length > 0)
      setHabitId(selectedHabits[0].id);
  }, [selectedHabits, habitId]);

  // If selected cues/locations are empty, keep null (means "None")
  useEffect(() => {
    // keep current selection if still valid
    if (cueId != null && !selectedCues.some((c) => c.id === cueId))
      setCueId(null);
  }, [selectedCues, cueId]);

  useEffect(() => {
    if (
      locationId != null &&
      !selectedLocations.some((l) => l.id === locationId)
    )
      setLocationId(null);
  }, [selectedLocations, locationId]);

  const resetForm = () => {
    setCueId(null);
    setLocationId(null);
    setNotes("");
    setShowNotes(false);
    setIntensity(5);
    setDidResist(false);
    setShowAddCue(false);
    setCustomCue("");
    setShowAddLocation(false);
    setCustomLocation("");
  };

  const onSave = async () => {
    setErrorMsg(null);
    setSavedMsg(null);

    if (habitId == null) {
      setErrorMsg("Select a habit.");
      return;
    }

    try {
      setSaving(true);

      await addLog({
        habitId,
        cueId,
        locationId,
        intensity,
        didResist,
        notes: notes.trim() || undefined,
      });

      resetForm();
      setSavedMsg("Saved ✅");
      setTimeout(() => setSavedMsg(null), 900);

      // Optional: go home after save
      // navigation.navigate("Home");
    } catch {
      setErrorMsg("Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const onAddCustomCue = async () => {
    const name = customCue.trim();
    if (!name) return;

    await addCustomCue(name, true);
    setCustomCue("");
    setShowAddCue(false);
    // it will appear in selectedCues and user can tap it (or you can auto-select by name later)
  };

  const onAddCustomLocation = async () => {
    const name = customLocation.trim();
    if (!name) return;

    await addCustomLocation(name, true);
    setCustomLocation("");
    setShowAddLocation(false);
  };

  const IntensityRow = () => (
    <View className="mt-3 w-full flex-row items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3">
      <Text className="text-sm font-semibold text-gray-900">Intensity</Text>

      <View className="flex-row items-center">
        <Pressable
          disabled={intensity <= 1}
          onPress={() => setIntensity((v) => Math.max(1, v - 1))}
          className={`rounded-xl px-3 py-2 ${intensity <= 1 ? "bg-gray-200" : "bg-gray-900"}`}
        >
          <Text
            className={`${intensity <= 1 ? "text-gray-600" : "text-white"} font-semibold`}
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
          className={`rounded-xl px-3 py-2 ${intensity >= 10 ? "bg-gray-200" : "bg-gray-900"}`}
        >
          <Text
            className={`${intensity >= 10 ? "text-gray-600" : "text-white"} font-semibold`}
          >
            +
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const Chips = <T extends { id: number; name: string }>({
    title,
    items,
    selectedId,
    onSelect,
    allowNone,
  }: {
    title: string;
    items: T[];
    selectedId: number | null;
    onSelect: (id: number | null) => void;
    allowNone?: boolean;
  }) => (
    <View className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3">
      <Text className="text-sm font-semibold text-gray-900">{title}</Text>

      <View className="mt-2 flex-row flex-wrap gap-2">
        {allowNone ? (
          <Pressable
            onPress={() => onSelect(null)}
            className={`rounded-full border px-3 py-1.5 ${
              selectedId == null
                ? "bg-gray-900 border-gray-900"
                : "bg-white border-gray-200"
            }`}
          >
            <Text
              className={`${selectedId == null ? "text-white" : "text-gray-900"} text-sm font-semibold`}
            >
              None
            </Text>
          </Pressable>
        ) : null}

        {items.map((item) => {
          const selected = item.id === selectedId;
          return (
            <Pressable
              key={item.id}
              onPress={() => onSelect(item.id)}
              className={`rounded-full border px-3 py-1.5 ${
                selected
                  ? "bg-blue-600 border-blue-600"
                  : "bg-white border-gray-200"
              }`}
            >
              <Text
                className={`${selected ? "text-white" : "text-gray-900"} text-sm font-semibold`}
              >
                {item.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderLog = ({ item }: { item: LogEntry }) => {
    const time = new Date(item.createdAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const resisted = item.didResist === 1;

    const meta = [
      item.cueName ? `Cue: ${item.cueName}` : null,
      item.locationName ? `Loc: ${item.locationName}` : null,
    ]
      .filter(Boolean)
      .join(" • ");

    return (
      <View className="mb-2 w-full rounded-2xl border border-gray-200 bg-white p-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-2">
            <Text className="text-xs text-gray-500">{time}</Text>
            <Text className="text-sm font-semibold text-gray-900">
              {item.habitName}
            </Text>
            {meta ? (
              <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={1}>
                {meta}
              </Text>
            ) : null}
          </View>

          <View
            className={`rounded-full px-2 py-1 ${resisted ? "bg-green-100" : "bg-gray-100"}`}
          >
            <Text
              className={`${resisted ? "text-green-800" : "text-gray-700"} text-xs font-semibold`}
            >
              {resisted ? "Resisted" : "Gave in"}
            </Text>
          </View>
        </View>

        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-xs text-gray-500">Intensity</Text>
          <Text className="text-xs font-semibold text-gray-900">
            {item.intensity}/10
          </Text>
        </View>

        {item.notes ? (
          <Text className="mt-2 text-xs text-gray-600" numberOfLines={2}>
            Notes: {item.notes}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-white"
    >
      <View className="flex-1 px-5 pt-8">
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-gray-900">Log</Text>

          <Pressable
            onPress={() => setShowRecent((v) => !v)}
            className="rounded-full border border-gray-200 bg-white px-3 py-2"
          >
            <Text className="text-xs font-semibold text-gray-900">
              {showRecent ? "Hide recent" : "Show recent"}
            </Text>
          </Pressable>
        </View>

        {/* Form Card */}
        <View className="mt-4 w-full rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <Chips<SelectedHabit>
            title="Habit"
            items={selectedHabits}
            selectedId={habitId}
            onSelect={(id) => setHabitId(id)}
          />

          <Chips<SelectedCue>
            title="Cue"
            items={selectedCues}
            selectedId={cueId}
            onSelect={(id) => setCueId(id)}
            allowNone
          />

          <Pressable
            onPress={() => setShowAddCue((v) => !v)}
            className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3"
          >
            <Text className="text-sm font-semibold text-gray-900">
              {showAddCue ? "Cancel custom cue" : "Add custom cue"}
            </Text>
          </Pressable>

          {showAddCue ? (
            <View className="mt-2 flex-row items-center gap-3">
              <TextInput
                value={customCue}
                onChangeText={setCustomCue}
                placeholder="e.g., after coffee"
                placeholderTextColor="#9CA3AF"
                className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900"
              />
              <Pressable
                onPress={onAddCustomCue}
                className="rounded-xl bg-gray-900 px-4 py-3"
              >
                <Text className="font-semibold text-white">Add</Text>
              </Pressable>
            </View>
          ) : null}

          <Chips<SelectedPlace>
            title="Location"
            items={selectedLocations}
            selectedId={locationId}
            onSelect={(id) => setLocationId(id)}
            allowNone
          />

          <Pressable
            onPress={() => setShowAddLocation((v) => !v)}
            className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3"
          >
            <Text className="text-sm font-semibold text-gray-900">
              {showAddLocation
                ? "Cancel custom location"
                : "Add custom location"}
            </Text>
          </Pressable>

          {showAddLocation ? (
            <View className="mt-2 flex-row items-center gap-3">
              <TextInput
                value={customLocation}
                onChangeText={setCustomLocation}
                placeholder="e.g., office parking lot"
                placeholderTextColor="#9CA3AF"
                className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900"
              />
              <Pressable
                onPress={onAddCustomLocation}
                className="rounded-xl bg-gray-900 px-4 py-3"
              >
                <Text className="font-semibold text-white">Add</Text>
              </Pressable>
            </View>
          ) : null}

          <IntensityRow />

          <View className="mt-3 w-full flex-row items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3">
            <Text className="text-sm font-semibold text-gray-900">
              Resisted?
            </Text>
            <Switch value={didResist} onValueChange={setDidResist} />
          </View>

          {/* Notes collapsed by default */}
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
              saving ? "bg-blue-300" : "bg-blue-600"
            }`}
          >
            <Text className="text-center text-base font-semibold text-white">
              {saving ? "Saving..." : "Save"}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate("Home")}
            className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-5 py-3.5"
          >
            <Text className="text-center text-base font-semibold text-gray-900">
              Home
            </Text>
          </Pressable>
        </View>

        {/* Recent Logs (collapsible) */}
        {showRecent ? (
          <View className="mt-4 flex-1">
            <Text className="text-base font-bold text-gray-900">
              Recent (10)
            </Text>

            {recentLogs.length === 0 ? (
              <View className="mt-3 rounded-2xl border border-gray-200 bg-white p-4">
                <Text className="text-sm text-gray-700">No logs yet.</Text>
              </View>
            ) : (
              <FlatList
                className="mt-3"
                data={recentLogs}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderLog}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        ) : (
          <View className="flex-1" />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
