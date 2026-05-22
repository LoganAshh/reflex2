import React from "react";
import { Pressable, Text, View } from "react-native";

export type CalendarCell = {
  key: string;
  label: string;
  count: number | null;
  isToday: boolean;
  dayStartMs: number | null;
  isInactive: boolean;
};

const CALENDAR_BORDER = "#E5E7EB";

function hexToRgba(hex: string, alpha: number) {
  const cleanHex = hex.replace("#", "");

  if (cleanHex.length !== 6) {
    return `rgba(22, 163, 74, ${alpha})`;
  }

  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function backgroundForCount(count: number, accentColor: string) {
  const alphaScale = [1, 0.86, 0.72, 0.56, 0.36, 0.22, 0.12];
  const idx = Math.min(Math.max(count, 0), alphaScale.length - 1);
  return hexToRgba(accentColor, alphaScale[idx]);
}

function textColorForCount(count: number) {
  return count <= 3 ? "#FFFFFF" : "#6B7280";
}

export function AnalyticsCalendar({
  monthLabel,
  weeks,
  onPreviousMonth,
  onNextMonth,
  onOpenDay,
  accentColor = "#16A34A",
}: {
  monthLabel: string;
  weeks: CalendarCell[][];
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onOpenDay: (dayStartMs: number) => void;
  accentColor?: string;
}) {
  return (
    <View
      className="mt-5 rounded-2xl bg-white p-4"
      style={{ borderWidth: 1, borderColor: CALENDAR_BORDER }}
    >
      <View className="flex-row items-center">
        <Pressable
          onPress={onPreviousMonth}
          className="h-10 w-10 items-center justify-center rounded-full bg-white"
          style={{ borderWidth: 1, borderColor: CALENDAR_BORDER }}
          hitSlop={10}
        >
          <Text className="text-lg font-bold text-gray-900">‹</Text>
        </Pressable>

        <View className="flex-1 items-center">
          <Text className="text-base font-semibold text-gray-900">
            {monthLabel}
          </Text>
        </View>

        <Pressable
          onPress={onNextMonth}
          className="h-10 w-10 items-center justify-center rounded-full bg-white"
          style={{ borderWidth: 1, borderColor: CALENDAR_BORDER }}
          hitSlop={10}
        >
          <Text className="text-lg font-bold text-gray-900">›</Text>
        </Pressable>
      </View>

      <View className="mt-4 flex-row">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <View key={`${d}-${i}`} className="flex-1 items-center">
            <Text className="text-xs font-semibold text-gray-500">{d}</Text>
          </View>
        ))}
      </View>

      <View className="mt-2">
        {weeks.map((week, wi) => (
          <View key={`week-${wi}`} className="flex-row">
            {week.map((c) => {
              const isBlank = c.count === null;

              if (isBlank) {
                return (
                  <View key={c.key} className="flex-1 p-1">
                    <View className="aspect-square rounded-xl" />
                  </View>
                );
              }

              const countValue = c.count ?? 0;
              const backgroundColor = c.isInactive
                ? "#FFFFFF"
                : backgroundForCount(countValue, accentColor);
              const borderWidth = c.isToday && !c.isInactive ? 0 : 1;
              const borderColor = CALENDAR_BORDER;
              const textColor = c.isInactive
                ? "#9CA3AF"
                : textColorForCount(countValue);
              const badgeBackgroundColor =
                countValue <= 3
                  ? "rgba(255, 255, 255, 0.25)"
                  : "rgba(0, 0, 0, 0.08)";
              const badgeTextColor = countValue <= 3 ? "#FFFFFF" : "#6B7280";

              const tile = (
                <View
                  className="aspect-square items-center justify-center overflow-hidden rounded-xl"
                  style={{
                    backgroundColor,
                    borderWidth,
                    borderColor,
                  }}
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: textColor }}
                  >
                    {c.label}
                  </Text>

                  {!c.isInactive ? (
                    <View
                      className="mt-1 rounded-full px-2 py-0.5"
                      style={{ backgroundColor: badgeBackgroundColor }}
                    >
                      <Text
                        className="text-[10px] font-semibold"
                        style={{ color: badgeTextColor }}
                      >
                        {countValue}
                      </Text>
                    </View>
                  ) : (
                    <Text className="mt-1 text-[10px] text-transparent">0</Text>
                  )}
                </View>
              );

              return (
                <View key={c.key} className="flex-1 p-1">
                  {c.isInactive || c.dayStartMs == null ? (
                    tile
                  ) : (
                    <Pressable
                      onPress={() => onOpenDay(c.dayStartMs!)}
                      hitSlop={6}
                    >
                      {tile}
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
