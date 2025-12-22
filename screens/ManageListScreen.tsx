import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Alert,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../App";
import { useData } from "../data/DataContext";

type ManageRoute = RouteProp<RootStackParamList, "ManageList">;

export default function ManageListScreen() {
  const route = useRoute<ManageRoute>();
  const type = route.params.type;

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

  const [text, setText] = useState("");

  const { items, selectedIds, title } = useMemo(() => {
    if (type === "habits") {
      return {
        items: habits,
        selectedIds: new Set(selectedHabits.map((h) => h.id)),
        title: "Habits",
      };
    }
    if (type === "cues") {
      return {
        items: cues,
        selectedIds: new Set(selectedCues.map((c) => c.id)),
        title: "Cues",
      };
    }
    return {
      items: locations,
      selectedIds: new Set(selectedLocations.map((l) => l.id)),
      title: "Locations",
    };
  }, [
    type,
    habits,
    cues,
    locations,
    selectedHabits,
    selectedCues,
    selectedLocations,
  ]);

  const toggleSelected = async (id: number) => {
    // Prevent removing the last habit (so you never fall back into onboarding
    // and you always have something to log against).
    if (type === "habits" && selectedIds.has(id) && selectedIds.size === 1) {
      Alert.alert("Keep one habit", "You need at least one habit selected.");
      return;
    }

    const ids = Array.from(selectedIds);
    const next = selectedIds.has(id)
      ? ids.filter((x) => x !== id)
      : [...ids, id];

    if (type === "habits") await setSelectedHabits(next);
    else if (type === "cues") await setSelectedCues(next);
    else await setSelectedLocations(next);
  };

  const onAdd = async () => {
    const name = text.trim();
    if (!name) return;

    if (type === "habits") await addCustomHabit(name, true);
    else if (type === "cues") await addCustomCue(name, true);
    else await addCustomLocation(name, true);

    setText("");
  };

  return (
    <View className="flex-1 bg-white px-6 pt-6">
      <Text className="text-2xl font-bold text-gray-900">{title}</Text>
      <Text className="mt-2 text-gray-600">
        Add new items and choose which ones appear in your Log screen.
      </Text>

      {type === "habits" ? (
        <View className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <Text className="text-sm font-semibold text-gray-900">
            Tip: Start Small
          </Text>
          <Text className="mt-1 text-xs text-gray-600">
            It’s usually easier to focus on one or two habits at first. You can
            always add more later.
          </Text>
        </View>
      ) : null}

      {/* Add row */}
      <View className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <Text className="text-sm font-semibold text-gray-900">Add new</Text>

        <View className="mt-3 flex-row items-center gap-3">
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={`New ${type.slice(0, -1)}...`}
            placeholderTextColor="#9CA3AF"
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900"
          />
          <Pressable
            onPress={onAdd}
            className="rounded-xl bg-gray-900 px-4 py-3"
          >
            <Text className="font-semibold text-white">Add</Text>
          </Pressable>
        </View>

        <Text className="mt-2 text-xs text-gray-500">
          New items are stored locally on your device.
        </Text>
      </View>

      {/* List */}
      <Text className="mt-6 text-base font-bold text-gray-900">Your list</Text>

      <FlatList
        className="mt-3"
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => {
          const isSelected = selectedIds.has(item.id);
          return (
            <Pressable
              onPress={() => toggleSelected(item.id)}
              className={`mb-3 rounded-2xl border p-4 ${
                isSelected
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
                    isSelected
                      ? "border-blue-600 bg-blue-600"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  {isSelected ? (
                    <Text className="text-white text-xs font-bold">✓</Text>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
