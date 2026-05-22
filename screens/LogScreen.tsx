import React, { useEffect, useMemo, useRef, useState } from "react";
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
import * as Haptics from "expo-haptics";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList, RootTabParamList } from "../App";
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

function ChipRow<T extends BaseItem>({
  title,
  subtitle,
  icon,
  items,
  selectedId,
  onSelect,
  allowNone,
  onAdd,
  listRef,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: T[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
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
        ? selectedId == null
        : item.kind === "value"
          ? item.id === selectedId
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

          onSelect(item.id);
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
        <View className="h-9 w-9 items-center justify-center rounded-2xl border border-gray-200 bg-white">
          <Ionicons name={icon} size={19} color="#000000" />
        </View>

        <View className="ml-2 flex-1">
          <Text className="text-sm font-black text-black">{title}</Text>
          <Text className="mt-0.5 text-[11px] font-semibold text-gray-500">
            {subtitle}
          </Text>
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
        extraData={{ selectedId, items }}
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
  onPick,
  onClose,
}: {
  visible: boolean;
  value: number;
  onPick: (n: number) => void;
  onClose: () => void;
}) {
  const options = useMemo(
    () => Array.from({ length: 10 }, (_, i) => i + 1),
    [],
  );

  const labelFor = (n: number) => (n === 1 ? "1 time" : `${n} times`);

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
              <Ionicons name="repeat" size={24} color="#000000" />
            </View>

            <View className="ml-3 flex-1">
              <Text className="text-xl font-black text-black">
                Times given in
              </Text>
              <Text className="mt-1 text-sm font-semibold text-gray-500">
                Only count times you actually gave in.
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
                    {labelFor(n)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View className="mt-3 flex-row justify-end">
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

export default function LogScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<LogRoute>();

  const { selectedHabits, selectedCues, selectedLocations, logs, addLog } =
    useData();

  const [habitId, setHabitId] = useState<number | null>(null);
  const [cueId, setCueId] = useState<number | null>(null);
  const [locationId, setLocationId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [didResist, setDidResist] = useState<boolean>(false);
  const [intensity, setIntensity] = useState<number | null>(null);
  const [showIntensityPicker, setShowIntensityPicker] = useState(false);
  const [count, setCount] = useState<number>(1);
  const [showCountPicker, setShowCountPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const keyboardLiftAnim = useRef(new Animated.Value(0)).current;
  const habitListRef = useRef<FlatList<ChipItem> | null>(null);
  const cueListRef = useRef<FlatList<ChipItem> | null>(null);
  const locationListRef = useRef<FlatList<ChipItem> | null>(null);
  const notesInputRef = useRef<TextInput | null>(null);
  const notesAnchorRef = useRef<View | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const handledManageListTokenRef = useRef<number | null>(null);
  const handledResetTokenRef = useRef<number | null>(null);

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
      if (log.cueId == null) continue;

      counts.set(log.cueId, (counts.get(log.cueId) ?? 0) + 1);
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
    setCueId(null);
    setLocationId(null);
    setNotes("");
    setShowNotes(false);
    setDidResist(false);
    setIntensity(null);
    setCount(1);
    setShowIntensityPicker(false);
    setShowCountPicker(false);

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

      setCueId(selection.id);
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

  const onSave = async () => {
    if (saving) return;

    setErrorMsg(null);

    if (habitId == null) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {},
      );
      setErrorMsg("Select a habit before saving.");
      return;
    }

    const submittedHabitId = habitId;
    const submittedCueId = cueId;
    const submittedLocationId = locationId;
    const submittedCount = didResist ? 0 : Math.max(1, count);

    try {
      setSaving(true);

      const newLogId = await addLog({
        habitId: submittedHabitId,
        cueId: submittedCueId,
        locationId: submittedLocationId,
        intensity,
        count: submittedCount,
        didResist,
        notes: notes.trim() || undefined,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );

      resetToDefaults(getDefaultHabitIdAfterLog(submittedHabitId));

      if (newLogId != null) {
        navigation.navigate("UrgeHelp", { logId: newLogId });
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {},
      );
      setErrorMsg("Could not save. Try again.");
    } finally {
      setSaving(false);
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
  const countLabel = didResist
    ? "0 times"
    : count === 1
      ? "1 time"
      : `${count} times`;

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
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
      keyboardVerticalOffset={0}
    >
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
        onPick={(n) => {
          setCount(n);
          setDidResist(false);
          setShowCountPicker(false);
        }}
        onClose={() => setShowCountPicker(false)}
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

              <Text className="mt-0.5 text-2xl font-black text-black">
                Log the moment
              </Text>
            </View>

            <View className="h-12 w-12 items-center justify-center rounded-full border-4 border-green-600 bg-white shadow-sm">
              <Ionicons name="create" size={23} color="#000000" />
            </View>
          </View>

          <ChipRow<SelectedHabit>
            title="Habit"
            subtitle="What showed up?"
            icon="radio-button-on"
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
            title="Cue"
            subtitle="What triggered it?"
            icon="alert-circle"
            items={orderedCues}
            selectedId={cueId}
            onSelect={setCueId}
            allowNone
            onAdd={() => navigation.navigate("ManageList", { type: "cues" })}
            listRef={cueListRef}
          />

          <ChipRow<SelectedPlace>
            title="Location"
            subtitle="Where was it?"
            icon="location"
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
                <View className="h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white">
                  <Ionicons
                    name={didResist ? "shield-checkmark" : "shield-outline"}
                    size={21}
                    color="#000000"
                  />
                </View>

                <View className="ml-2 flex-1">
                  <Text className="text-sm font-black text-black">
                    Did you resist?
                  </Text>
                  <Text className="mt-0.5 text-[11px] leading-4 text-gray-500">
                    Toggle on if you did not give in.
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
              label="Times"
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
                <View className="h-9 w-9 items-center justify-center rounded-2xl border border-gray-200 bg-white">
                  <Ionicons name="document-text" size={19} color="#000000" />
                </View>

                <View className="ml-2 flex-1">
                  <Text className="text-sm font-black text-black">Notes</Text>
                  <Text className="mt-0.5 text-[11px] font-semibold text-gray-500">
                    Optional context
                  </Text>
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
    </KeyboardAvoidingView>
  );
}
