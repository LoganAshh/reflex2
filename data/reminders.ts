import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { DailyReminderSettings } from "./types";
import {
  loadDailyReminderNotificationId,
  saveDailyReminderNotificationId,
} from "./profileStorage";

export const DEFAULT_DAILY_REMINDER: DailyReminderSettings = {
  option: "off",
  hour: 20,
  minute: 0,
};

export async function cancelDailyReminderNotification(): Promise<void> {
  const notificationId = await loadDailyReminderNotificationId();

  if (notificationId) {
    await Notifications.cancelScheduledNotificationAsync(notificationId).catch(
      () => {},
    );
  }

  await saveDailyReminderNotificationId("");
}

export async function scheduleDailyReminderNotification(
  settings: DailyReminderSettings,
): Promise<void> {
  await cancelDailyReminderNotification();

  if (settings.option === "off") return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("daily-reflection", {
      name: "Daily reflection",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Check in with Reflex?",
      body: "Take a minute to reflect on your urges and wins today.",
      sound: false,
    },
    trigger: {
      hour: settings.hour,
      minute: settings.minute,
      repeats: true,
      channelId: "daily-reflection",
    } as any,
  });

  await saveDailyReminderNotificationId(notificationId);
}
