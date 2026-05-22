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

function hexToRgb(hex: string) {
  const clean = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex.slice(1) : "16A34A";
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function colorForCount(count: number, accentColor: string) {
  if (count <= 0) return "#F9FAFB";

  const opacity = Math.max(0.16, 1 - Math.min(count, 6) * 0.12);
  const { r, g, b } = hexToRgb(accentColor);

  const mixedR = Math.round(r * opacity + 255 * (1 - opacity));
  const mixedG = Math.round(g * opacity + 255 * (1 - opacity));
  const mixedB = Math.round(b * opacity + 255 * (1 - opacity));

  return `rgb(${mixedR}, ${mixedG}, ${mixedB})`;
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
    <View className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
      <View className="flex-row items-center">
        <Pressable
          onPress={onPreviousMonth}
          className="h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white"
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
          className="h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white"
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
              const bgColor = c.isInactive
                ? "#FFFFFF"
                : colorForCount(countValue, accentColor);
              const borderColor = c.isInactive
                ? "#E5E7EB"
                : c.isToday
                  ? "#111827"
                  : "transparent";
              const borderWidth = c.isToday && !c.isInactive ? 2 : 1;
              const textColor = c.isInactive
                ? "#9CA3AF"
                : countValue === 0
                  ? "#9CA3AF"
                  : textColorForCount(countValue);
              const badgeTextColor = countValue <= 3 ? "#FFFFFF" : "#9CA3AF";
              const badgeBg =
                countValue <= 3 ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.1)";

              const tile = (
                <View
                  className="aspect-square items-center justify-center overflow-hidden rounded-xl"
                  style={{
                    backgroundColor: bgColor,
                    borderColor,
                    borderWidth,
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
                      style={{ backgroundColor: badgeBg }}
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
