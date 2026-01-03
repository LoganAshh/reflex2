import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyB8Wai5sTLAsPg53oExFhu9adUSwgI7VXI",
  authDomain: "reflex-2970e.firebaseapp.com",
  projectId: "reflex-2970e",
  storageBucket: "reflex-2970e.firebasestorage.app",
  messagingSenderId: "468344200790",
  appId: "1:468344200790:web:25614badd4c91fa54e65f7",
  measurementId: "G-XV0VJEH80W",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
