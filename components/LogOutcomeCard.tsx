import React, { useState } from "react";
import { Modal, Pressable, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type LogOutcomeCardProps = {
  didResist: boolean;
  quantityLabel: string;
  onSelectResisted: () => void;
  onSelectGaveIn: () => void;
  onChangeQuantity: () => void;
};

export function LogOutcomeCard({
  didResist,
  quantityLabel,
  onSelectResisted,
  onSelectGaveIn,
  onChangeQuantity,
}: LogOutcomeCardProps) {
  const [infoOpen, setInfoOpen] = useState(false);

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

          <Text className="ml-3 flex-1 text-sm font-black text-black">
            Resisted?
          </Text>

          <Switch
            value={didResist}
            style={{ transform: [{ scale: 0.88 }] }}
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

        <View className="mt-2 flex-row items-center rounded-2xl border border-gray-200 bg-white px-3 py-2.5">
          <View className="flex-1 flex-row items-center">
            <Text className="text-[10px] font-black uppercase tracking-wide text-gray-500">
              Amount
            </Text>
            <Text
              numberOfLines={1}
              className={`ml-2 flex-1 text-sm font-black ${
                didResist ? "text-green-600" : "text-black"
              }`}
            >
              {quantityLabel}
            </Text>
          </View>

          {!didResist ? (
            <Pressable
              onPress={onChangeQuantity}
              accessibilityRole="button"
              className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1"
            >
              <Text className="text-xs font-black text-black">Change</Text>
            </Pressable>
          ) : (
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              className="rounded-full border border-transparent px-3 py-1"
            >
              <Text className="text-xs font-black opacity-0">Change</Text>
            </View>
          )}
        </View>
      </View>

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
