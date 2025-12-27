import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Alert,
} from "react-native";
import { useData, type ReplacementAction } from "../data/DataContext";

const SELECTED = "selected" as const;
const ALL = "all" as const;
const CUSTOM = "custom" as const;

const PRESET_CATEGORIES = ["Physical", "Mental", "Social", "Creative"] as const;
type PresetCategory = (typeof PRESET_CATEGORIES)[number];

type Filter = typeof SELECTED | typeof ALL | typeof CUSTOM | PresetCategory;

export default function ShopScreen() {
  const { actions, addAction } = useData();

  const [filter, setFilter] = useState<Filter>(ALL);
  const [text, setText] = useState("");

  // NEW: selected category for custom action
  const [newCategory, setNewCategory] = useState<PresetCategory>("Physical");

  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const selectedActions = useMemo(() => {
    if (selectedIds.length === 0) return [];
    const map = new Map(actions.map((a) => [a.id, a]));
    return selectedIds
      .map((id) => map.get(id))
      .filter(Boolean) as ReplacementAction[];
  }, [actions, selectedIds]);

  const filtered = useMemo(() => {
    if (filter === SELECTED) return selectedActions;
    if (filter === ALL) return actions;
    if (filter === CUSTOM) return actions.filter((a) => a.isCustom === 1);

    return actions.filter(
      (a) => a.isCustom === 0 && (a.category ?? "") === filter
    );
  }, [actions, filter, selectedActions]);

  const toggleSelected = (actionId: number) => {
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

  const FilterPill = ({
    label,
    value,
    selected,
    onPress,
  }: {
    label: string;
    value?: any;
    selected: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
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

        <Text className="mt-3 text-sm text-gray-600">
          If you can delay the habit by 2 minutes, you’re training control.
        </Text>
      </View>
    );
  };

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
        <FilterPill
          label="Selected"
          selected={filter === SELECTED}
          onPress={() => setFilter(SELECTED)}
        />
        <FilterPill
          label="All"
          selected={filter === ALL}
          onPress={() => setFilter(ALL)}
        />
        {PRESET_CATEGORIES.map((cat) => (
          <FilterPill
            key={cat}
            label={cat}
            selected={filter === cat}
            onPress={() => setFilter(cat)}
          />
        ))}
        <FilterPill
          label="Custom"
          selected={filter === CUSTOM}
          onPress={() => setFilter(CUSTOM)}
        />
      </View>

      {/* Add new action (ONLY when Custom selected) */}
      {filter === CUSTOM && (
        <View className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
          <Text className="text-sm font-semibold text-gray-900">
            Add an action
          </Text>

          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="e.g., 10 push-ups, call a friend"
            placeholderTextColor="#9CA3AF"
            className="mt-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900"
            returnKeyType="done"
            onSubmitEditing={onAdd}
          />

          {/* Category selector */}
          <Text className="mt-4 text-xs font-semibold text-gray-600">
            Category
          </Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {PRESET_CATEGORIES.map((cat) => (
              <FilterPill
                key={cat}
                label={cat}
                selected={newCategory === cat}
                onPress={() => setNewCategory(cat)}
              />
            ))}
          </View>

          <Pressable
            onPress={onAdd}
            disabled={!text.trim()}
            className={`mt-4 rounded-xl px-4 py-3 ${
              text.trim() ? "bg-gray-900" : "bg-gray-300"
            }`}
          >
            <Text className="text-center font-semibold text-white">Add</Text>
          </Pressable>
        </View>
      )}

      {/* List */}
      <View className="mt-6 flex-1">
        <Text className="text-xl font-bold text-gray-900">
          {filter === SELECTED ? "Selected actions" : "Actions"}
        </Text>

        {filtered.length === 0 ? (
          <View className="mt-4 rounded-2xl border border-gray-200 bg-white p-5">
            <Text className="text-gray-700">
              {filter === SELECTED
                ? "No selected actions yet."
                : filter === CUSTOM
                  ? "No custom actions yet. Add one above."
                  : "No actions in this category yet."}
            </Text>
          </View>
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
    </View>
  );
}
