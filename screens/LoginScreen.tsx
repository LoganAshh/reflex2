import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Keyboard,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { useAuth } from "../data/AuthContext";

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export default function LoginScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onLogin() {
    if (!email.trim() || !password) {
      Alert.alert("Missing fields", "Enter email and password.");
      return;
    }

    try {
      setLoading(true);
      Keyboard.dismiss();
      await Haptics.selectionAsync();
      await login(email.trim(), password);
    } catch (e: any) {
      Alert.alert("Login failed", e.message ?? "Invalid credentials.");
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
          Welcome back
        </Text>
        <Text className="mb-8 text-zinc-600">Log in to continue.</Text>

        {/* Email */}
        <TextInput
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          multiline={false}
          numberOfLines={1}
          returnKeyType="done"
          onSubmitEditing={() => Keyboard.dismiss()}
          textAlignVertical="center"
          className="mb-3 rounded-xl border border-zinc-300 bg-white px-4 py-3"
          style={{ height: 48 }}
        />

        {/* Password */}
        <TextInput
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          multiline={false}
          numberOfLines={1}
          returnKeyType="done"
          onSubmitEditing={() => Keyboard.dismiss()}
          textAlignVertical="center"
          className="mb-6 rounded-xl border border-zinc-300 bg-white px-4 py-3"
          style={{ height: 48 }}
        />

        <Pressable
          onPress={onLogin}
          disabled={loading}
          className="mb-4 rounded-xl bg-zinc-900 py-3"
        >
          <Text className="text-center text-base font-semibold text-white">
            {loading ? "Logging in…" : "Log In"}
          </Text>
        </Pressable>

        <Pressable onPress={() => navigation.navigate("Register")}>
          <Text className="text-center text-sm text-zinc-600">
            Don’t have an account?{" "}
            <Text className="font-semibold text-zinc-900">Create one</Text>
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
