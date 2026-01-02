import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Alert,
  ScrollView,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
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

const SELECTED_IDS_KEY = "shop_selected_action_ids_v1";

async function loadSelectedIds(): Promise<number[]> {
  try {
    const raw = await SecureStore.getItemAsync(SELECTED_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((n) => Number(n)).filter((n) => Number.isFinite(n));
  } catch {
    return [];
  }
}

async function saveSelectedIds(ids: number[]) {
  try {
    await SecureStore.setItemAsync(SELECTED_IDS_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

function interleaveAll(actions: ReplacementAction[]): ReplacementAction[] {
  // Goal: Physical[0], Mental[0], Social[0], Creative[0], Other[0],
  // then Physical[1], Mental[1], ...
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

  // Buckets already come in DB order (isCustom ASC, id ASC). Keep it.
  const maxLen = Math.max(
    ...PRESET_CATEGORIES.map((c) => buckets[c].length),
    0
  );

  const out: ReplacementAction[] = [];
  for (let i = 0; i < maxLen; i++) {
    for (const cat of PRESET_CATEGORIES) {
      const item = buckets[cat][i];
      if (item) out.push(item);
    }
  }

  // Keep customs after presets (preserves their DB order too)
  return [...out, ...customs];
}

export default function ShopScreen() {
  const { actions, addAction } = useData();

  // start on All; we'll switch to Selected after we load persisted selections
  const [filter, setFilter] = useState<Filter>(ALL);

  const [text, setText] = useState("");
  const [newCategory, setNewCategory] = useState<PresetCategory>("Physical");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Load saved selections on first mount, then set initial chip:
  // - none selected -> All
  // - at least one selected -> Selected
  useEffect(() => {
    let alive = true;
    (async () => {
      const ids = await loadSelectedIds();
      if (!alive) return;
      setSelectedIds(ids);
      setFilter(ids.length > 0 ? SELECTED : ALL);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Persist selections whenever they change
  useEffect(() => {
    saveSelectedIds(selectedIds);
  }, [selectedIds]);

  const selectedActions = useMemo(() => {
    if (selectedIds.length === 0) return [];
    const map = new Map(actions.map((a) => [a.id, a]));
    return selectedIds
      .map((id) => map.get(id))
      .filter(Boolean) as ReplacementAction[];
  }, [actions, selectedIds]);

  const allInterleaved = useMemo(() => interleaveAll(actions), [actions]);

  const filtered = useMemo(() => {
    if (filter === SELECTED) return selectedActions;
    if (filter === ALL) return allInterleaved;
    if (filter === CUSTOM) return actions.filter((a) => a.isCustom === 1);

    return actions.filter(
      (a) => a.isCustom === 0 && (a.category ?? "") === filter
    );
  }, [actions, filter, selectedActions, allInterleaved]);

  const toggleSelected = (actionId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedIds((prev) =>
      prev.includes(actionId)
        ? prev.filter((id) => id !== actionId)
        : [actionId, ...prev]
    );
  };

  const onAdd = async () => {
    const title = text.trim();
    if (!title) return;

    await addAction({
      title,
      category: newCategory,
      isCustom: true,
    });

    setText("");
    setNewCategory("Physical");
    Alert.alert("Added ✅", `"${title}" is now in your actions list.`);
  };

  const FilterPill = ({ label, value }: { label: string; value: Filter }) => {
    const selected = filter === value;
    return (
      <Pressable
        onPress={() => setFilter(value)}
        className={`rounded-full border px-4 py-2 ${
          selected ? "bg-gray-900 border-gray-900" : "bg-white border-gray-200"
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

  const CategoryPill = ({ label }: { label: PresetCategory }) => {
    const selected = newCategory === label;
    return (
      <Pressable
        onPress={() => setNewCategory(label)}
        className={`rounded-full border px-4 py-2 ${
          selected ? "bg-gray-900 border-gray-900" : "bg-white border-gray-200"
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

  const renderItem = ({ item }: { item: ReplacementAction }) => {
    const isCustom = item.isCustom === 1;
    const isSelected = selectedIds.includes(item.id);

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

          <Pressable
            onPress={() => toggleSelected(item.id)}
            className={`rounded-xl border px-4 py-2 ${
              isSelected
                ? "bg-white border-gray-300"
                : "bg-green-600 border-green-600"
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
    <View className="mt-4 rounded-2xl border border-gray-200 bg-white p-5">
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
    <View className="flex-1 bg-white px-6 pt-10">
      <Text className="text-3xl font-bold text-gray-900">Shop</Text>

      <Text className="mt-2 text-base font-semibold text-gray-900">
        Tip: Make it easy
      </Text>
      <Text className="mt-1 text-sm text-gray-600">
        Pick something you genuinely enjoy doing, then choose the easiest
        possible version of it.
      </Text>

      {/* Filters */}
      <View className="mt-5 flex-row flex-wrap gap-2">
        <FilterPill label="Selected" value={SELECTED} />
        <FilterPill label="All" value={ALL} />
        {PRESET_CATEGORIES.map((cat) => (
          <FilterPill key={cat} label={cat} value={cat} />
        ))}
        <FilterPill label="Custom" value={CUSTOM} />
      </View>

      {/* Custom view: everything below chips scrolls */}
      {filter === CUSTOM ? (
        <ScrollView
          className="mt-5 flex-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Add new action */}
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
                <CategoryPill key={cat} label={cat} />
              ))}
            </View>
          </View>

          {/* List */}
          <View className="mt-6">
            <Text className="text-xl font-bold text-gray-900">Actions</Text>
            <Text className="mt-1 text-sm text-gray-500">
              Tap “Select” to add or remove an action.
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

          <View className="h-6" />
        </ScrollView>
      ) : (
        <View className="mt-6 flex-1">
          <Text className="text-xl font-bold text-gray-900">
            {filter === SELECTED ? "Selected actions" : "Actions"}
          </Text>
          <Text className="mt-1 text-sm text-gray-500">
            Tap “Select” to add or remove an action.
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
            />
          )}
        </View>
      )}
    </View>
  );
}
