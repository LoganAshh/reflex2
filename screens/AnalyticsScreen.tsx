import { View, Text } from "react-native";

export default function AnalyticsScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-2xl font-bold text-gray-900">Analytics</Text>
      <Text className="mt-2 text-center text-gray-600">
        Charts and deeper insights go here.
      </Text>
    </View>
  );
}
