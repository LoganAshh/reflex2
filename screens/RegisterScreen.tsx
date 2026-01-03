import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { useAuth } from "../data/AuthContext";

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export default function RegisterScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { signUp } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  async function onRegister() {
    if (!email || !password) {
      Alert.alert("Missing fields", "Email and password are required.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }

    try {
      setLoading(true);
      await Haptics.selectionAsync();
      await signUp({ email, password, displayName });
    } catch (e: any) {
      Alert.alert("Registration failed", e.message ?? "Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-zinc-50"
    >
      <View className="flex-1 justify-center px-6">
        <Text className="mb-2 text-3xl font-bold text-zinc-900">
          Create account
        </Text>
        <Text className="mb-8 text-zinc-600">
          This takes less than a minute.
        </Text>

        <TextInput
          placeholder="Name (optional)"
          value={displayName}
          onChangeText={setDisplayName}
          className="mb-3 rounded-xl border border-zinc-300 bg-white px-4 py-3"
        />

        <TextInput
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          className="mb-3 rounded-xl border border-zinc-300 bg-white px-4 py-3"
        />

        <TextInput
          placeholder="Password (min 6 chars)"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          className="mb-6 rounded-xl border border-zinc-300 bg-white px-4 py-3"
        />

        <Pressable
          onPress={onRegister}
          disabled={loading}
          className="mb-4 rounded-xl bg-zinc-900 py-3"
        >
          <Text className="text-center text-base font-semibold text-white">
            {loading ? "Creating…" : "Create Account"}
          </Text>
        </Pressable>

        <Pressable onPress={() => navigation.navigate("Login")}>
          <Text className="text-center text-sm text-zinc-600">
            Already have an account?{" "}
            <Text className="font-semibold text-zinc-900">Log in</Text>
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
