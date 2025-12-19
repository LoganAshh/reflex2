import { View, Text } from "react-native";

export default function ShopScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-2xl font-bold text-gray-900">Shop</Text>
      <Text className="mt-2 text-center text-gray-600">
        Replacement actions list (preset + custom) goes here.
      </Text>
    </View>
  );
}
