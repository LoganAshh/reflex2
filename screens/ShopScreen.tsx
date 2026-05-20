import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Alert,
  ScrollView,
  Keyboard,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { RootTabParamList } from "../App";
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
type ShopRoute = RouteProp<RootTabParamList, "Shop">;

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

function getFilterIcon(filter: Filter): keyof typeof Ionicons.glyphMap {
  if (filter === SELECTED) return "checkmark-circle";
  if (filter === ALL) return "sparkles";
  if (filter === CUSTOM) return "create";
  if (filter === "Physical") return "fitness";
  if (filter === "Mental") return "bulb";
  if (filter === "Social") return "people";
  if (filter === "Creative") return "color-palette";
  return "ellipsis-horizontal-circle";
}

function getActionIcon(
  action: ReplacementAction,
): keyof typeof Ionicons.glyphMap {
  if (action.isCustom === 1) return "create";

  const category = action.category ?? "";

  if (category === "Physical") return "fitness";
  if (category === "Mental") return "bulb";
  if (category === "Social") return "people";
  if (category === "Creative") return "color-palette";

  return "flash";
}

export default function ShopScreen() {
  const route = useRoute<ShopRoute>();
  const {
    actions,
    addAction,
    selectedActionIds,
    toggleSelectedAction,
    renameCustomAction,
    deleteCustomAction,
  } = useData();

  const [filter, setFilter] = useState<Filter>(ALL);
  const [text, setText] = useState("");
  const [newCategory, setNewCategory] = useState<PresetCategory>("Physical");
  const [editingAction, setEditingAction] = useState<ReplacementAction | null>(
    null,
  );
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState<PresetCategory>("Physical");

  const actionListRef = useRef<FlatList<ReplacementAction> | null>(null);
  const filterScrollRef = useRef<ScrollView | null>(null);
  const filterScrollOffsetRef = useRef(0);
  const handledResetTokenRef = useRef<number | null>(null);

  const didSetInitialFilter = useRef(false);

  useEffect(() => {
    if (didSetInitialFilter.current) return;

    didSetInitialFilter.current = true;
    setFilter(selectedActionIds.length > 0 ? SELECTED : ALL);
  }, [selectedActionIds.length]);

  useEffect(() => {
    const resetToken = route.params?.resetToken;
    if (!resetToken) return;
    if (handledResetTokenRef.current === resetToken) return;

    handledResetTokenRef.current = resetToken;
    setFilter(selectedActionIds.length > 0 ? SELECTED : ALL);
    setText("");
    setNewCategory("Physical");
    filterScrollOffsetRef.current = 0;
    Keyboard.dismiss();
    actionListRef.current?.scrollToOffset({ offset: 0, animated: true });
    filterScrollRef.current?.scrollTo({ x: 0, animated: true });
  }, [route.params?.resetToken, selectedActionIds.length]);

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

  const currentFilterLabel =
    filter === SELECTED
      ? "Selected"
      : filter === ALL
        ? "All actions"
        : filter === CUSTOM
          ? "Custom"
          : filter;

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

    Keyboard.dismiss();

    try {
      await addAction({
        title,
        category: newCategory,
        isCustom: true,
      });

      setText("");
      setNewCategory("Physical");

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {},
      );

      Alert.alert(
        "Already exists",
        e?.message ?? "That action already exists.",
      );
    }
  };

  const openEdit = (action: ReplacementAction) => {
    if (action.isCustom !== 1) return;

    setEditingAction(action);
    setEditTitle(action.title);
    setEditCategory(
      PRESET_CATEGORIES.includes((action.category ?? "") as PresetCategory)
        ? ((action.category ?? "Physical") as PresetCategory)
        : "Physical",
    );
  };

  const closeEdit = () => {
    Keyboard.dismiss();
    setEditingAction(null);
    setEditTitle("");
    setEditCategory("Physical");
  };

  const onRenameAction = async () => {
    if (!editingAction) return;

    const cleanTitle = editTitle.trim();
    if (!cleanTitle) return;

    try {
      await renameCustomAction(editingAction.id, cleanTitle, editCategory);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeEdit();
    } catch (e: any) {
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error,
      ).catch(() => {});
      Alert.alert(
        "Could not save",
        e?.message ?? "That action name is already used.",
      );
    }
  };

  const onDeleteAction = () => {
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

  const renderFilterPill = (label: string, value: Filter) => {
    const selected = filter === value;

    return (
      <Pressable
        key={value}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          setFilter(value);
        }}
        className={`mr-2 flex-row items-center rounded-full border px-4 py-2.5 ${
          selected
            ? "border-green-600 bg-green-600"
            : "border-gray-200 bg-white"
        }`}
      >
        <Ionicons
          name={getFilterIcon(value)}
          size={16}
          color={selected ? "#FFFFFF" : "#000000"}
        />

        <Text
          className={`ml-1.5 text-sm font-black ${
            selected ? "text-white" : "text-black"
          }`}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  const renderCategoryPill = (label: PresetCategory) => {
    const selected = newCategory === label;

    return (
      <Pressable
        key={label}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          setNewCategory(label);
        }}
        className={`mr-2 mt-2 flex-row items-center rounded-full border px-4 py-2.5 ${
          selected
            ? "border-green-600 bg-green-600"
            : "border-gray-200 bg-white"
        }`}
      >
        <Ionicons
          name={getFilterIcon(label)}
          size={16}
          color={selected ? "#FFFFFF" : "#000000"}
        />

        <Text
          className={`ml-1.5 text-sm font-black ${
            selected ? "text-white" : "text-black"
          }`}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  const renderEditCategoryPill = (label: PresetCategory) => {
    const selected = editCategory === label;

    return (
      <Pressable
        key={label}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          setEditCategory(label);
        }}
        className={`mr-2 mt-2 flex-row items-center rounded-full border px-4 py-2.5 ${
          selected
            ? "border-green-600 bg-green-600"
            : "border-gray-200 bg-white"
        }`}
      >
        <Ionicons
          name={getFilterIcon(label)}
          size={16}
          color={selected ? "#FFFFFF" : "#000000"}
        />

        <Text
          className={`ml-1.5 text-sm font-black ${
            selected ? "text-white" : "text-black"
          }`}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  const ActionCard = ({ item }: { item: ReplacementAction }) => {
    const isCustom = item.isCustom === 1;
    const isSelected = selectedActionIds.includes(item.id);

    return (
      <View
        className={`mx-5 mb-3 rounded-3xl border p-4 shadow-sm ${
          isSelected ? "border-gray-200 bg-gray-50" : "border-gray-200 bg-white"
        }`}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1 flex-row items-center pr-3">
            <View className="h-12 w-12 items-center justify-center rounded-3xl border border-gray-200 bg-white">
              <Ionicons name={getActionIcon(item)} size={24} color="#000000" />
            </View>

            <View className="ml-3 flex-1">
              <Text className="text-base font-black text-black">
                {item.title}
              </Text>

              <Text className="mt-1 text-xs font-bold uppercase tracking-wide text-gray-500">
                {isCustom ? "Custom" : "Preset"}
                {item.category ? ` • ${item.category}` : ""}
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
            onPress={() => onToggleSelected(item.id)}
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
  };

  const EmptyState = () => (
    <View className="mt-4 rounded-3xl border border-gray-200 bg-gray-50 p-5 shadow-sm">
      <View className="h-12 w-12 items-center justify-center rounded-3xl border border-gray-200 bg-white">
        <Ionicons name="leaf" size={24} color="#000000" />
      </View>

      <Text className="mt-4 text-lg font-black text-black">
        Nothing here yet
      </Text>

      <Text className="mt-2 text-sm leading-5 text-gray-500">
        {filter === SELECTED
          ? "No selected actions yet. Choose a few easy actions from All."
          : filter === CUSTOM
            ? "No custom actions yet. Add one above."
            : "No actions in this category yet."}
      </Text>
    </View>
  );

  const listHeader = (
    <View>
      <View className="px-5 pt-10">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-4">
            <Text className="text-sm font-black uppercase tracking-widest text-green-600">
              Action shop
            </Text>

            <Text className="mt-1 text-3xl font-black text-black">
              Pick your backups
            </Text>
          </View>

          <View className="h-16 w-16 items-center justify-center rounded-full border-4 border-green-600 bg-white shadow-sm">
            <Ionicons name="bag-handle" size={29} color="#000000" />
          </View>
        </View>

        <View className="mt-5 rounded-3xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
          <View className="flex-row items-center">
            <View className="h-10 w-10 items-center justify-center rounded-3xl border border-gray-200 bg-white">
              <Ionicons name="bulb" size={21} color="#000000" />
            </View>

            <View className="ml-3 flex-1">
              <Text className="text-sm font-black text-black">
                Tip: make it easy
              </Text>

              <Text className="mt-1 text-sm font-semibold leading-5 text-gray-500">
                Pick something enjoyable, then choose the easiest version.
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          ref={filterScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-5"
          scrollEventThrottle={16}
          contentOffset={{ x: filterScrollOffsetRef.current, y: 0 }}
          onScroll={(event) => {
            filterScrollOffsetRef.current = event.nativeEvent.contentOffset.x;
          }}
        >
          {renderFilterPill("Selected", SELECTED)}
          {renderFilterPill("All", ALL)}

          {PRESET_CATEGORIES.map((cat) => renderFilterPill(cat, cat))}

          {renderFilterPill("Custom", CUSTOM)}
        </ScrollView>
      </View>

      {filter === CUSTOM ? (
        <View className="mx-5 mt-5 rounded-[32px] border border-gray-200 bg-gray-50 p-5 shadow-sm">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-xl font-black text-black">
                Create your own
              </Text>

              <Text className="mt-1 text-sm font-semibold text-gray-500">
                Add a backup action that fits your life.
              </Text>
            </View>

            <View className="h-12 w-12 items-center justify-center rounded-3xl border border-gray-200 bg-white">
              <Ionicons name="add-circle" size={25} color="#000000" />
            </View>
          </View>

          <View className="mt-4 flex-row items-center gap-3">
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="e.g., 10 push-ups, call a friend"
              placeholderTextColor="#9CA3AF"
              className="flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-black"
              returnKeyType="done"
              onSubmitEditing={() => {
                if (text.trim()) onAdd();
              }}
              blurOnSubmit
            />

            <Pressable
              onPress={onAdd}
              className={`rounded-2xl px-4 py-3 ${
                text.trim() ? "bg-green-600" : "bg-gray-300"
              }`}
              disabled={!text.trim()}
            >
              <Text className="font-black text-white">Add</Text>
            </Pressable>
          </View>

          <Text className="mt-5 text-xs font-black uppercase tracking-wide text-gray-500">
            Category
          </Text>

          <View className="mt-1 flex-row flex-wrap">
            {PRESET_CATEGORIES.map((cat) => renderCategoryPill(cat))}
          </View>
        </View>
      ) : null}

      <View className="mx-5 mb-4 mt-6 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-black text-black">
            {currentFilterLabel}
          </Text>

          <Text className="mt-1 text-sm font-semibold text-gray-500">
            Tap “Select” to add or remove an action.
          </Text>
        </View>

        <View className="rounded-full border border-gray-200 bg-white px-3 py-2 shadow-sm">
          <Text className="text-sm font-black text-green-600">
            {filtered.length}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-white">
      <Modal visible={!!editingAction} transparent animationType="fade">
        <View className="flex-1 justify-center bg-black/40 px-6">
          <View className="rounded-[32px] bg-white p-5">
            <View className="flex-row items-center">
              <View className="h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white">
                <Ionicons name="create" size={24} color="#000000" />
              </View>

              <View className="ml-3 flex-1">
                <Text className="text-xl font-black text-black">
                  Edit custom action
                </Text>

                <Text className="mt-1 text-sm leading-5 text-gray-500">
                  Rename it, change the category, or delete it from future use.
                </Text>
              </View>
            </View>

            <TextInput
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Custom action"
              placeholderTextColor="#9CA3AF"
              className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-black"
              multiline={false}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={() => Keyboard.dismiss()}
            />

            <Text className="mt-5 text-xs font-black uppercase tracking-wide text-gray-500">
              Category
            </Text>

            <View className="mt-1 flex-row flex-wrap">
              {PRESET_CATEGORIES.map((cat) => renderEditCategoryPill(cat))}
            </View>

            <Pressable
              onPress={onRenameAction}
              disabled={!editTitle.trim()}
              className={`mt-4 rounded-3xl py-4 ${
                editTitle.trim() ? "bg-green-600" : "bg-gray-300"
              }`}
            >
              <Text className="text-center text-base font-black text-white">
                Save Changes
              </Text>
            </Pressable>

            <Pressable
              onPress={onDeleteAction}
              className="mt-3 rounded-3xl border border-red-200 bg-red-50 py-4 active:bg-red-100"
            >
              <Text className="text-center text-base font-black text-red-600">
                Delete Custom Action
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
        ref={actionListRef}
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <ActionCard item={item} />}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <View className="px-5">
            <EmptyState />
          </View>
        }
        contentContainerStyle={{
          paddingBottom: 28,
        }}
      />
    </View>
  );
}
