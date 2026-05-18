import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Alert,
  Keyboard,
  Modal,
} from "react-native";
import {
  CommonActions,
  useRoute,
  useNavigation,
} from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type {
  ManageListSelection,
  ManageListType,
  RootStackParamList,
} from "../App";
import * as Haptics from "expo-haptics";
import { useData, type Habit, type Cue, type Place } from "../data/DataContext";

type ManageRoute = RouteProp<RootStackParamList, "ManageList">;
type Nav = NativeStackNavigationProp<RootStackParamList>;
type Filter = "selected" | "preset" | "custom";
type ManageItem = Habit | Cue | Place;
type PendingAddedItem = { type: ManageListType; name: string };

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
    renameCustomHabit,
    renameCustomCue,
    renameCustomLocation,
    deleteCustomHabit,
    deleteCustomCue,
    deleteCustomLocation,
  } = useData();

  const [text, setText] = useState("");
  const [filter, setFilter] = useState<Filter>("selected");
  const [editingItem, setEditingItem] = useState<ManageItem | null>(null);
  const [editText, setEditText] = useState("");
  const [returnSelection, setReturnSelection] =
    useState<ManageListSelection | null>(null);
  const [pendingAddedItem, setPendingAddedItem] =
    useState<PendingAddedItem | null>(null);

  const { items, selectedIds, title, singularTitle } = useMemo(() => {
    if (type === "habits") {
      return {
        items: habits,
        selectedIds: new Set(selectedHabits.map((h) => h.id)),
        title: "Habits",
        singularTitle: "habit",
      };
    }

    if (type === "cues") {
      return {
        items: cues,
        selectedIds: new Set(selectedCues.map((c) => c.id)),
        title: "Cues",
        singularTitle: "cue",
      };
    }

    return {
      items: locations,
      selectedIds: new Set(selectedLocations.map((l) => l.id)),
      title: "Locations",
      singularTitle: "location",
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

  useEffect(() => {
    if (!pendingAddedItem) return;
    if (pendingAddedItem.type !== type) return;

    const match = items.find(
      (item) =>
        item.name.trim().toLowerCase() ===
        pendingAddedItem.name.trim().toLowerCase(),
    );

    if (!match) return;

    setReturnSelection({
      type,
      id: match.id,
      token: Date.now(),
    });
    setPendingAddedItem(null);
  }, [items, pendingAddedItem, type]);

  const filteredItems = useMemo(() => {
    if (filter === "selected") {
      return items.filter((it) => selectedIds.has(it.id));
    }

    if (filter === "preset") {
      return items.filter((it) => !it.isCustom);
    }

    return items.filter((it) => !!it.isCustom);
  }, [items, selectedIds, filter]);

  const setLogReturnSelectionParam = (selection: ManageListSelection) => {
    const rootState = navigation.getState();
    const mainRoute = rootState.routes.find((r) => r.name === "Main");
    const tabState = mainRoute?.state as
      | {
          key?: string;
          routes?: Array<{ key: string; name: string }>;
        }
      | undefined;

    const logRoute = tabState?.routes?.find((r) => r.name === "Log");

    if (!tabState?.key || !logRoute?.key) return false;

    navigation.dispatch({
      ...CommonActions.setParams({
        manageListSelection: selection,
      }),
      source: logRoute.key,
      target: tabState.key,
    });

    return true;
  };

  const toggleSelected = async (id: number) => {
    const wasSelected = selectedIds.has(id);

    if (type === "habits" && wasSelected && selectedIds.size === 1) {
      Alert.alert("Keep one habit", "You need at least one habit selected.");
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const ids = Array.from(selectedIds);
    const next = wasSelected ? ids.filter((x) => x !== id) : [...ids, id];

    if (type === "habits") await setSelectedHabits(next);
    else if (type === "cues") await setSelectedCues(next);
    else await setSelectedLocations(next);

    if (!wasSelected) {
      setReturnSelection({
        type,
        id,
        token: Date.now(),
      });
    }
  };

  const onAdd = async () => {
    const name = text.trim();
    if (!name) return;

    Keyboard.dismiss();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (type === "habits") await addCustomHabit(name, true);
      else if (type === "cues") await addCustomCue(name, true);
      else await addCustomLocation(name, true);

      setPendingAddedItem({ type, name });
      setText("");
      setFilter("custom");
    } catch (e: any) {
      Alert.alert("Already exists", e?.message ?? "That item already exists.");
    }
  };

  const openEdit = (item: ManageItem) => {
    if (!item.isCustom) return;
    setEditingItem(item);
    setEditText(item.name);
  };

  const closeEdit = () => {
    setEditingItem(null);
    setEditText("");
  };

  const onRename = async () => {
    if (!editingItem) return;

    const name = editText.trim();
    if (!name) return;

    try {
      if (type === "habits") await renameCustomHabit(editingItem.id, name);
      else if (type === "cues") await renameCustomCue(editingItem.id, name);
      else await renameCustomLocation(editingItem.id, name);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeEdit();
    } catch (e: any) {
      Alert.alert(
        "Could not rename",
        e?.message ?? "That name is already used.",
      );
    }
  };

  const onDelete = () => {
    if (!editingItem) return;

    Alert.alert(
      `Delete ${singularTitle}?`,
      `This removes “${editingItem.name}” from future logging. If old logs use it, those logs will keep their saved text.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!editingItem) return;

            const result =
              type === "habits"
                ? await deleteCustomHabit(editingItem.id)
                : type === "cues"
                  ? await deleteCustomCue(editingItem.id)
                  : await deleteCustomLocation(editingItem.id);

            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            );

            if (returnSelection?.id === editingItem.id) {
              setReturnSelection(null);
            }

            closeEdit();

            if (result === "hidden") {
              Alert.alert(
                "Hidden from logging",
                "This item was used in old logs, so it was hidden instead of fully deleted. Historical logs still keep the original text.",
              );
            }
          },
        },
      ],
    );
  };

  const onDone = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (returnSelection) {
      setLogReturnSelectionParam(returnSelection);
    }

    navigation.goBack();
  };

  const Chip = ({ label, value }: { label: string; value: Filter }) => {
    const active = filter === value;

    return (
      <Pressable
        onPress={() => setFilter(value)}
        className={`rounded-full border px-4 py-2 ${
          active ? "border-gray-900 bg-gray-900" : "border-gray-200 bg-white"
        }`}
      >
        <Text
          className={`text-sm font-semibold ${
            active ? "text-white" : "text-gray-900"
          }`}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View className="flex-1 bg-white px-6 pt-6">
      <Modal visible={!!editingItem} transparent animationType="fade">
        <View className="flex-1 justify-center bg-black/40 px-6">
          <View className="rounded-3xl bg-white p-5">
            <Text className="text-xl font-bold text-gray-900">
              Edit custom {singularTitle}
            </Text>

            <Text className="mt-2 text-sm text-gray-600">
              Rename it, or delete it from future logging.
            </Text>

            <TextInput
              value={editText}
              onChangeText={setEditText}
              placeholder={`Custom ${singularTitle}`}
              placeholderTextColor="#9CA3AF"
              className="mt-4 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-gray-900"
              multiline={false}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={onRename}
            />

            <Pressable
              onPress={onRename}
              className="mt-4 rounded-2xl bg-green-600 py-4 active:bg-green-700"
            >
              <Text className="text-center text-base font-semibold text-white">
                Save Rename
              </Text>
            </Pressable>

            <Pressable
              onPress={onDelete}
              className="mt-3 rounded-2xl border border-red-200 bg-red-50 py-4 active:bg-red-100"
            >
              <Text className="text-center text-base font-semibold text-red-600">
                Delete Custom Item
              </Text>
            </Pressable>

            <Pressable onPress={closeEdit} className="mt-3 rounded-2xl py-3">
              <Text className="text-center text-base font-semibold text-gray-500">
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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

      <View className="mt-5 flex-row gap-2">
        <Chip label="Selected" value="selected" />
        <Chip label="Preset" value="preset" />
        <Chip label="Custom" value="custom" />
      </View>

      {filter === "custom" ? (
        <View className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <Text className="text-sm font-semibold text-gray-900">Add new</Text>

          <View className="mt-3 flex-row items-center gap-3">
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={`New ${singularTitle}...`}
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
        </View>
      ) : null}

      <Text className="mt-6 text-base font-bold text-gray-900">
        {filter === "selected"
          ? "Selected"
          : filter === "preset"
            ? "Preset"
            : "Custom"}
      </Text>

      <FlatList
        className="mt-3"
        data={filteredItems}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => {
          const isSelected = selectedIds.has(item.id);
          const isCustom = item.isCustom === 1;

          return (
            <View
              className={`mb-3 rounded-2xl border p-4 ${
                isSelected
                  ? "border-green-600 bg-green-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-base font-semibold text-gray-900">
                    {item.name}
                  </Text>

                  <Text className="mt-1 text-xs text-gray-500">
                    {isCustom ? "Custom" : "Preset"}
                    {isCustom ? " • Tap Edit to rename/delete" : ""}
                  </Text>
                </View>

                {isCustom ? (
                  <Pressable
                    onPress={() => openEdit(item)}
                    className="mr-3 rounded-xl border border-gray-200 bg-white px-3 py-2 active:bg-gray-50"
                  >
                    <Text className="text-xs font-semibold text-gray-900">
                      Edit
                    </Text>
                  </Pressable>
                ) : null}

                <Pressable
                  onPress={() => toggleSelected(item.id)}
                  className={`rounded-xl border px-4 py-2 ${
                    isSelected
                      ? "border-gray-300 bg-white"
                      : "border-green-600 bg-green-600"
                  }`}
                >
                  <Text
                    className={`font-semibold ${
                      isSelected ? "text-gray-900" : "text-white"
                    }`}
                  >
                    {isSelected ? "Selected" : "Select"}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        ListEmptyComponent={
          <View className="mt-2 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <Text className="text-sm font-semibold text-gray-900">
              Nothing here yet
            </Text>

            <Text className="mt-1 text-xs text-gray-600">
              {filter === "selected"
                ? "Select items from Preset or Custom to see them here."
                : filter === "preset"
                  ? "No preset items found."
                  : "Add your first custom item above."}
            </Text>
          </View>
        }
      />

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
