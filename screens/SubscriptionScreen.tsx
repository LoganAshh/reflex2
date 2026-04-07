import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function SubscriptionScreen() {
  return (
    <View className="flex-1 bg-white px-6 pt-10">
      <View className="flex-1 items-center justify-center">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-green-50">
          <Ionicons name="diamond-outline" size={36} color="#16A34A" />
        </View>

        <Text className="mt-6 text-3xl font-bold text-gray-900">
          Subscription
        </Text>

        <Text className="mt-3 text-center text-base leading-7 text-gray-600">
          Premium features and subscription options are coming soon.
        </Text>
      </View>
    </View>
  );
}
