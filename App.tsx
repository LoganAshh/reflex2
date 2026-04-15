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
import SubscriptionScreen from "./screens/SubscriptionScreen";
import SettingsScreen from "./screens/SettingsScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import ManageListScreen from "./screens/ManageListScreen";
import ProfileSetupScreen from "./screens/ProfileSetupScreen";
import UrgeHelpScreen from "./screens/UrgeHelpScreen";

import { DataProvider, useData } from "./data/DataContext";

export type RootTabParamList = {
  Home: undefined;
  Shop: undefined;
  Log: undefined;
  Analytics: undefined;
  Subscription: undefined;
};

export type RootStackParamList = {
  Main: undefined;
  ManageList: { type: "habits" | "cues" | "locations" };
  ProfileSetup: undefined;
  Settings: undefined;
  UrgeHelp: { logId: number };
  ShopPicker: undefined;
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
            case "Subscription":
              iconName = focused ? "diamond" : "diamond-outline";
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
                navigation.getParent()?.navigate("Settings");
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{
                marginRight: 20,
                height: 24,
                width: 24,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name="settings-outline"
                size={24}
                color="#1F2937"
                style={{ transform: [{ translateY: -1 }] }}
              />
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
        name="Subscription"
        component={SubscriptionScreen}
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
        name="Settings"
        component={SettingsScreen}
        options={{ title: "Settings", headerBackTitle: "Back" }}
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
      <Stack.Screen
        name="UrgeHelp"
        component={UrgeHelpScreen}
        options={{
          title: "Resist the urge",
          headerBackTitle: "Back",
          headerBackButtonMenuEnabled: false,
        }}
      />
      <Stack.Screen
        name="ShopPicker"
        component={ShopScreen}
        options={{ title: "Shop", headerBackTitle: "Back" }}
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
