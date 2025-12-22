import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Switch,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { RootTabParamList } from "../App";
import {
  useData,
  type LogEntry,
  type SelectedHabit,
} from "../data/DataContext";

type Nav = BottomTabNavigationProp<RootTabParamList>;

export default function LogScreen() {
  const navigation = useNavigation<Nav>();
  const { selectedHabits, logs, addLog } = useData();

  // ---- Selected habit (required) ----
  const [selectedHabitId, setSelectedHabitId] = useState<number | null>(null);

  // ---- Form State ----
  const [cue, setCue] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [intensity, setIntensity] = useState<number>(5);
  const [didResist, setDidResist] = useState<boolean>(false);

  // ---- UX State ----
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showRecent, setShowRecent] = useState(false);

  const recentLogs = useMemo(() => logs.slice(0, 10), [logs]);

  // Ensure we pick a default habit once selectedHabits loads
  useEffect(() => {
    if (selectedHabitId == null && selectedHabits.length > 0) {
      setSelectedHabitId(selectedHabits[0].id);
    }
  }, [selectedHabits, selectedHabitId]);

  const resetForm = () => {
    setCue("");
    setLocation("");
    setNotes("");
    setShowNotes(false);
    setIntensity(5);
    setDidResist(false);
  };

  const onSave = async () => {
    setErrorMsg(null);
    setSavedMsg(null);

    if (selectedHabitId == null) {
      setErrorMsg("Select a habit.");
      return;
    }

    try {
      setSaving(true);

      await addLog({
        habitId: selectedHabitId,
        cue: cue.trim() || undefined,
        location: location.trim() || undefined,
        intensity,
        didResist,
        notes: notes.trim() || undefined,
      });

      resetForm();
      setSavedMsg("Saved ✅");
      setTimeout(() => setSavedMsg(null), 900);

      // Optional: jump to Home after save
      // navigation.navigate("Home");
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

  const HabitChips = () => {
    if (selectedHabits.length === 0) {
      return (
        <View className="mt-3 w-full rounded-2xl border border-gray-200 bg-white p-4">
          <Text className="text-sm font-semibold text-gray-900">
            No habits selected
          </Text>
          <Text className="mt-1 text-xs text-gray-600">
            Go back to onboarding to choose habits.
          </Text>
        </View>
      );
    }

    return (
      <View className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3">
        <Text className="text-sm font-semibold text-gray-900">Habit</Text>
        <View className="mt-2 flex-row flex-wrap gap-2">
          {selectedHabits.map((h: SelectedHabit) => {
            const selected = h.id === selectedHabitId;
            return (
              <Pressable
                key={h.id}
                onPress={() => setSelectedHabitId(h.id)}
                className={`rounded-full border px-3 py-1.5 ${
                  selected
                    ? "bg-blue-600 border-blue-600"
                    : "bg-white border-gray-200"
                }`}
              >
                <Text
                  className={`${selected ? "text-white" : "text-gray-900"} text-sm font-semibold`}
                >
                  {h.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  const renderLog = ({ item }: { item: LogEntry }) => {
    const time = new Date(item.createdAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const resisted = item.didResist === 1;

    return (
      <View className="mb-2 w-full rounded-2xl border border-gray-200 bg-white p-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-2">
            <Text className="text-xs text-gray-500">{time}</Text>
            <Text className="text-sm font-semibold text-gray-900">
              {item.habitName}
            </Text>
            {item.cue || item.location ? (
              <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={1}>
                {[
                  item.cue ? `Cue: ${item.cue}` : null,
                  item.location ? `Loc: ${item.location}` : null,
                ]
                  .filter(Boolean)
                  .join(" • ")}
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
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-white"
    >
      <View className="flex-1 px-5 pt-8">
        {/* Header (compact) */}
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

        {/* Form Card (compact) */}
        <View className="mt-4 w-full rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <HabitChips />

          <View className="mt-3 flex-row gap-2">
            <View className="flex-1">
              <Text className="text-xs font-semibold text-gray-700">Cue</Text>
              <TextInput
                value={cue}
                onChangeText={setCue}
                placeholder="stress, boredom…"
                placeholderTextColor="#9CA3AF"
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-gray-900"
              />
            </View>

            <View className="flex-1">
              <Text className="text-xs font-semibold text-gray-700">
                Location
              </Text>
              <TextInput
                value={location}
                onChangeText={setLocation}
                placeholder="car, bed…"
                placeholderTextColor="#9CA3AF"
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-gray-900"
              />
            </View>
          </View>

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

        {/* Recent Logs (collapsible; no forced scrolling) */}
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
          // Spacer so layout doesn't jump weirdly
          <View className="flex-1" />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
