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

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const isValid =
    displayName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 6;

  async function onRegister() {
    if (!displayName.trim()) {
      Alert.alert("Missing name", "Name is required.");
      return;
    }

    if (!email.trim() || !password) {
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
      await signUp({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
      });
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

        {/* Name (REQUIRED, single-line, height-locked) */}
        <TextInput
          placeholder="Name"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          multiline={false}
          numberOfLines={1}
          textAlignVertical="center"
          className="mb-3 rounded-xl border border-zinc-300 bg-white px-4 py-3"
          style={{ height: 48 }}
        />

        {/* Email */}
        <TextInput
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          multiline={false}
          numberOfLines={1}
          textAlignVertical="center"
          className="mb-3 rounded-xl border border-zinc-300 bg-white px-4 py-3"
          style={{ height: 48 }}
        />

        {/* Password */}
        <TextInput
          placeholder="Password (min 6 chars)"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          multiline={false}
          numberOfLines={1}
          textAlignVertical="center"
          className="mb-6 rounded-xl border border-zinc-300 bg-white px-4 py-3"
          style={{ height: 48 }}
        />

        <Pressable
          onPress={onRegister}
          disabled={!isValid || loading}
          className={`mb-4 rounded-xl py-3 ${
            !isValid || loading ? "bg-zinc-400" : "bg-zinc-900"
          }`}
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
