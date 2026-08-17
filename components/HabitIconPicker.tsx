import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { HABIT_ICON_CATEGORIES, type HabitIconName } from "../data/habitIcons";

type Props = {
  selectedIcon: HabitIconName;
  color: string;
  onSelect: (icon: HabitIconName) => void;
};

export function HabitIconPicker({ selectedIcon, color, onSelect }: Props) {
  const categoryScrollRef = useRef<ScrollView | null>(null);
  const iconScrollRef = useRef<ScrollView | null>(null);
  const categoryOffsets = useRef<Record<string, number>>({});
  const sectionOffsets = useRef<Record<string, number>>({});
  const isCategoryJumping = useRef(false);
  const jumpResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeCategory, setActiveCategory] = useState(
    HABIT_ICON_CATEGORIES.find((category) =>
      category.icons.includes(selectedIcon),
    )?.name ?? HABIT_ICON_CATEGORIES[0].name,
  );

  useEffect(() => {
    const categoryOffset = categoryOffsets.current[activeCategory];
    if (categoryOffset == null) return;

    categoryScrollRef.current?.scrollTo({
      x: Math.max(0, categoryOffset - 12),
      animated: true,
    });
  }, [activeCategory]);

  const jumpToCategory = (categoryName: string) => {
    Haptics.selectionAsync();
    setActiveCategory(categoryName);
    isCategoryJumping.current = true;
    if (jumpResetTimer.current) clearTimeout(jumpResetTimer.current);
    jumpResetTimer.current = setTimeout(() => {
      isCategoryJumping.current = false;
    }, 700);
    iconScrollRef.current?.scrollTo({
      x: Math.max(0, (sectionOffsets.current[categoryName] ?? 0) - 4),
      animated: true,
    });
  };

  return (
    <View>
      <ScrollView
        ref={categoryScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <View className="flex-row gap-2 pr-3">
          {HABIT_ICON_CATEGORIES.map((category) => {
            const selected = category.name === activeCategory;

            return (
              <Pressable
                key={category.name}
                onPress={() => jumpToCategory(category.name)}
                onLayout={(event) => {
                  categoryOffsets.current[category.name] =
                    event.nativeEvent.layout.x;
                }}
                accessibilityRole="button"
                accessibilityLabel={`Jump to ${category.name} icons`}
                className={`rounded-full border px-3 py-2 ${
                  selected
                    ? "border-green-600 bg-green-600"
                    : "border-gray-200 bg-white"
                }`}
              >
                <Text
                  className={`text-xs font-black ${
                    selected ? "text-white" : "text-black"
                  }`}
                >
                  {category.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <ScrollView
        ref={iconScrollRef}
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        className="mt-4"
        scrollEventThrottle={16}
        onScroll={(event) => {
          if (isCategoryJumping.current) return;

          const x = event.nativeEvent.contentOffset.x + 24;
          let visibleCategory = HABIT_ICON_CATEGORIES[0].name;

          for (const category of HABIT_ICON_CATEGORIES) {
            const offset = sectionOffsets.current[category.name];
            if (offset == null || offset > x) break;
            visibleCategory = category.name;
          }

          setActiveCategory(visibleCategory);
        }}
        onMomentumScrollEnd={() => {
          isCategoryJumping.current = false;
        }}
      >
        <View className="flex-row items-stretch pr-3">
          {HABIT_ICON_CATEGORIES.map((category, categoryIndex) => (
            <View
              key={category.name}
              className="flex-row items-stretch"
              onLayout={(event) => {
                sectionOffsets.current[category.name] =
                  event.nativeEvent.layout.x;
              }}
            >
              {categoryIndex > 0 ? (
                <View className="mx-4 w-px bg-gray-200" />
              ) : null}

              <View>
                <Text className="mb-2 text-xs font-black uppercase tracking-wide text-gray-500">
                  {category.name}
                </Text>
                <View className="flex-row gap-3">
                  {Array.from(
                    { length: Math.ceil(category.icons.length / 3) },
                    (_, columnIndex) => (
                      <View key={columnIndex} className="gap-3">
                        {category.icons
                          .slice(columnIndex * 3, columnIndex * 3 + 3)
                          .map((icon) => {
                            const selected = selectedIcon === icon;

                            return (
                              <Pressable
                                key={icon}
                                onPress={() => {
                                  Haptics.selectionAsync();
                                  onSelect(icon);
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={`Choose ${icon.replaceAll("-", " ")} icon`}
                                className="h-12 w-12 items-center justify-center rounded-2xl border bg-white"
                                style={{
                                  borderColor: selected ? color : "#E5E7EB",
                                  borderWidth: selected ? 3 : 1,
                                }}
                              >
                                <Ionicons
                                  name={icon}
                                  size={24}
                                  color={selected ? color : "#4B5563"}
                                />
                              </Pressable>
                            );
                          })}
                      </View>
                    ),
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View className="mt-3 flex-row items-center justify-center">
        <Text className="mr-1 text-xs font-bold text-gray-500">
          Scroll to see more icons
        </Text>
        <Ionicons name="chevron-forward" size={14} color="#6B7280" />
      </View>
    </View>
  );
}
