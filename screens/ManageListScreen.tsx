import { useEffect, useMemo, useRef, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
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

function getScreenIcon(type: ManageListType): keyof typeof Ionicons.glyphMap {
  if (type === "habits") return "radio-button-on";
  if (type === "cues") return "alert-circle";
  return "location";
}

function getFilterIcon(filter: Filter): keyof typeof Ionicons.glyphMap {
  if (filter === "selected") return "checkmark-circle";
  if (filter === "preset") return "sparkles";
  return "create";
}

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

  const didSetInitialFilter = useRef(false);

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
    if (didSetInitialFilter.current) return;

    didSetInitialFilter.current = true;

    if (type !== "habits" && selectedIds.size === 0) {
      setFilter("preset");
      return;
    }

    setFilter("selected");
  }, [type, selectedIds.size]);

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

    if (wasSelected && next.length === 0 && type !== "habits") {
      setFilter("preset");
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

            const deletedId = editingItem.id;

            const result =
              type === "habits"
                ? await deleteCustomHabit(deletedId)
                : type === "cues"
                  ? await deleteCustomCue(deletedId)
                  : await deleteCustomLocation(deletedId);

            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            );

            if (returnSelection?.id === deletedId) {
              setReturnSelection(null);
            }

            closeEdit();

            if (
              type !== "habits" &&
              selectedIds.has(deletedId) &&
              selectedIds.size === 1
            ) {
              setFilter("preset");
            }

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

  const renderFilterChip = (label: string, value: Filter) => {
    const active = filter === value;

    return (
      <Pressable
        key={value}
        onPress={() => {
          Haptics.selectionAsync();
          setFilter(value);
        }}
        className={`mr-2 flex-row items-center rounded-full border px-4 py-2.5 ${
          active ? "border-green-600 bg-green-600" : "border-gray-200 bg-white"
        }`}
      >
        <Ionicons
          name={getFilterIcon(value)}
          size={16}
          color={active ? "#FFFFFF" : "#000000"}
        />

        <Text
          className={`ml-1.5 text-sm font-black ${
            active ? "text-white" : "text-black"
          }`}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  const listHeader = (
    <View className="px-5 pt-10">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-4">
          <Text className="text-sm font-black uppercase tracking-widest text-green-600">
            Manage list
          </Text>

          <Text className="mt-1 text-3xl font-black text-black">{title}</Text>
        </View>

        <View className="h-16 w-16 items-center justify-center rounded-full border-4 border-green-600 bg-white shadow-sm">
          <Ionicons name={getScreenIcon(type)} size={29} color="#000000" />
        </View>
      </View>

      {type === "habits" ? (
        <View className="mt-5 rounded-[28px] border border-gray-200 bg-gray-50 p-4 shadow-sm">
          <View className="flex-row items-center">
            <View className="h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white">
              <Ionicons name="bulb" size={24} color="#000000" />
            </View>

            <View className="ml-3 flex-1">
              <Text className="text-base font-black text-black">
                Tip: Start small
              </Text>

              <Text className="mt-1 text-sm font-semibold leading-5 text-gray-500">
                It’s usually easier to focus on one or two habits at first. You
                can always add more later.
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      <View className="mt-5 flex-row">
        {renderFilterChip("Selected", "selected")}
        {renderFilterChip("Preset", "preset")}
        {renderFilterChip("Custom", "custom")}
      </View>

      {filter === "custom" ? (
        <View className="mt-5 rounded-[32px] border border-gray-200 bg-gray-50 p-5 shadow-sm">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-xl font-black text-black">Add new</Text>

              <Text className="mt-1 text-sm font-semibold text-gray-500">
                Create a custom {singularTitle} that fits your life.
              </Text>
            </View>

            <View className="h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white">
              <Ionicons name="add-circle" size={25} color="#000000" />
            </View>
          </View>

          <View className="mt-4 flex-row items-center gap-3">
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={`New ${singularTitle}...`}
              placeholderTextColor="#9CA3AF"
              className="flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-black"
              multiline={false}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={onAdd}
            />

            <Pressable
              onPress={onAdd}
              disabled={!text.trim()}
              className={`rounded-2xl px-4 py-3 ${
                text.trim() ? "bg-green-600" : "bg-gray-300"
              }`}
            >
              <Text className="font-black text-white">Add</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View className="mb-4 mt-6 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-black text-black">
            {filter === "selected"
              ? "Selected"
              : filter === "preset"
                ? "Preset"
                : "Custom"}
          </Text>

          <Text className="mt-1 text-sm font-semibold text-gray-500">
            Tap Select to show an item on the Log screen.
          </Text>
        </View>

        <View className="rounded-full border border-gray-200 bg-white px-3 py-2 shadow-sm">
          <Text className="text-sm font-black text-green-600">
            {filteredItems.length}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-white">
      <Modal visible={!!editingItem} transparent animationType="fade">
        <View className="flex-1 justify-center bg-black/40 px-6">
          <View className="rounded-[32px] bg-white p-5">
            <View className="flex-row items-center">
              <View className="h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white">
                <Ionicons name="create" size={24} color="#000000" />
              </View>

              <View className="ml-3 flex-1">
                <Text className="text-xl font-black text-black">
                  Edit custom {singularTitle}
                </Text>

                <Text className="mt-1 text-sm leading-5 text-gray-500">
                  Rename it, or delete it from future logging.
                </Text>
              </View>
            </View>

            <TextInput
              value={editText}
              onChangeText={setEditText}
              placeholder={`Custom ${singularTitle}`}
              placeholderTextColor="#9CA3AF"
              className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-black"
              multiline={false}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={onRename}
            />

            <Pressable
              onPress={onRename}
              className="mt-4 rounded-3xl bg-green-600 py-4 active:bg-green-700"
            >
              <Text className="text-center text-base font-black text-white">
                Save Rename
              </Text>
            </Pressable>

            <Pressable
              onPress={onDelete}
              className="mt-3 rounded-3xl border border-red-200 bg-red-50 py-4 active:bg-red-100"
            >
              <Text className="text-center text-base font-black text-red-600">
                Delete Custom Item
              </Text>
            </Pressable>

            <Pressable
              onPress={closeEdit}
              className="mt-3 rounded-3xl border border-gray-200 bg-white py-4 active:bg-gray-50"
            >
              <Text className="text-center text-base font-black text-black">
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => {
          const isSelected = selectedIds.has(item.id);
          const isCustom = item.isCustom === 1;

          return (
            <View
              className={`mx-5 mb-3 rounded-[28px] border p-4 shadow-sm ${
                isSelected
                  ? "border-gray-200 bg-gray-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1 flex-row items-center pr-3">
                  <View className="h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white">
                    <Ionicons
                      name={isCustom ? "create" : "sparkles"}
                      size={24}
                      color="#000000"
                    />
                  </View>

                  <View className="ml-3 flex-1">
                    <Text className="text-base font-black text-black">
                      {item.name}
                    </Text>

                    <Text className="mt-1 text-xs font-bold uppercase tracking-wide text-gray-500">
                      {isCustom ? "Custom" : "Preset"}
                    </Text>
                  </View>
                </View>

                {isCustom ? (
                  <Pressable
                    onPress={() => openEdit(item)}
                    className="mr-3 rounded-2xl border border-gray-300 bg-white px-4 py-2.5"
                  >
                    <Text className="font-black text-black">Edit</Text>
                  </Pressable>
                ) : null}

                <Pressable
                  onPress={() => toggleSelected(item.id)}
                  className={`rounded-2xl border px-4 py-2.5 ${
                    isSelected
                      ? "border-gray-300 bg-white"
                      : "border-green-600 bg-green-600"
                  }`}
                >
                  <Text
                    className={`font-black ${
                      isSelected ? "text-black" : "text-white"
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
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={listHeader}
        contentContainerStyle={{ paddingBottom: 116 }}
        ListEmptyComponent={
          <View className="mx-5 rounded-[28px] border border-gray-200 bg-gray-50 p-5 shadow-sm">
            <View className="h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white">
              <Ionicons name="leaf" size={24} color="#000000" />
            </View>

            <Text className="mt-4 text-lg font-black text-black">
              Nothing here yet
            </Text>

            <Text className="mt-2 text-sm leading-5 text-gray-500">
              {filter === "selected"
                ? "Select items from Preset or Custom to see them here."
                : filter === "preset"
                  ? "No preset items found."
                  : "Add your first custom item above."}
            </Text>
          </View>
        }
      />

      <View className="absolute bottom-0 left-0 right-0 border-t border-gray-200 bg-white px-5 pb-6 pt-4">
        <Pressable
          onPress={onDone}
          className="w-full rounded-3xl bg-green-600 py-4 shadow-sm active:bg-green-700"
        >
          <View className="flex-row items-center justify-center">
            <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />

            <Text className="ml-2 text-center text-base font-black text-white">
              Done
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}
