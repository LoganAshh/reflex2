import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  Switch,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import { useData } from "../data/DataContext";
import { useAuth } from "../data/AuthContext";

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
  const { exportData, resetAll } = useData() as {
    exportData?: () => Promise<void>;
    resetAll?: () => Promise<void>;
  };

  const { user, signOut } = useAuth() as {
    user: any;
    signOut: () => Promise<void>;
  };

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

  const [busy, setBusy] = useState<null | "export" | "reset" | "logout">(null);
  const [appLockEnabled, setAppLockEnabled] = useState(false);

  const canExport = typeof exportData === "function";
  const canReset = typeof resetAll === "function";

  async function onExport() {
    if (!canExport) {
      Alert.alert(
        "Export not available",
        "exportData() is not implemented in DataContext yet."
      );
      return;
    }

    try {
      setBusy("export");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await exportData!();
    } catch (e: any) {
      Alert.alert("Export failed", e?.message ?? "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  function onReset() {
    if (!canReset) {
      Alert.alert(
        "Reset not available",
        "resetAll() is not implemented in DataContext yet."
      );
      return;
    }

    Alert.alert(
      "Reset all data?",
      "This will permanently delete your logs, selections, and saved actions on this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              setBusy("reset");
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Warning
              );
              await resetAll!();
              Alert.alert("Done", "All data has been reset.");
            } catch (e: any) {
              Alert.alert(
                "Reset failed",
                e?.message ?? "Something went wrong."
              );
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  }

  function onLogout() {
    Alert.alert(
      "Log out?",
      "Before logging out, export your data. Your logs are stored on this device, and you can lose them if you uninstall the app or switch phones.\n\nDo you want to export now?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Export first",
          onPress: () => {
            Haptics.selectionAsync();
            onExport();
          },
        },
        {
          text: "Log out",
          style: "destructive",
          onPress: async () => {
            try {
              setBusy("logout");
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Warning
              );
              await signOut();
            } catch (e: any) {
              Alert.alert(
                "Logout failed",
                e?.message ?? "Something went wrong."
              );
            } finally {
              setBusy(null);
            }
          },
        },
      ]
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
          Manage your data and app settings.
        </Text>
      </View>

      <View className="gap-3">
        <Text className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
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
          Account
        </Text>

        <Row
          title="Log out"
          subtitle={
            user?.email
              ? `Signed in as ${user.email}. Export your data before logging out.`
              : "Export your data before logging out."
          }
          tone="danger"
          onPress={busy ? undefined : onLogout}
          disabled={!!busy}
          right={
            busy === "logout" ? (
              <ActivityIndicator />
            ) : (
              <Text className="text-red-700">Log out</Text>
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
            Your data stays on your device unless you export it.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
