import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  Pressable,
  Switch,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Keyboard,
  Modal,
  ScrollView,
  Animated,
  UIManager,
  findNodeHandle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList, RootTabParamList } from "../App";
import { Screen } from "../components/Screen";
import {
  useData,
  type SelectedHabit,
  type SelectedCue,
  type SelectedPlace,
} from "../data/DataContext";

type StackNav = NativeStackNavigationProp<RootStackParamList>;
type TabNav = BottomTabNavigationProp<RootTabParamList>;
type Nav = StackNav & TabNav;
type LogRoute = RouteProp<RootTabParamList, "Log">;

type ChipItem = {
  key: string;
  label: string;
  id: number | null;
  kind: "value" | "none" | "add";
  color?: string | null;
};

type BaseItem = { id: number; name: string; color?: string | null };

type TimePreset = {
  label: string;
  hour: number;
  minute: number;
};

type DatePreset = {
  label: string;
  daysAgo: number;
};

type RelativeTimePreset = {
  label: string;
  hoursAgo: number;
};

const DATE_PRESETS: DatePreset[] = [
  { label: "Today", daysAgo: 0 },
  { label: "Yesterday", daysAgo: 1 },
  { label: "2 days ago", daysAgo: 2 },
  { label: "Last week", daysAgo: 7 },
  { label: "Tomorrow", daysAgo: -1 },
  { label: "Next week", daysAgo: -7 },
];

const TIME_PRESETS: TimePreset[] = [
  { label: "Morning", hour: 8, minute: 0 },
  { label: "Afternoon", hour: 13, minute: 0 },
  { label: "Evening", hour: 18, minute: 0 },
  { label: "Night", hour: 22, minute: 0 },
];

const RELATIVE_TIME_PRESETS: RelativeTimePreset[] = [
  { label: "Now", hoursAgo: 0 },
  { label: "1 hour ago", hoursAgo: 1 },
  { label: "2 hours ago", hoursAgo: 2 },
  { label: "3 hours ago", hoursAgo: 3 },
];

function dateForPreset(preset: DatePreset) {
  const date = new Date();
  date.setDate(date.getDate() - preset.daysAgo);
  return date;
}

function dateForRelativeTimePreset(preset: RelativeTimePreset) {
  const date = new Date();
  date.setHours(date.getHours() - preset.hoursAgo);
  date.setSeconds(0, 0);
  return date;
}

function isSameCalendarDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

