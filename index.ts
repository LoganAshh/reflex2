import "react-native-gesture-handler";
import { registerRootComponent } from "expo";

if (__DEV__) {
  const ignoredWarningStarts = [
    "expo-notifications: Android Push notifications",
    "`expo-notifications` functionality is not fully supported in Expo Go",
    "SafeAreaView has been deprecated",
  ];

  const originalConsoleWarn = console.warn.bind(console);

  console.warn = (...args: unknown[]) => {
    const message = args.map(String).join(" ");
    if (ignoredWarningStarts.some((warning) => message.startsWith(warning))) {
      return;
    }

    originalConsoleWarn(...args);
  };
}

// Load the app only after the development warning filter is installed.
const App = require("./App").default;

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
