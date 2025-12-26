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

type Filter = "all" | "preset" | "custom";

export default function ShopScreen() {
  const { actions, addAction } = useData();

  const [filter, setFilter] = useState<Filter>("all");
  const [text, setText] = useState("");
  const [suggestionId, setSuggestionId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return actions;

    return actions.filter((a) =>
      filter === "preset" ? a.isCustom === 0 : a.isCustom === 1
    );
  }, [actions, filter]);

  const activeSuggestion = useMemo(() => {
    if (filtered.length === 0) return null;
    if (suggestionId == null) return filtered[0];
    return filtered.find((a) => a.id === suggestionId) ?? filtered[0];
  }, [filtered, suggestionId]);

  const pickRandomSuggestion = () => {
    if (filtered.length === 0) return;
    const idx = Math.floor(Math.random() * filtered.length);
    setSuggestionId(filtered[idx].id);
  };

  const onTry = (action: ReplacementAction) => {
    Alert.alert(
      "Nice choice ✅",
      `Try: "${action.title}"\n\nEven a small replacement action is progress.`,
      [{ text: "Got it" }]
    );
  };

  const onAdd = async () => {
    const title = text.trim();
    if (!title) return;

    await addAction({ title, isCustom: true }); // ✅ FIX: matches AddActionInput
    setText("");
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

  const renderItem = ({ item }: { item: ReplacementAction }) => {
    const isCustom = item.isCustom === 1;

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
            onPress={() => onTry(item)}
            className="rounded-xl bg-green-600 px-4 py-2"
          >
            <Text className="font-semibold text-white">Try</Text>
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
      <Text className="mt-2 text-gray-600">
        Replacement actions to do instead of the habit.
      </Text>

      {/* Suggestion */}
      <View className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
        <Text className="text-base font-semibold text-gray-900">
          Suggestion
        </Text>

        {activeSuggestion ? (
          <>
            <Text className="mt-2 text-xl font-bold text-gray-900">
              {activeSuggestion.title}
            </Text>

            <View className="mt-4 flex-row gap-3">
              <Pressable
                onPress={() => onTry(activeSuggestion)}
                className="flex-1 rounded-2xl bg-green-600 px-5 py-4"
              >
                <Text className="text-center text-base font-semibold text-white">
                  Try this now
                </Text>
              </Pressable>

              <Pressable
                onPress={pickRandomSuggestion}
                className="rounded-2xl border border-gray-200 bg-white px-5 py-4"
              >
                <Text className="text-center text-base font-semibold text-gray-900">
                  Shuffle
                </Text>
              </Pressable>
            </View>

            <Text className="mt-3 text-xs text-gray-500">
              Tip: You don’t need motivation — just a small replacement.
            </Text>
          </>
        ) : (
          <Text className="mt-2 text-sm text-gray-600">
            No actions yet. Add one below.
          </Text>
        )}
      </View>

      {/* Filters */}
      <View className="mt-5 flex-row gap-2">
        <FilterPill label="All" value="all" />
        <FilterPill label="Presets" value="preset" />
        <FilterPill label="Custom" value="custom" />
      </View>

      {/* Add new action */}
      <View className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
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

        <Text className="mt-2 text-xs text-gray-500">
          Actions are stored locally on your device.
        </Text>
      </View>

      {/* List */}
      <View className="mt-6 flex-1">
        <Text className="text-xl font-bold text-gray-900">Actions</Text>
        <Text className="mt-1 text-sm text-gray-500">
          Tap “Try” to use one right now.
        </Text>

        {filtered.length === 0 ? (
          <View className="mt-4 rounded-2xl border border-gray-200 bg-white p-5">
            <Text className="text-gray-700">
              {filter === "custom"
                ? "No custom actions yet. Add one above."
                : "No actions yet. Add your first one above."}
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
