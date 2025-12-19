import { View, Text, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { RootTabParamList } from "../App";

export default function HomeScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();

  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-2xl font-bold text-gray-900">Home</Text>
      <Text className="mt-2 text-center text-gray-600">
        Dashboard + quick log button goes here.
      </Text>

      <Pressable
        onPress={() => navigation.navigate("Log")}
        className="mt-6 rounded-full bg-blue-600 px-5 py-3"
      >
        <Text className="text-white font-semibold">Log an Urge</Text>
      </Pressable>
    </View>
  );
}
