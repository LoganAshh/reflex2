import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  Switch,
  ActivityIndicator,
  Image,
} from "react-native";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import * as DocumentPicker from "expo-document-picker";
import * as Notifications from "expo-notifications";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { useData } from "../data/DataContext";
import type { DailyReminderOption } from "../data/types";
import { Screen } from "../components/Screen";

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Temporarily hide App Lock in Settings while Face ID issues are investigated.
// Change this to true to show the existing section again.
const SHOW_APP_LOCK_SETTINGS = false;

type RowProps = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
};

function Row({
  title,
  subtitle,
  right,
  onPress,
  tone = "default",
  disabled,
  icon,
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
        "rounded-[28px] border p-4 shadow-sm",
        danger ? "border-red-200 bg-red-50" : "border-gray-200 bg-white",
        disabled ? "opacity-50" : "",
      ].join(" ")}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row flex-1 items-center pr-4">
          <View
            className={`h-11 w-11 items-center justify-center rounded-2xl border ${
              danger ? "border-red-200 bg-white" : "border-gray-200 bg-white"
            }`}
          >
            <Ionicons
              name={icon}
              size={23}
              color={danger ? "#DC2626" : "#000000"}
            />
          </View>

          <View className="ml-3 flex-1">
            <Text
              className={[
                "text-base font-black",
                danger ? "text-red-700" : "text-black",
              ].join(" ")}
            >
              {title}
            </Text>

            {!!subtitle && (
              <Text
                className={[
                  "mt-1 text-sm leading-5",
                  danger ? "text-red-700/80" : "text-gray-500",
                ].join(" ")}
              >
                {subtitle}
              </Text>
            )}
          </View>
        </View>

        {right ? (
          right
        ) : clickable ? (
          <View className="h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white">
            <Ionicons name="chevron-forward" size={18} color="#000000" />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function SectionTitle({
  title,
  icon,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View className="mb-3 mt-6 flex-row items-center">
      <View className="h-9 w-9 items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm">
        <Ionicons name={icon} size={19} color="#000000" />
      </View>

      <Text className="ml-2 text-xs font-black uppercase tracking-widest text-green-600">
        {title}
      </Text>
    </View>
  );
}

function formatReminderTime(hour: number, minute: number) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getReminderLabel(option: DailyReminderOption) {
  if (option === "morning") return "Morning";
  if (option === "evening") return "Evening";
  if (option === "custom") return "Custom time";
  return "Off";
}

function getReminderIcon(
  option: DailyReminderOption,
): keyof typeof Ionicons.glyphMap {
  if (option === "morning") return "sunny";
  if (option === "evening") return "moon";
  if (option === "custom") return "time";
  return "notifications-off";
}

function getBiometricName(types: LocalAuthentication.AuthenticationType[]) {
  if (
    types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
  ) {
    return "Face ID";
  }

  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return "Touch ID";
  }

  return "biometrics";
}

export default function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const {
    exportData,
    importData,
    resetAll,
    profileName,
    profilePhotoUri,
    clearLocalProfile,
    appLockEnabled,
    setAppLockEnabled,
    dailyReminder,
    setDailyReminder,
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

  const [busy, setBusy] = useState<
    null | "export" | "import" | "reset" | "profile" | "lock" | "reminder"
  >(null);

  async function onImport() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert("Restore failed", "No backup file was selected.");
        return;
      }

      Alert.alert(
        "Restore backup?",
        "This will replace your current Reflex data with the selected backup. Your current local data will be deleted first.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Restore",
            style: "destructive",
            onPress: async () => {
              try {
                setBusy("import");
                await importData(asset.uri);
                await Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
                Alert.alert(
                  "Backup restored",
                  "Your Reflex data was restored. Profile photos are not restored from backup files, so choose a new profile photo if prompted.",
                );
              } catch (e: any) {
                await Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Error,
                );
                Alert.alert(
                  "Restore failed",
                  e?.message ?? "Something went wrong.",
                );
              } finally {
                setBusy(null);
              }
            },
          },
        ],
      );
    } catch (e: any) {
      Alert.alert("Restore failed", e?.message ?? "Something went wrong.");
    }
  }

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

  async function enableAppLock() {
    try {
      setBusy("lock");

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        Alert.alert(
          "App lock unavailable",
          "This device does not support biometric authentication.",
        );
        return;
      }

      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!enrolled) {
        Alert.alert(
          "Set up Face ID first",
          "Turn on Face ID or another biometric unlock method in your device settings before enabling App Lock.",
        );
        return;
      }

      const types =
        await LocalAuthentication.supportedAuthenticationTypesAsync();
      const biometricName = getBiometricName(types);

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Enable ${biometricName} for Reflex`,
        fallbackLabel: "Use Passcode",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });

      if (!result.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      await setAppLockEnabled(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert(
        "Could not enable App Lock",
        e?.message ?? "Something went wrong.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function disableAppLock() {
    try {
      setBusy("lock");
      await setAppLockEnabled(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert(
        "Could not disable App Lock",
        e?.message ?? "Something went wrong.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function ensureNotificationPermission() {
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;

    if (status !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }

    if (status !== "granted") {
      Alert.alert(
        "Notifications are off",
        "Turn on notifications for Reflex in Settings to use daily reminders.",
      );
      return false;
    }

    return true;
  }

  async function saveReminder(
    option: DailyReminderOption,
    hour: number,
    minute: number,
    shouldHaptic = true,
  ) {
    try {
      setBusy("reminder");

      if (option !== "off") {
        const allowed = await ensureNotificationPermission();
        if (!allowed) return;
      }

      await setDailyReminder({ option, hour, minute });

      if (shouldHaptic) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Could not update reminder",
        e?.message ?? "Something went wrong.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function onChooseReminder(option: DailyReminderOption) {
    if (option === "off") {
      await saveReminder("off", dailyReminder.hour, dailyReminder.minute);
      return;
    }

    if (option === "morning") {
      await saveReminder("morning", 9, 0);
      return;
    }

    if (option === "evening") {
      await saveReminder("evening", 20, 0);
      return;
    }

    await saveReminder("custom", dailyReminder.hour, dailyReminder.minute);
  }

  async function onCustomTimeChange(date: Date) {
    await saveReminder("custom", date.getHours(), date.getMinutes(), false);
  }

  async function onToggleAppLock(nextValue: boolean) {
    if (nextValue) {
      await enableAppLock();
    } else {
      await disableAppLock();
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
    <Screen
      scroll
      scrollViewProps={{
        showsVerticalScrollIndicator: false,
        contentContainerStyle: {
          paddingHorizontal: 20,
          paddingTop: 42,
          paddingBottom: 32,
        },
      }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-4">
          <Text className="text-sm font-black uppercase tracking-widest text-green-600">
            Settings
          </Text>

          <Text
            className="mt-1 text-3xl font-black leading-9 text-black"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
          >
            Your Reflex
          </Text>
        </View>

        <View className="h-16 w-16 items-center justify-center rounded-full border-4 border-green-600 bg-white shadow-sm">
          <Ionicons name="settings" size={29} color="#000000" />
        </View>
      </View>

      <View className="mt-6 rounded-[32px] border border-gray-200 bg-gray-50 p-5 shadow-sm">
        <View className="flex-row items-center">
          {profilePhotoUri ? (
            <View className="rounded-full border-4 border-green-600 bg-white">
              <Image
                source={{ uri: profilePhotoUri }}
                className="h-16 w-16 rounded-full"
                resizeMode="cover"
              />
            </View>
          ) : (
            <View className="h-16 w-16 items-center justify-center rounded-full border-4 border-green-600 bg-white">
              <Ionicons name="person" size={28} color="#000000" />
            </View>
          )}

          <View className="ml-4 flex-1">
            <Text
              className="text-xl font-black leading-6 text-black"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
            >
              {profileName || "No username"}
            </Text>

            <Text className="mt-1 text-sm font-semibold text-gray-500">
              Stored locally on this device
            </Text>
          </View>
        </View>
      </View>

      <SectionTitle title="Tracking" icon="list" />

      <Row
        title="Manage habits"
        subtitle="Add habits and update their current and goal amounts."
        onPress={() => navigation.navigate("ManageList", { type: "habits" })}
        icon="create"
      />

      <SectionTitle title="Reminders" icon="notifications" />

      <View className="rounded-[32px] border border-gray-200 bg-gray-50 p-5 shadow-sm">
        <View className="flex-row items-start justify-between">
          <View className="flex-row flex-1 items-start pr-4">
            <View className="h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white">
              <Ionicons name="alarm" size={24} color="#000000" />
            </View>

            <View className="ml-3 flex-1">
              <Text className="text-base font-black text-black">
                Daily reflection reminder
              </Text>

              <Text className="mt-2 text-sm font-black text-green-600">
                {dailyReminder.option === "off"
                  ? "Currently off"
                  : `${getReminderLabel(dailyReminder.option)} · ${formatReminderTime(
                      dailyReminder.hour,
                      dailyReminder.minute,
                    )}`}
              </Text>

              <Text className="mt-1 text-sm leading-5 text-gray-500">
                Get a gentle nudge to check in and reflect.
              </Text>
            </View>
          </View>

          {busy === "reminder" ? <ActivityIndicator /> : null}
        </View>

        <View className="mt-5 flex-row flex-wrap gap-2">
          {(
            ["off", "morning", "evening", "custom"] as DailyReminderOption[]
          ).map((option) => {
            const selected = dailyReminder.option === option;

            return (
              <Pressable
                key={option}
                onPress={() => onChooseReminder(option)}
                disabled={!!busy}
                className={[
                  "flex-row items-center rounded-full border px-4 py-2.5",
                  selected
                    ? "border-green-600 bg-green-600"
                    : "border-gray-200 bg-white",
                  busy ? "opacity-50" : "",
                ].join(" ")}
              >
                <Ionicons
                  name={getReminderIcon(option)}
                  size={16}
                  color={selected ? "#FFFFFF" : "#000000"}
                />

                <Text
                  className={[
                    "ml-1.5 text-sm font-black",
                    selected ? "text-white" : "text-black",
                  ].join(" ")}
                >
                  {getReminderLabel(option)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {dailyReminder.option === "custom" && (
          <View className="mt-5 rounded-[28px] border border-gray-200 bg-white p-2">
            <DateTimePicker
              value={
                new Date(2000, 0, 1, dailyReminder.hour, dailyReminder.minute)
              }
              mode="time"
              display="spinner"
              onChange={(_, selectedDate) => {
                if (!selectedDate) return;
                onCustomTimeChange(selectedDate);
              }}
            />
          </View>
        )}
      </View>

      {SHOW_APP_LOCK_SETTINGS && (
        <>
          <SectionTitle title="Security" icon="shield-checkmark" />

          <Row
            title="App Lock"
            subtitle={
              appLockEnabled
                ? "Require Face ID or your device passcode when opening Reflex."
                : "Protect your local Reflex data with Face ID or your device passcode."
            }
            disabled={busy === "lock"}
            icon="lock-closed"
            right={
              busy === "lock" ? (
                <ActivityIndicator />
              ) : (
                <Switch
                  value={appLockEnabled}
                  onValueChange={onToggleAppLock}
                  disabled={!!busy}
                  trackColor={{ false: "#E5E7EB", true: "#86EFAC" }}
                  thumbColor={appLockEnabled ? "#16A34A" : "#F9FAFB"}
                />
              )
            }
          />
        </>
      )}

      <SectionTitle title="Profile" icon="person-circle" />

      <View className="gap-3">
        <Row
          title="Edit profile"
          subtitle="Change your local username and profile picture."
          onPress={busy ? undefined : () => navigation.navigate("ProfileSetup")}
          disabled={!!busy}
          icon="create"
        />

        <Row
          title="Clear local profile"
          subtitle="Remove your saved username and photo from this device."
          tone="danger"
          onPress={busy ? undefined : onClearProfile}
          disabled={!!busy}
          icon="trash"
          right={
            busy === "profile" ? (
              <ActivityIndicator />
            ) : (
              <Text className="font-black text-red-700">Clear</Text>
            )
          }
        />
      </View>

      <SectionTitle title="Data" icon="folder" />

      <View className="gap-3">
        <Row
          title="Export data"
          subtitle="Exporting creates a file you control and can store or share."
          onPress={busy ? undefined : onExport}
          disabled={!!busy}
          icon="share"
          right={
            busy === "export" ? (
              <ActivityIndicator />
            ) : (
              <View className="rounded-full border border-gray-200 bg-white px-3 py-1.5">
                <Text className="font-black text-black">Share</Text>
              </View>
            )
          }
        />

        <Row
          title="Restore from backup"
          subtitle="Import a Reflex JSON backup and replace the current local data."
          onPress={busy ? undefined : onImport}
          disabled={!!busy}
          icon="cloud-upload"
          right={
            busy === "import" ? (
              <ActivityIndicator />
            ) : (
              <View className="rounded-full border border-gray-200 bg-white px-3 py-1.5">
                <Text className="font-black text-black">Import</Text>
              </View>
            )
          }
        />

        <Row
          title="Reset all data"
          subtitle="Permanently delete everything stored on this device."
          tone="danger"
          onPress={busy ? undefined : onReset}
          disabled={!!busy}
          icon="warning"
          right={
            busy === "reset" ? (
              <ActivityIndicator />
            ) : (
              <Text className="font-black text-red-700">Reset</Text>
            )
          }
        />
      </View>

      <SectionTitle title="About" icon="information-circle" />

      <View className="gap-3">
        <Row
          title="Version"
          subtitle={version}
          disabled
          icon="phone-portrait"
          right={
            <View className="rounded-full border border-gray-200 bg-white px-3 py-1.5">
              <Text className="font-black text-black">{version}</Text>
            </View>
          }
        />

        <View className="rounded-[28px] border border-gray-200 bg-gray-50 p-5 shadow-sm">
          <View className="flex-row items-center">
            <View className="h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white">
              <Ionicons name="leaf" size={23} color="#000000" />
            </View>

            <View className="ml-3 flex-1">
              <Text className="text-base font-black text-black">
                Your personal data is private
              </Text>

              <Text className="mt-1 text-sm leading-5 text-gray-500">
                Your tracking data and profile stay on this device unless you
                choose to export them.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Screen>
  );
}
