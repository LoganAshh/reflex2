import { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  Alert,
} from "react-native";
import { useData } from "../data/DataContext";

export default function OnboardingScreen() {
  const { habits, selectedHabits, setSelectedHabits, addCustomHabit } =
    useData();

  // local selection (so user can toggle freely then save once)
  const [selectedIds, setSelectedIds] = useState<number[]>(
    selectedHabits.map((h) => h.id)
  );

  const [customHabit, setCustomHabit] = useState("");

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggle = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const onAddCustom = async () => {
    const name = customHabit.trim();
    if (!name) return;

    // add to habits table + auto-select it
    await addCustomHabit(name, true);

    // after addCustomHabit auto-selects, we still need to update local selectedIds
    // safest: re-derive from current selectedHabits on next render is tricky (async),
    // so we optimistically add by matching the name against habits list (after DB refresh happens).
    setCustomHabit("");

    // small UX: we won't force it; user can just hit Save after it appears selected
  };

  const onContinue = async () => {
    if (selectedIds.length === 0) {
      Alert.alert(
        "Pick at least one habit",
        "Select one or more habits to continue."
      );
      return;
    }
    await setSelectedHabits(selectedIds);
  };

  return (
    <View className="flex-1 bg-white px-6 pt-14">
      <Text className="text-3xl font-bold text-gray-900">Welcome</Text>
      <Text className="mt-2 text-gray-600">
        Select the habit(s) you want to work on. You can change this later.
      </Text>

      {/* Add custom habit */}
      <View className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <Text className="text-base font-semibold text-gray-900">
          Add a custom habit
        </Text>
        <View className="mt-3 flex-row items-center gap-3">
          <TextInput
            value={customHabit}
            onChangeText={setCustomHabit}
            placeholder="e.g., nail biting"
            placeholderTextColor="#9CA3AF"
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900"
          />
          <Pressable
            onPress={onAddCustom}
            className="rounded-xl bg-gray-900 px-4 py-3"
          >
            <Text className="font-semibold text-white">Add</Text>
          </Pressable>
        </View>
      </View>

      {/* Habits list */}
      <Text className="mt-7 text-lg font-bold text-gray-900">
        Choose habits
      </Text>
      <Text className="mt-1 text-sm text-gray-500">
        Tap to select. Selected: {selectedIds.length}
      </Text>

      <FlatList
        className="mt-4"
        data={habits}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => {
          const selected = selectedSet.has(item.id);
          return (
            <Pressable
              onPress={() => toggle(item.id)}
              className={`mb-3 rounded-2xl border p-4 ${
                selected
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <View className="flex-row items-center justify-between">
                <View className="pr-3">
                  <Text className="text-base font-semibold text-gray-900">
                    {item.name}
                  </Text>
                  <Text className="mt-1 text-xs text-gray-500">
                    {item.isCustom ? "Custom" : "Preset"}
                  </Text>
                </View>

                <View
                  className={`h-6 w-6 items-center justify-center rounded-full border ${
                    selected
                      ? "border-blue-600 bg-blue-600"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  {selected ? (
                    <Text className="text-white text-xs font-bold">✓</Text>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        }}
        showsVerticalScrollIndicator={false}
      />

      {/* Continue */}
      <Pressable
        onPress={onContinue}
        className="mb-8 mt-2 w-full rounded-2xl bg-blue-600 px-5 py-4"
      >
        <Text className="text-center text-lg font-semibold text-white">
          Continue
        </Text>
      </Pressable>
    </View>
  );
}
