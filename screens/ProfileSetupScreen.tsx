import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { useData } from "../data/DataContext";
import { persistPickedProfilePhoto } from "../data/profileStorage";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileSetupScreen() {
  const navigation = useNavigation<Nav>();
  const {
    profileName,
    profilePhotoUri,
    hasCompletedLocalProfile,
    completeLocalProfile,
  } = useData();

  const [name, setName] = useState(profileName);
  const [photoUri, setPhotoUri] = useState<string | null>(profilePhotoUri);
  const [saving, setSaving] = useState(false);

  const isEditing = hasCompletedLocalProfile;

  const canSave = useMemo(
    () => name.trim().length > 0 && !!photoUri && !saving,
    [name, photoUri, saving],
  );

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!perm.granted) {
      Alert.alert(
        "Permission needed",
        "Photo library permission is required to choose a profile picture.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.9,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets[0]?.uri) {
      try {
        const persistentUri = await persistPickedProfilePhoto(
          result.assets[0].uri,
        );
        await Haptics.selectionAsync();
        setPhotoUri(persistentUri);
      } catch {
        Alert.alert(
          "Could not use photo",
          "Please try choosing that photo again.",
        );
      }
    }
  }

  async function onSave() {
    if (!name.trim()) {
      Alert.alert("Missing name", "Please enter a name.");
      return;
    }

    if (!photoUri) {
      Alert.alert("Missing photo", "Please choose a profile picture.");
      return;
    }

    try {
      setSaving(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await completeLocalProfile(name.trim(), photoUri);

      if (isEditing && navigation.canGoBack()) {
        navigation.goBack();
      }
    } catch (e: any) {
      Alert.alert("Could not save profile", e?.message ?? "Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 20}
    >
      <ScrollView
        className="flex-1 bg-white"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          padding: 24,
        }}
      >
        <View className="items-center">
          <Text className="text-center text-3xl font-bold text-gray-900">
            {isEditing ? "Edit profile" : "Set up your profile"}
          </Text>

          <Text className="mt-2 text-center text-gray-600">
            {isEditing
              ? "Update your name and photo."
              : "Choose a name and profile picture for this device."}
          </Text>

          <View className="mt-10 items-center">
            {photoUri ? (
              <Image
                source={{ uri: photoUri }}
                className="h-32 w-32 rounded-full"
                resizeMode="cover"
              />
            ) : (
              <View className="h-32 w-32 items-center justify-center rounded-full bg-gray-100">
                <Text className="text-sm font-semibold text-gray-500">
                  No photo
                </Text>
              </View>
            )}

            <Pressable
              onPress={pickPhoto}
              className="mt-4 rounded-2xl border border-gray-200 bg-white px-5 py-3"
            >
              <Text className="text-sm font-semibold text-gray-900">
                {photoUri ? "Change photo" : "Choose photo"}
              </Text>
            </Pressable>
          </View>

          <View className="mt-10 w-full">
            <Text className="mb-2 text-sm font-semibold text-gray-900">
              Name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter your first name"
              autoCapitalize="words"
              returnKeyType="done"
              submitBehavior="blurAndSubmit"
              className="rounded-2xl border border-gray-200 bg-white px-4 py-4 text-gray-900"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
          </View>

          <Pressable
            onPress={onSave}
            disabled={!canSave}
            className={`mt-10 w-full rounded-2xl py-4 ${
              canSave ? "bg-green-600" : "bg-green-300"
            }`}
          >
            <Text className="text-center text-base font-semibold text-white">
              {saving ? "Saving..." : isEditing ? "Save Changes" : "Continue"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
