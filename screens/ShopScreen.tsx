import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Alert,
  ScrollView,
  Modal,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useData, type ReplacementAction } from "../data/DataContext";

const SELECTED = "selected" as const;
const ALL = "all" as const;
const CUSTOM = "custom" as const;

const PRESET_CATEGORIES = [
  "Physical",
  "Mental",
  "Social",
  "Creative",
  "Other",
] as const;

type PresetCategory = (typeof PRESET_CATEGORIES)[number];
type Filter = typeof SELECTED | typeof ALL | typeof CUSTOM | PresetCategory;

function interleaveAll(actions: ReplacementAction[]): ReplacementAction[] {
  const customs: ReplacementAction[] = [];
  const buckets: Record<PresetCategory, ReplacementAction[]> = {
    Physical: [],
    Mental: [],
    Social: [],
    Creative: [],
    Other: [],
  };

  for (const a of actions) {
    if (a.isCustom === 1) {
      customs.push(a);
      continue;
    }
    const cat = (a.category ?? "") as PresetCategory;
    if (PRESET_CATEGORIES.includes(cat)) buckets[cat].push(a);
    else buckets.Other.push(a);
  }

  const maxLen = Math.max(
    ...PRESET_CATEGORIES.map((c) => buckets[c].length),
    0,
  );

  const out: ReplacementAction[] = [];
  for (let i = 0; i < maxLen; i++) {
    for (const cat of PRESET_CATEGORIES) {
      const item = buckets[cat][i];
      if (item) out.push(item);
    }
  }

  return [...out, ...customs];
}

