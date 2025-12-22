import "./global.css";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";

import HomeScreen from "./screens/HomeScreen";
import ShopScreen from "./screens/ShopScreen";
import LogScreen from "./screens/LogScreen";
import AnalyticsScreen from "./screens/AnalyticsScreen";
import ProfileScreen from "./screens/ProfileScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import ManageListScreen from "./screens/ManageListScreen";

import { DataProvider, useData } from "./data/DataContext";

export type RootTabParamList = {
  Home: undefined;
  Shop: undefined;
  Log: undefined;
  Analytics: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Main: undefined;
  ManageList: { type: "habits" | "cues" | "locations" };
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function Tabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: true }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Shop" component={ShopScreen} />
      <Tab.Screen name="Log" component={LogScreen} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function RootStack() {
  const { hasOnboarded } = useData();

  if (!hasOnboarded) return <OnboardingScreen />;

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
        options={{ title: "Manage" }}
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
