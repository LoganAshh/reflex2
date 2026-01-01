import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Alert,
  Keyboard,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import * as Haptics from "expo-haptics";
import { useData } from "../data/DataContext";

type ManageRoute = RouteProp<RootStackParamList, "ManageList">;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ManageListScreen() {
  const route = useRoute<ManageRoute>();
  const navigation = useNavigation<Nav>();
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

    Keyboard.dismiss();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (type === "habits") await addCustomHabit(name, true);
    else if (type === "cues") await addCustomCue(name, true);
    else await addCustomLocation(name, true);

    setText("");
  };

  const onDone = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
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
            multiline={false}
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={onAdd}
          />
          <Pressable
            onPress={onAdd}
            className="rounded-xl bg-gray-900 px-4 py-3 active:bg-gray-800"
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
                  ? "border-green-600 bg-green-50"
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
                      ? "border-green-600 bg-green-600"
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
        contentContainerStyle={{ paddingBottom: 110 }}
      />

      {/* Bottom overlay Done button */}
      <View className="absolute bottom-0 left-0 right-0 border-t border-gray-200 bg-white px-6 pb-6 pt-4">
        <Pressable
          onPress={onDone}
          className="w-full rounded-2xl bg-gray-900 py-4 active:bg-gray-800"
        >
          <Text className="text-center text-base font-semibold text-white">
            Done
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