async function lightHaptic() {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function formatDateButton(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeButton(date: Date) {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function quantityUnit(unit: string, value: number) {
  if (value !== 1) return unit;
  if (unit.toLowerCase() === "times") return "time";
  if (unit.toLowerCase() === "minutes") return "minute";
  return unit;
}

function formatQuantity(value: number, unit: string) {
  return `${value} ${quantityUnit(unit, value)}`;
}

function mergeDatePart(current: Date, selectedDate: Date) {
  const next = new Date(current);
  next.setFullYear(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate(),
  );
  return next;
}

function mergeTimePart(current: Date, selectedDate: Date) {
  const next = new Date(current);
  next.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
  return next;
}

function applyFrequencyOrdering<T extends { id: number }>(
  items: T[],
  frequencyCounts: Map<number, number>,
) {
  if (items.length === 0) return items;

  const originalRank = new Map<number, number>();
  items.forEach((item, index) => {
    originalRank.set(item.id, index);
  });

  return [...items].sort((a, b) => {
    const aCount = frequencyCounts.get(a.id) ?? 0;
    const bCount = frequencyCounts.get(b.id) ?? 0;

    if (aCount !== bCount) {
      return bCount - aCount;
    }

    return (originalRank.get(a.id) ?? 0) - (originalRank.get(b.id) ?? 0);
  });
}

function scrollChipToId<T extends { id: number }>(
  listRef: React.RefObject<FlatList<ChipItem> | null>,
  items: T[],
  id: number | null,
  allowNone?: boolean,
) {
  const index =
    id == null
      ? allowNone
        ? 0
        : -1
      : items.findIndex((item) => item.id === id) + (allowNone ? 1 : 0);

  if (index < 0) return;

  requestAnimationFrame(() => {
    listRef.current?.scrollToIndex({
      index,
      animated: true,
      viewPosition: 0.5,
    });
  });
}

function HeaderInfoBubble({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Log screen information"
      className="ml-1.5 h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white"
    >
      <Ionicons name="information" size={13} color="#6B7280" />
    </Pressable>
  );
}

function HelperIcon({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-9 w-9 items-center justify-center rounded-2xl border border-gray-200 bg-white"
    >
      <Ionicons name={icon} size={19} color="#000000" />
    </Pressable>
  );
}

function InfoModal({
  visible,
  title,
  body,
  icon,
  onClose,
}: {
  visible: boolean;
  title: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/40 px-6"
        onPress={onClose}
      >
        <Pressable
          className="w-full rounded-[32px] bg-white p-5"
          onPress={() => {}}
        >
          <View className="flex-row items-center">
            <View className="h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white">
              <Ionicons name={icon} size={24} color="#000000" />
            </View>

            <View className="ml-3 flex-1">
              <Text className="text-xl font-black text-black">{title}</Text>
            </View>
          </View>

          <Text className="mt-4 text-sm font-semibold leading-5 text-gray-600">
            {body}
          </Text>

          <Pressable
            onPress={onClose}
            className="mt-5 rounded-2xl bg-green-600 px-4 py-3"
          >
            <Text className="text-center text-sm font-black text-white">
              Got it
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ExactDateTimePickerOverlay({
  visible,
  mode,
  value,
  onChange,
  onClose,
}: {
  visible: boolean;
  mode: "date" | "time";
  value: Date;
  onChange: (date: Date) => void;
  onClose: () => void;
}) {
  const isDate = mode === "date";
  if (!visible) return null;

  return (
    <Pressable
      className="w-full rounded-[28px] bg-white p-5 shadow-lg"
      onPress={() => {}}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row flex-1 items-center pr-3">
          <View className="h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white">
            <Ionicons
              name={isDate ? "calendar-outline" : "time-outline"}
              size={22}
              color="#000000"
            />
          </View>
          <Text className="ml-3 text-lg font-black text-black">
            {isDate ? "Choose exact date" : "Choose exact time"}
          </Text>
        </View>

        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={`Close exact ${mode} picker`}
          className="h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-gray-50"
        >
          <Ionicons name="close" size={21} color="#000000" />
        </Pressable>
      </View>

      <View
        className="mt-4 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 px-2 py-3"
        style={
          Platform.OS === "ios" ? { height: isDate ? 360 : 220 } : undefined
        }
      >
        <DateTimePicker
          value={value}
          mode={mode}
          display={
            Platform.OS === "ios" ? (isDate ? "inline" : "spinner") : "default"
          }
          onChange={(_, selectedDate) => {
            if (!selectedDate) {
              if (Platform.OS !== "ios") onClose();
              return;
            }
            onChange(selectedDate);
            if (Platform.OS !== "ios") onClose();
          }}
          textColor="#000000"
          themeVariant="light"
          style={
            Platform.OS === "ios"
              ? { width: "100%", height: isDate ? 340 : 200 }
              : undefined
          }
        />
      </View>

      {Platform.OS === "ios" ? (
        <Pressable
          onPress={async () => {
            await lightHaptic();
            onClose();
          }}
          className="mt-4 rounded-2xl bg-green-600 px-5 py-3"
        >
          <Text className="text-center text-sm font-black text-white">
            Done
          </Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

function LogDateTimeModal({
  visible,
  value,
  onChange,
  onClose,
}: {
  visible: boolean;
  value: Date;
  onChange: (date: Date) => void;
  onClose: () => void;
}) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const selectedPreset = TIME_PRESETS.find(
    (preset) =>
      value.getHours() === preset.hour && value.getMinutes() === preset.minute,
  );

  const selectedDatePreset = DATE_PRESETS.find((preset) =>
    isSameCalendarDay(value, dateForPreset(preset)),
  );

  const selectedRelativeTimePreset = RELATIVE_TIME_PRESETS.find((preset) => {
    const presetDate = dateForRelativeTimePreset(preset);
    return (
      isSameCalendarDay(value, presetDate) &&
      value.getHours() === presetDate.getHours() &&
      value.getMinutes() === presetDate.getMinutes()
    );
  });

  const applyDatePreset = async (preset: DatePreset) => {
    await lightHaptic();
    onChange(mergeDatePart(value, dateForPreset(preset)));
    setShowDatePicker(false);
  };

  const applyTimePreset = async (preset: TimePreset) => {
    await lightHaptic();
    const next = new Date(value);
    next.setHours(preset.hour, preset.minute, 0, 0);
    onChange(next);
    setShowTimePicker(false);
  };

  const applyRelativeTimePreset = async (preset: RelativeTimePreset) => {
    await lightHaptic();
    onChange(dateForRelativeTimePreset(preset));
    setShowTimePicker(false);
  };

  const closeModal = () => {
    setShowDatePicker(false);
    setShowTimePicker(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={closeModal}
    >
      <View className="flex-1">
        <Pressable
          className="flex-1 items-center justify-center bg-black/40 px-4"
          onPress={() => {
            if (showDatePicker) setShowDatePicker(false);
            else if (showTimePicker) setShowTimePicker(false);
            else closeModal();
          }}
        >
          {showDatePicker ? (
            <ExactDateTimePickerOverlay
              visible
              mode="date"
              value={value}
              onChange={(selectedDate) =>
                onChange(mergeDatePart(value, selectedDate))
              }
              onClose={() => setShowDatePicker(false)}
            />
          ) : showTimePicker ? (
            <ExactDateTimePickerOverlay
              visible
              mode="time"
              value={value}
              onChange={(selectedDate) =>
                onChange(mergeTimePart(value, selectedDate))
              }
              onClose={() => setShowTimePicker(false)}
            />
          ) : (
            <Pressable
              className="w-full rounded-[32px] bg-white p-5"
              onPress={() => {}}
            >
              <View className="flex-row items-center">
                <View className="h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white">
                  <Ionicons name="calendar" size={24} color="#000000" />
                </View>

                <View className="ml-3 flex-1">
                  <Text className="text-xl font-black text-black">
                    Edit date & time
                  </Text>
                  <Text className="mt-1 text-sm font-semibold text-gray-500">
                    Change when this check-in happened.
                  </Text>
                </View>
              </View>

              <View className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-3">
                <View className="flex-row flex-wrap">
                  {DATE_PRESETS.map((preset) => {
                    const selected = selectedDatePreset?.label === preset.label;

                    return (
                      <Pressable
                        key={preset.label}
                        onPress={() => applyDatePreset(preset)}
                        className={`mb-2 mr-2 rounded-full border px-4 py-2.5 ${
                          selected
                            ? "border-green-600 bg-green-600"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        <Text
                          className={`text-sm font-black ${
                            selected ? "text-white" : "text-black"
                          }`}
                        >
                          {preset.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  onPress={() => {
                    lightHaptic();
                    Keyboard.dismiss();
                    setShowTimePicker(false);
                    setShowDatePicker(true);
                  }}
                  className="mt-1 flex-row items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3"
                >
                  <View>
                    <Text className="text-xs font-black uppercase tracking-wide text-gray-500">
                      Exact date
                    </Text>
                    <Text className="mt-1 text-sm font-black text-black">
                      {formatDateButton(value)}
                    </Text>
                  </View>
                  <Ionicons name="calendar-outline" size={18} color="#000000" />
                </Pressable>
              </View>

              <View className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-3">
                <View className="flex-row flex-wrap">
                  {RELATIVE_TIME_PRESETS.map((preset) => {
                    const selected =
                      selectedRelativeTimePreset?.label === preset.label;

                    return (
                      <Pressable
                        key={preset.label}
                        onPress={() => applyRelativeTimePreset(preset)}
                        className={`mb-2 mr-2 rounded-full border px-4 py-2.5 ${
                          selected
                            ? "border-green-600 bg-green-600"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        <Text
                          className={`text-sm font-black ${
                            selected ? "text-white" : "text-black"
                          }`}
                        >
                          {preset.label}
                        </Text>
                      </Pressable>
                    );
                  })}

                  {TIME_PRESETS.map((preset) => {
                    const selected = selectedPreset?.label === preset.label;

                    return (
                      <Pressable
                        key={preset.label}
                        onPress={() => applyTimePreset(preset)}
                        className={`mb-2 mr-2 rounded-full border px-4 py-2.5 ${
                          selected
                            ? "border-green-600 bg-green-600"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        <Text
                          className={`text-sm font-black ${
                            selected ? "text-white" : "text-black"
                          }`}
                        >
                          {preset.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  onPress={() => {
                    lightHaptic();
                    Keyboard.dismiss();
                    setShowDatePicker(false);
                    setShowTimePicker(true);
                  }}
                  className="mt-1 flex-row items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3"
                >
                  <View>
                    <Text className="text-xs font-black uppercase tracking-wide text-gray-500">
                      Exact time
                    </Text>
                    <Text className="mt-1 text-sm font-black text-black">
                      {formatTimeButton(value)}
                    </Text>
                  </View>
                  <Ionicons name="time-outline" size={18} color="#000000" />
                </Pressable>
              </View>

              <Pressable
                onPress={() => {
                  lightHaptic();
                  closeModal();
                }}
                className="mt-5 rounded-2xl bg-green-600 px-4 py-3"
              >
                <Text className="text-center text-sm font-black text-white">
                  Done
                </Text>
              </Pressable>
            </Pressable>
          )}
        </Pressable>
      </View>
    </Modal>
  );
}

function ChipRow<T extends BaseItem>({
  title,
  icon,
  onInfo,
  items,
  selectedId,
  selectedIds,
  onSelect,
  onToggle,
  allowNone,
  onAdd,
  listRef,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onInfo: () => void;
  items: T[];
  selectedId: number | null;
  selectedIds?: number[];
  onSelect?: (id: number | null) => void;
  onToggle?: (id: number | null) => void;
  allowNone?: boolean;
  onAdd: () => void;
  listRef: React.RefObject<FlatList<ChipItem> | null>;
}) {
  const data: ChipItem[] = [
    ...(allowNone
      ? [{ key: "none", label: "None", id: null, kind: "none" as const }]
      : []),
    ...items.map((x) => ({
      key: `v-${x.id}`,
      label: x.name,
      id: x.id,
      kind: "value" as const,
      color: typeof x.color === "string" ? x.color : null,
    })),
    { key: "add", label: "+ Add", id: null, kind: "add" as const },
  ];

  const renderItem = ({ item }: { item: ChipItem }) => {
    const isSelected =
      item.kind === "none"
        ? selectedIds
          ? selectedIds.length === 0
          : selectedId == null
        : item.kind === "value"
          ? selectedIds
            ? item.id != null && selectedIds.includes(item.id)
            : item.id === selectedId
          : false;

    const selectedColor =
      item.kind === "value" && typeof item.color === "string"
        ? item.color
        : "#16A34A";

    return (
      <Pressable
        onPress={() => {
          if (item.kind === "add") {
            onAdd();
            return;
          }

          if (selectedIds && onToggle) onToggle(item.id);
          else onSelect?.(item.id);
        }}
        className={`mr-2 rounded-full border px-3 py-1.5 ${
          item.kind === "add" || !isSelected ? "border-gray-200 bg-white" : ""
        }`}
        style={
          item.kind !== "add" && isSelected
            ? { borderColor: selectedColor, backgroundColor: selectedColor }
            : undefined
        }
      >
        <Text
          className={`text-xs font-black ${
            item.kind === "add"
              ? "text-black"
              : isSelected
                ? "text-white"
                : "text-black"
          }`}
          numberOfLines={1}
        >
          {item.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View className="mt-2 w-full rounded-3xl border border-gray-200 bg-gray-50 p-3 shadow-sm">
      <View className="flex-row items-center">
        <HelperIcon icon={icon} label={`${title} helper`} onPress={onInfo} />

        <View className="ml-2 flex-1">
          <Text className="text-sm font-black text-black">{title}</Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        className="mt-2"
        horizontal
        showsHorizontalScrollIndicator={false}
        data={data}
        keyExtractor={(x) => x.key}
        renderItem={renderItem}
        extraData={{ selectedId, selectedIds, items }}
        keyboardShouldPersistTaps="handled"
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            listRef.current?.scrollToOffset({
              offset: Math.max(0, info.averageItemLength * info.index),
              animated: true,
            });
          }, 80);
        }}
      />
    </View>
  );
}

function IntensityPickerModal({
  visible,
  value,
  onPick,
  onClear,
  onClose,
}: {
  visible: boolean;
  value: number | null;
  onPick: (n: number) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const options = useMemo(
    () => Array.from({ length: 10 }, (_, i) => i + 1),
    [],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/40 px-6"
        onPress={onClose}
      >
        <Pressable
          className="w-full rounded-[32px] bg-white p-5"
          onPress={() => {}}
        >
          <View className="flex-row items-center">
            <View className="h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white">
              <Ionicons name="pulse" size={24} color="#000000" />
            </View>

            <View className="ml-3 flex-1">
              <Text className="text-xl font-black text-black">
                Pick intensity
              </Text>
              <Text className="mt-1 text-sm font-semibold text-gray-500">
                1 low, 10 high
              </Text>
            </View>
          </View>

          <View className="mt-5 flex-row flex-wrap">
            {options.map((n) => {
              const selected = value === n;

              return (
                <Pressable
                  key={n}
                  onPress={() => onPick(n)}
                  className={`mb-2 mr-2 rounded-full border px-4 py-2.5 ${
                    selected
                      ? "border-green-600 bg-green-600"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <Text
                    className={`text-sm font-black ${
                      selected ? "text-white" : "text-black"
                    }`}
                  >
                    {n}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View className="mt-3 flex-row justify-between">
            <Pressable
              onPress={onClear}
              className="rounded-2xl border border-gray-200 bg-white px-4 py-3"
            >
              <Text className="text-sm font-black text-black">Set None</Text>
            </Pressable>

            <Pressable
              onPress={onClose}
              className="rounded-2xl bg-green-600 px-4 py-3"
            >
              <Text className="text-sm font-black text-white">Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CountPickerModal({
  visible,
  value,
  unit,
  onPick,
  onClose,
}: {
  visible: boolean;
  value: number;
  unit: string;
  onPick: (n: number) => void;
  onClose: () => void;
}) {
  const [customValue, setCustomValue] = useState("");
  const [showCustomValue, setShowCustomValue] = useState(false);
  const customValueInputRef = useRef<TextInput | null>(null);
  const options = useMemo(
    () =>
      unit.trim().toLowerCase() === "minutes"
        ? [1, 5, 10, 15, 20, 30, 45, 60]
        : Array.from({ length: 10 }, (_, i) => i + 1),
    [unit],
  );

  const labelFor = (n: number) => formatQuantity(n, unit);

  useEffect(() => {
    if (!visible) {
      setShowCustomValue(false);
      setCustomValue("");
      return;
    }

    if (!options.includes(value)) {
      setShowCustomValue(true);
      setCustomValue(String(value));
    }
  }, [visible, value, options]);

  const submitCustomValue = () => {
    const rawAmount = Number(customValue);
    if (!Number.isFinite(rawAmount) || rawAmount < 1) return;
    const amount = Math.min(999999, Math.max(1, Math.round(rawAmount)));
    onPick(amount);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/40 px-6"
          onPress={onClose}
        >
          <Pressable
            className="w-full rounded-[32px] bg-white p-5"
            onPress={() => {}}
          >
            <View className="flex-row items-center">
              <View className="h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white">
                <Ionicons name="repeat" size={24} color="#000000" />
              </View>

              <View className="ml-3 flex-1">
                <Text className="text-xl font-black text-black">
                  Quantity logged
                </Text>
                <Text className="mt-1 text-sm font-semibold text-gray-500">
                  Log the actual amount, not just one event.
                </Text>
              </View>
            </View>

            <View className="mt-5 flex-row flex-wrap">
              {options.map((n) => {
                const selected = !showCustomValue && value === n;

                return (
                  <Pressable
                    key={n}
                    onPress={() => onPick(n)}
                    className={`mb-2 mr-2 rounded-full border px-4 py-2.5 ${
                      selected
                        ? "border-green-600 bg-green-600"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <Text
                      className={`text-sm font-black ${
                        selected ? "text-white" : "text-black"
                      }`}
                    >
                      {labelFor(n)}
                    </Text>
                  </Pressable>
                );
              })}

              <Pressable
                onPress={() => {
                  setShowCustomValue(true);
                  requestAnimationFrame(() =>
                    customValueInputRef.current?.focus(),
                  );
                }}
                className={`mb-2 mr-2 rounded-full border px-4 py-2.5 ${
                  showCustomValue
                    ? "border-green-600 bg-green-600"
                    : "border-gray-200 bg-white"
                }`}
              >
                <Text
                  className={`text-sm font-black ${
                    showCustomValue ? "text-white" : "text-black"
                  }`}
                >
                  Custom
                </Text>
              </Pressable>
            </View>

            {showCustomValue ? (
              <View className="mt-3 flex-row items-center gap-2">
                <TextInput
                  ref={customValueInputRef}
                  value={customValue}
                  onChangeText={setCustomValue}
                  placeholder={`Other ${unit}`}
                  placeholderTextColor="#9CA3AF"
                  keyboardType={
                    Platform.OS === "ios"
                      ? "numbers-and-punctuation"
                      : "number-pad"
                  }
                  returnKeyType="done"
                  blurOnSubmit
                  onSubmitEditing={submitCustomValue}
                  className="flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-black"
                />
                <Pressable
                  onPress={submitCustomValue}
                  disabled={
                    !Number.isFinite(Number(customValue)) ||
                    Number(customValue) < 1
                  }
                  className={`rounded-2xl px-5 py-3 ${
                    Number(customValue) >= 1 ? "bg-green-600" : "bg-gray-300"
                  }`}
                >
                  <Text className="font-black text-white">Done</Text>
                </Pressable>
              </View>
            ) : null}

            {!showCustomValue ? (
              <View className="mt-3 flex-row justify-end">
                <Pressable
                  onPress={onClose}
                  className="rounded-2xl bg-green-600 px-5 py-3"
                >
                  <Text className="text-sm font-black text-white">Done</Text>
                </Pressable>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function LogScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<LogRoute>();

  const {
    selectedHabits,
    selectedCues,
    selectedLocations,
    logs,
    addLog,
    updateLog,
  } = useData();

  const [habitId, setHabitId] = useState<number | null>(null);
  const [cueIds, setCueIds] = useState<number[]>([]);
  const [locationId, setLocationId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [didResist, setDidResist] = useState<boolean>(false);
  const [intensity, setIntensity] = useState<number | null>(null);
  const [showIntensityPicker, setShowIntensityPicker] = useState(false);
  const [count, setCount] = useState<number>(1);
  const [showCountPicker, setShowCountPicker] = useState(false);
  const [logDate, setLogDate] = useState(() => new Date());
  const [showLogDateTimeModal, setShowLogDateTimeModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [infoModal, setInfoModal] = useState<{
    title: string;
    body: string;
    icon: keyof typeof Ionicons.glyphMap;
  } | null>(null);

  const keyboardLiftAnim = useRef(new Animated.Value(0)).current;
  const habitListRef = useRef<FlatList<ChipItem> | null>(null);
  const cueListRef = useRef<FlatList<ChipItem> | null>(null);
  const locationListRef = useRef<FlatList<ChipItem> | null>(null);
  const notesInputRef = useRef<TextInput | null>(null);
  const notesAnchorRef = useRef<View | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const handledManageListTokenRef = useRef<number | null>(null);
  const handledResetTokenRef = useRef<number | null>(null);
  const saveInProgressRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      saveInProgressRef.current = false;
      setSaving(false);
    }, []),
  );

  const habitFrequencyCounts = useMemo(() => {
    const counts = new Map<number, number>();

    for (const log of logs) {
      counts.set(log.habitId, (counts.get(log.habitId) ?? 0) + 1);
    }

    return counts;
  }, [logs]);

  const cueAssociationCounts = useMemo(() => {
    const counts = new Map<number, number>();

    if (habitId == null) return counts;

    for (const log of logs) {
      if (log.habitId !== habitId) continue;
      for (const cueId of log.cueIds) {
        counts.set(cueId, (counts.get(cueId) ?? 0) + 1);
      }
    }

    return counts;
  }, [logs, habitId]);

  const locationAssociationCounts = useMemo(() => {
    const counts = new Map<number, number>();

    if (habitId == null) return counts;

    for (const log of logs) {
      if (log.habitId !== habitId) continue;
      if (log.locationId == null) continue;

      counts.set(log.locationId, (counts.get(log.locationId) ?? 0) + 1);
    }

    return counts;
  }, [logs, habitId]);

  const orderedHabits = useMemo(
    () => applyFrequencyOrdering(selectedHabits, habitFrequencyCounts),
    [selectedHabits, habitFrequencyCounts],
  );

  const activeHabit = useMemo(
    () => selectedHabits.find((habit) => habit.id === habitId) ?? null,
    [selectedHabits, habitId],
  );
  const countUnit = activeHabit?.unit?.trim() || "times";

  const orderedCues = useMemo(
    () => applyFrequencyOrdering(selectedCues, cueAssociationCounts),
    [selectedCues, cueAssociationCounts],
  );

  const orderedLocations = useMemo(
    () => applyFrequencyOrdering(selectedLocations, locationAssociationCounts),
    [selectedLocations, locationAssociationCounts],
  );

  const scrollChipRowsToStart = () => {
    habitListRef.current?.scrollToOffset({ offset: 0, animated: true });
    cueListRef.current?.scrollToOffset({ offset: 0, animated: true });
    locationListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const scrollNotesIntoView = () => {
    requestAnimationFrame(() => {
      const scrollNode = findNodeHandle(scrollViewRef.current);
      const notesNode = findNodeHandle(notesAnchorRef.current);

      if (!scrollNode || !notesNode) {
        scrollViewRef.current?.scrollToEnd({ animated: true });
        return;
      }

      UIManager.measureLayout(
        notesNode,
        scrollNode,
        () => scrollViewRef.current?.scrollToEnd({ animated: true }),
        (_x, y, _width, height) => {
          const targetY = Math.max(0, y + height - 220);
          scrollViewRef.current?.scrollTo({ y: targetY, animated: true });
        },
      );
    });
  };

  const getDefaultHabitId = () => orderedHabits[0]?.id ?? null;

  const getDefaultHabitIdAfterLog = (submittedHabitId: number) => {
    const nextCounts = new Map(habitFrequencyCounts);
    nextCounts.set(
      submittedHabitId,
      (nextCounts.get(submittedHabitId) ?? 0) + 1,
    );

    return applyFrequencyOrdering(selectedHabits, nextCounts)[0]?.id ?? null;
  };

  const resetToDefaults = (habitOverrideId?: number | null) => {
    setErrorMsg(null);
    setHabitId(habitOverrideId ?? getDefaultHabitId());
    setCueIds([]);
    setLocationId(null);
    setNotes("");
    setShowNotes(false);
    setDidResist(false);
    setIntensity(null);
    setCount(1);
    setShowIntensityPicker(false);
    setShowCountPicker(false);
    setShowLogDateTimeModal(false);
    setLogDate(new Date());

    requestAnimationFrame(() => {
      Keyboard.dismiss();
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      scrollChipRowsToStart();
    });
  };

  useEffect(() => {
    if (habitId == null && orderedHabits.length > 0) {
      setHabitId(orderedHabits[0].id);
    }
  }, [orderedHabits, habitId]);

  useEffect(() => {
    const resetToken = route.params?.resetToken;
    if (!resetToken) return;
    if (handledResetTokenRef.current === resetToken) return;

    handledResetTokenRef.current = resetToken;
    resetToDefaults();
  }, [route.params?.resetToken, orderedHabits]);

  useEffect(() => {
    const selection = route.params?.manageListSelection;
    if (!selection) return;
    if (handledManageListTokenRef.current === selection.token) return;

    if (selection.type === "habits") {
      const exists = selectedHabits.some((habit) => habit.id === selection.id);
      if (!exists) return;

      setHabitId(selection.id);
      setErrorMsg(null);
      handledManageListTokenRef.current = selection.token;

      setTimeout(() => {
        scrollChipToId(habitListRef, orderedHabits, selection.id);
      }, 120);

      return;
    }

    if (selection.type === "cues") {
      const exists = selectedCues.some((cue) => cue.id === selection.id);
      if (!exists) return;

      setCueIds((current) =>
        current.includes(selection.id) ? current : [...current, selection.id],
      );
      handledManageListTokenRef.current = selection.token;

      setTimeout(() => {
        scrollChipToId(cueListRef, orderedCues, selection.id, true);
      }, 120);

      return;
    }

    const exists = selectedLocations.some(
      (location) => location.id === selection.id,
    );

    if (!exists) return;

    setLocationId(selection.id);
    handledManageListTokenRef.current = selection.token;

    setTimeout(() => {
      scrollChipToId(locationListRef, orderedLocations, selection.id, true);
    }, 120);
  }, [
    route.params?.manageListSelection?.type,
    route.params?.manageListSelection?.id,
    route.params?.manageListSelection?.token,
    selectedHabits,
    selectedCues,
    selectedLocations,
    orderedHabits,
    orderedCues,
    orderedLocations,
  ]);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);

      Animated.timing(keyboardLiftAnim, {
        toValue: -150,
        duration: 120,
        useNativeDriver: true,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);

      Animated.timing(keyboardLiftAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardLiftAnim]);

  const unlockSave = () => {
    saveInProgressRef.current = false;
    setSaving(false);
  };

  const onSave = async () => {
    if (saveInProgressRef.current) return;

    saveInProgressRef.current = true;
    setSaving(true);
    setErrorMsg(null);

    if (habitId == null) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {},
      );
      setErrorMsg("Select a habit before saving.");
      unlockSave();
      return;
    }

    const submittedHabitId = habitId;
    const submittedCueIds = cueIds;
    const submittedLocationId = locationId;
    const submittedIntensity = intensity;
    const submittedDidResist = didResist;
    const submittedCount = submittedDidResist ? 0 : Math.max(1, count);
    const submittedNotes = notes.trim() || undefined;
    const submittedCreatedAt = logDate.getTime();

    try {
      const newLogId = await addLog({
        habitId: submittedHabitId,
        createdAt: submittedCreatedAt,
        cueIds: submittedCueIds,
        locationId: submittedLocationId,
        intensity: submittedIntensity,
        count: submittedCount,
        didResist: submittedDidResist,
        notes: submittedNotes,
      });

      if (newLogId != null) {
        await updateLog(newLogId, {
          habitId: submittedHabitId,
          cueIds: submittedCueIds,
          locationId: submittedLocationId,
          intensity: submittedIntensity,
          count: submittedCount,
          didResist: submittedDidResist,
          notes: submittedNotes,
          createdAt: submittedCreatedAt,
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );

      resetToDefaults(getDefaultHabitIdAfterLog(submittedHabitId));

      if (newLogId != null) {
        navigation.navigate("UrgeHelp", { logId: newLogId });
        return;
      }

      unlockSave();
      navigation.navigate("Home");
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {},
      );
      setErrorMsg("Could not save. Try again.");
      unlockSave();
    }
  };

  const onShowNotes = () => {
    setShowNotes((v) => {
      const next = !v;

      if (!v && next) {
        setTimeout(() => {
          notesInputRef.current?.focus();
          scrollNotesIntoView();
        }, 80);
      }

      return next;
    });
  };

  const setDidResistAndMaybeCount = (v: boolean) => {
    setDidResist(v);

    if (v) {
      setCount(0);
    } else if (count === 0) {
      setCount(1);
    }
  };

  const intensityLabel = intensity == null ? "None" : `${intensity}/10`;
  const countLabel = formatQuantity(didResist ? 0 : count, countUnit);

  const openInfo = (
    title: string,
    body: string,
    icon: keyof typeof Ionicons.glyphMap,
  ) => {
    setInfoModal({ title, body, icon });
  };

  const ValueCard = ({
    label,
    value,
    icon,
    onPress,
    disabled,
  }: {
    label: string;
    value: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress?: () => void;
    disabled?: boolean;
  }) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="flex-1 rounded-3xl border border-gray-200 bg-gray-50 p-3 shadow-sm"
    >
      <View className="flex-row items-center justify-between">
        <View className="h-9 w-9 items-center justify-center rounded-2xl border border-gray-200 bg-white">
          <Ionicons name={icon} size={19} color="#000000" />
        </View>

        {onPress ? (
          <View className="rounded-full border border-gray-200 bg-white px-2 py-0.5">
            <Text className="text-[10px] font-black text-black">Change</Text>
          </View>
        ) : null}
      </View>

      <Text className="mt-2 text-[10px] font-black uppercase tracking-wide text-gray-500">
        {label}
      </Text>
      <Text className="mt-0.5 text-base font-black text-black">{value}</Text>
    </Pressable>
  );

  return (
    <Screen keyboardAvoiding keyboardVerticalOffset={0}>
      <IntensityPickerModal
        visible={showIntensityPicker}
        value={intensity}
        onPick={(n) => {
          setIntensity(n);
          setShowIntensityPicker(false);
        }}
        onClear={() => {
          setIntensity(null);
          setShowIntensityPicker(false);
        }}
        onClose={() => setShowIntensityPicker(false)}
      />

      <CountPickerModal
        visible={showCountPicker}
        value={Math.max(1, count)}
        unit={countUnit}
        onPick={(n) => {
          setCount(n);
          setDidResist(false);
          setShowCountPicker(false);
        }}
        onClose={() => setShowCountPicker(false)}
      />

      <LogDateTimeModal
        visible={showLogDateTimeModal}
        value={logDate}
        onChange={setLogDate}
        onClose={() => setShowLogDateTimeModal(false)}
      />

      <InfoModal
        visible={infoModal != null}
        title={infoModal?.title ?? ""}
        body={infoModal?.body ?? ""}
        icon={infoModal?.icon ?? "information-circle"}
        onClose={() => setInfoModal(null)}
      />

      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 34,
          paddingBottom: keyboardHeight > 0 ? 72 : 16,
        }}
      >
        <Animated.View
          style={{
            transform: [{ translateY: keyboardLiftAnim }],
          }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-xs font-black uppercase tracking-widest text-green-600">
                Check-in
              </Text>

              <View className="mt-0.5 flex-row items-center">
                <Text className="text-2xl font-black text-black">
                  Log the moment
                </Text>

                <HeaderInfoBubble
                  onPress={() =>
                    openInfo(
                      "Hidden shortcuts",
                      "Tap the top-right icon to change the date and time of this check-in. Tap the icon beside each section to learn what that section is for.",
                      "information-circle",
                    )
                  }
                />
              </View>
            </View>

            <Pressable
              onPress={async () => {
                await lightHaptic();
                Keyboard.dismiss();
                setShowLogDateTimeModal(true);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Change log date and time"
              className="h-12 w-12 items-center justify-center rounded-full border-4 border-green-600 bg-white shadow-sm"
            >
              <Ionicons
                name={
                  (activeHabit?.icon as keyof typeof Ionicons.glyphMap) ??
                  "ellipse"
                }
                size={23}
                color="#000000"
              />
            </Pressable>
          </View>

          {logs.length === 0 ? (
            <View className="mt-2 flex-row items-center px-1">
              <Ionicons name="shield-checkmark" size={15} color="#16A34A" />
              <Text className="ml-1.5 text-xs font-semibold text-gray-500">
                Your habit data stays on this device.
              </Text>
            </View>
          ) : null}

          <ChipRow<SelectedHabit>
            title="Habit"
            icon="radio-button-on"
            onInfo={() =>
              openInfo(
                "Habit",
                "Choose the habit or urge you are logging right now.",
                "radio-button-on",
              )
            }
            items={orderedHabits}
            selectedId={habitId}
            onSelect={(id) => {
              setHabitId(id);
              setErrorMsg(null);
            }}
            onAdd={() => navigation.navigate("ManageList", { type: "habits" })}
            listRef={habitListRef}
          />

          <ChipRow<SelectedCue>
            title="Cues"
            icon="alert-circle"
            onInfo={() =>
              openInfo(
                "Cues",
                "Pick everything that seemed to contribute to the urge. You can select more than one, or leave this as None.",
                "alert-circle",
              )
            }
            items={orderedCues}
            selectedId={null}
            selectedIds={cueIds}
            onToggle={(id) => {
              if (id == null) {
                setCueIds([]);
                return;
              }
              setCueIds((current) =>
                current.includes(id)
                  ? current.filter((cueId) => cueId !== id)
                  : [...current, id],
              );
            }}
            allowNone
            onAdd={() => navigation.navigate("ManageList", { type: "cues" })}
            listRef={cueListRef}
          />

          <ChipRow<SelectedPlace>
            title="Location"
            icon="location"
            onInfo={() =>
              openInfo(
                "Location",
                "Pick where the urge happened. You can leave this as None if the place does not matter.",
                "location",
              )
            }
            items={orderedLocations}
            selectedId={locationId}
            onSelect={setLocationId}
            allowNone
            onAdd={() =>
              navigation.navigate("ManageList", { type: "locations" })
            }
            listRef={locationListRef}
          />

          <View className="mt-2 rounded-3xl border border-gray-200 bg-gray-50 p-3 shadow-sm">
            <View className="flex-row items-center justify-between">
              <View className="flex-row flex-1 items-center pr-4">
                <HelperIcon
                  icon={didResist ? "shield-checkmark" : "shield-outline"}
                  label="Did you resist helper"
                  onPress={() =>
                    openInfo(
                      "Did you resist?",
                      "Turn this on when you felt the urge but chose not to act on it. Quantity will automatically become 0.",
                      didResist ? "shield-checkmark" : "shield-outline",
                    )
                  }
                />

                <View className="ml-2 flex-1">
                  <Text className="text-sm font-black text-black">
                    Did you resist?
                  </Text>
                </View>
              </View>

              <Switch
                value={didResist}
                onValueChange={setDidResistAndMaybeCount}
                trackColor={{ false: "#E5E7EB", true: "#86EFAC" }}
                thumbColor={didResist ? "#16A34A" : "#F9FAFB"}
              />
            </View>
          </View>

          <View className="mt-2 flex-row gap-2">
            <ValueCard
              label="Quantity"
              value={countLabel}
              icon="repeat"
              onPress={() => {
                if (!didResist) setShowCountPicker(true);
              }}
              disabled={didResist}
            />

            <ValueCard
              label="Intensity"
              value={intensityLabel}
              icon="pulse"
              onPress={() => setShowIntensityPicker(true)}
            />
          </View>

          <View className="mt-2 rounded-3xl border border-gray-200 bg-gray-50 p-3 shadow-sm">
            <View className="flex-row items-center justify-between">
              <View className="flex-row flex-1 items-center pr-3">
                <HelperIcon
                  icon="document-text"
                  label="Notes helper"
                  onPress={() =>
                    openInfo(
                      "Notes",
                      "Add anything that might help you spot patterns later. This is optional.",
                      "document-text",
                    )
                  }
                />

                <View className="ml-2 flex-1">
                  <Text className="text-sm font-black text-black">Notes</Text>
                </View>
              </View>

              <Pressable
                onPress={onShowNotes}
                className="rounded-2xl border border-gray-200 bg-white px-3 py-1.5"
              >
                <Text className="text-xs font-black text-black">
                  {showNotes ? "Hide" : "Add"}
                </Text>
              </Pressable>
            </View>

            {showNotes ? (
              <View ref={notesAnchorRef} collapsable={false}>
                <TextInput
                  ref={notesInputRef}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Anything useful to remember..."
                  placeholderTextColor="#9CA3AF"
                  className="mt-2 min-h-[38px] w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-black"
                  returnKeyType="done"
                  submitBehavior="blurAndSubmit"
                  blurOnSubmit
                  multiline={false}
                  onSubmitEditing={() => Keyboard.dismiss()}
                  onFocus={scrollNotesIntoView}
                />
              </View>
            ) : null}
          </View>

          {errorMsg ? (
            <View className="mt-2 rounded-3xl border border-red-200 bg-red-50 px-4 py-2">
              <Text className="text-xs font-black text-red-700">
                {errorMsg}
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={onSave}
            disabled={saving}
            className={`mt-3 w-full rounded-3xl px-5 py-3 shadow-sm ${
              saving ? "bg-green-300" : "bg-green-600"
            }`}
          >
            <View className="flex-row items-center justify-center">
              <Ionicons name="save" size={20} color="#FFFFFF" />
              <Text className="ml-2 text-center text-base font-black text-white">
                {saving ? "Saving..." : "Save Check-In"}
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}
