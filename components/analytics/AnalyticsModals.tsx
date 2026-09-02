import React, { useMemo, useRef, useState } from "react";
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  UIManager,
  View,
  findNodeHandle,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import type { LogEntry } from "../../data/DataContext";

type ChipItem = {
  key: string;
  label: string;
  id: number | null;
  kind: "value" | "none";
  color?: string | null;
};

type BaseItem = {
  id: number;
  name: string;
  color?: string | null;
  unit?: string | null;
};

type TimePreset = {
  label: string;
  hourText: string;
  minuteText: string;
  ampm: "AM" | "PM";
};

const TIME_PRESETS: TimePreset[] = [
  { label: "Morning", hourText: "8", minuteText: "00", ampm: "AM" },
  { label: "Afternoon", hourText: "1", minuteText: "00", ampm: "PM" },
  { label: "Evening", hourText: "6", minuteText: "00", ampm: "PM" },
  { label: "Night", hourText: "10", minuteText: "00", ampm: "PM" },
];

async function lightHaptic() {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function inputDateValue(monthText: string, dayText: string, yearText: string) {
  const month = Number(monthText);
  const day = Number(dayText);
  const year = Number(yearText);

  if (
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(year)
  ) {
    return new Date();
  }

  const candidate = new Date(year, month - 1, day);

  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return new Date();
  }

  return candidate;
}

function inputTimeDateValue(
  hourText: string,
  minuteText: string,
  ampm: "AM" | "PM",
) {
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const date = new Date();

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 1 ||
    hour > 12 ||
    minute < 0 ||
    minute > 59
  ) {
    return date;
  }

  let hour24 = hour;

  if (ampm === "PM" && hour !== 12) {
    hour24 = hour + 12;
  }

  if (ampm === "AM" && hour === 12) {
    hour24 = 0;
  }

  date.setHours(hour24, minute, 0, 0);
  return date;
}

function formatDateButton(
  monthText: string,
  dayText: string,
  yearText: string,
) {
  const date = inputDateValue(monthText, dayText, yearText);

  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeButton(
  hourText: string,
  minuteText: string,
  ampm: "AM" | "PM",
) {
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 1 ||
    hour > 12 ||
    minute < 0 ||
    minute > 59
  ) {
    return "Pick time";
  }

  return `${hour}:${String(minute).padStart(2, "0")} ${ampm}`;
}

function dateToTimeParts(date: Date) {
  const hours24 = date.getHours();
  const minutes = date.getMinutes();
  const nextAmpm: "AM" | "PM" = hours24 >= 12 ? "PM" : "AM";
  let hour12 = hours24 % 12;

  if (hour12 === 0) {
    hour12 = 12;
  }

  return {
    hourText: String(hour12),
    minuteText: String(minutes).padStart(2, "0"),
    ampm: nextAmpm,
  };
}

function countLabelFor(n: number) {
  if (n === 0) return "None";
  if (n === 1) return "Once";
  if (n === 2) return "Twice";
  return `${n}x`;
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

function getSectionIcon(title: string): keyof typeof Ionicons.glyphMap {
  if (title === "Habit") return "radio-button-on";
  if (title === "Cue" || title === "Cues") return "alert-circle";
  if (title === "Location") return "location";
  if (title === "Replacement action") return "flash";
  return "ellipse";
}

function ChipRow<T extends BaseItem>({
  title,
  items,
  selectedId,
  selectedIds,
  onSelect,
  onToggle,
  allowNone = true,
  listRef,
}: {
  title: string;
  items: T[];
  selectedId: number | null;
  selectedIds?: number[];
  onSelect?: (id: number | null) => void;
  onToggle?: (id: number | null) => void;
  allowNone?: boolean;
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
      color: x.color ?? null,
    })),
  ];

  return (
    <View className="mt-2 w-full rounded-3xl border border-gray-200 bg-gray-50 p-3 shadow-sm">
      <View className="flex-row items-center">
        <View className="h-9 w-9 items-center justify-center rounded-2xl border border-gray-200 bg-white">
          <Ionicons name={getSectionIcon(title)} size={19} color="#000000" />
        </View>

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
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const isSelected =
            item.kind === "none"
              ? selectedIds
                ? selectedIds.length === 0
                : selectedId == null
              : selectedIds
                ? item.id != null && selectedIds.includes(item.id)
                : item.id === selectedId;

          return (
            <Pressable
              onPress={async () => {
                await lightHaptic();
                if (selectedIds && onToggle) onToggle(item.id);
                else onSelect?.(item.id);
              }}
              className={`mr-2 rounded-full border px-3 py-1.5 ${
                isSelected ? "" : "border-gray-200 bg-white"
              }`}
              style={
                isSelected
                  ? {
                      borderColor: item.color || "#16A34A",
                      backgroundColor: item.color || "#16A34A",
                    }
                  : undefined
              }
            >
              <Text
                className={`text-sm font-black ${
                  isSelected ? "text-white" : "text-black"
                }`}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        }}
        extraData={{ selectedId, selectedIds }}
      />
    </View>
  );
}

