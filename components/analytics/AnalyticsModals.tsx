import React, { useMemo, useRef, useState } from "react";
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
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
};

type BaseItem = { id: number; name: string };

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

function ChipRow<T extends BaseItem>({
  title,
  items,
  selectedId,
  onSelect,
  allowNone = true,
  listRef,
}: {
  title: string;
  items: T[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
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
    })),
  ];

  return (
    <View className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3">
      <Text className="text-sm font-semibold text-gray-900">{title}</Text>

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
            item.kind === "none" ? selectedId == null : item.id === selectedId;

          return (
            <Pressable
              onPress={async () => {
                await lightHaptic();
                onSelect(item.id);
              }}
              className={`mr-2 rounded-full border px-4 py-2 ${
                isSelected
                  ? "border-green-600 bg-green-600"
                  : "border-gray-200 bg-white"
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  isSelected ? "text-white" : "text-gray-900"
                }`}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        }}
        extraData={selectedId}
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
        className="mb-3 rounded-2xl border border-gray-200 bg-white p-4"
      >
        <View className="flex-row items-start justify-between">
          <View>
            <Text className="text-xs font-semibold text-gray-500">{t}</Text>
            <Text className="mt-2 text-base font-bold text-gray-900">
              {item.habitName}
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <View
              className={`rounded-full px-2 py-1 ${
                win ? "bg-emerald-50" : "bg-gray-50"
              }`}
            >
              <Text
                className={`text-[11px] font-semibold ${
                  win ? "text-emerald-700" : "text-gray-700"
                }`}
              >
                {win ? "Resisted" : "Gave in"}
              </Text>
            </View>

            <Pressable
              onPress={() => onEditLog(item)}
              className="h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white"
              hitSlop={10}
            >
              <Ionicons name="create-outline" size={18} color="#111827" />
            </Pressable>
          </View>
        </View>

        <View className="mt-2">
          {item.cueName ? (
            <Text className="text-sm text-gray-700">
              <Text className="font-semibold">Cue:</Text> {item.cueName}
            </Text>
          ) : null}

          {item.locationName ? (
            <Text className="mt-1 text-sm text-gray-700">
              <Text className="font-semibold">Location:</Text>{" "}
              {item.locationName}
            </Text>
          ) : null}

          {item.selectedActionTitle ? (
            <Text className="mt-1 text-sm text-gray-700">
              <Text className="font-semibold">Replacement Action:</Text>{" "}
              {item.selectedActionTitle}
            </Text>
          ) : null}

          <Text className="mt-1 text-sm text-gray-700">
            <Text className="font-semibold">Intensity:</Text>{" "}
            {item.intensity == null ? "None" : `${item.intensity}/10`}
          </Text>

          <Text className="mt-1 text-sm text-gray-700">
            <Text className="font-semibold">Count:</Text>{" "}
            {countLabelFor(item.count)}
          </Text>

          {item.notes ? (
            <Text className="mt-1 text-sm text-gray-700">
              <Text className="font-semibold">Notes:</Text> {item.notes}
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
        <View className="w-full max-w-[520px] rounded-3xl bg-white p-5">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-lg font-bold text-gray-900">Logs</Text>
              <Text className="mt-1 text-sm text-gray-600">
                {selectedDayLabel}
              </Text>
            </View>

            <Pressable
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-full bg-gray-100"
              hitSlop={10}
            >
              <Text className="text-lg font-bold text-gray-900">✕</Text>
            </Pressable>
          </View>

          <ScrollView
            className="mt-4 max-h-[520px]"
            showsVerticalScrollIndicator={false}
          >
            {selectedDayLogs.length === 0 ? (
              <View className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <Text className="text-sm text-gray-700">
                  No logs on this day.
                </Text>
              </View>
            ) : (
              <View>{selectedDayLogs.map(renderDayLog)}</View>
            )}
          </ScrollView>

          <Pressable
            onPress={onClose}
            className="mt-4 rounded-2xl bg-gray-900 py-3"
          >
            <Text className="text-center text-sm font-semibold text-white">
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
  selectedActions,
  habitId,
  cueId,
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
  setCueId,
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
  selectedActions: BaseItem[];
  habitId: number | null;
  cueId: number | null;
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
  setCueId: (id: number | null) => void;
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
  const actionListRef = useRef<FlatList<ChipItem> | null>(null);
  const editScrollViewRef = useRef<ScrollView | null>(null);
  const notesInputRef = useRef<TextInput | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const datePickerValue = useMemo(
    () => inputDateValue(monthText, dayText, yearText),
    [monthText, dayText, yearText],
  );

  const timePickerValue = useMemo(
    () => inputTimeDateValue(hourText, minuteText, ampm),
    [hourText, minuteText, ampm],
  );

  const selectedPreset = TIME_PRESETS.find(
    (preset) =>
      preset.hourText === hourText &&
      preset.minuteText === minuteText &&
      preset.ampm === ampm,
  );

  const intensityLabel = intensity == null ? "None" : `${intensity}/10`;
  const countLabel = countLabelFor(count);
  const chipBase = "rounded-full border px-2.5 py-1.5";
  const chipSelected = "border-green-600 bg-green-600";
  const chipUnselected = "border-gray-200 bg-white";

  const scrollNotesIntoView = () => {
    setTimeout(() => {
      editScrollViewRef.current?.scrollTo({
        y: 820,
        animated: true,
      });
    }, 250);
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

    if (value > 0) {
      setDidResist(0);
    }

    setShowCountPicker(false);
  };

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
        <View className="flex-1 bg-gray-50">
          <View className="border-b border-gray-200 bg-white px-5 pb-4 pt-14">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-3xl font-bold text-gray-900">
                  Edit Log
                </Text>
                <Text className="mt-1 text-sm text-gray-500">
                  Update or delete this check-in
                </Text>
              </View>

              <Pressable
                onPress={onClose}
                className="h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white"
              >
                <Ionicons name="close" size={20} color="#111827" />
              </Pressable>
            </View>
          </View>

          <ScrollView
            ref={editScrollViewRef}
            className="flex-1 px-4 pt-3"
            contentContainerStyle={{ paddingBottom: 100 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
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
              title="Cue"
              items={cueOptions}
              selectedId={cueId}
              onSelect={setCueId}
              listRef={cueListRef}
            />

            <ChipRow
              title="Location"
              items={locationOptions}
              selectedId={locationId}
              onSelect={setLocationId}
              listRef={locationListRef}
            />

            <ChipRow
              title="Replacement Action"
              items={selectedActions}
              selectedId={selectedActionId}
              onSelect={setSelectedActionId}
              listRef={actionListRef}
            />

            <View className="mt-3 w-full flex-row gap-3">
              <View className="flex-1 rounded-2xl border border-gray-200 bg-white px-3 py-3">
                <Text className="text-sm font-semibold text-gray-900">
                  Count
                </Text>

                <View className="mt-2 flex-row items-center">
                  <Pressable
                    onPress={toggleCountPicker}
                    className={`${chipBase} ${chipSelected} mr-2`}
                  >
                    <Text className="text-sm font-semibold text-white">
                      {countLabel}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={toggleCountPicker}
                    className={`${chipBase} ${chipUnselected}`}
                  >
                    <Text className="text-sm font-semibold text-gray-900">
                      + Add
                    </Text>
                  </Pressable>
                </View>

                {showCountPicker ? (
                  <View className="mt-3 flex-row flex-wrap">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => {
                      const selected = count === value;

                      return (
                        <Pressable
                          key={value}
                          onPress={() => chooseCount(value)}
                          className={`mr-2 mb-2 rounded-full border px-4 py-2 ${
                            selected
                              ? "border-green-600 bg-green-600"
                              : "border-gray-200 bg-white"
                          }`}
                        >
                          <Text
                            className={`text-sm font-semibold ${
                              selected ? "text-white" : "text-gray-900"
                            }`}
                          >
                            {countLabelFor(value)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>

              <View className="flex-1 rounded-2xl border border-gray-200 bg-white px-3 py-3">
                <Text className="text-sm font-semibold text-gray-900">
                  Intensity
                </Text>

                <View className="mt-2 flex-row items-center">
                  <Pressable
                    onPress={toggleIntensityPicker}
                    className={`${chipBase} ${chipSelected} mr-2`}
                  >
                    <Text className="text-sm font-semibold text-white">
                      {intensityLabel}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={toggleIntensityPicker}
                    className={`${chipBase} ${chipUnselected}`}
                  >
                    <Text className="text-sm font-semibold text-gray-900">
                      + Add
                    </Text>
                  </Pressable>
                </View>

                {showIntensityPicker ? (
                  <View className="mt-3 flex-row flex-wrap">
                    <Pressable
                      onPress={() => chooseIntensity(null)}
                      className={`mr-2 mb-2 rounded-full border px-4 py-2 ${
                        intensity == null
                          ? "border-green-600 bg-green-600"
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          intensity == null ? "text-white" : "text-gray-900"
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
                          className={`mr-2 mb-2 rounded-full border px-4 py-2 ${
                            selected
                              ? "border-green-600 bg-green-600"
                              : "border-gray-200 bg-white"
                          }`}
                        >
                          <Text
                            className={`text-sm font-semibold ${
                              selected ? "text-white" : "text-gray-900"
                            }`}
                          >
                            {value}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            </View>

            <View className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3">
              <Text className="text-sm font-semibold text-gray-900">
                Did you resist?
              </Text>

              <View className="mt-2 flex-row gap-2">
                <Pressable
                  onPress={async () => {
                    await lightHaptic();
                    setDidResist(1);
                    setCount(0);
                  }}
                  className={`flex-1 rounded-full border px-4 py-2 ${
                    didResist === 1
                      ? "border-green-600 bg-green-600"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <Text
                    className={`text-center text-sm font-semibold ${
                      didResist === 1 ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Yes
                  </Text>
                </Pressable>

                <Pressable
                  onPress={async () => {
                    await lightHaptic();
                    setDidResist(0);
                    if (count === 0) {
                      setCount(1);
                    }
                  }}
                  className={`flex-1 rounded-full border px-4 py-2 ${
                    didResist === 0
                      ? "border-green-600 bg-green-600"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <Text
                    className={`text-center text-sm font-semibold ${
                      didResist === 0 ? "text-white" : "text-gray-900"
                    }`}
                  >
                    No
                  </Text>
                </Pressable>
              </View>
            </View>

            <View className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3">
              <Text className="text-sm font-semibold text-gray-900">Date</Text>

              <Pressable
                onPress={async () => {
                  await lightHaptic();
                  Keyboard.dismiss();
                  setShowTimePicker(false);
                  setShowDatePicker((value) => !value);
                }}
                className="mt-2 flex-row items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3"
              >
                <Text className="text-sm font-semibold text-gray-900">
                  {formatDateButton(monthText, dayText, yearText)}
                </Text>
                <Ionicons name="calendar-outline" size={18} color="#111827" />
              </Pressable>

              {showDatePicker ? (
                <View className="mt-3 items-center rounded-2xl border border-gray-200 bg-gray-50 px-2 py-3">
                  <DateTimePicker
                    value={datePickerValue}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={(_, selectedDate) => {
                      if (!selectedDate) return;

                      setMonthText(String(selectedDate.getMonth() + 1));
                      setDayText(String(selectedDate.getDate()));
                      setYearText(String(selectedDate.getFullYear()));

                      if (Platform.OS !== "ios") {
                        setShowDatePicker(false);
                      }
                    }}
                    textColor="#111827"
                    themeVariant="light"
                  />

                  {Platform.OS === "ios" ? (
                    <Pressable
                      onPress={async () => {
                        await lightHaptic();
                        setShowDatePicker(false);
                      }}
                      className="mt-2 rounded-xl bg-gray-900 px-5 py-3"
                    >
                      <Text className="text-sm font-semibold text-white">
                        Done
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3">
              <Text className="text-sm font-semibold text-gray-900">Time</Text>

              <Text className="mt-1 text-xs text-gray-500">
                Choose a general time of day or tap exact time.
              </Text>

              <View className="mt-3 flex-row flex-wrap">
                {TIME_PRESETS.map((preset) => {
                  const selected = selectedPreset?.label === preset.label;

                  return (
                    <Pressable
                      key={preset.label}
                      onPress={() => applyTimePreset(preset)}
                      className={`mr-2 mb-2 rounded-full border px-4 py-2 ${
                        selected
                          ? "border-green-600 bg-green-600"
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          selected ? "text-white" : "text-gray-900"
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
                  <Text className="text-xs font-semibold text-gray-500">
                    Exact time
                  </Text>
                  <Text className="mt-1 text-sm font-semibold text-gray-900">
                    {formatTimeButton(hourText, minuteText, ampm)}
                  </Text>
                </View>
                <Ionicons name="time-outline" size={18} color="#111827" />
              </Pressable>

              {showTimePicker ? (
                <View className="mt-3 items-center rounded-2xl border border-gray-200 bg-gray-50 px-2 py-3">
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
                    textColor="#111827"
                    themeVariant="light"
                  />

                  {Platform.OS === "ios" ? (
                    <Pressable
                      onPress={async () => {
                        await lightHaptic();
                        setShowTimePicker(false);
                      }}
                      className="mt-2 rounded-xl bg-gray-900 px-5 py-3"
                    >
                      <Text className="text-sm font-semibold text-white">
                        Done
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3">
              <Text className="text-sm font-semibold text-gray-900">Notes</Text>

              <TextInput
                ref={notesInputRef}
                value={notesText}
                onChangeText={setNotesText}
                multiline
                blurOnSubmit
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
                onFocus={scrollNotesIntoView}
                placeholder="Optional"
                className="mt-2 min-h-[110px] rounded-2xl border border-gray-200 px-4 py-3 text-gray-900"
                placeholderTextColor="#9CA3AF"
                textAlignVertical="top"
              />
            </View>

            {editError ? (
              <Text className="mt-4 px-1 text-sm font-semibold text-red-600">
                {editError}
              </Text>
            ) : null}

            <Pressable
              onPress={onSave}
              className="mt-5 rounded-2xl bg-green-600 px-5 py-4"
            >
              <Text className="text-center text-lg font-bold text-white">
                Save Changes
              </Text>
            </Pressable>

            <Pressable
              onPress={onDelete}
              className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4"
            >
              <Text className="text-center text-lg font-bold text-red-700">
                Delete Log
              </Text>
            </Pressable>

            <Pressable
              onPress={onClose}
              className="mt-3 rounded-2xl border border-gray-200 bg-white px-5 py-4"
            >
              <Text className="text-center text-lg font-bold text-gray-900">
                Cancel
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
