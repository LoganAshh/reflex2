import React, { useEffect, useMemo, useState } from "react";
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

function formatQuantity(value: number, unit: string) {
  if (unit.trim().toLowerCase() === "times") {
    if (value === 1) return "Once";
    if (value === 2) return "Twice";
  }

  return `${value} ${quantityUnit(unit, value)}`;
}

export function LogOutcomeCard({
  didResist,
  quantity,
  unit,
  onSelectResisted,
  onSelectGaveIn,
  onSelectQuantity,
}: LogOutcomeCardProps) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const options = useMemo(
    () =>
      unit.trim().toLowerCase() === "minutes"
        ? [1, 5, 10, 15, 20, 30, 45, 60]
        : Array.from({ length: 10 }, (_, index) => index + 1),
    [unit],
  );
  const customSelected =
    !didResist && quantity > 0 && !options.includes(quantity);

  useEffect(() => {
    if (didResist) {
      setShowCustom(false);
      setCustomValue("");
    }
  }, [didResist]);

  useEffect(() => {
    setShowCustom(false);
    setCustomValue("");
  }, [unit]);

  const chooseQuantity = (value: number) => {
    Keyboard.dismiss();
    setShowCustom(false);
    setCustomValue("");
    onSelectQuantity(value);
  };

  const submitCustomValue = () => {
    const parsed = Number(customValue);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    chooseQuantity(Math.min(999999, Math.max(1, Math.round(parsed))));
  };

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
                      {formatQuantity(value, unit)}
                    </Text>
                  </Pressable>
                );
              })}

              <Pressable
                onPress={() => {
                  setShowCustom(true);
                  setCustomValue(customSelected ? String(quantity) : "");
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
                  Custom
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
                  Enter the amount that happened.
                </Text>
              </View>
            </View>

            <TextInput
              autoFocus
              value={customValue}
              onChangeText={setCustomValue}
              placeholder={`Amount in ${unit}`}
              placeholderTextColor="#9CA3AF"
              keyboardType={
                Platform.OS === "ios" ? "numbers-and-punctuation" : "number-pad"
              }
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={submitCustomValue}
              className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-black"
            />

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
                disabled={
                  !Number.isFinite(Number(customValue)) ||
                  Number(customValue) < 1
                }
                className={`ml-2 flex-1 rounded-2xl px-4 py-3 ${
                  Number(customValue) >= 1 ? "bg-green-600" : "bg-gray-300"
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