export default function ShopScreen() {
  const {
    actions,
    addAction,
    renameCustomAction,
    deleteCustomAction,
    selectedActionIds,
    toggleSelectedAction,
  } = useData();

  const [filter, setFilter] = useState<Filter>(ALL);
  const [text, setText] = useState("");
  const [newCategory, setNewCategory] = useState<PresetCategory>("Physical");
  const [editingAction, setEditingAction] = useState<ReplacementAction | null>(
    null,
  );
  const [editText, setEditText] = useState("");
  const [editCategory, setEditCategory] = useState<PresetCategory>("Physical");

  const didSetInitialFilter = useRef(false);
  useEffect(() => {
    if (didSetInitialFilter.current) return;
    didSetInitialFilter.current = true;
    setFilter(selectedActionIds.length > 0 ? SELECTED : ALL);
  }, [selectedActionIds.length]);

  const selectedActions = useMemo(() => {
    if (selectedActionIds.length === 0) return [];
    const map = new Map(actions.map((a) => [a.id, a]));
    return selectedActionIds
      .map((id) => map.get(id))
      .filter(Boolean) as ReplacementAction[];
  }, [actions, selectedActionIds]);

  const allInterleaved = useMemo(() => interleaveAll(actions), [actions]);

  const filtered = useMemo(() => {
    if (filter === SELECTED) return selectedActions;
    if (filter === ALL) return allInterleaved;
    if (filter === CUSTOM) return actions.filter((a) => a.isCustom === 1);

    return actions.filter(
      (a) => a.isCustom === 0 && (a.category ?? "") === filter,
    );
  }, [actions, filter, selectedActions, allInterleaved]);

  const onToggleSelected = async (actionId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await toggleSelectedAction(actionId);

    if (filter === SELECTED && selectedActionIds.length === 1) {
      setFilter(ALL);
    }
  };

  const onAdd = async () => {
    const title = text.trim();
    if (!title) return;

    try {
      await addAction({
        title,
        category: newCategory,
        isCustom: true,
      });

      setText("");
      setNewCategory("Physical");
      Alert.alert("Added ✅", `“${title}” is now in your actions list.`);
    } catch (e: any) {
      Alert.alert(
        "Already exists",
        e?.message ?? "That action already exists.",
      );
    }
  };

  const openEdit = (action: ReplacementAction) => {
    if (action.isCustom !== 1) return;
    setEditingAction(action);
    setEditText(action.title);
    setEditCategory(
      PRESET_CATEGORIES.includes((action.category ?? "") as PresetCategory)
        ? ((action.category ?? "Physical") as PresetCategory)
        : "Physical",
    );
  };

  const closeEdit = () => {
    setEditingAction(null);
    setEditText("");
    setEditCategory("Physical");
  };

  const onRename = async () => {
    if (!editingAction) return;
    const title = editText.trim();
    if (!title) return;

    try {
      await renameCustomAction(editingAction.id, title, editCategory);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeEdit();
    } catch (e: any) {
      Alert.alert(
        "Could not rename",
        e?.message ?? "That action name is already used.",
      );
    }
  };

  const onDelete = () => {
    if (!editingAction) return;

    Alert.alert(
      "Delete action?",
      `This removes “${editingAction.title}” from future use. If old logs use it, those logs will keep their saved text.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!editingAction) return;
            const result = await deleteCustomAction(editingAction.id);

            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            );
            closeEdit();

            if (result === "hidden") {
              Alert.alert(
                "Hidden from future use",
                "This action was used in old logs, so it was hidden instead of fully deleted. Historical logs still keep the original text.",
              );
            }
          },
        },
      ],
    );
  };

  const FilterPill = ({ label, value }: { label: string; value: Filter }) => {
    const selected = filter === value;
    return (
      <Pressable
        onPress={() => setFilter(value)}
        className={`rounded-full border px-4 py-2 ${
          selected ? "border-gray-900 bg-gray-900" : "border-gray-200 bg-white"
        }`}
      >
        <Text
          className={`${selected ? "text-white" : "text-gray-900"} font-semibold`}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  const CategoryPill = ({
    label,
    selected,
    onPress,
  }: {
    label: PresetCategory;
    selected: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      className={`rounded-full border px-4 py-2 ${
        selected ? "border-gray-900 bg-gray-900" : "border-gray-200 bg-white"
      }`}
    >
      <Text
        className={`${selected ? "text-white" : "text-gray-900"} font-semibold`}
      >
        {label}
      </Text>
    </Pressable>
  );

  const renderItem = ({ item }: { item: ReplacementAction }) => {
    const isCustom = item.isCustom === 1;
    const isSelected = selectedActionIds.includes(item.id);

    return (
      <View className="mb-3 rounded-2xl border border-gray-200 bg-white p-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-base font-semibold text-gray-900">
              {item.title}
            </Text>
            <Text className="mt-1 text-xs text-gray-500">
              {isCustom ? "Custom" : "Preset"}
              {item.category ? ` • ${item.category}` : ""}
            </Text>
          </View>

          {isCustom ? (
            <Pressable
              onPress={() => openEdit(item)}
              className="mr-2 rounded-xl border border-gray-200 bg-white px-3 py-2 active:bg-gray-50"
            >
              <Text className="font-semibold text-gray-900">Edit</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => onToggleSelected(item.id)}
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
  };

  const EmptyState = () => (
    <View className="mx-6 mt-4 rounded-2xl border border-gray-200 bg-white p-5">
      <Text className="text-gray-700">
        {filter === SELECTED
          ? "No selected actions yet."
          : filter === CUSTOM
            ? "No custom actions yet. Add one above."
            : "No actions in this category yet."}
      </Text>
    </View>
  );

  return (
    <View className="flex-1 bg-white pt-10">
      <Modal visible={!!editingAction} transparent animationType="fade">
        <View className="flex-1 justify-center bg-black/40 px-6">
          <View className="rounded-3xl bg-white p-5">
            <Text className="text-xl font-bold text-gray-900">
              Edit custom action
            </Text>
            <Text className="mt-2 text-sm text-gray-600">
              Rename it, change the category, or delete it from future use.
            </Text>

            <TextInput
              value={editText}
              onChangeText={setEditText}
              placeholder="Custom action"
              placeholderTextColor="#9CA3AF"
              className="mt-4 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-gray-900"
              returnKeyType="done"
              onSubmitEditing={onRename}
              blurOnSubmit
            />

            <Text className="mt-4 text-xs font-semibold text-gray-600">
              Category
            </Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {PRESET_CATEGORIES.map((cat) => (
                <CategoryPill
                  key={cat}
                  label={cat}
                  selected={editCategory === cat}
                  onPress={() => setEditCategory(cat)}
                />
              ))}
            </View>

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
                Delete Custom Action
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

      <View className="px-6">
        <Text className="text-3xl font-bold text-gray-900">Shop</Text>

        <Text className="mt-2 text-base font-semibold text-gray-900">
          Tip: Make it easy
        </Text>
        <Text className="mt-1 text-sm text-gray-600">
          Pick something you genuinely enjoy doing, then choose the easiest
          possible version of it.
        </Text>

        <View className="mt-5 flex-row flex-wrap gap-2">
          <FilterPill label="Selected" value={SELECTED} />
          <FilterPill label="All" value={ALL} />
          {PRESET_CATEGORIES.map((cat) => (
            <FilterPill key={cat} label={cat} value={cat} />
          ))}
          <FilterPill label="Custom" value={CUSTOM} />
        </View>
      </View>

      {filter === CUSTOM ? (
        <ScrollView
          className="mt-5 flex-1"
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
        >
          <View className="rounded-2xl border border-gray-200 bg-white p-4">
            <Text className="text-sm font-semibold text-gray-900">
              Add an action
            </Text>

            <View className="mt-3 flex-row items-center gap-3">
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="e.g., 10 push-ups, call a friend"
                placeholderTextColor="#9CA3AF"
                className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900"
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (text.trim()) onAdd();
                }}
                blurOnSubmit
              />

              <Pressable
                onPress={onAdd}
                className={`rounded-xl px-4 py-3 ${
                  text.trim() ? "bg-gray-900" : "bg-gray-300"
                }`}
                disabled={!text.trim()}
              >
                <Text className="font-semibold text-white">Add</Text>
              </Pressable>
            </View>

            <Text className="mt-4 text-xs font-semibold text-gray-600">
              Category
            </Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {PRESET_CATEGORIES.map((cat) => (
                <CategoryPill
                  key={cat}
                  label={cat}
                  selected={newCategory === cat}
                  onPress={() => setNewCategory(cat)}
                />
              ))}
            </View>
          </View>

          <View className="mt-6">
            <Text className="text-xl font-bold text-gray-900">Actions</Text>
            <Text className="mt-1 text-sm text-gray-500">
              Tap “Select” to add or remove an action. Custom actions can also
              be edited.
            </Text>

            {filtered.length === 0 ? (
              <EmptyState />
            ) : (
              <FlatList
                className="mt-4"
                data={filtered}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderItem}
                showsVerticalScrollIndicator={false}
                scrollEnabled={false}
              />
            )}
          </View>
        </ScrollView>
      ) : (
        <View className="mt-6 flex-1">
          <View className="px-6">
            <Text className="text-xl font-bold text-gray-900">
              {filter === SELECTED ? "Selected actions" : "Actions"}
            </Text>
            <Text className="mt-1 text-sm text-gray-500">
              Tap “Select” to add or remove an action. Custom actions can also
              be edited.
            </Text>
          </View>

          {filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <FlatList
              className="mt-4 flex-1"
              data={filtered}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderItem}
              showsVerticalScrollIndicator
              contentContainerStyle={{
                paddingHorizontal: 24,
                paddingBottom: 20,
              }}
            />
          )}
        </View>
      )}
    </View>
  );
}
