import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  Switch,
  ScrollView,
  ActivityIndicator,
  Image,
} from "react-native";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { useData } from "../data/DataContext";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type RowProps = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
};

function Row({
  title,
  subtitle,
  right,
  onPress,
  tone = "default",
  disabled,
}: RowProps) {
  const danger = tone === "danger";
  const clickable = !!onPress && !disabled;

  return (
    <Pressable
      onPress={() => {
        if (!clickable) return;
        Haptics.selectionAsync();
        onPress?.();
      }}
      disabled={!clickable}
      className={[
        "rounded-2xl border px-4 py-4",
        danger ? "border-red-300 bg-red-50" : "border-zinc-200 bg-white",
        disabled ? "opacity-50" : "",
      ].join(" ")}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-4">
          <Text
            className={[
              "text-base font-semibold",
              danger ? "text-red-700" : "text-zinc-900",
            ].join(" ")}
          >
            {title}
          </Text>
          {!!subtitle && (
            <Text
              className={[
                "mt-1 text-sm",
                danger ? "text-red-700/80" : "text-zinc-600",
              ].join(" ")}
            >
              {subtitle}
            </Text>
          )}
        </View>
        {right ? (
          right
        ) : clickable ? (
          <Text className="text-zinc-400">›</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const {
    exportData,
    resetAll,
    profileName,
    profilePhotoUri,
    clearLocalProfile,
  } = useData();

  const version = useMemo(() => {
    const v =
      (Constants.expoConfig as any)?.version ??
      (Constants.manifest as any)?.version ??
      "—";
    const build =
      (Constants.expoConfig as any)?.ios?.buildNumber ??
      (Constants.expoConfig as any)?.android?.versionCode ??
      (Constants.manifest as any)?.ios?.buildNumber ??
      (Constants.manifest as any)?.android?.versionCode ??
      null;

    return build ? `${v} (${build})` : `${v}`;
  }, []);

  const [busy, setBusy] = useState<null | "export" | "reset" | "profile">(null);
  const [appLockEnabled, setAppLockEnabled] = useState(false);

  async function onExport() {
    try {
      setBusy("export");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await exportData();
    } catch (e: any) {
      Alert.alert("Export failed", e?.message ?? "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  function onReset() {
    Alert.alert(
      "Reset all data?",
      "This will permanently delete your logs, profile, selections, custom items, and saved actions on this device. You will go back to onboarding.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              setBusy("reset");
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Warning,
              );
              await resetAll();
              Alert.alert("Done", "All local app data has been reset.");
            } catch (e: any) {
              Alert.alert(
                "Reset failed",
                e?.message ?? "Something went wrong.",
              );
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }

  function onClearProfile() {
    Alert.alert(
      "Clear local profile?",
      "This will remove your saved username and profile photo on this device. You will be asked to set them again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              setBusy("profile");
              await clearLocalProfile();
            } catch (e: any) {
              Alert.alert(
                "Could not clear profile",
                e?.message ?? "Something went wrong.",
              );
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-zinc-50"
      contentContainerClassName="p-4 pb-10"
    >
      <View className="mb-4">
        <Text className="text-2xl font-bold text-zinc-900">Profile</Text>
        <Text className="mt-1 text-sm text-zinc-600">
          Manage your local profile and app data.
        </Text>
      </View>

      <View className="mb-6 rounded-2xl border border-zinc-200 bg-white p-4">
        <View className="flex-row items-center">
          {profilePhotoUri ? (
            <Image
              source={{ uri: profilePhotoUri }}
              className="h-16 w-16 rounded-full"
              resizeMode="cover"
            />
          ) : (
            <View className="h-16 w-16 items-center justify-center rounded-full bg-zinc-100">
              <Text className="text-xs font-semibold text-zinc-500">
                No photo
              </Text>
            </View>
          )}

          <View className="ml-4 flex-1">
            <Text className="text-lg font-bold text-zinc-900">
              {profileName || "No username"}
            </Text>
            <Text className="mt-1 text-sm text-zinc-600">
              Stored locally on this device
            </Text>
          </View>
        </View>
      </View>

      <View className="gap-3">
        <Text className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Profile
        </Text>

        <Row
          title="Edit profile"
          subtitle="Change your local username and profile picture."
          onPress={busy ? undefined : () => navigation.navigate("ProfileSetup")}
          disabled={!!busy}
        />

        <Row
          title="Clear local profile"
          subtitle="Remove your saved username and photo from this device."
          tone="danger"
          onPress={busy ? undefined : onClearProfile}
          disabled={!!busy}
          right={
            busy === "profile" ? (
              <ActivityIndicator />
            ) : (
              <Text className="text-red-700">Clear</Text>
            )
          }
        />

        <Text className="mt-6 mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Data
        </Text>

        <Row
          title="Export data (JSON)"
          subtitle="Share a backup file of your logs and saved actions."
          onPress={busy ? undefined : onExport}
          disabled={!!busy}
          right={
            busy === "export" ? (
              <ActivityIndicator />
            ) : (
              <Text className="text-zinc-400">Share</Text>
            )
          }
        />

        <Row
          title="Reset all data"
          subtitle="Permanently delete everything stored on this device."
          tone="danger"
          onPress={busy ? undefined : onReset}
          disabled={!!busy}
          right={
            busy === "reset" ? (
              <ActivityIndicator />
            ) : (
              <Text className="text-red-700">Reset</Text>
            )
          }
        />

        <Text className="mt-6 mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Security
        </Text>

        <Row
          title="App lock"
          subtitle="Coming soon."
          disabled
          right={
            <Switch
              value={appLockEnabled}
              onValueChange={setAppLockEnabled}
              disabled
            />
          }
        />

        <Text className="mt-6 mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          About
        </Text>

        <Row
          title="Version"
          subtitle={version}
          disabled
          right={<Text className="text-zinc-400">{version}</Text>}
        />

        <View className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4">
          <Text className="text-sm font-semibold text-zinc-900">Privacy</Text>
          <Text className="mt-1 text-sm text-zinc-600">
            Reflex is local-first. Your tracking data and profile stay on this
            device unless you export them.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
