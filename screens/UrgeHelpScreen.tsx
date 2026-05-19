import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  useNavigation,
  useRoute,
  usePreventRemove,
} from "@react-navigation/native";
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
      icon: keyof typeof Ionicons.glyphMap;
    }
  | {
      kind: "info";
      title: string;
      body: string;
      tip?: string;
      icon: keyof typeof Ionicons.glyphMap;
    }
  | {
      kind: "action";
      title: string;
      body: string;
      tip?: string;
      icon: keyof typeof Ionicons.glyphMap;
    }
  | {
      kind: "done";
      title: string;
      body: string;
      tip?: string;
      icon: keyof typeof Ionicons.glyphMap;
    };

const helpSteps: Step[] = [
  {
    kind: "info",
    title: "Name the Urge",
    body: 'Say to yourself (out loud if possible): \n"I\'m having an urge to ___."',
    tip: "Just labeling it creates psychological distance between you and the feeling.",
    icon: "chatbubble-ellipses",
  },
  {
    kind: "info",
    title: "Pause for 2 Minutes",
    body: "Look at a clock or set a timer for 2 minutes.",
    tip: "Urges behave a lot like ocean waves: they build up, reach a peak intensity, and then naturally crash and fade away.",
    icon: "pause-circle",
  },
  {
    kind: "info",
    title: "Change your Environment",
    body: "If you are sitting, stand up. Enter a different room or step outside for a breath of fresh air.",
    tip: "Urges are heavily tied to environmental cues. If you stay in the exact same spot where the urge hit, your brain will keep screaming at you to do the habit.",
    icon: "walk",
  },
  {
    kind: "info",
    title: "Take 10 Slow Breaths",
    body: "Breathe in through your nose. Breathe out slower than you breathed in.",
    tip: "Breathing deeply activates the parasympathetic nervous system, which helps calm you down.",
    icon: "leaf",
  },
  {
    kind: "action",
    title: "Do a Replacement Action",
    body: "Pick one action that is easy and enjoyable.",
    icon: "flash",
  },
  {
    kind: "info",
    title: "Reward Yourself",
    body: "Give yourself immediate positive feedback.",
    tip: "Acknowledging the win releases a small hit of dopamine, which helps rewire your brain to associate resisting the urge with a feeling of success.",
    icon: "trophy",
  },
];

