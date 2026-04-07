import "./global.css";
import React from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import HomeScreen from "./screens/HomeScreen";
import ShopScreen from "./screens/ShopScreen";
import LogScreen from "./screens/LogScreen";
import AnalyticsScreen from "./screens/AnalyticsScreen";
import SettingsScreen from "./screens/SettingsScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import ManageListScreen from "./screens/ManageListScreen";
import ProfileSetupScreen from "./screens/ProfileSetupScreen";

import { DataProvider, useData } from "./data/DataContext";

export type RootTabParamList = {
  Home: undefined;
  Shop: undefined;
  Log: undefined;
  Analytics: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Main: undefined;
  ManageList: { type: "habits" | "cues" | "locations" };
  ProfileSetup: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function AppLoadingScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <ActivityIndicator size="large" color="#16A34A" />
      <Text className="mt-4 text-base font-semibold text-gray-900">
        Loading Reflex...
      </Text>
      <Text className="mt-1 text-sm text-gray-500">
        Getting everything ready
      </Text>
    </View>
  );
}

function Tabs() {
  const tabHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        tabBarShowLabel: false,
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarStyle: {
          height: 76,
          paddingBottom: 6,
          paddingTop: 8,
          borderTopWidth: 0.5,
          borderTopColor: "#E5E7EB",
        },
        tabBarIconStyle: { marginTop: 2 },
        tabBarIcon: ({ focused, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case "Home":
              iconName = focused ? "home" : "home-outline";
              break;
            case "Shop":
              iconName = focused ? "flash" : "flash-outline";
              break;
            case "Log":
              iconName = focused ? "add-circle" : "add-circle-outline";
              break;
            case "Analytics":
              iconName = focused ? "bar-chart" : "bar-chart-outline";
              break;
            case "Settings":
              iconName = focused ? "person" : "person-outline";
              break;
            default:
              iconName = "ellipse";
          }

          const color =
            route.name === "Log"
              ? focused
                ? "#16A34A"
                : "#9CA3AF"
              : focused
                ? "#1F2937"
                : "#9CA3AF";

          const iconSize = route.name === "Log" ? size + 4 : size;

          return <Ionicons name={iconName} size={iconSize} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        listeners={{ tabPress: () => tabHaptic() }}
        options={({ navigation }) => ({
          headerRight: () => (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate("Settings");
              }}
              style={{ marginRight: 16 }}
            >
              <Ionicons name="settings-outline" size={24} color="#1F2937" />
            </Pressable>
          ),
        })}
      />

      <Tab.Screen
        name="Shop"
        component={ShopScreen}
        listeners={{ tabPress: () => tabHaptic() }}
      />

      <Tab.Screen
        name="Log"
        component={LogScreen}
        listeners={{ tabPress: () => tabHaptic() }}
      />

      <Tab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        listeners={{ tabPress: () => tabHaptic() }}
      />

      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        listeners={{ tabPress: () => tabHaptic() }}
      />
    </Tab.Navigator>
  );
}

function RootStack() {
  const { hasOnboarded, hasCompletedLocalProfile, initializing } = useData();

  if (initializing) {
    return <AppLoadingScreen />;
  }

  if (!hasOnboarded) return <OnboardingScreen />;
  if (!hasCompletedLocalProfile) return <ProfileSetupScreen />;

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Main"
        component={Tabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ManageList"
        component={ManageListScreen}
        options={{ title: "Manage", headerBackTitle: "Back" }}
      />
      <Stack.Screen
        name="ProfileSetup"
        component={ProfileSetupScreen}
        options={{ title: "Edit Profile", headerBackTitle: "Back" }}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <DataProvider>
        <NavigationContainer>
          <RootStack />
        </NavigationContainer>
      </DataProvider>
    </SafeAreaProvider>
  );
}
