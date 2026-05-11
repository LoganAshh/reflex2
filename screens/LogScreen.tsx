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
} from "react-native";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
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

type ChipItem = {
  key: string;
  label: string;
  id: number | null;
  kind: "value" | "none" | "add";
};

type BaseItem = { id: number; name: string };

function applyRecentOrdering<T extends { id: number }>(
  items: T[],
  recentIds: number[],
) {
  if (items.length === 0) return items;

  const byId = new Map(items.map((x) => [x.id, x] as const));
  const used = new Set<number>();
  const ordered: T[] = [];

  for (const id of recentIds) {
    const it = byId.get(id);
    if (it && !used.has(id)) {
      ordered.push(it);
      used.add(id);
    }
  }

  for (const it of items) {
    if (!used.has(it.id)) ordered.push(it);
  }

  return ordered;
}

function ChipRow<T extends BaseItem>({
  title,
  items,
  selectedId,
  onSelect,
  allowNone,
  onAdd,
  listRef,
}: {
  title: string;
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

    const base = "mr-2 rounded-full border px-4 py-2";
    const selected = "bg-green-600 border-green-600";
    const unselected = "bg-white border-gray-200";
    const addStyle = "bg-white border-gray-200";

    return (
      <Pressable
        onPress={() => {
          if (item.kind === "add") {
            onAdd();
            return;
          }
          onSelect(item.id);
        }}
        className={`${base} ${
          item.kind === "add" ? addStyle : isSelected ? selected : unselected
        }`}
      >
        <Text
          className={`text-sm font-semibold ${
            item.kind === "add"
              ? "text-gray-900"
              : isSelected
                ? "text-white"
                : "text-gray-900"
          }`}
          numberOfLines={1}
        >
          {item.label}
        </Text>
      </Pressable>
    );
  };

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
        renderItem={renderItem}
        extraData={selectedId}
        keyboardShouldPersistTaps="handled"
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
          className="w-full rounded-2xl bg-white p-4"
          onPress={() => {}}
        >
          <Text className="text-base font-bold text-gray-900">
            Pick intensity
          </Text>
          <Text className="mt-1 text-xs text-gray-500">
            1 (low) → 10 (high)
          </Text>

          <View className="mt-4 flex-row flex-wrap">
            {options.map((n) => {
              const selected = value === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => onPick(n)}
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
                    {n}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View className="mt-2 flex-row justify-between">
            <Pressable
              onPress={onClear}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3"
            >
              <Text className="text-sm font-semibold text-gray-900">
                Set None
              </Text>
            </Pressable>

            <Pressable
              onPress={onClose}
              className="rounded-xl bg-gray-900 px-4 py-3"
            >
              <Text className="text-sm font-semibold text-white">Done</Text>
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
  allowNone,
  onPick,
  onClose,
}: {
  visible: boolean;
  value: number;
  allowNone: boolean;
  onPick: (n: number) => void;
  onClose: () => void;
}) {
  const options = useMemo(
    () => Array.from({ length: 10 }, (_, i) => i + 1),
    [],
  );

  const labelFor = (n: number) =>
    n === 0 ? "None" : n === 1 ? "Once" : n === 2 ? "Twice" : `${n}x`;

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
          className="w-full rounded-2xl bg-white p-4"
          onPress={() => {}}
        >
          <Text className="text-base font-bold text-gray-900">Pick count</Text>
          <Text className="mt-1 text-xs text-gray-500">
            How many times did it happen?
          </Text>

          <View className="mt-4 flex-row flex-wrap">
            {allowNone ? (
              <Pressable
                onPress={() => onPick(0)}
                className={`mr-2 mb-2 rounded-full border px-4 py-2 ${
                  value === 0
                    ? "border-green-600 bg-green-600"
                    : "border-gray-200 bg-white"
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    value === 0 ? "text-white" : "text-gray-900"
                  }`}
                >
                  None
                </Text>
              </Pressable>
            ) : null}

            {options.map((n) => {
              const selected = value === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => onPick(n)}
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
                    {labelFor(n)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View className="mt-2 flex-row justify-end">
            <Pressable
              onPress={onClose}
              className="rounded-xl bg-gray-900 px-4 py-3"
            >
              <Text className="text-sm font-semibold text-white">Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function LogScreen() {
  const navigation = useNavigation<Nav>();
  const { selectedHabits, selectedCues, selectedLocations, addLog } = useData();

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
  const [recentHabitIds, setRecentHabitIds] = useState<number[]>([]);
  const [recentCueIds, setRecentCueIds] = useState<number[]>([]);
  const [recentLocationIds, setRecentLocationIds] = useState<number[]>([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const keyboardLiftAnim = useRef(new Animated.Value(0)).current;
  const orderedHabits = useMemo(
    () => applyRecentOrdering(selectedHabits, recentHabitIds),
    [selectedHabits, recentHabitIds],
  );
  const orderedCues = useMemo(
    () => applyRecentOrdering(selectedCues, recentCueIds),
    [selectedCues, recentCueIds],
  );
  const orderedLocations = useMemo(
    () => applyRecentOrdering(selectedLocations, recentLocationIds),
    [selectedLocations, recentLocationIds],
  );

  const habitListRef = useRef<FlatList<ChipItem> | null>(null);
  const cueListRef = useRef<FlatList<ChipItem> | null>(null);
  const locationListRef = useRef<FlatList<ChipItem> | null>(null);
  const notesInputRef = useRef<TextInput | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (habitId == null && orderedHabits.length > 0) {
      setHabitId(orderedHabits[0].id);
    }
  }, [orderedHabits, habitId]);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (event) => {
      setKeyboardHeight(event.endCoordinates.height);

      Animated.timing(keyboardLiftAnim, {
        toValue: -160,
        duration: 240,
        useNativeDriver: true,
      }).start();
    });

    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardHeight(0);

      Animated.timing(keyboardLiftAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardLiftAnim]);

  const bumpRecent = (prev: number[], id: number, max = 25) => {
    const next = [id, ...prev.filter((x) => x !== id)];
    return next.slice(0, max);
  };

  const scrollAllToStart = () => {
    habitListRef.current?.scrollToOffset({ offset: 0, animated: true });
    cueListRef.current?.scrollToOffset({ offset: 0, animated: true });
    locationListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const scrollNotesIntoView = () => {};

  const getDefaultHabitId = () =>
    recentHabitIds[0] ?? orderedHabits[0]?.id ?? selectedHabits[0]?.id ?? null;

  const resetToDefaults = (habitOverrideId?: number) => {
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
      scrollAllToStart();
      Keyboard.dismiss();
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    });
  };

  useEffect(() => {
    const unsub = navigation.addListener("tabPress", () => {
      if (navigation.isFocused?.()) resetToDefaults();
    });
    return unsub;
  }, [navigation, orderedHabits, selectedHabits, recentHabitIds]);

  const onSave = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    setErrorMsg(null);

    if (habitId == null) {
      setErrorMsg("Select a habit.");
      return;
    }

    const submittedHabitId = habitId;
    const submittedCueId = cueId;
    const submittedLocationId = locationId;

    try {
      setSaving(true);

      const newLogId = await addLog({
        habitId: submittedHabitId,
        cueId: submittedCueId,
        locationId: submittedLocationId,
        intensity,
        count,
        didResist,
        notes: notes.trim() || undefined,
      });

      setRecentHabitIds((prev) => bumpRecent(prev, submittedHabitId));

      if (submittedCueId != null) {
        setRecentCueIds((prev) => bumpRecent(prev, submittedCueId));
      }

      if (submittedLocationId != null) {
        setRecentLocationIds((prev) => bumpRecent(prev, submittedLocationId));
      }

      resetToDefaults(submittedHabitId);

      if (newLogId != null) {
        navigation.navigate("UrgeHelp", { logId: newLogId });
      }
    } catch {
      setErrorMsg("Could not save.");
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
        }, 50);
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
  const countLabel =
    count === 0
      ? "None"
      : count === 1
        ? "Once"
        : count === 2
          ? "Twice"
          : `${count}x`;

  const chipBase = "rounded-full border px-2.5 py-1.5";
  const chipSelected = "bg-green-600 border-green-600";
  const chipUnselected = "bg-white border-gray-200";

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
        value={count}
        allowNone={didResist}
        onPick={(n) => {
          setCount(n);
          if (n > 0) setDidResist(false);
          setShowCountPicker(false);
        }}
        onClose={() => setShowCountPicker(false)}
      />

      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: 20,
          paddingVertical: 16,
          paddingBottom: keyboardHeight > 0 ? 80 : 16,
        }}
      >
        <Animated.View
          className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-4"
          style={{
            transform: [{ translateY: keyboardLiftAnim }],
          }}
        >
          <ChipRow<SelectedHabit>
            title="Habit"
            items={orderedHabits}
            selectedId={habitId}
            onSelect={setHabitId}
            onAdd={() => navigation.navigate("ManageList", { type: "habits" })}
            listRef={habitListRef}
          />

          <ChipRow<SelectedCue>
            title="Cue"
            items={orderedCues}
            selectedId={cueId}
            onSelect={setCueId}
            allowNone
            onAdd={() => navigation.navigate("ManageList", { type: "cues" })}
            listRef={cueListRef}
          />

          <ChipRow<SelectedPlace>
            title="Location"
            items={orderedLocations}
            selectedId={locationId}
            onSelect={setLocationId}
            allowNone
            onAdd={() =>
              navigation.navigate("ManageList", { type: "locations" })
            }
            listRef={locationListRef}
          />

          <View className="mt-3 w-full flex-row items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3">
            <Text className="text-sm font-semibold text-gray-900">
              Resisted?
            </Text>
            <Switch
              value={didResist}
              onValueChange={setDidResistAndMaybeCount}
            />
          </View>

          <View className="mt-3 w-full flex-row gap-3">
            <View className="flex-1 rounded-2xl border border-gray-200 bg-white px-3 py-3">
              <Text className="text-sm font-semibold text-gray-900">Count</Text>

              <View className="mt-2 flex-row items-center">
                <Pressable
                  onPress={() => setShowCountPicker(true)}
                  className={`${chipBase} ${chipSelected} ${
                    didResist ? "" : "mr-2"
                  }`}
                >
                  <Text className="text-sm font-semibold text-white">
                    {countLabel}
                  </Text>
                </Pressable>

                {!didResist ? (
                  <Pressable
                    onPress={() => setShowCountPicker(true)}
                    className={`${chipBase} ${chipUnselected}`}
                  >
                    <Text className="text-sm font-semibold text-gray-900">
                      + Add
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View className="flex-1 rounded-2xl border border-gray-200 bg-white px-3 py-3">
              <Text className="text-sm font-semibold text-gray-900">
                Intensity
              </Text>

              <View className="mt-2 flex-row items-center">
                <Pressable
                  onPress={() => setShowIntensityPicker(true)}
                  className={`${chipBase} ${chipSelected} mr-2`}
                >
                  <Text className="text-sm font-semibold text-white">
                    {intensityLabel}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setShowIntensityPicker(true)}
                  className={`${chipBase} ${chipUnselected}`}
                >
                  <Text className="text-sm font-semibold text-gray-900">
                    + Add
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          <Pressable
            onPress={onShowNotes}
            className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3"
          >
            <Text className="text-sm font-semibold text-gray-900">
              {showNotes ? "Hide notes" : "Add Notes (optional)"}
            </Text>
          </Pressable>

          {showNotes ? (
            <TextInput
              ref={notesInputRef}
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything useful to remember…"
              placeholderTextColor="#9CA3AF"
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-gray-900"
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={() => Keyboard.dismiss()}
              onFocus={scrollNotesIntoView}
            />
          ) : null}

          {errorMsg ? (
            <Text className="mt-2 text-sm font-semibold text-red-600">
              {errorMsg}
            </Text>
          ) : null}

          <Pressable
            onPress={onSave}
            disabled={saving}
            className={`mt-3 w-full rounded-2xl px-5 py-3.5 ${
              saving ? "bg-green-300" : "bg-green-600"
            }`}
          >
            <Text className="text-center text-base font-semibold text-white">
              {saving ? "Saving..." : "Save"}
            </Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