function ProgressBar({
  visible,
  progressPct,
  currentStepNumber,
  totalSteps,
}: {
  visible: boolean;
  progressPct: number;
  currentStepNumber: number;
  totalSteps: number;
}) {
  if (!visible) return null;

  return (
    <View className="pt-10">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-sm font-black uppercase tracking-wide text-green-600">
          Guided help
        </Text>

        <View className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 shadow-sm">
          <Text className="text-sm font-black text-green-600">
            Step {currentStepNumber} of {totalSteps}
          </Text>
        </View>
      </View>

      <View className="h-5 w-full overflow-hidden rounded-full bg-gray-200">
        <View
          style={{ width: `${progressPct}%` }}
          className="h-5 rounded-full bg-green-600"
        />
      </View>
    </View>
  );
}

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
  const allowExitRef = useRef(false);

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

  useEffect(() => {
    setSelectedActionId(currentLog?.selectedActionId ?? null);
  }, [currentLog?.selectedActionId]);

  usePreventRemove(mode === "guided", ({ data }) => {
    if (allowExitRef.current) {
      navigation.dispatch(data.action);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMode("decision");
    setStepIndex(0);
  });

  const currentStep: Step = useMemo(() => {
    if (mode === "decision") {
      return {
        kind: "decision",
        title: "Nice job logging",
        body: "You paused and checked in instead of staying on autopilot. What do you want to do next?",
        icon: "checkmark-circle",
      };
    }

    const doneStep: Step = {
      kind: "done",
      title: "Great work!",
      body: "You practiced resisting that urge. This is how you build your self-control muscle.",
      tip: "Every time you resist an urge, you're physically rewiring your brain to make the old habit weaker and the new habit stronger.",
      icon: "star",
    };

    if (stepIndex < helpSteps.length) return helpSteps[stepIndex];
    return doneStep;
  }, [mode, stepIndex]);

  const totalSteps = helpSteps.length + 1;
  const currentStepNumber = stepIndex + 1;
  const canGoBack = mode === "guided" && currentStepNumber > 1;
  const isFirstGuidedStep = mode === "guided" && currentStepNumber === 1;
  const hasSelectedActions = selectedActions.length > 0;
  const progressPct = (currentStepNumber / totalSteps) * 100;

  const onChooseAction = async (actionId: number | null) => {
    try {
      setSavingAction(true);
      await updateLogSelectedAction(logId, actionId);
      setSelectedActionId(actionId);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } finally {
      setSavingAction(false);
    }
  };

  const goBackToLog = () => {
    allowExitRef.current = true;
    navigation.goBack();
  };

  const goToShop = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("ShopPicker");
  };

  const startGuided = () => {
    allowExitRef.current = false;
    setMode("guided");
    setStepIndex(0);
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

  const renderActionPicker = () => {
    if (currentStep.kind !== "action") return null;

    return (
      <View className="mt-6 w-full rounded-[28px] border border-gray-200 bg-gray-50 p-5 shadow-sm">
        <View className="flex-row items-center">
          <View className="h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white">
            <Ionicons name="flash" size={23} color="#000000" />
          </View>

          <View className="ml-3 flex-1">
            <Text className="text-base font-black text-black">
              Selected replacement actions
            </Text>

            <Text className="mt-1 text-sm leading-5 text-gray-500">
              Choose the action you used, or add a new one.
            </Text>
          </View>
        </View>

        {!hasSelectedActions ? (
          <>
            <View className="mt-5 rounded-[24px] border border-gray-200 bg-white p-4">
              <Text className="text-sm font-semibold leading-5 text-gray-500">
                You do not have any selected replacement actions yet.
              </Text>
            </View>

            <Pressable
              onPress={goToShop}
              className="mt-4 w-full rounded-3xl border border-gray-200 bg-white px-5 py-4 shadow-sm"
              style={({ pressed }) => ({
                shadowColor: "#000",
                shadowOffset: { width: 0, height: pressed ? 1 : 4 },
                shadowOpacity: 0.12,
                shadowRadius: pressed ? 2 : 4,
                elevation: pressed ? 2 : 5,
                transform: [{ translateY: pressed ? 1 : 0 }],
              })}
            >
              <View className="flex-row items-center justify-center">
                <Ionicons name="bag-handle" size={20} color="#000000" />
                <Text className="ml-2 text-center text-base font-black text-black">
                  Go to Shop
                </Text>
              </View>
            </Pressable>

            <Text className="mt-3 text-center text-xs font-semibold text-gray-500">
              Select a few actions in Shop, then tap Back to return here.
            </Text>
          </>
        ) : (
          <ScrollView
            className="mt-5"
            style={{ maxHeight: 132 }}
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            <View className="flex-row flex-wrap gap-2 pb-1">
              <Pressable
                onPress={() => onChooseAction(null)}
                disabled={savingAction}
                className={`rounded-full border px-4 py-2.5 ${
                  selectedActionId == null
                    ? "border-green-600 bg-green-600"
                    : "border-gray-200 bg-white"
                }`}
              >
                <Text
                  className={`text-sm font-black ${
                    selectedActionId == null ? "text-white" : "text-black"
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
                    className={`rounded-full border px-4 py-2.5 ${
                      isSelected
                        ? "border-green-600 bg-green-600"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <Text
                      className={`text-sm font-black ${
                        isSelected ? "text-white" : "text-black"
                      }`}
                    >
                      {action.title}
                    </Text>
                  </Pressable>
                );
              })}

              <Pressable
                onPress={goToShop}
                className="rounded-full border border-gray-200 bg-white px-4 py-2.5"
              >
                <Text className="text-sm font-black text-black">+ Add</Text>
              </Pressable>
            </View>
          </ScrollView>
        )}

        <View className="mt-5 rounded-[24px] border border-gray-200 bg-white p-4">
          <Text className="text-xs font-black uppercase tracking-wide text-gray-500">
            Saved to this log
          </Text>

          <Text className="mt-1 text-sm font-black text-black">
            {currentLog?.selectedActionTitle ??
              "No replacement action selected"}
          </Text>
        </View>
      </View>
    );
  };

  const primaryLabel =
    currentStep.kind === "done"
      ? "Complete Log"
      : currentStep.kind === "action"
        ? "Continue"
        : "Next";

  return (
    <View className="flex-1 bg-white px-5">
      <ProgressBar
        visible={mode === "guided"}
        progressPct={progressPct}
        currentStepNumber={currentStepNumber}
        totalSteps={totalSteps}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingTop: mode === "guided" ? 20 : 42,
          paddingBottom: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center">
          <View className="rounded-full border-4 border-green-600 bg-white p-5 shadow-sm">
            <Ionicons name={currentStep.icon} size={54} color="#000000" />
          </View>

          <Text className="mt-8 text-center text-4xl font-black leading-[44px] text-black">
            {currentStep.title}
          </Text>

          <Text className="mt-5 text-center text-lg font-semibold leading-7 text-gray-500">
            {currentStep.body}
          </Text>

          {"tip" in currentStep && currentStep.tip ? (
            <View className="mt-8 w-full rounded-[28px] border border-gray-200 bg-gray-50 p-5 shadow-sm">
              <View className="flex-row items-center">
                <View className="h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white">
                  <Ionicons name="bulb" size={24} color="#000000" />
                </View>

                <View className="ml-3 flex-1">
                  <Text className="text-base font-black text-black">
                    Why this helps
                  </Text>

                  <Text className="mt-1 text-sm leading-5 text-gray-500">
                    {currentStep.tip}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {renderActionPicker()}
        </View>
      </ScrollView>

      {mode === "decision" ? (
        <View className="pb-8 pt-4">
          <Pressable
            onPress={() => {
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              goBackToLog();
            }}
            className="w-full rounded-3xl bg-green-600 px-5 py-4 shadow-sm"
            style={({ pressed }) => ({
              shadowColor: "#000",
              shadowOffset: { width: 0, height: pressed ? 2 : 6 },
              shadowOpacity: 0.25,
              shadowRadius: pressed ? 3 : 6,
              elevation: pressed ? 3 : 8,
              transform: [{ translateY: pressed ? 2 : 0 }],
            })}
          >
            <View className="flex-row items-center justify-center">
              <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
              <Text className="ml-2 text-center text-lg font-black text-white">
                Complete Log
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              startGuided();
            }}
            className="mt-3 w-full rounded-3xl border border-gray-200 bg-white px-5 py-4 shadow-sm"
            style={({ pressed }) => ({
              shadowColor: "#000",
              shadowOffset: { width: 0, height: pressed ? 1 : 4 },
              shadowOpacity: 0.12,
              shadowRadius: pressed ? 2 : 4,
              elevation: pressed ? 2 : 5,
              transform: [{ translateY: pressed ? 1 : 0 }],
            })}
          >
            <View className="flex-row items-center justify-center">
              <Ionicons name="shield-checkmark" size={22} color="#000000" />
              <Text className="ml-2 text-center text-lg font-black text-black">
                Help me resist
              </Text>
            </View>
          </Pressable>
        </View>
      ) : (
        <View className="pb-8 pt-4">
          {isFirstGuidedStep ? (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPrimary();
              }}
              className="w-full rounded-3xl bg-green-600 px-5 py-4 shadow-sm"
              style={({ pressed }) => ({
                shadowColor: "#000",
                shadowOffset: { width: 0, height: pressed ? 2 : 6 },
                shadowOpacity: 0.25,
                shadowRadius: pressed ? 3 : 6,
                elevation: pressed ? 3 : 8,
                transform: [{ translateY: pressed ? 2 : 0 }],
              })}
            >
              <View className="flex-row items-center justify-center">
                <Ionicons
                  name="arrow-forward-circle"
                  size={22}
                  color="#FFFFFF"
                />
                <Text className="ml-2 text-center text-lg font-black text-white">
                  {primaryLabel}
                </Text>
              </View>
            </Pressable>
          ) : (
            <View className="flex-row items-center gap-3">
              {canGoBack ? (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onBack();
                  }}
                  className="flex-1 rounded-3xl border border-gray-200 bg-white px-5 py-4 shadow-sm"
                  style={({ pressed }) => ({
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: pressed ? 1 : 4 },
                    shadowOpacity: 0.12,
                    shadowRadius: pressed ? 2 : 4,
                    elevation: pressed ? 2 : 5,
                    transform: [{ translateY: pressed ? 1 : 0 }],
                  })}
                >
                  <Text className="text-center text-lg font-black text-black">
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
                className="flex-1 rounded-3xl bg-green-600 px-5 py-4 shadow-sm"
                style={({ pressed }) => ({
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: pressed ? 2 : 6 },
                  shadowOpacity: 0.25,
                  shadowRadius: pressed ? 3 : 6,
                  elevation: pressed ? 3 : 8,
                  transform: [{ translateY: pressed ? 2 : 0 }],
                })}
              >
                <Text className="text-center text-lg font-black text-white">
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
