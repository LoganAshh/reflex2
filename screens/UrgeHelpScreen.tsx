import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { useData, type ReplacementAction } from "../data/DataContext";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type HelpRoute = RouteProp<RootStackParamList, "UrgeHelp">;

type Step =
  | {
      kind: "decision";
      title: string;
      body: string;
    }
  | {
      kind: "info";
      title: string;
      body: string;
      tip?: string;
    }
  | {
      kind: "action";
      title: string;
      body: string;
      tip?: string;
    }
  | {
      kind: "done";
      title: string;
      body: string;
    };

const helpSteps: Step[] = [
  {
    kind: "info",
    title: "Catch it fast",
    body: "The moment you notice the urge, say to yourself: “This is an urge, not a command.”",
  },
  {
    kind: "info",
    title: "Pause for 60 seconds",
    body: "Do not immediately act. Buy a little space first.",
  },
  {
    kind: "info",
    title: "Change your environment",
    body: "Put distance between yourself and the habit.",
    tip: "Stand up, leave the room, put your phone away, move the object out of reach, or go where other people are.",
  },
  {
    kind: "info",
    title: "Take 10 slow breaths",
    body: "In through your nose, out slowly.",
    tip: "The goal is to lower the intensity, not make it vanish instantly.",
  },
  {
    kind: "info",
    title: "Delay the habit",
    body: "Tell yourself: “I can do it later, but not for the next 10 minutes.”",
    tip: "Urges usually rise and fall like a wave.",
  },
  {
    kind: "info",
    title: "Name what triggered it",
    body: "Ask yourself what happened right before this.",
    tip: "Am I stressed, bored, lonely, tired, or anxious? What am I actually wanting right now?",
  },
  {
    kind: "action",
    title: "Do a replacement action immediately",
    body: "Pick one action that is easy and short.",
    tip: "Choose one of your selected replacement actions below.",
  },
  {
    kind: "info",
    title: "Make the bad habit harder",
    body: "Add friction before you act.",
    tip: "Log out, block the app or site, put it in another room, give the item to someone else, or turn off Wi-Fi or data for a bit.",
  },
  {
    kind: "info",
    title: "Wait for the urge to pass",
    body: "Don’t fight it dramatically. Just observe it.",
    tip: "Think: “This will peak, then drop.”",
  },
];

