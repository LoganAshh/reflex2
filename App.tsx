import "./global.css";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

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
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        tabBarShowLabel: false,
        tabBarInactiveTintColor: "#9CA3AF", // gray-400
        tabBarStyle: {
          height: 76,
          paddingBottom: 6,
          paddingTop: 8,
          borderTopWidth: 0.5,
          borderTopColor: "#E5E7EB",
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
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
            case "Profile":
              iconName = focused ? "person" : "person-outline";
              break;
            default:
              iconName = "ellipse";
          }

          const color =
            route.name === "Log"
              ? focused
                ? "#16A34A" // green-600
                : "#9CA3AF" // gray-400
              : focused
                ? "#1F2937" // gray-800
                : "#9CA3AF"; // gray-400

          const iconSize = route.name === "Log" ? size + 4 : size;

          return <Ionicons name={iconName} size={iconSize} color={color} />;
        },
      })}
    >
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

  // Gate: ONLY this SecureStore-backed flag controls onboarding now.
  // (Selections like selectedHabits can change during onboarding without booting the user out.)
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
        options={{
          title: "Manage",
          headerBackTitle: "Back",
        }}
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
