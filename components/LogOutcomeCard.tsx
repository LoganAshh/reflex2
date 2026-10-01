import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

type LogOutcomeCardProps = {
  didResist: boolean;
  quantity: number;
  unit: string;
  resetToken?: number;
  onSelectResisted: () => void;
  onSelectGaveIn: () => void;
  onSelectQuantity: (quantity: number) => void;
};

function quantityUnit(unit: string, value: number) {
  if (value !== 1) return unit;
  if (unit.toLowerCase() === "times") return "time";
  if (unit.toLowerCase() === "minutes") return "minute";
  return unit;
}

export function formatLogAmount(value: number, unit: string) {
  if (value === 0) return "None";
  const normalizedUnit = unit.trim().toLowerCase();
  if (normalizedUnit === "times") {
    if (value === 1) return "Once";
    if (value === 2) return "Twice";
  }

  if (normalizedUnit === "minutes") {
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    if (hours > 0 && minutes > 0) return `${hours} hr ${minutes} min`;
    if (hours > 0) return `${hours} hr`;
    return `${minutes} min`;
  }

  return `${value} ${quantityUnit(unit, value)}`;
}

export function LogOutcomeCard({
  didResist,
  quantity,
  unit,
  resetToken,
  onSelectResisted,
  onSelectGaveIn,
  onSelectQuantity,
}: LogOutcomeCardProps) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const [customHours, setCustomHours] = useState("");
  const [customMinutes, setCustomMinutes] = useState("");
  const customMinutesInputRef = useRef<TextInput | null>(null);
  const amountScrollRef = useRef<ScrollView | null>(null);
  const isTimeBased = unit.trim().toLowerCase() === "minutes";
  const options = useMemo(
    () =>
      unit.trim().toLowerCase() === "minutes"
        ? [1, 5, 15, 30, 60, 120]
        : Array.from({ length: 10 }, (_, index) => index + 1),
    [unit],
  );
  const customSelected =
    !didResist && quantity > 0 && !options.includes(quantity);

  useEffect(() => {
    if (didResist) {
      setShowCustom(false);
      setCustomValue("");
      setCustomHours("");
      setCustomMinutes("");
    }
  }, [didResist]);

  useEffect(() => {
    setShowCustom(false);
    setCustomValue("");
    setCustomHours("");
    setCustomMinutes("");
  }, [unit]);

  useEffect(() => {
    if (resetToken == null) return;
    setShowCustom(false);
    setCustomValue("");
    setCustomHours("");
    setCustomMinutes("");
    requestAnimationFrame(() => {
      amountScrollRef.current?.scrollTo({ x: 0, animated: true });
    });
  }, [resetToken]);

  const chooseQuantity = (value: number) => {
    Keyboard.dismiss();
    setShowCustom(false);
    setCustomValue("");
    setCustomHours("");
    setCustomMinutes("");
    onSelectQuantity(value);
  };

  const submitCustomValue = () => {
    if (isTimeBased) {
      const hours = customHours.trim() === "" ? 0 : Number(customHours);
      const minutes = customMinutes.trim() === "" ? 0 : Number(customMinutes);
      if (
        !Number.isInteger(hours) ||
        !Number.isInteger(minutes) ||
        hours < 0 ||
        minutes < 0 ||
        minutes > 59
      ) {
        return;
      }
      const totalMinutes = hours * 60 + minutes;
      if (totalMinutes < 1) return;
      chooseQuantity(Math.min(999999, totalMinutes));
      return;
    }

    const parsed = Number(customValue);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    chooseQuantity(Math.min(999999, Math.max(1, Math.round(parsed))));
  };

  const customDurationIsValid = (() => {
    const hours = customHours.trim() === "" ? 0 : Number(customHours);
    const minutes = customMinutes.trim() === "" ? 0 : Number(customMinutes);
    return (
      Number.isInteger(hours) &&
      Number.isInteger(minutes) &&
      hours >= 0 &&
      minutes >= 0 &&
      minutes <= 59 &&
      hours * 60 + minutes >= 1
    );
  })();
  const customAmountIsValid = isTimeBased
    ? customDurationIsValid
    : Number.isFinite(Number(customValue)) && Number(customValue) >= 1;

  return (
    <>
      <View className="mt-2 w-full rounded-3xl border border-gray-200 bg-gray-50 p-3 shadow-sm">
        <View className="flex-row items-center">
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="About resisted"
            className="h-9 w-9 items-center justify-center rounded-2xl border border-gray-200 bg-white"
          >
            <Ionicons
              name={didResist ? "shield-checkmark" : "shield-outline"}
              size={19}
              color="#000000"
            />
          </Pressable>

          <View className="ml-3 flex-1">
            <Text className="text-sm font-black text-black">Amount</Text>
          </View>

          <Text className="mr-1 text-xs font-black text-black">Resisted?</Text>

          <Switch
            value={didResist}
            style={{ transform: [{ scale: 0.76 }] }}
            onValueChange={(value) => {
              if (value) {
                onSelectResisted();
              } else {
                onSelectGaveIn();
              }
            }}
            trackColor={{ false: "#E5E7EB", true: "#86EFAC" }}
            thumbColor={didResist ? "#16A34A" : "#F9FAFB"}
          />
        </View>

        <ScrollView
          ref={amountScrollRef}
          className="mt-2"
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {didResist ? (
            <View className="mr-2 rounded-full border border-green-600 bg-green-600 px-3 py-1.5">
              <Text className="text-xs font-black text-white">None</Text>
            </View>
          ) : (
            <>
              {options.map((value) => {
                const selected = !showCustom && quantity === value;

                return (
                  <Pressable
                    key={value}
                    onPress={() => chooseQuantity(value)}
                    className={`mr-2 rounded-full border px-3 py-1.5 ${
                      selected
                        ? "border-green-600 bg-green-600"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <Text
                      numberOfLines={1}
                      className={`text-xs font-black ${
                        selected ? "text-white" : "text-black"
                      }`}
                    >
                      {formatLogAmount(value, unit)}
                    </Text>
                  </Pressable>
                );
              })}

              <Pressable
                onPress={() => {
                  setShowCustom(true);
                  if (isTimeBased) {
                    const existing = customSelected ? quantity : 0;
                    const hours = Math.floor(existing / 60);
                    const minutes = existing % 60;
                    setCustomHours(hours > 0 ? String(hours) : "");
                    setCustomMinutes(minutes > 0 ? String(minutes) : "");
                  } else {
                    setCustomValue(customSelected ? String(quantity) : "");
                  }
                }}
                className={`mr-2 rounded-full border px-3 py-1.5 ${
                  showCustom || customSelected
                    ? "border-green-600 bg-green-600"
                    : "border-gray-200 bg-white"
                }`}
              >
                <Text
                  className={`text-xs font-black ${
                    showCustom || customSelected ? "text-white" : "text-black"
                  }`}
                >
                  {customSelected && !showCustom
                    ? formatLogAmount(quantity, unit)
                    : "Custom"}
                </Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </View>

      <Modal
        visible={showCustom}
        transparent
        animationType="fade"
        onRequestClose={() => {
          Keyboard.dismiss();
          setShowCustom(false);
        }}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/40 px-6"
          onPress={() => {
            Keyboard.dismiss();
            setShowCustom(false);
          }}
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
                  Custom amount
                </Text>
                <Text className="mt-1 text-sm font-semibold text-gray-500">
                  {isTimeBased
                    ? "Enter the hours and minutes."
                    : "Enter the amount that happened."}
                </Text>
              </View>
            </View>

            {isTimeBased ? (
              <View className="mt-4 flex-row gap-3">
                <View className="flex-1">
                  <Text className="mb-2 text-xs font-black uppercase tracking-wide text-gray-500">
                    Hours
                  </Text>
                  <TextInput
                    autoFocus
                    value={customHours}
                    onChangeText={setCustomHours}
                    placeholder="0"
                    placeholderTextColor="#9CA3AF"
                    keyboardType={
                      Platform.OS === "ios"
                        ? "numbers-and-punctuation"
                        : "number-pad"
                    }
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() =>
                      customMinutesInputRef.current?.focus()
                    }
                    maxLength={4}
                    textAlignVertical="center"
                    className="h-12 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-0 text-center text-black"
                  />
                </View>

                <View className="flex-1">
                  <Text className="mb-2 text-xs font-black uppercase tracking-wide text-gray-500">
                    Minutes
                  </Text>
                  <TextInput
                    ref={customMinutesInputRef}
                    value={customMinutes}
                    onChangeText={setCustomMinutes}
                    placeholder="0"
                    placeholderTextColor="#9CA3AF"
                    keyboardType={
                      Platform.OS === "ios"
                        ? "numbers-and-punctuation"
                        : "number-pad"
                    }
                    returnKeyType="done"
                    blurOnSubmit
                    onSubmitEditing={submitCustomValue}
                    maxLength={2}
                    textAlignVertical="center"
                    className="h-12 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-0 text-center text-black"
                  />
                </View>
              </View>
            ) : (
              <TextInput
                autoFocus
                value={customValue}
                onChangeText={setCustomValue}
                placeholder={`Amount in ${unit}`}
                placeholderTextColor="#9CA3AF"
                keyboardType={
                  Platform.OS === "ios"
                    ? "numbers-and-punctuation"
                    : "number-pad"
                }
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={submitCustomValue}
                className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-black"
              />
            )}

            <View className="mt-4 flex-row">
              <Pressable
                onPress={() => {
                  Keyboard.dismiss();
                  setShowCustom(false);
                }}
                className="mr-2 flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3"
              >
                <Text className="text-center text-sm font-black text-black">
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                onPress={submitCustomValue}
                disabled={!customAmountIsValid}
                className={`ml-2 flex-1 rounded-2xl px-4 py-3 ${
                  customAmountIsValid ? "bg-green-600" : "bg-gray-300"
                }`}
              >
                <Text className="text-center text-sm font-black text-white">
                  Done
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={infoOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoOpen(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/40 px-6"
          onPress={() => setInfoOpen(false)}
        >
          <Pressable
            className="w-full rounded-[32px] bg-white p-5"
            onPress={() => {}}
          >
            <View className="flex-row items-center">
              <View className="h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white">
                <Ionicons name="shield-checkmark" size={24} color="#000000" />
              </View>

              <Text className="ml-3 flex-1 text-xl font-black text-black">
                Resisted?
              </Text>
            </View>

            <Text className="mt-4 text-sm font-semibold leading-5 text-gray-600">
              Turn this on when you felt the urge but did not do the habit. When
              it is off, enter the amount that happened.
            </Text>

            <Pressable
              onPress={() => setInfoOpen(false)}
              className="mt-5 rounded-2xl bg-green-600 px-4 py-3"
            >
              <Text className="text-center text-sm font-black text-white">
                Got it
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
