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
  type LogEntry,
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

export default function LogScreen() {
  const navigation = useNavigation<Nav>();
  const { selectedHabits, selectedCues, selectedLocations, logs, addLog } =
    useData();

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
  const [showRecent, setShowRecent] = useState(false);

  const recentLogs = useMemo(() => logs.slice(0, 10), [logs]);

  useEffect(() => {
    if (habitId == null && selectedHabits.length > 0)
      setHabitId(selectedHabits[0].id);
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
      const selected = "bg-blue-600 border-blue-600";
      const unselected = "bg-white border-gray-200";

      // "+ Add" chip styling: neutral
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

        <View className="mt-4 w-full rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <ChipRow<SelectedHabit>
            title="Habit"
            items={selectedHabits}
            selectedId={habitId}
            onSelect={setHabitId}
            addType="habits"
          />

          <ChipRow<SelectedCue>
            title="Cue"
            items={selectedCues}
            selectedId={cueId}
            onSelect={setCueId}
            allowNone
            addType="cues"
          />

          <ChipRow<SelectedPlace>
            title="Location"
            items={selectedLocations}
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
            className={`mt-3 w-full rounded-2xl px-5 py-3.5 ${saving ? "bg-blue-300" : "bg-blue-600"}`}
          >
            <Text className="text-center text-base font-semibold text-white">
              {saving ? "Saving..." : "Save"}
            </Text>
          </Pressable>
        </View>

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
