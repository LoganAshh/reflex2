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
import { useData, type UrgeLog } from "../data/DataContext";

type Nav = BottomTabNavigationProp<RootTabParamList>;

export default function LogScreen() {
  const navigation = useNavigation<Nav>();
  const { logs, addLog } = useData();

  // ---- Form State ----
  const [habit, setHabit] = useState("");
  const [urge, setUrge] = useState("");
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

  const resetForm = () => {
    setHabit("");
    setUrge("");
    setCue("");
    setLocation("");
    setNotes("");
    setIntensity(5);
    setDidResist(false);
  };

  const onSave = async () => {
    setErrorMsg(null);
    setSavedMsg(null);

    const cleanHabit = habit.trim();
    const cleanUrge = urge.trim();

    if (!cleanHabit || !cleanUrge) {
      setErrorMsg("Please fill out Habit and Urge.");
      return;
    }

    try {
      setSaving(true);

      await addLog({
        habit: cleanHabit,
        urge: cleanUrge,
        cue: cue.trim() || undefined,
        location: location.trim() || undefined,
        intensity,
        didResist,
        notes: notes.trim() || undefined,
      });

      resetForm();
      setSavedMsg("Saved ✅");

      // Optional: jump back to Home after saving (comment out if you don’t want this)
      // navigation.navigate("Home");

      // Clear saved message after a moment
      setTimeout(() => setSavedMsg(null), 1200);
    } catch (e) {
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

  const renderLog = ({ item }: { item: UrgeLog }) => {
    const dt = new Date(item.createdAt);
    const time = dt.toLocaleString();
    const resisted = item.didResist === 1;

    return (
      <View className="mb-3 w-full rounded-2xl border border-gray-200 bg-white p-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-sm text-gray-500">{time}</Text>
            <Text className="mt-1 text-base font-semibold text-gray-900">
              {item.habit}
            </Text>
            <Text className="mt-1 text-sm text-gray-700">{item.urge}</Text>

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
          Add an entry in under 15 seconds.
        </Text>

        {/* Form */}
        <View className="mt-6 w-full rounded-2xl border border-gray-200 bg-gray-50 p-5">
          <Text className="text-base font-semibold text-gray-900">
            New Entry
          </Text>

          <Text className="mt-3 text-sm text-gray-700">Habit *</Text>
          <TextInput
            value={habit}
            onChangeText={setHabit}
            placeholder="e.g., Nicotine, doomscrolling, binge eating"
            placeholderTextColor="#9CA3AF"
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900"
            returnKeyType="next"
          />

          <Text className="mt-3 text-sm text-gray-700">Urge *</Text>
          <TextInput
            value={urge}
            onChangeText={setUrge}
            placeholder="What are you feeling the urge to do?"
            placeholderTextColor="#9CA3AF"
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900"
          />

          <View className="mt-3 flex-row gap-3">
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
