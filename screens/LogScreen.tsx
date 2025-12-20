import { useMemo, useState } from "react";
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
  const [selectedHabitId, setSelectedHabitId] = useState<number | null>(
    selectedHabits[0]?.id ?? null
  );

  // ---- Form State ----
  const [cue, setCue] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [intensity, setIntensity] = useState<number>(5);
  const [didResist, setDidResist] = useState<boolean>(false);

  // ---- UX State ----
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recentLogs = useMemo(() => logs.slice(0, 10), [logs]);

  // If the user updates habits after first render, ensure we still have a valid selection.
  // (This handles the case where selectedHabits loads async and was empty at first.)
  useMemo(() => {
    if (selectedHabitId == null && selectedHabits.length > 0) {
      setSelectedHabitId(selectedHabits[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHabits]);

  const resetForm = () => {
    setCue("");
    setLocation("");
    setNotes("");
    setIntensity(5);
    setDidResist(false);
  };

  const onSave = async () => {
    setErrorMsg(null);
    setSavedMsg(null);

    if (selectedHabitId == null) {
      setErrorMsg("Select a habit to log.");
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
      setTimeout(() => setSavedMsg(null), 1200);

      // Optional: jump back to Home after saving
      // navigation.navigate("Home");
    } catch {
      setErrorMsg("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const IntensityStepper = () => (
    <View className="mt-4 w-full rounded-2xl border border-gray-200 bg-white p-4">
      <Text className="text-base font-semibold text-gray-900">Intensity</Text>
      <Text className="mt-1 text-sm text-gray-500">1 (low) → 10 (high)</Text>

      <View className="mt-3 flex-row items-center justify-between">
        <Pressable
          disabled={intensity <= 1}
          onPress={() => setIntensity((v) => Math.max(1, v - 1))}
          className={`rounded-xl px-4 py-2 ${
            intensity <= 1 ? "bg-gray-200" : "bg-gray-900"
          }`}
        >
          <Text
            className={`${intensity <= 1 ? "text-gray-600" : "text-white"} font-semibold`}
          >
            −
          </Text>
        </Pressable>

        <Text className="text-2xl font-bold text-gray-900">{intensity}</Text>

        <Pressable
          disabled={intensity >= 10}
          onPress={() => setIntensity((v) => Math.min(10, v + 1))}
          className={`rounded-xl px-4 py-2 ${
            intensity >= 10 ? "bg-gray-200" : "bg-gray-900"
          }`}
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
        <View className="mt-4 w-full rounded-2xl border border-gray-200 bg-white p-4">
          <Text className="text-base font-semibold text-gray-900">Habit</Text>
          <Text className="mt-2 text-sm text-gray-600">
            You haven’t selected any habits yet. Go back to onboarding.
          </Text>
        </View>
      );
    }

    return (
      <View className="mt-4 w-full rounded-2xl border border-gray-200 bg-white p-4">
        <Text className="text-base font-semibold text-gray-900">Habit *</Text>
        <Text className="mt-1 text-sm text-gray-500">Tap one to log.</Text>

        <View className="mt-3 flex-row flex-wrap gap-2">
          {selectedHabits.map((h: SelectedHabit) => {
            const selected = h.id === selectedHabitId;
            return (
              <Pressable
                key={h.id}
                onPress={() => setSelectedHabitId(h.id)}
                className={`rounded-full px-4 py-2 border ${
                  selected
                    ? "bg-blue-600 border-blue-600"
                    : "bg-white border-gray-200"
                }`}
              >
                <Text
                  className={`${selected ? "text-white" : "text-gray-900"} font-semibold`}
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
    const dt = new Date(item.createdAt);
    const time = dt.toLocaleString();
    const resisted = item.didResist === 1;

    return (
      <View className="mb-3 w-full rounded-2xl border border-gray-200 bg-white p-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-sm text-gray-500">{time}</Text>
            <Text className="mt-1 text-base font-semibold text-gray-900">
              {item.habitName}
            </Text>

            {(item.cue || item.location) && (
              <Text className="mt-2 text-xs text-gray-500">
                {[
                  item.cue ? `Cue: ${item.cue}` : null,
                  item.location ? `Location: ${item.location}` : null,
                ]
                  .filter(Boolean)
                  .join(" • ")}
              </Text>
            )}
          </View>

          <View
            className={`rounded-full px-3 py-1 ${
              resisted ? "bg-green-100" : "bg-gray-100"
            }`}
          >
            <Text
              className={`${resisted ? "text-green-800" : "text-gray-700"} text-xs font-semibold`}
            >
              {resisted ? "Resisted" : "Gave in"}
            </Text>
          </View>
        </View>

        <View className="mt-3 flex-row items-center justify-between">
          <Text className="text-xs text-gray-500">Intensity</Text>
          <Text className="text-xs font-semibold text-gray-900">
            {item.intensity}/10
          </Text>
        </View>

        {item.notes ? (
          <Text className="mt-2 text-xs text-gray-600">
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
      <View className="flex-1 px-6 pt-10">
        <Text className="text-3xl font-bold text-gray-900">Log</Text>
        <Text className="mt-2 text-gray-600">
          Choose a habit, add context, save.
        </Text>

        {/* Form */}
        <View className="mt-6 w-full rounded-2xl border border-gray-200 bg-gray-50 p-5">
          <Text className="text-base font-semibold text-gray-900">
            New Entry
          </Text>

          <HabitChips />

          <View className="mt-4 flex-row gap-3">
            <View className="flex-1">
              <Text className="text-sm text-gray-700">Cue</Text>
              <TextInput
                value={cue}
                onChangeText={setCue}
                placeholder="e.g., stress, boredom"
                placeholderTextColor="#9CA3AF"
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900"
              />
            </View>

            <View className="flex-1">
              <Text className="text-sm text-gray-700">Location</Text>
              <TextInput
                value={location}
                onChangeText={setLocation}
                placeholder="e.g., car, bedroom"
                placeholderTextColor="#9CA3AF"
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900"
              />
            </View>
          </View>

          <IntensityStepper />

          <View className="mt-4 w-full rounded-2xl border border-gray-200 bg-white p-4">
            <View className="flex-row items-center justify-between">
              <View className="pr-3">
                <Text className="text-base font-semibold text-gray-900">
                  Did you resist?
                </Text>
                <Text className="mt-1 text-sm text-gray-500">
                  Toggle based on what happened.
                </Text>
              </View>
              <Switch value={didResist} onValueChange={setDidResist} />
            </View>
          </View>

          <Text className="mt-4 text-sm text-gray-700">Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional: anything useful to remember"
            placeholderTextColor="#9CA3AF"
            multiline
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900"
          />

          {errorMsg ? (
            <Text className="mt-3 text-sm font-semibold text-red-600">
              {errorMsg}
            </Text>
          ) : null}

          {savedMsg ? (
            <Text className="mt-3 text-sm font-semibold text-green-700">
              {savedMsg}
            </Text>
          ) : null}

          <Pressable
            onPress={onSave}
            disabled={saving}
            className={`mt-4 w-full rounded-2xl px-5 py-4 ${
              saving ? "bg-blue-300" : "bg-blue-600"
            }`}
          >
            <Text className="text-center text-lg font-semibold text-white">
              {saving ? "Saving..." : "Save Entry"}
            </Text>
          </Pressable>

          {/* Optional quick nav */}
          <Pressable
            onPress={() => navigation.navigate("Home")}
            className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-5 py-4"
          >
            <Text className="text-center text-base font-semibold text-gray-900">
              Back to Home
            </Text>
          </Pressable>
        </View>

        {/* Recent Logs */}
        <View className="mt-8 flex-1">
          <Text className="text-xl font-bold text-gray-900">Recent logs</Text>
          <Text className="mt-1 text-sm text-gray-500">Last 10 entries</Text>

          {recentLogs.length === 0 ? (
            <View className="mt-4 rounded-2xl border border-gray-200 bg-white p-5">
              <Text className="text-gray-700">
                No logs yet. Add your first entry above.
              </Text>
            </View>
          ) : (
            <FlatList
              className="mt-4"
              data={recentLogs}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderLog}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
