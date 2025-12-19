import { View, Text } from "react-native";

export default function ProfileScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-2xl font-bold text-gray-900">Profile</Text>
      <Text className="mt-2 text-center text-gray-600">
        Settings, export/backup, and auth controls go here.
      </Text>
    </View>
  );
}