export default function UrgeHelpScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<HelpRoute>();
  const { logId } = route.params;

  const { actions, selectedActionIds, updateLogSelectedAction, logs } =
    useData();

  const [mode, setMode] = useState<"decision" | "guided">("decision");
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedActionId, setSelectedActionId] = useState<number | null>(null);
  const [savingAction, setSavingAction] = useState(false);

  const selectedActions = useMemo(() => {
    if (selectedActionIds.length === 0) return [];
    const byId = new Map(actions.map((a) => [a.id, a] as const));
    return selectedActionIds
      .map((id) => byId.get(id))
      .filter(Boolean) as ReplacementAction[];
  }, [actions, selectedActionIds]);

  const currentLog = useMemo(
    () => logs.find((l) => l.id === logId) ?? null,
    [logs, logId],
  );

  const currentStep: Step = useMemo(() => {
    if (mode === "decision") {
      return {
        kind: "decision",
        title: "Nice job logging",
        body: "You paused and checked in instead of staying on autopilot. What do you want to do next?",
      };
    }

    const doneStep: Step = {
      kind: "done",
      title: "You made space",
      body: "The goal was not to feel perfect. The goal was to slow down, create distance, and give yourself a better next move.",
    };

    if (stepIndex < helpSteps.length) {
      return helpSteps[stepIndex];
    }

    return doneStep;
  }, [mode, stepIndex]);

  const totalSteps = helpSteps.length + 1;
  const currentStepNumber = stepIndex + 1;
  const canGoBack = mode === "guided" && currentStepNumber > 1;

  const onChooseAction = async (actionId: number | null) => {
    try {
      setSavingAction(true);
      await updateLogSelectedAction(logId, actionId);
      setSelectedActionId(actionId);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setSavingAction(false);
    }
  };

  const goBackToLog = () => {
    navigation.goBack();
  };

  const onPrimary = async () => {
    if (currentStep.kind === "action") {
      setStepIndex((v) => v + 1);
      return;
    }

    if (currentStep.kind === "done") {
      goBackToLog();
      return;
    }

    setStepIndex((v) => v + 1);
  };

  const onBack = () => {
    if (!canGoBack) return;
    setStepIndex((v) => Math.max(0, v - 1));
  };

  const progressPct = (currentStepNumber / totalSteps) * 100;

  const renderActionPicker = () => {
    if (currentStep.kind !== "action") return null;

    return (
      <View className="mt-6 w-full rounded-2xl border border-gray-200 bg-white p-4">
        <Text className="text-sm font-semibold text-gray-900">
          Selected replacement actions
        </Text>

        {selectedActions.length === 0 ? (
          <Text className="mt-3 text-sm text-gray-600">
            You do not have any selected replacement actions yet. You can still
            continue, or add some later in Shop.
          </Text>
        ) : (
          <View className="mt-3 flex-row flex-wrap gap-2">
            <Pressable
              onPress={() => onChooseAction(null)}
              disabled={savingAction}
              className={`rounded-full border px-4 py-2 ${
                selectedActionId == null
                  ? "border-green-600 bg-green-600"
                  : "border-gray-200 bg-white"
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  selectedActionId == null ? "text-white" : "text-gray-900"
                }`}
              >
                None
              </Text>
            </Pressable>

            {selectedActions.map((action) => {
              const isSelected = selectedActionId === action.id;
              return (
                <Pressable
                  key={action.id}
                  onPress={() => onChooseAction(action.id)}
                  disabled={savingAction}
                  className={`rounded-full border px-4 py-2 ${
                    isSelected
                      ? "border-green-600 bg-green-600"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      isSelected ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {action.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <View className="mt-4 rounded-xl bg-gray-50 p-3">
          <Text className="text-xs font-semibold text-gray-500">
            Saved to this log
          </Text>
          <Text className="mt-1 text-sm font-semibold text-gray-900">
            {currentLog?.selectedActionTitle ??
              "No replacement action selected"}
          </Text>
        </View>
      </View>
    );
  };

  const primaryLabel =
    currentStep.kind === "done"
      ? "Back to Log"
      : currentStep.kind === "action"
        ? "Continue"
        : "Next";

  const isFirstGuidedStep = mode === "guided" && currentStepNumber === 1;

  return (
    <View className="flex-1 bg-white px-6 pt-12">
      {mode === "guided" ? (
        <View className="mt-2">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-gray-700">
              Step {currentStepNumber} of {totalSteps}
            </Text>
            <Text className="text-sm font-semibold text-gray-700">
              Guided help
            </Text>
          </View>

          <View className="h-4 w-full overflow-hidden rounded-full bg-gray-200">
            <View
              style={{ width: `${progressPct}%` }}
              className="h-4 rounded-full bg-green-600"
            />
          </View>
        </View>
      ) : null}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center px-2">
          <Ionicons
            name={
              currentStep.kind === "decision"
                ? "checkmark-circle"
                : currentStep.kind === "action"
                  ? "flash"
                  : currentStep.kind === "done"
                    ? "shield-checkmark"
                    : "leaf"
            }
            size={64}
            color="#16A34A"
            style={{ marginBottom: 20 }}
          />

          <Text className="text-center text-4xl font-bold text-gray-900">
            {currentStep.title}
          </Text>

          <Text className="mt-5 text-center text-lg leading-7 text-gray-700">
            {currentStep.body}
          </Text>

          {"tip" in currentStep && currentStep.tip ? (
            <View className="mt-6 w-full rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <Text className="text-sm leading-6 text-gray-700">
                {currentStep.tip}
              </Text>
            </View>
          ) : null}

          {renderActionPicker()}
        </View>
      </ScrollView>

      {mode === "decision" ? (
        <View className="mb-10 pb-8 pt-4">
          <Pressable
            onPress={() => {
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              goBackToLog();
            }}
            className="w-full rounded-2xl bg-green-600 px-5 py-4"
          >
            <Text className="text-center text-lg font-bold text-white">
              Complete Log
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setMode("guided");
              setStepIndex(0);
            }}
            className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-5 py-4"
          >
            <Text className="text-center text-lg font-bold text-gray-900">
              Help me resist
            </Text>
          </Pressable>
        </View>
      ) : (
        <View className="mb-10 pb-8 pt-4">
          {isFirstGuidedStep ? (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPrimary();
              }}
              className="w-full rounded-2xl bg-green-600 px-5 py-4"
            >
              <Text className="text-center text-lg font-bold text-white">
                {primaryLabel}
              </Text>
            </Pressable>
          ) : (
            <View className="flex-row items-center gap-3">
              {canGoBack ? (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onBack();
                  }}
                  className="flex-1 rounded-2xl border border-gray-200 bg-white px-5 py-4"
                >
                  <Text className="text-center text-lg font-bold text-gray-900">
                    Back
                  </Text>
                </Pressable>
              ) : (
                <View className="flex-1" />
              )}

              <Pressable
                onPress={() => {
                  if (currentStep.kind === "done") {
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Success,
                    );
                  } else {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  onPrimary();
                }}
                className="flex-1 rounded-2xl bg-green-600 px-5 py-4"
              >
                <Text className="text-center text-lg font-bold text-white">
                  {primaryLabel}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
