import "./global.css";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  AppState,
} from "react-native";
import {
  NavigationContainer,
  type NavigatorScreenParams,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import * as Notifications from "expo-notifications";

import HomeScreen from "./screens/HomeScreen";
import ShopScreen from "./screens/ShopScreen";
import LogScreen from "./screens/LogScreen";
import AnalyticsScreen from "./screens/AnalyticsScreen";
import SettingsScreen from "./screens/SettingsScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import ManageListScreen from "./screens/ManageListScreen";
import ProfileSetupScreen from "./screens/ProfileSetupScreen";
import UrgeHelpScreen from "./screens/UrgeHelpScreen";
import { Screen } from "./components/Screen";

import { DataProvider, useData } from "./data/DataContext";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type ManageListType = "habits" | "cues" | "locations";

export type ManageListSelection = {
  type: ManageListType;
  id: number;
  token: number;
};

export type TabResetParams = {
  resetToken?: number;
};

export type RootTabParamList = {
  Home: TabResetParams | undefined;
  Analytics: TabResetParams | undefined;
  Shop: TabResetParams | undefined;
  Log:
    | (TabResetParams & {
        manageListSelection?: ManageListSelection;
      })
    | undefined;
  Settings: TabResetParams | undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  InitialProfileSetup: undefined;
  Main: NavigatorScreenParams<RootTabParamList> | undefined;
  ManageList: {
    type: ManageListType;
    habitId?: number;
    openGoal?: boolean;
    setupMissingPlans?: boolean;
  };
  ProfileSetup: undefined;
  Settings: undefined;
  UrgeHelp: { logId: number };
  ShopPicker: { showDoneButton?: boolean } | undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function AppLoadingScreen() {
  return (
    <Screen
      edges={["top", "bottom", "left", "right"]}
      className="items-center justify-center px-6"
    >
      <ActivityIndicator size="large" color="#16A34A" />
      <Text className="mt-4 text-base font-semibold text-gray-900">
        Loading Reflex...
      </Text>
      <Text className="mt-1 text-sm text-gray-500">
        Getting everything ready
      </Text>
    </Screen>
  );
}

function AppLockScreen({
  authenticating,
  onUnlock,
}: {
  authenticating: boolean;
  onUnlock: () => void;
}) {
  return (
    <Screen
      edges={["top", "bottom", "left", "right"]}
      className="items-center justify-center px-6"
    >
      <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-green-50">
        <Ionicons name="lock-closed" size={38} color="#16A34A" />
      </View>

      <Text className="text-2xl font-bold text-zinc-900">Reflex is locked</Text>

      <Text className="mt-2 text-center text-base text-zinc-600">
        Use Face ID or your device passcode to unlock your local data.
      </Text>

      <Pressable
        onPress={onUnlock}
        disabled={authenticating}
        className={[
          "mt-8 w-full rounded-2xl py-4",
          authenticating ? "bg-green-400" : "bg-green-600",
        ].join(" ")}
      >
        {authenticating ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-center text-base font-bold text-white">
            Unlock Reflex
          </Text>
        )}
      </Pressable>
    </Screen>
  );
}

function AppLockGate({ children }: { children: React.ReactNode }) {
  const { appLockEnabled } = useData();

  const [unlocked, setUnlocked] = useState(!appLockEnabled);
  const [authenticating, setAuthenticating] = useState(false);
  const [shouldPrompt, setShouldPrompt] = useState(appLockEnabled);

  const appStateRef = useRef(AppState.currentState);
  const authenticatingRef = useRef(false);
  const lastAuthCompletedAtRef = useRef(0);

  const unlock = useCallback(async () => {
    if (!appLockEnabled) {
      setUnlocked(true);
      setShouldPrompt(false);
      return;
    }

    if (authenticatingRef.current) return;

    try {
      authenticatingRef.current = true;
      setAuthenticating(true);
      setShouldPrompt(false);

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Reflex",
        fallbackLabel: "Use Passcode",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });

      lastAuthCompletedAtRef.current = Date.now();

      if (result.success) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        setUnlocked(true);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch {
      lastAuthCompletedAtRef.current = Date.now();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      authenticatingRef.current = false;
      setAuthenticating(false);
    }
  }, [appLockEnabled]);

  useEffect(() => {
    if (!appLockEnabled) {
      setUnlocked(true);
      setShouldPrompt(false);
      return;
    }

    setShouldPrompt((current) => current);
  }, [appLockEnabled]);

  useEffect(() => {
    if (!appLockEnabled) return;
    if (unlocked) return;
    if (!shouldPrompt) return;
    if (authenticatingRef.current) return;

    unlock();
  }, [appLockEnabled, unlocked, shouldPrompt, unlock]);

  useEffect(() => {
    if (!appLockEnabled) return;

    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (authenticatingRef.current) return;

      const justAuthenticated =
        Date.now() - lastAuthCompletedAtRef.current < 2000;

      if (justAuthenticated) return;

      const wasAway =
        previousState === "inactive" || previousState === "background";

      if (wasAway && nextState === "active") {
        setUnlocked(false);
        setShouldPrompt(true);
      }
    });

    return () => subscription.remove();
  }, [appLockEnabled]);

  if (appLockEnabled && !unlocked) {
    return <AppLockScreen authenticating={authenticating} onUnlock={unlock} />;
  }

  return <>{children}</>;
}

function Tabs() {
  const tabHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const onTabPress = (navigation: any) => {
    tabHaptic();

    if (navigation.isFocused()) {
      navigation.setParams({ resetToken: Date.now() });
    }
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
              iconName = focused ? "settings" : "settings-outline";
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
        listeners={({ navigation }) => ({
          tabPress: () => onTabPress(navigation),
        })}
      />

      <Tab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        listeners={({ navigation }) => ({
          tabPress: () => onTabPress(navigation),
        })}
      />

      <Tab.Screen
        name="Log"
        component={LogScreen}
        listeners={({ navigation }) => ({
          tabPress: () => onTabPress(navigation),
        })}
      />

      <Tab.Screen
        name="Shop"
        component={ShopScreen}
        listeners={({ navigation }) => ({
          tabPress: () => onTabPress(navigation),
        })}
      />

      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        listeners={({ navigation }) => ({
          tabPress: () => onTabPress(navigation),
        })}
      />
    </Tab.Navigator>
  );
}

function RootStack() {
  const { hasOnboarded, hasCompletedLocalProfile, initializing } = useData();

  if (initializing) {
    return <AppLoadingScreen />;
  }

  return (
    <AppLockGate>
      <Stack.Navigator>
        {!hasOnboarded ? (
          <Stack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            options={{ headerShown: false }}
          />
        ) : !hasCompletedLocalProfile ? (
          <Stack.Screen
            name="InitialProfileSetup"
            component={ProfileSetupScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <>
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
              options={{
                title: "Shop",
                headerBackTitle: "Back",
                headerBackVisible: false,
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </AppLockGate>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <DataProvider>
          <NavigationContainer>
            <RootStack />
          </NavigationContainer>
        </DataProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
