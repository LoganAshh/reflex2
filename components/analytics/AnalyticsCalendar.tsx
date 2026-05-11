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

const GREEN_SCALE = [
  "bg-green-600",
  "bg-green-500",
  "bg-green-400",
  "bg-green-300",
  "bg-green-200",
  "bg-green-100",
  "bg-green-50",
] as const;

function greenBgForCount(count: number) {
  const idx = Math.min(Math.max(count, 0), GREEN_SCALE.length - 1);
  return GREEN_SCALE[idx];
}

function textColorForCount(count: number) {
  return count <= 3 ? "text-white" : "text-gray-400";
}

export function AnalyticsCalendar({
  monthLabel,
  weeks,
  onPreviousMonth,
  onNextMonth,
  onOpenDay,
}: {
  monthLabel: string;
  weeks: CalendarCell[][];
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onOpenDay: (dayStartMs: number) => void;
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
              const bg = c.isInactive
                ? "bg-white"
                : greenBgForCount(countValue);
              const baseBorder = c.isInactive
                ? "border border-gray-200"
                : "border border-transparent";
              const todayBorder =
                c.isToday && !c.isInactive ? "border-2 border-gray-900" : "";
              const textColor = c.isInactive
                ? "text-gray-400"
                : textColorForCount(countValue);
              const badgeTextColor =
                countValue <= 3 ? "text-white" : "text-gray-400";
              const badgeBg = countValue <= 3 ? "bg-white/25" : "bg-black/10";

              const tile = (
                <View
                  className={[
                    "aspect-square items-center justify-center overflow-hidden rounded-xl",
                    bg,
                    baseBorder,
                    todayBorder,
                  ].join(" ")}
                >
                  <Text className={`text-xs font-semibold ${textColor}`}>
                    {c.label}
                  </Text>

                  {!c.isInactive ? (
                    <View
                      className={[
                        "mt-1 rounded-full px-2 py-0.5",
                        badgeBg,
                      ].join(" ")}
                    >
                      <Text
                        className={[
                          "text-[10px] font-semibold",
                          badgeTextColor,
                        ].join(" ")}
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

      <Text className="mt-3 text-xs text-gray-500">
        Tap a day to view your log history for that date.
      </Text>
    </View>
  );
}
