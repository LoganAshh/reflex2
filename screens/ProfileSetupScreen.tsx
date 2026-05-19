import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  Image,
  ScrollView,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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

  const scrollViewRef = useRef<ScrollView | null>(null);

  const [name, setName] = useState(profileName);
  const [photoUri, setPhotoUri] = useState<string | null>(profilePhotoUri);
  const [saving, setSaving] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);

  const isEditing = hasCompletedLocalProfile;

  const canSave = useMemo(
    () => name.trim().length > 0 && !!photoUri && !saving,
    [name, photoUri, saving],
  );

  const scrollNameInputIntoView = () => {
    setNameFocused(true);

    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: 150,
        animated: true,
      });
    }, 250);
  };

  const stopNameInputScroll = () => {
    setNameFocused(false);
  };

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
    <View className="flex-1 bg-white">
      <ScrollView
        ref={scrollViewRef}
        className="flex-1 bg-white"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        scrollEnabled={nameFocused}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: 20,
          paddingTop: 42,
          paddingBottom: nameFocused ? 110 : 32,
        }}
      >
        <View>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-sm font-black uppercase tracking-widest text-green-600">
                Profile
              </Text>

              <Text className="mt-1 text-3xl font-black text-black">
                {isEditing ? "Edit profile" : "Set up profile"}
              </Text>
            </View>

            <View className="h-16 w-16 items-center justify-center rounded-full border-4 border-green-600 bg-white shadow-sm">
              <Ionicons name="person" size={29} color="#000000" />
            </View>
          </View>

          <View className="mt-6 rounded-[32px] border border-gray-200 bg-gray-50 p-5 shadow-sm">
            <View className="items-center">
              <View className="rounded-full border-4 border-green-600 bg-white p-1 shadow-sm">
                {photoUri ? (
                  <Image
                    source={{ uri: photoUri }}
                    className="h-32 w-32 rounded-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="h-32 w-32 items-center justify-center rounded-full bg-white">
                    <Ionicons name="camera" size={42} color="#000000" />
                  </View>
                )}
              </View>

              <Pressable
                onPress={pickPhoto}
                className="mt-5 flex-row items-center rounded-3xl border border-gray-200 bg-white px-5 py-3 shadow-sm"
                style={({ pressed }) => ({
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: pressed ? 1 : 4 },
                  shadowOpacity: 0.12,
                  shadowRadius: pressed ? 2 : 4,
                  elevation: pressed ? 2 : 5,
                  transform: [{ translateY: pressed ? 1 : 0 }],
                })}
              >
                <Ionicons
                  name={photoUri ? "camera-reverse" : "camera"}
                  size={18}
                  color="#000000"
                />

                <Text className="ml-2 text-sm font-black text-black">
                  {photoUri ? "Change photo" : "Choose photo"}
                </Text>
              </Pressable>
            </View>
          </View>

          <View className="mt-5 rounded-[32px] border border-gray-200 bg-gray-50 p-5 shadow-sm">
            <View className="flex-row items-center">
              <View className="h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white">
                <Ionicons name="id-card" size={24} color="#000000" />
              </View>

              <View className="ml-3 flex-1">
                <Text className="text-base font-black text-black">
                  Display name
                </Text>

                <Text className="mt-1 text-sm leading-5 text-gray-500">
                  {isEditing
                    ? "Update the name shown around the app."
                    : "Choose the name you want Reflex to use on this device."}
                </Text>
              </View>
            </View>

            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter your first name"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
              returnKeyType="done"
              submitBehavior="blurAndSubmit"
              className="mt-5 rounded-2xl border border-gray-200 bg-white px-4 py-4 text-black"
              onFocus={scrollNameInputIntoView}
              onBlur={stopNameInputScroll}
              onSubmitEditing={() => Keyboard.dismiss()}
            />
          </View>

          <View className="mt-5 rounded-[28px] border border-gray-200 bg-gray-50 p-4 shadow-sm">
            <View className="flex-row items-center">
              <View className="h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white">
                <Ionicons name="lock-closed" size={22} color="#000000" />
              </View>

              <View className="ml-3 flex-1">
                <Text className="text-base font-black text-black">
                  Local profile
                </Text>

                <Text className="mt-1 text-sm leading-5 text-gray-500">
                  Your name and photo are saved locally on this device.
                </Text>
              </View>
            </View>
          </View>

          <Pressable
            onPress={onSave}
            disabled={!canSave}
            className={`mt-6 w-full rounded-3xl px-5 py-4 shadow-sm ${
              canSave ? "bg-green-600" : "bg-gray-300"
            }`}
            style={({ pressed }) => ({
              shadowColor: canSave ? "#000" : "transparent",
              shadowOffset: { width: 0, height: pressed ? 2 : 6 },
              shadowOpacity: canSave ? 0.25 : 0,
              shadowRadius: pressed ? 3 : 6,
              elevation: canSave ? (pressed ? 3 : 8) : 0,
              transform: [{ translateY: canSave && pressed ? 2 : 0 }],
            })}
          >
            <View className="flex-row items-center justify-center">
              <Ionicons
                name={isEditing ? "checkmark-circle" : "arrow-forward-circle"}
                size={22}
                color="#FFFFFF"
              />

              <Text className="ml-2 text-center text-lg font-black text-white">
                {saving ? "Saving..." : isEditing ? "Save Changes" : "Continue"}
              </Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
