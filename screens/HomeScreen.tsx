import { View, Text, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { RootTabParamList } from "../App";
import { useData } from "../data/DataContext";

export default function HomeScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const { logs } = useData();

  const totalLogs = logs.length;
  const lastLog = logs[0];
  const lastLogDate = lastLog ? new Date(lastLog.createdAt) : null;

  return (
    <View className="flex-1 bg-white px-6 pt-10">
      <Text className="text-3xl font-bold text-gray-900">Home</Text>
      <Text className="mt-2 text-gray-600">
        Quick log + your progress snapshot.
      </Text>

      {/* Stats Card */}
      <View className="mt-6 w-full rounded-2xl border border-gray-200 bg-gray-50 p-5">
        <Text className="text-base font-semibold text-gray-900">Progress</Text>

        <View className="mt-4 flex-row justify-between">
          <View>
            <Text className="text-sm text-gray-500">Total logs</Text>
            <Text className="text-2xl font-bold text-gray-900">
              {totalLogs}
            </Text>
          </View>

          <View className="items-end">
            <Text className="text-sm text-gray-500">Last log</Text>
            <Text className="text-base font-semibold text-gray-900">
              {lastLogDate ? lastLogDate.toLocaleString() : "No logs yet"}
            </Text>
          </View>
        </View>

        <Text className="mt-4 text-sm text-gray-600">
          {totalLogs === 0
            ? "Start by logging your first urge. You’re building awareness."
            : "Nice. Every entry is a win—awareness is progress."}
        </Text>
      </View>

      {/* Primary Action */}
      <Pressable
        onPress={() => navigation.navigate("Log")}
        className="mt-6 w-full rounded-2xl bg-blue-600 px-5 py-4"
      >
        <Text className="text-center text-lg font-semibold text-white">
          Log an Urge
        </Text>
      </Pressable>

      {/* Secondary (placeholder for future quick actions) */}
      <Pressable
        onPress={() => navigation.navigate("Shop")}
        className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-5 py-4"
      >
        <Text className="text-center text-base font-semibold text-gray-900">
          Browse Replacement Actions
        </Text>
      </Pressable>
    </View>
  );
}
