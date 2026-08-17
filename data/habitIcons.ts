import type { Ionicons } from "@expo/vector-icons";

export type HabitIconName = keyof typeof Ionicons.glyphMap;

export const DEFAULT_HABIT_ICON: HabitIconName = "ellipse";

export const HABIT_ICON_CATEGORIES: readonly {
  name: string;
  icons: readonly HabitIconName[];
}[] = [
  {
    name: "Popular",
    icons: [
      "ellipse",
      "heart",
      "star",
      "flash",
      "flame",
      "leaf",
      "happy",
      "sad",
      "alert-circle",
      "checkmark-circle",
      "eye",
      "eye-off",
    ],
  },
  {
    name: "Tech",
    icons: [
      "phone-portrait",
      "game-controller",
      "tv",
      "desktop",
      "laptop",
      "headset",
      "camera",
      "chatbubble",
      "musical-notes",
      "radio",
      "videocam",
      "wifi",
      "notifications",
      "newspaper",
      "globe",
    ],
  },
  {
    name: "Food",
    icons: [
      "fast-food",
      "cafe",
      "wine",
      "beer",
      "ice-cream",
      "pizza",
      "restaurant",
      "water",
      "nutrition",
      "fish",
      "basket",
    ],
  },
  {
    name: "Health",
    icons: [
      "medical",
      "fitness",
      "walk",
      "bicycle",
      "bed",
      "moon",
      "sunny",
      "body",
      "pulse",
      "bandage",
      "medkit",
      "thermometer",
    ],
  },
  {
    name: "Shopping",
    icons: [
      "cart",
      "cash",
      "card",
      "basket",
      "gift",
      "shirt",
      "pricetag",
      "wallet",
      "storefront",
      "bag-handle",
      "diamond",
    ],
  },
  {
    name: "Activities",
    icons: [
      "book",
      "football",
      "baseball",
      "dice",
      "basketball",
      "golf",
      "barbell",
      "stopwatch",
      "school",
      "airplane",
      "train",
      "car",
      "paw",
      "map",
      "compass",
      "color-palette",
      "brush",
      "hammer",
      "construct",
    ],
  },
  {
    name: "Routine",
    icons: [
      "alarm",
      "calendar",
      "time",
      "repeat",
      "key",
      "lock-closed",
      "home",
      "briefcase",
      "people",
      "person",
      "hand-left",
      "thumbs-up",
      "trending-down",
    ],
  },
] as const;

export const HABIT_ICON_OPTIONS: readonly HabitIconName[] =
  HABIT_ICON_CATEGORIES.flatMap((category) => category.icons).filter(
    (icon, index, icons) => icons.indexOf(icon) === index,
  );

export const PRESET_HABIT_ICONS: Record<string, HabitIconName> = {
  "Social Media": "phone-portrait",
  "Junk Food": "fast-food",
  Caffeine: "cafe",
  Shopping: "cart",
  "Video Games": "game-controller",
  Alcohol: "wine",
  Nicotine: "flame",
  Streaming: "tv",
  Porn: "eye-off",
  Weed: "leaf",
  Gambling: "dice",
  Prescriptions: "medical",
};

export function cleanHabitIcon(value: unknown): HabitIconName {
  return typeof value === "string" &&
    HABIT_ICON_OPTIONS.includes(value as HabitIconName)
    ? (value as HabitIconName)
    : DEFAULT_HABIT_ICON;
}