export function DayLogsModal({
  visible,
  selectedDayLabel,
  selectedDayLogs,
  onClose,
  onEditLog,
}: {
  visible: boolean;
  selectedDayLabel: string;
  selectedDayLogs: LogEntry[];
  onClose: () => void;
  onEditLog: (log: LogEntry) => void;
}) {
  const renderDayLog = (item: LogEntry) => {
    const t = new Date(item.createdAt).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });

    const win = item.didResist === 1;

    return (
      <View
        key={String(item.id)}
        className="mb-3 rounded-[28px] border border-gray-200 bg-gray-50 p-4 shadow-sm"
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-xs font-black uppercase tracking-wide text-green-600">
              {t}
            </Text>

            <Text className="mt-2 text-base font-black text-black">
              {item.habitName}
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <View
              className={`rounded-full border px-3 py-1 ${
                win
                  ? "border-green-600 bg-green-600"
                  : "border-gray-200 bg-white"
              }`}
            >
              <Text
                className={`text-[11px] font-black ${
                  win ? "text-white" : "text-black"
                }`}
              >
                {win ? "Resisted" : "Habit logged"}
              </Text>
            </View>

            <Pressable
              onPress={() => onEditLog(item)}
              className="h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white"
              hitSlop={10}
            >
              <Ionicons name="create-outline" size={18} color="#000000" />
            </Pressable>
          </View>
        </View>

        <View className="mt-3 rounded-2xl border border-gray-200 bg-white p-3">
          {item.cueNames.length > 0 ? (
            <Text className="text-sm text-gray-500">
              <Text className="font-black text-black">Cues:</Text>{" "}
              {item.cueNames.join(", ")}
            </Text>
          ) : null}

          {item.locationName ? (
            <Text className="mt-1 text-sm text-gray-500">
              <Text className="font-black text-black">Location:</Text>{" "}
              {item.locationName}
            </Text>
          ) : null}

          {item.selectedActionTitle ? (
            <Text className="mt-1 text-sm text-gray-500">
              <Text className="font-black text-black">Replacement Action:</Text>{" "}
              {item.selectedActionTitle}
            </Text>
          ) : null}

          <Text className="mt-1 text-sm text-gray-500">
            <Text className="font-black text-black">Intensity:</Text>{" "}
            {item.intensity == null ? "None" : `${item.intensity}/10`}
          </Text>

          <Text className="mt-1 text-sm text-gray-500">
            <Text className="font-black text-black">Count:</Text>{" "}
            {countLabelFor(item.count)}
          </Text>

          {item.notes ? (
            <Text className="mt-1 text-sm text-gray-500">
              <Text className="font-black text-black">Notes:</Text> {item.notes}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-black/40 px-5">
        <View className="w-full max-w-[520px] rounded-[32px] bg-white p-5">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 flex-row items-center pr-3">
              <View className="h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white">
                <Ionicons name="calendar" size={24} color="#000000" />
              </View>

              <View className="ml-3 flex-1">
                <Text className="text-xl font-black text-black">Logs</Text>
                <Text className="mt-1 text-sm font-semibold text-gray-500">
                  {selectedDayLabel}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white"
              hitSlop={10}
            >
              <Ionicons name="close" size={20} color="#000000" />
            </Pressable>
          </View>

          <ScrollView
            className="mt-4 max-h-[520px]"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 4,
              paddingTop: 2,
              paddingBottom: 2,
            }}
          >
            {selectedDayLogs.length === 0 ? (
              <View className="rounded-[28px] border border-gray-200 bg-gray-50 p-4 shadow-sm">
                <Text className="text-sm font-semibold text-gray-500">
                  No logs on this day.
                </Text>
              </View>
            ) : (
              <View>{selectedDayLogs.map(renderDayLog)}</View>
            )}
          </ScrollView>

          <Pressable
            onPress={onClose}
            className="mt-4 rounded-3xl bg-green-600 py-4 shadow-sm"
          >
            <Text className="text-center text-base font-black text-white">
              Close
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function EditLogModal({
  visible,
  habitOptions,
  cueOptions,
  locationOptions,
  replacementActionOptions,
  habitId,
  cueIds,
  locationId,
  selectedActionId,
  didResist,
  intensity,
  count,
  notesText,
  monthText,
  dayText,
  yearText,
  hourText,
  minuteText,
  ampm,
  editError,
  showIntensityPicker,
  showCountPicker,
  setHabitId,
  setCueIds,
  setLocationId,
  setSelectedActionId,
  setDidResist,
  setIntensity,
  setCount,
  setNotesText,
  setMonthText,
  setDayText,
  setYearText,
  setHourText,
  setMinuteText,
  setAmpm,
  setShowIntensityPicker,
  setShowCountPicker,
  onSave,
  onDelete,
  onClose,
}: {
  visible: boolean;
  habitOptions: BaseItem[];
  cueOptions: BaseItem[];
  locationOptions: BaseItem[];
  replacementActionOptions: BaseItem[];
  habitId: number | null;
  cueIds: number[];
  locationId: number | null;
  selectedActionId: number | null;
  didResist: 0 | 1;
  intensity: number | null;
  count: number;
  notesText: string;
  monthText: string;
  dayText: string;
  yearText: string;
  hourText: string;
  minuteText: string;
  ampm: "AM" | "PM";
  editError: string;
  showIntensityPicker: boolean;
  showCountPicker: boolean;
  setHabitId: (id: number | null) => void;
  setCueIds: (ids: number[]) => void;
  setLocationId: (id: number | null) => void;
  setSelectedActionId: (id: number | null) => void;
  setDidResist: (value: 0 | 1) => void;
  setIntensity: (value: number | null) => void;
  setCount: (value: number) => void;
  setNotesText: (value: string) => void;
  setMonthText: (value: string) => void;
  setDayText: (value: string) => void;
  setYearText: (value: string) => void;
  setHourText: (value: string) => void;
  setMinuteText: (value: string) => void;
  setAmpm: (value: "AM" | "PM") => void;
  setShowIntensityPicker: (value: boolean) => void;
  setShowCountPicker: (value: boolean) => void;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const habitListRef = useRef<FlatList<ChipItem> | null>(null);
  const cueListRef = useRef<FlatList<ChipItem> | null>(null);
  const locationListRef = useRef<FlatList<ChipItem> | null>(null);
  const replacementActionListRef = useRef<FlatList<ChipItem> | null>(null);
  const editScrollViewRef = useRef<ScrollView | null>(null);
  const editScrollViewportHeightRef = useRef(0);
  const notesAnchorRef = useRef<View | null>(null);
  const notesInputRef = useRef<TextInput | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [customCountText, setCustomCountText] = useState("");
  const [showNotes, setShowNotes] = useState(notesText.trim().length > 0);

  React.useEffect(() => {
    if (visible) setShowNotes(notesText.trim().length > 0);
  }, [visible]);

  const datePickerValue = useMemo(
    () => inputDateValue(monthText, dayText, yearText),
    [monthText, dayText, yearText],
  );

  const timePickerValue = useMemo(
    () => inputTimeDateValue(hourText, minuteText, ampm),
    [hourText, minuteText, ampm],
  );

  const activeHabit = habitOptions.find((habit) => habit.id === habitId);
  const countUnit = activeHabit?.unit?.trim() || "times";
  const countOptions = useMemo(
    () =>
      countUnit.toLowerCase() === "minutes"
        ? [1, 5, 10, 15, 20, 30, 45, 60]
        : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    [countUnit],
  );

  const selectedPreset = TIME_PRESETS.find(
    (preset) =>
      preset.hourText === hourText &&
      preset.minuteText === minuteText &&
      preset.ampm === ampm,
  );

  const intensityLabel = intensity == null ? "None" : `${intensity}/10`;
  const countLabel = formatQuantity(didResist === 1 ? 0 : count, countUnit);

  const scrollNotesIntoView = () => {
    setTimeout(() => {
      const scrollNode = findNodeHandle(editScrollViewRef.current);
      const notesNode = findNodeHandle(notesAnchorRef.current);

      if (!scrollNode || !notesNode) {
        editScrollViewRef.current?.scrollToEnd({ animated: true });
        return;
      }

      UIManager.measureLayout(
        notesNode,
        scrollNode,
        () => editScrollViewRef.current?.scrollToEnd({ animated: true }),
        (_x, y, _width, height) => {
          const visibleHeight = editScrollViewportHeightRef.current;
          const targetY =
            visibleHeight > 0
              ? Math.max(0, y + height - visibleHeight + 24)
              : y;

          editScrollViewRef.current?.scrollTo({
            y: targetY,
            animated: true,
          });
        },
      );
    }, 350);
  };

  const applyTimePreset = async (preset: TimePreset) => {
    await lightHaptic();
    Keyboard.dismiss();
    setHourText(preset.hourText);
    setMinuteText(preset.minuteText);
    setAmpm(preset.ampm);
    setShowTimePicker(false);
  };

  const toggleIntensityPicker = async () => {
    await lightHaptic();
    Keyboard.dismiss();
    setShowCountPicker(false);
    setShowIntensityPicker(!showIntensityPicker);
  };

  const toggleCountPicker = async () => {
    await lightHaptic();
    Keyboard.dismiss();
    setShowIntensityPicker(false);
    if (!showCountPicker) {
      setCustomCountText(countOptions.includes(count) ? "" : String(count));
    }
    setShowCountPicker(!showCountPicker);
  };

  const chooseIntensity = async (value: number | null) => {
    await lightHaptic();
    setIntensity(value);
    setShowIntensityPicker(false);
  };

  const chooseCount = async (value: number) => {
    await lightHaptic();
    setCount(value);
    setDidResist(0);
    setShowCountPicker(false);
    setCustomCountText("");
  };

  const submitCustomCount = () => {
    const value = Number(customCountText);
    if (!Number.isFinite(value) || value < 1) return;
    chooseCount(Math.min(999999, Math.max(1, Math.round(value))));
  };

  const StatCard = ({
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
      className={`flex-1 rounded-3xl border border-gray-200 bg-gray-50 p-3 shadow-sm ${disabled ? "opacity-60" : ""}`}
    >
      <View className="flex-row items-center justify-between">
        <View className="h-9 w-9 items-center justify-center rounded-2xl border border-gray-200 bg-white">
          <Ionicons name={icon} size={19} color="#000000" />
        </View>

        {onPress && !disabled ? (
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
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        className="flex-1 bg-white"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-1 bg-white">
          <View className="border-b border-gray-200 bg-white px-5 pb-4 pt-14">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 flex-row items-center pr-4">
                <View className="h-14 w-14 items-center justify-center rounded-full border-4 border-green-600 bg-white shadow-sm">
                  <Ionicons name="create" size={25} color="#000000" />
                </View>

                <View className="ml-3 flex-1">
                  <Text className="text-xs font-black uppercase tracking-widest text-green-600">
                    Edit check-in
                  </Text>

                  <Text className="mt-1 text-2xl font-black text-black">
                    Edit the moment
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={onClose}
                className="h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white"
              >
                <Ionicons name="close" size={20} color="#000000" />
              </Pressable>
            </View>
          </View>

          <ScrollView
            ref={editScrollViewRef}
            className="flex-1 px-4 pt-3"
            contentContainerStyle={{ paddingBottom: 108 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onLayout={(event) => {
              editScrollViewportHeightRef.current =
                event.nativeEvent.layout.height;
            }}
          >
            <ChipRow
              title="Habit"
              items={habitOptions}
              selectedId={habitId}
              onSelect={setHabitId}
              allowNone={false}
              listRef={habitListRef}
            />

            <ChipRow
              title="Cues"
              items={cueOptions}
              selectedId={null}
              selectedIds={cueIds}
              onToggle={(id) => {
                if (id == null) {
                  setCueIds([]);
                  return;
                }
                setCueIds(
                  cueIds.includes(id)
                    ? cueIds.filter((cueId) => cueId !== id)
                    : [...cueIds, id],
                );
              }}
              listRef={cueListRef}
            />

            <ChipRow
              title="Location"
              items={locationOptions}
              selectedId={locationId}
              onSelect={setLocationId}
              listRef={locationListRef}
            />

            <View className="mt-2 w-full rounded-3xl border border-gray-200 bg-gray-50 p-3 shadow-sm">
              <View className="flex-row items-center justify-between">
                <View className="flex-row flex-1 items-center pr-4">
                  <View className="h-9 w-9 items-center justify-center rounded-2xl border border-gray-200 bg-white">
                    <Ionicons
                      name={
                        didResist === 1 ? "shield-checkmark" : "shield-outline"
                      }
                      size={19}
                      color="#000000"
                    />
                  </View>

                  <View className="ml-2 flex-1">
                    <Text className="text-sm font-black text-black">
                      Did you resist?
                    </Text>
                  </View>
                </View>

                <Switch
                  value={didResist === 1}
                  onValueChange={(value) => {
                    lightHaptic();
                    setDidResist(value ? 1 : 0);
                    if (value) setCount(0);
                    else if (count === 0) setCount(1);
                  }}
                  trackColor={{ false: "#E5E7EB", true: "#86EFAC" }}
                  thumbColor={didResist === 1 ? "#16A34A" : "#F9FAFB"}
                />
              </View>
            </View>

            <View className="mt-2 flex-row gap-2">
              <StatCard
                label="Quantity"
                value={countLabel}
                icon="repeat"
                onPress={didResist === 1 ? undefined : toggleCountPicker}
                disabled={didResist === 1}
              />

              <StatCard
                label="Intensity"
                value={intensityLabel}
                icon="pulse"
                onPress={toggleIntensityPicker}
              />
            </View>

            {showCountPicker ? (
              <View className="mt-2 rounded-3xl border border-gray-200 bg-gray-50 p-3 shadow-sm">
                <View className="flex-row items-center">
                  <View className="h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white">
                    <Ionicons name="repeat" size={20} color="#000000" />
                  </View>

                  <View className="ml-3 flex-1">
                    <Text className="text-base font-black text-black">
                      Quantity logged
                    </Text>
                    <Text className="mt-0.5 text-xs font-semibold text-gray-500">
                      Log the actual amount, not just one event.
                    </Text>
                  </View>
                </View>

                <View className="mt-3 flex-row flex-wrap">
                  {countOptions.map((value) => {
                    const selected = count === value && !customCountText;

                    return (
                      <Pressable
                        key={value}
                        onPress={() => chooseCount(value)}
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
                          {formatQuantity(value, countUnit)}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    onPress={() =>
                      setCustomCountText(String(Math.max(1, count)))
                    }
                    className={`mb-2 mr-2 rounded-full border px-4 py-2.5 ${
                      customCountText
                        ? "border-green-600 bg-green-600"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <Text
                      className={`text-sm font-black ${customCountText ? "text-white" : "text-black"}`}
                    >
                      Custom
                    </Text>
                  </Pressable>
                </View>

                {customCountText ? (
                  <View className="mt-1 flex-row items-center gap-2">
                    <TextInput
                      value={customCountText}
                      onChangeText={setCustomCountText}
                      placeholder={`Other ${countUnit}`}
                      placeholderTextColor="#9CA3AF"
                      keyboardType={
                        Platform.OS === "ios"
                          ? "numbers-and-punctuation"
                          : "number-pad"
                      }
                      returnKeyType="done"
                      onSubmitEditing={submitCustomCount}
                      className="flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-black"
                    />
                    <Pressable
                      onPress={submitCustomCount}
                      className="rounded-2xl bg-green-600 px-5 py-3"
                    >
                      <Text className="font-black text-white">Done</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : null}

            {showIntensityPicker ? (
              <View className="mt-3 rounded-[28px] border border-gray-200 bg-gray-50 p-4 shadow-sm">
                <View className="flex-row items-center">
                  <View className="h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white">
                    <Ionicons name="pulse" size={20} color="#000000" />
                  </View>

                  <View className="ml-3 flex-1">
                    <Text className="text-base font-black text-black">
                      Intensity
                    </Text>
                    <Text className="mt-0.5 text-xs font-semibold text-gray-500">
                      1 low, 10 high.
                    </Text>
                  </View>
                </View>

                <View className="mt-3 flex-row flex-wrap">
                  <Pressable
                    onPress={() => chooseIntensity(null)}
                    className={`mb-2 mr-2 rounded-full border px-4 py-2.5 ${
                      intensity == null
                        ? "border-green-600 bg-green-600"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <Text
                      className={`text-sm font-black ${
                        intensity == null ? "text-white" : "text-black"
                      }`}
                    >
                      None
                    </Text>
                  </Pressable>

                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => {
                    const selected = intensity === value;

                    return (
                      <Pressable
                        key={value}
                        onPress={() => chooseIntensity(value)}
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
                          {value}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <ChipRow
              title="Replacement action"
              items={replacementActionOptions}
              selectedId={selectedActionId}
              onSelect={setSelectedActionId}
              listRef={replacementActionListRef}
            />

            <View className="mt-3 w-full rounded-[28px] border border-gray-200 bg-gray-50 p-4 shadow-sm">
              <View className="flex-row items-center">
                <View className="h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white">
                  <Ionicons name="calendar" size={20} color="#000000" />
                </View>

                <View className="ml-3 flex-1">
                  <Text className="text-base font-black text-black">Date</Text>
                  <Text className="mt-0.5 text-xs font-semibold text-gray-500">
                    Change the day this happened.
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={async () => {
                  await lightHaptic();
                  Keyboard.dismiss();
                  setShowTimePicker(false);
                  setShowDatePicker((value) => !value);
                }}
                className="mt-3 flex-row items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3"
              >
                <Text className="text-sm font-black text-black">
                  {formatDateButton(monthText, dayText, yearText)}
                </Text>
                <Ionicons name="calendar-outline" size={18} color="#000000" />
              </Pressable>

              {showDatePicker ? (
                <View className="mt-3 items-center rounded-2xl border border-gray-200 bg-white px-2 py-3">
                  <DateTimePicker
                    value={datePickerValue}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    onChange={(_, selectedDate) => {
                      if (!selectedDate) return;

                      setMonthText(String(selectedDate.getMonth() + 1));
                      setDayText(String(selectedDate.getDate()));
                      setYearText(String(selectedDate.getFullYear()));

                      if (Platform.OS !== "ios") {
                        setShowDatePicker(false);
                      }
                    }}
                    textColor="#000000"
                    themeVariant="light"
                    style={
                      Platform.OS === "ios"
                        ? { width: "100%", height: 340 }
                        : undefined
                    }
                  />

                  {Platform.OS === "ios" ? (
                    <Pressable
                      onPress={async () => {
                        await lightHaptic();
                        setShowDatePicker(false);
                      }}
                      className="mt-2 rounded-2xl bg-green-600 px-5 py-3"
                    >
                      <Text className="text-sm font-black text-white">
                        Done
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View className="mt-3 w-full rounded-[28px] border border-gray-200 bg-gray-50 p-4 shadow-sm">
              <View className="flex-row items-center">
                <View className="h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white">
                  <Ionicons name="time" size={20} color="#000000" />
                </View>

                <View className="ml-3 flex-1">
                  <Text className="text-base font-black text-black">Time</Text>
                  <Text className="mt-0.5 text-xs font-semibold text-gray-500">
                    Choose a general time or exact time.
                  </Text>
                </View>
              </View>

              <View className="mt-3 flex-row flex-wrap">
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
                onPress={async () => {
                  await lightHaptic();
                  Keyboard.dismiss();
                  setShowDatePicker(false);
                  setShowTimePicker((value) => !value);
                }}
                className="mt-1 flex-row items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3"
              >
                <View>
                  <Text className="text-xs font-black uppercase tracking-wide text-gray-500">
                    Exact time
                  </Text>
                  <Text className="mt-1 text-sm font-black text-black">
                    {formatTimeButton(hourText, minuteText, ampm)}
                  </Text>
                </View>
                <Ionicons name="time-outline" size={18} color="#000000" />
              </Pressable>

              {showTimePicker ? (
                <View className="mt-3 items-center rounded-2xl border border-gray-200 bg-white px-2 py-3">
                  <DateTimePicker
                    value={timePickerValue}
                    mode="time"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={(_, selectedDate) => {
                      if (!selectedDate) return;

                      const parts = dateToTimeParts(selectedDate);
                      setHourText(parts.hourText);
                      setMinuteText(parts.minuteText);
                      setAmpm(parts.ampm);

                      if (Platform.OS !== "ios") {
                        setShowTimePicker(false);
                      }
                    }}
                    textColor="#000000"
                    themeVariant="light"
                  />

                  {Platform.OS === "ios" ? (
                    <Pressable
                      onPress={async () => {
                        await lightHaptic();
                        setShowTimePicker(false);
                      }}
                      className="mt-2 rounded-2xl bg-green-600 px-5 py-3"
                    >
                      <Text className="text-sm font-black text-white">
                        Done
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View
              ref={notesAnchorRef}
              className="mt-2 w-full rounded-3xl border border-gray-200 bg-gray-50 p-3 shadow-sm"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row flex-1 items-center pr-3">
                  <View className="h-9 w-9 items-center justify-center rounded-2xl border border-gray-200 bg-white">
                    <Ionicons name="document-text" size={19} color="#000000" />
                  </View>

                  <Text className="ml-2 text-sm font-black text-black">
                    Notes
                  </Text>
                </View>

                <Pressable
                  onPress={() => setShowNotes((value) => !value)}
                  className="rounded-2xl border border-gray-200 bg-white px-3 py-1.5"
                >
                  <Text className="text-xs font-black text-black">
                    {showNotes ? "Hide" : "Add"}
                  </Text>
                </Pressable>
              </View>

              {showNotes ? (
                <TextInput
                  ref={notesInputRef}
                  value={notesText}
                  onChangeText={setNotesText}
                  blurOnSubmit
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  onFocus={scrollNotesIntoView}
                  placeholder="Anything useful to remember..."
                  className="mt-2 min-h-[38px] rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-black"
                  placeholderTextColor="#9CA3AF"
                />
              ) : null}
            </View>

            {editError ? (
              <View className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                <Text className="text-sm font-black text-red-700">
                  {editError}
                </Text>
              </View>
            ) : null}

            <Pressable
              onPress={onSave}
              className="mt-5 rounded-3xl bg-green-600 px-5 py-4 shadow-sm"
            >
              <View className="flex-row items-center justify-center">
                <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                <Text className="ml-2 text-center text-lg font-black text-white">
                  Save Check-In
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={onDelete}
              className="mt-3 rounded-3xl border border-red-200 bg-red-50 px-5 py-4"
            >
              <View className="flex-row items-center justify-center">
                <Ionicons name="trash" size={21} color="#DC2626" />
                <Text className="ml-2 text-center text-lg font-black text-red-600">
                  Delete Log
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={onClose}
              className="mt-3 rounded-3xl border border-gray-200 bg-white px-5 py-4"
            >
              <Text className="text-center text-lg font-black text-black">
                Cancel
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
