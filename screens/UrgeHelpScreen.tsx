import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, Modal, View, Text, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  useNavigation,
  useRoute,
  usePreventRemove,
} from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type {
  FocusedHelpLogRequest,
  RootStackParamList,
  RootTabParamList,
} from "../App";
import {
  useData,
  type ReplacementAction,
  type SelectedPlace,
} from "../data/DataContext";
import { Screen } from "../components/Screen";
import { useHelpExitGuard } from "../components/HelpExitGuard";
import LogScreen from "./LogScreen";

const QUICK_ACTION_TITLES = [
  "Go for a 5-min walk",
  "Read one page of a book",
  "Call a friend",
] as const;

const SELECTED_ACTION_BOX_MAX_HEIGHT = 110;

type HelpRoute =
  | RouteProp<RootStackParamList, "UrgeHelp">
  | RouteProp<RootTabParamList, "Help">;
type HelpMode = "decision" | "menu" | "guided" | "single" | "log_choice";

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
    }
  | {
      kind: "menu" | "log_choice";
      title: string;
      body: string;
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
    title: "Pause and Breathe",
    body: "Breathe in slowly through your nose, then breathe out even more slowly through your mouth. Continue for 10 breaths and wait before deciding what to do.",
    tip: "Slow breathing can calm your body and gives the urge time to weaken. Urges are like ocean waves: they build, reach a peak, and then naturally fade.",
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
    kind: "action",
    title: "Do a Replacement Action",
    body: "Pick one action that is easy and enjoyable.",
    tip: "Replacement actions give your brain another response to choose when an urge appears. Repeating the new response helps weaken the automatic connection between the urge and the old habit.",
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
    <View className="pt-7">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-sm font-black uppercase tracking-wide text-green-600">
          Guided help
        </Text>

        <View className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 shadow-sm">
          <Text className="text-sm font-black text-green-600">
            Step {currentStepNumber} of {totalSteps}
          </Text>
        </View>
      </View>

      <View className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
        <View
          style={{ width: `${progressPct}%` }}
          className="h-3 rounded-full bg-green-600"
        />
      </View>
    </View>
  );
}

function getQuickActionIcon(title: string): keyof typeof Ionicons.glyphMap {
  if (title === "Go for a 5-min walk") return "walk";
  if (title === "Read one page of a book") return "book";
  if (title === "Call a friend") return "call";
  return "flash";
}

function HelpTipModal({
  visible,
  body,
  onClose,
}: {
  visible: boolean;
  body: string;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-black/40 px-5">
        <View className="w-full rounded-[28px] bg-white p-5">
          <View className="flex-row items-center justify-between">
            <View className="flex-row flex-1 items-center pr-3">
              <View className="h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white">
                <Ionicons name="bulb" size={22} color="#000000" />
              </View>
              <Text className="ml-3 flex-1 text-xl font-black text-black">
                Why this helps
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              className="h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white"
            >
              <Ionicons name="close" size={20} color="#000000" />
            </Pressable>
          </View>

          <Text className="mt-4 text-base font-semibold leading-6 text-gray-600">
            {body}
          </Text>

          <Pressable
            onPress={onClose}
            className="mt-5 rounded-2xl bg-green-600 px-5 py-3"
          >
            <Text className="text-center text-sm font-black text-white">
              Done
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function UrgeHelpScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<HelpRoute>();
  const helpExitGuardRef = useHelpExitGuard();
  const logId = route.name === "UrgeHelp" ? route.params.logId : null;
  const isHelpFirst = logId == null;

  const {
    actions,
    selectedActionIds,
    updateLogSelectedAction,
    updateLogMovedToLocation,
    toggleSelectedAction,
    locations,
    selectedLocations,
    logs,
  } = useData();

  const [mode, setMode] = useState<HelpMode>(isHelpFirst ? "menu" : "decision");
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedActionId, setSelectedActionId] = useState<number | null>(null);
  const [selectedMovedToLocationId, setSelectedMovedToLocationId] = useState<
    number | null
  >(null);
  const [savingAction, setSavingAction] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [keepQuickActionFallbackOpen, setKeepQuickActionFallbackOpen] =
    useState(false);
  const [pendingQuickActionId, setPendingQuickActionId] = useState<
    number | null
  >(null);
  const [helpTipOpen, setHelpTipOpen] = useState(false);
  const [triedStepIndexes, setTriedStepIndexes] = useState<number[]>([]);
  const [focusedHelpLog, setFocusedHelpLog] =
    useState<FocusedHelpLogRequest | null>(null);
  const [selectedActionsContentHeight, setSelectedActionsContentHeight] =
    useState(0);
  const [environmentContentHeight, setEnvironmentContentHeight] = useState(0);
  const allowExitRef = useRef(false);
  const hasReceivedHelpRef = useRef(false);
  const suppressExitPromptRef = useRef(false);
  const mainScrollViewRef = useRef<ScrollView | null>(null);
  const previousSelectedActionIdsRef = useRef<number[]>(selectedActionIds);
  const previousSelectedLocationIdsRef = useRef<number[]>(
    selectedLocations.map((location) => location.id),
  );

  useEffect(() => {
    requestAnimationFrame(() => {
      mainScrollViewRef.current?.scrollTo({ y: 0, animated: false });
    });
  }, [mode, stepIndex]);

  const quickActions = useMemo(() => {
    const normalize = (value: string) =>
      value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const aliases = new Map<string, string[]>([
      [
        "Go for a 5-min walk",
        ["go for a 5-min walk", "go for a 5 min walk", "walk for 5 minutes"],
      ],
      [
        "Read one page of a book",
        ["read one page of a book", "read 1 page of a book", "read one page"],
      ],
      ["Call a friend", ["call a friend", "phone a friend"]],
    ]);

    return QUICK_ACTION_TITLES.map((title) => {
      const normalizedAliases = (aliases.get(title) ?? [title]).map(normalize);
      const matchingAction =
        actions.find((action) => {
          const normalizedTitle = normalize(action.title);
          return normalizedAliases.includes(normalizedTitle);
        }) ?? null;

      return {
        title,
        actionId: matchingAction?.id ?? null,
      };
    });
  }, [actions]);

  const quickActionIds = useMemo(() => {
    return quickActions
      .map((quickAction) => quickAction.actionId)
      .filter((id): id is number => id != null);
  }, [quickActions]);

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

  const recentLog = useMemo(() => {
    if (!isHelpFirst) return null;

    const now = Date.now();
    const cutoff = now - 30 * 60 * 1000;

    return (
      logs
        .filter((log) => log.createdAt >= cutoff && log.createdAt <= now)
        .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null
    );
  }, [isHelpFirst, logs]);

  const recentLogTime = useMemo(() => {
    if (!recentLog) return null;

    const minutesAgo = Math.max(
      0,
      Math.floor((Date.now() - recentLog.createdAt) / 60_000),
    );

    if (minutesAgo === 0) return "just now";
    if (minutesAgo === 1) return "1 minute ago";
    return `${minutesAgo} minutes ago`;
  }, [recentLog]);

  const selectedActionTitle = useMemo(() => {
    if (selectedActionId == null) return null;

    return (
      actions.find((action) => action.id === selectedActionId)?.title ??
      currentLog?.selectedActionTitle ??
      null
    );
  }, [actions, currentLog?.selectedActionTitle, selectedActionId]);

  const environmentLocations = useMemo(() => {
    const options: SelectedPlace[] = [...selectedLocations];
    if (
      selectedMovedToLocationId != null &&
      !options.some((location) => location.id === selectedMovedToLocationId)
    ) {
      const selectedLocation = locations.find(
        (location) => location.id === selectedMovedToLocationId,
      );
      if (selectedLocation) options.push(selectedLocation);
    }
    if (
      currentLog?.movedToLocationId != null &&
      currentLog.movedToLocationName &&
      !options.some((location) => location.id === currentLog.movedToLocationId)
    ) {
      options.push({
        id: currentLog.movedToLocationId,
        name: currentLog.movedToLocationName,
        isCustom: 1,
        hidden: 1,
      });
    }
    return options;
  }, [
    currentLog?.movedToLocationId,
    currentLog?.movedToLocationName,
    locations,
    selectedMovedToLocationId,
    selectedLocations,
  ]);

  const hasSelectedActionsOverflow =
    selectedActionsContentHeight > SELECTED_ACTION_BOX_MAX_HEIGHT + 4;
  const selectedActionsScrollRef = useRef<ScrollView | null>(null);
  const environmentScrollRef = useRef<ScrollView | null>(null);
  const hasEnvironmentOverflow =
    environmentContentHeight > SELECTED_ACTION_BOX_MAX_HEIGHT + 4;
  const shouldResetSelectedActionsScrollRef = useRef(false);

  useEffect(() => {
    return navigation.addListener("focus", () => {
      suppressExitPromptRef.current = false;

      if (!shouldResetSelectedActionsScrollRef.current) return;

      shouldResetSelectedActionsScrollRef.current = false;
      requestAnimationFrame(() => {
        selectedActionsScrollRef.current?.scrollTo({ y: 0, animated: false });
      });
    });
  }, [navigation]);

  useEffect(() => {
    if (selectedActions.length > 0) {
      setKeepQuickActionFallbackOpen(false);
    }
  }, [selectedActions.length]);

  useEffect(() => {
    if (isHelpFirst) return;

    const nextSelectedActionId = currentLog?.selectedActionId ?? null;

    if (!savingAction) {
      setSelectedActionId(nextSelectedActionId);
    }

    if (!savingLocation) {
      setSelectedMovedToLocationId(currentLog?.movedToLocationId ?? null);
    }

    if (nextSelectedActionId == null && !savingAction) {
      setPendingQuickActionId(null);
      return;
    }

    if (
      keepQuickActionFallbackOpen &&
      pendingQuickActionId != null &&
      nextSelectedActionId !== pendingQuickActionId &&
      !savingAction
    ) {
      setPendingQuickActionId(null);
      setKeepQuickActionFallbackOpen(false);
    }
  }, [
    currentLog?.selectedActionId,
    keepQuickActionFallbackOpen,
    pendingQuickActionId,
    savingAction,
    savingLocation,
    isHelpFirst,
    currentLog?.movedToLocationId,
  ]);

  useLayoutEffect(() => {
    const showBackButton = isHelpFirst ? mode !== "menu" : mode !== "decision";

    const goBackWithinHelp = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setStepIndex(0);
      setMode(!isHelpFirst && mode === "menu" ? "decision" : "menu");
    };

    if (isHelpFirst) {
      navigation.setOptions({
        title: "Urge help",
        headerLeft: showBackButton
          ? () => (
              <Pressable
                onPress={goBackWithinHelp}
                hitSlop={12}
                className="h-10 w-10 items-center justify-center"
              >
                <Ionicons name="chevron-back" size={28} color="#111827" />
              </Pressable>
            )
          : () => null,
      });
      return;
    }

    navigation.setOptions({
      headerBackVisible: false,
      headerLeft: showBackButton
        ? () => (
            <Pressable
              onPress={goBackWithinHelp}
              hitSlop={12}
              className="h-10 w-10 items-center justify-center"
            >
              <Ionicons name="chevron-back" size={28} color="#111827" />
            </Pressable>
          )
        : () => null,
      gestureEnabled: showBackButton,
    });
  }, [isHelpFirst, navigation, mode]);

  usePreventRemove(!isHelpFirst && mode !== "decision", ({ data }) => {
    if (allowExitRef.current) {
      navigation.dispatch(data.action);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMode(mode === "menu" ? "decision" : "menu");
    setStepIndex(0);
  });

  useEffect(() => {
    if (!isHelpFirst) return;

    const resetToken = route.name === "Help" ? route.params?.resetToken : null;
    if (!resetToken) return;

    setMode("menu");
    setStepIndex(0);
    setSelectedActionId(null);
    setSelectedMovedToLocationId(null);
    setPendingQuickActionId(null);
    setKeepQuickActionFallbackOpen(false);
    setTriedStepIndexes([]);
    hasReceivedHelpRef.current = false;
  }, [isHelpFirst, route]);

  const currentStep: Step = useMemo(() => {
    if (mode === "decision") {
      return {
        kind: "decision",
        title: "Nice job logging",
        body: "You paused and checked in instead of staying on autopilot. What do you want to do next?",
        icon: "checkmark-circle",
      };
    }

    if (mode === "menu") {
      return {
        kind: "menu",
        title: "What Would Help Right Now?",
        body: "Choose one step, or use the full walkthrough.",
        icon: "shield-checkmark",
      };
    }

    if (mode === "log_choice") {
      return {
        kind: "log_choice",
        title: "Use Your Recent Log?",
        body: `Add this help to your ${recentLog?.habitName ?? "habit"} log from ${recentLogTime ?? "recently"}?`,
        icon: "time",
      };
    }

    const completedAnyStep = triedStepIndexes.length > 0;
    const doneStep: Step = completedAnyStep
      ? {
          kind: "done",
          title: "Great work!",
          body: "You practiced responding to that urge with intention.",
          tip: "Each time you practice a different response, you make it easier to choose again in the future.",
          icon: "star",
        }
      : {
          kind: "done",
          title: "Walkthrough complete",
          body: "You looked through the options. Choose any step whenever you feel ready.",
          icon: "list",
        };

    if (stepIndex < helpSteps.length) return helpSteps[stepIndex];
    return doneStep;
  }, [mode, recentLog?.habitName, recentLogTime, stepIndex, triedStepIndexes]);

  const totalSteps = helpSteps.length + 1;
  const currentStepNumber = stepIndex + 1;
  const canGoBack = mode === "guided" && currentStepNumber > 1;
  const isFirstGuidedStep = mode === "guided" && currentStepNumber === 1;
  const hasSelectedActions = selectedActions.length > 0;
  const progressPct = (currentStepNumber / totalSteps) * 100;

  const isReplacementActionStep =
    currentStep.title === "Do a Replacement Action";
  const isEnvironmentStep = currentStep.title === "Change your Environment";
  const choiceRequired = isEnvironmentStep || isReplacementActionStep;
  const hasRequiredChoice = isEnvironmentStep
    ? selectedMovedToLocationId != null
    : isReplacementActionStep
      ? selectedActionId != null
      : true;
  const usesHelpTipBubble = isEnvironmentStep || isReplacementActionStep;
  const usesCompactStepLayout = isEnvironmentStep || isReplacementActionStep;
  const isGuidedMode = mode === "guided";
  const usesGuidedSpacing = mode === "guided" && usesCompactStepLayout;

  const shouldShowQuickActionFallback =
    !hasSelectedActions &&
    (quickActionIds.length > 0 || keepQuickActionFallbackOpen);

  const titleClassName = usesGuidedSpacing
    ? "mt-4 text-center text-[28px] font-black leading-8 text-black"
    : isGuidedMode
      ? "mt-5 text-center text-[32px] font-black leading-9 text-black"
      : usesCompactStepLayout
        ? "mt-5 text-center text-[25px] font-black leading-[30px] text-black"
        : "mt-8 text-center text-4xl font-black leading-[44px] text-black";

  const bodyClassName = usesGuidedSpacing
    ? "mt-2 text-center text-base font-semibold leading-6 text-gray-500"
    : isGuidedMode
      ? "mt-3 text-center text-base font-semibold leading-6 text-gray-500"
      : usesCompactStepLayout
        ? "mt-2 text-center text-base font-semibold leading-6 text-gray-500"
        : "mt-5 text-center text-lg font-semibold leading-7 text-gray-500";

  const iconWrapClassName = usesGuidedSpacing
    ? "rounded-full border-4 border-green-600 bg-white p-4 shadow-sm"
    : isGuidedMode
      ? "rounded-full border-4 border-green-600 bg-white p-4 shadow-sm"
      : usesCompactStepLayout
        ? "rounded-full border-4 border-green-600 bg-white p-4 shadow-sm"
        : "rounded-full border-4 border-green-600 bg-white p-5 shadow-sm";

  const iconSize = usesGuidedSpacing
    ? 44
    : isGuidedMode
      ? 48
      : usesCompactStepLayout
        ? 44
        : 54;

  const onChooseAction = async (actionId: number | null) => {
    const previousActionId = selectedActionId;
    const nextActionId =
      actionId != null && selectedActionId === actionId ? null : actionId;

    setSelectedActionId(nextActionId);
    setPendingQuickActionId(null);
    setKeepQuickActionFallbackOpen(false);
    setSavingAction(true);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    if (isHelpFirst) {
      setSavingAction(false);
      return;
    }

    try {
      await updateLogSelectedAction(logId as number, nextActionId);
    } catch {
      setSelectedActionId(previousActionId);
    } finally {
      setSavingAction(false);
    }
  };

  const onChooseMovedToLocation = async (locationId: number | null) => {
    const previousLocationId = selectedMovedToLocationId;
    const nextLocationId =
      locationId != null && selectedMovedToLocationId === locationId
        ? null
        : locationId;
    setSelectedMovedToLocationId(nextLocationId);
    setSavingLocation(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    if (isHelpFirst) {
      setSavingLocation(false);
      return;
    }

    try {
      await updateLogMovedToLocation(logId as number, nextLocationId);
    } catch {
      setSelectedMovedToLocationId(previousLocationId);
    } finally {
      setSavingLocation(false);
    }
  };

  useEffect(() => {
    const previousIds = previousSelectedActionIdsRef.current;
    const addedIds = selectedActionIds.filter(
      (id) => !previousIds.includes(id),
    );
    previousSelectedActionIdsRef.current = selectedActionIds;

    if (addedIds.length === 0) return;
    if (currentStep.kind !== "action") return;

    const mostRecentAddedActionId = addedIds[addedIds.length - 1];

    if (selectedActionId === mostRecentAddedActionId) return;

    onChooseAction(mostRecentAddedActionId);
  }, [selectedActionIds, currentStep.kind, selectedActionId]);

  useEffect(() => {
    const currentIds = selectedLocations.map((location) => location.id);
    const previousIds = previousSelectedLocationIdsRef.current;
    const addedIds = currentIds.filter((id) => !previousIds.includes(id));
    previousSelectedLocationIdsRef.current = currentIds;

    if (addedIds.length === 0 || !isEnvironmentStep) return;
    const newestLocationId = addedIds[addedIds.length - 1];
    if (selectedMovedToLocationId === newestLocationId) return;
    void onChooseMovedToLocation(newestLocationId);
    requestAnimationFrame(() => {
      environmentScrollRef.current?.scrollToEnd({ animated: true });
    });
  }, [isEnvironmentStep, selectedLocations, selectedMovedToLocationId]);

  const onChooseQuickAction = async (actionId: number | null) => {
    if (actionId == null) return;

    const previousActionId = selectedActionId;
    const nextActionId = selectedActionId === actionId ? null : actionId;

    setSelectedActionId(nextActionId);
    setKeepQuickActionFallbackOpen(true);
    setPendingQuickActionId(nextActionId);
    setSavingAction(true);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    if (isHelpFirst) {
      setSavingAction(false);
      return;
    }

    try {
      await updateLogSelectedAction(logId as number, nextActionId);
    } catch {
      setSelectedActionId(previousActionId);
      setPendingQuickActionId(
        quickActionIds.includes(previousActionId ?? -1)
          ? previousActionId
          : null,
      );
    } finally {
      setSavingAction(false);
    }
  };

  const completeLogAndExit = async () => {
    const actionToSave = pendingQuickActionId;

    if (actionToSave != null && !selectedActionIds.includes(actionToSave)) {
      await toggleSelectedAction(actionToSave);
    }

    allowExitRef.current = true;
    navigation.popTo("Main", { screen: "Home" });
  };

  const completeWithoutHelp = () => {
    allowExitRef.current = true;
    navigation.popTo("Main", { screen: "Home" });
  };

  const goToShop = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    previousSelectedActionIdsRef.current = selectedActionIds;
    shouldResetSelectedActionsScrollRef.current = true;
    suppressExitPromptRef.current = true;

    const stackNavigation = isHelpFirst ? navigation.getParent() : navigation;
    stackNavigation?.navigate("ShopPicker", { showDoneButton: true });
  };

  const goToLocations = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    previousSelectedLocationIdsRef.current = selectedLocations.map(
      (location) => location.id,
    );
    suppressExitPromptRef.current = true;

    const stackNavigation = isHelpFirst ? navigation.getParent() : navigation;
    stackNavigation?.navigate("ManageList", {
      type: "locations",
      returnToHelp: true,
      openToAdd: true,
    });
  };

  const openHelpTip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHelpTipOpen(true);
  };

  const startGuided = () => {
    allowExitRef.current = false;
    setTriedStepIndexes([]);
    setMode("guided");
    setStepIndex(0);
  };

  const startSingleStep = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStepIndex(index);
    setMode("single");
  };

  const markCurrentStepTried = () => {
    hasReceivedHelpRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    setTriedStepIndexes((current) =>
      current.includes(stepIndex) ? current : [...current, stepIndex],
    );
    setMode("menu");
    setStepIndex(0);
  };

  const savePendingAction = async () => {
    const actionToSave = pendingQuickActionId;

    if (actionToSave != null && !selectedActionIds.includes(actionToSave)) {
      await toggleSelectedAction(actionToSave);
    }
  };

  const openFullLog = async () => {
    await savePendingAction();

    suppressExitPromptRef.current = true;
    setFocusedHelpLog({
      token: Date.now(),
      createdAt: Date.now(),
      selectedActionId,
      movedToLocationId: selectedMovedToLocationId,
    });
  };

  const closeFocusedHelpLog = (saved: boolean) => {
    setFocusedHelpLog(null);
    suppressExitPromptRef.current = false;

    if (!saved) return;

    suppressExitPromptRef.current = true;
    hasReceivedHelpRef.current = false;
    setMode("menu");
    setStepIndex(0);
    setSelectedActionId(null);
    setSelectedMovedToLocationId(null);
    setPendingQuickActionId(null);
    setKeepQuickActionFallbackOpen(false);
    setTriedStepIndexes([]);
    navigation.navigate("Home");
  };

  useEffect(() => {
    if (!isHelpFirst || !helpExitGuardRef) return;

    const guard = (proceed: () => void) => {
      if (!hasReceivedHelpRef.current || focusedHelpLog != null) return false;

      Alert.alert(
        "Log this urge before you go?",
        "Logging it helps keep your progress accurate.",
        [
          {
            text: "Not now",
            style: "cancel",
            onPress: () => {
              hasReceivedHelpRef.current = false;
              setMode("menu");
              setStepIndex(0);
              setSelectedActionId(null);
              setSelectedMovedToLocationId(null);
              setPendingQuickActionId(null);
              setKeepQuickActionFallbackOpen(false);
              setTriedStepIndexes([]);
              proceed();
            },
          },
          {
            text: "Log urge",
            onPress: () => {
              void openFullLog();
            },
          },
        ],
      );
      return true;
    };

    helpExitGuardRef.current = guard;
    return () => {
      if (helpExitGuardRef.current === guard) {
        helpExitGuardRef.current = null;
      }
    };
  });

  const updateRecentLogAndExit = async () => {
    if (!recentLog) {
      await openFullLog();
      return;
    }

    setSavingAction(true);

    try {
      await savePendingAction();

      if (selectedActionId != null) {
        await updateLogSelectedAction(recentLog.id, selectedActionId);
      }
      if (selectedMovedToLocationId != null) {
        await updateLogMovedToLocation(recentLog.id, selectedMovedToLocationId);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      suppressExitPromptRef.current = true;
      hasReceivedHelpRef.current = false;
      setMode("menu");
      setStepIndex(0);
      setSelectedActionId(null);
      setSelectedMovedToLocationId(null);
      setPendingQuickActionId(null);
      setKeepQuickActionFallbackOpen(false);
      setTriedStepIndexes([]);
      navigation.navigate("Home");
    } catch {
      Alert.alert("Could not update the log", "Please try again.");
    } finally {
      setSavingAction(false);
    }
  };

  const finishHelp = async () => {
    if (isHelpFirst) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );

      if (recentLog) {
        setMode("log_choice");
      } else {
        await openFullLog();
      }
      return;
    }

    await completeLogAndExit();
  };

  const onPrimary = async () => {
    if (currentStep.kind === "done") {
      await finishHelp();
      return;
    }

    hasReceivedHelpRef.current = true;
    setTriedStepIndexes((current) =>
      current.includes(stepIndex) ? current : [...current, stepIndex],
    );
    setStepIndex((v) => v + 1);
  };

  const skipCurrentStep = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setStepIndex((value) => value + 1);
  };

  const completeGuidedHelp = () => {
    hasReceivedHelpRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    setMode("menu");
    setStepIndex(0);
  };

  const onBack = () => {
    if (!canGoBack) return;
    setStepIndex((v) => Math.max(0, v - 1));
  };

  const renderHelpMenu = () => {
    if (currentStep.kind !== "menu") return null;

    const options: Array<{
      title: string;
      detail: string;
      icon: keyof typeof Ionicons.glyphMap;
      onPress: () => void;
    }> = [
      {
        title: "Change my environment",
        detail: "Move away from what triggered it.",
        icon: "walk",
        onPress: () => startSingleStep(2),
      },
      {
        title: "Choose a replacement action",
        detail: "Do something easier and enjoyable.",
        icon: "flash",
        onPress: () => startSingleStep(3),
      },
      {
        title: "Pause and breathe",
        detail: "Slow down while the urge passes.",
        icon: "pause-circle",
        onPress: () => startSingleStep(1),
      },
      {
        title: "Full guided help",
        detail: "Walk through every step in order.",
        icon: "list",
        onPress: startGuided,
      },
    ];

    return (
      <View className="mt-7 w-[96%] gap-3">
        {options.map((option) => (
          <Pressable
            key={option.title}
            onPress={option.onPress}
            className="w-full rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm"
            style={({ pressed }) => ({
              shadowColor: "#000",
              shadowOffset: { width: 0, height: pressed ? 1 : 4 },
              shadowOpacity: 0.12,
              shadowRadius: pressed ? 2 : 4,
              elevation: pressed ? 2 : 5,
              transform: [{ translateY: pressed ? 1 : 0 }],
            })}
          >
            <View className="flex-row items-center">
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-green-50">
                <Ionicons name={option.icon} size={24} color="#16A34A" />
              </View>

              <View className="ml-3 flex-1">
                <Text className="text-base font-black text-black">
                  {option.title}
                </Text>
                <Text className="mt-0.5 text-sm leading-5 text-gray-500">
                  {option.detail}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={21} color="#6B7280" />
            </View>
          </Pressable>
        ))}
      </View>
    );
  };

  const renderActionPicker = () => {
    if (currentStep.kind !== "action") return null;

    return (
      <View
        className={`${usesGuidedSpacing ? "mt-3 p-3" : "mt-4 p-4"} w-[96%] rounded-[26px] border border-gray-200 bg-gray-50 shadow-sm`}
      >
        <View className="flex-row items-center">
          <View className="h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white">
            <Ionicons name="flash" size={21} color="#000000" />
          </View>

          <View className="ml-3 flex-1">
            <Text className="text-sm font-black text-black">
              Selected replacement actions
            </Text>
          </View>
          <Pressable
            onPress={openHelpTip}
            accessibilityRole="button"
            accessibilityLabel="Why this helps"
            hitSlop={8}
            className="ml-2 h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white"
          >
            <Ionicons name="bulb-outline" size={18} color="#000000" />
          </Pressable>
        </View>

        {shouldShowQuickActionFallback ? (
          <>
            <View className="mt-3 rounded-[20px] border border-gray-200 bg-white p-3">
              <Text className="text-sm font-black text-black">
                No selected actions yet.
              </Text>

              <Text className="mt-2 text-xs font-black uppercase tracking-wide text-gray-500">
                Recommended:
              </Text>
            </View>

            <View className="mt-3">
              {quickActions.map((quickAction) => {
                const isSelected = selectedActionId === quickAction.actionId;
                const canSelect = quickAction.actionId != null;

                return (
                  <Pressable
                    key={quickAction.title}
                    onPress={() => onChooseQuickAction(quickAction.actionId)}
                    disabled={!canSelect}
                    className={`mb-2 rounded-3xl border p-3 ${
                      isSelected
                        ? "border-green-600 bg-green-600"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <View className="flex-row items-center">
                      <View
                        className={`h-10 w-10 items-center justify-center rounded-2xl border ${
                          isSelected
                            ? "border-white/30 bg-white/20"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        <Ionicons
                          name={getQuickActionIcon(quickAction.title)}
                          size={20}
                          color={isSelected ? "#FFFFFF" : "#000000"}
                        />
                      </View>

                      <Text
                        className={`ml-3 flex-1 text-sm font-black ${
                          isSelected ? "text-white" : "text-black"
                        }`}
                      >
                        {quickAction.title}
                      </Text>

                      <Ionicons
                        name={
                          isSelected
                            ? "remove-circle-outline"
                            : "add-circle-outline"
                        }
                        size={21}
                        color={isSelected ? "#FFFFFF" : "#000000"}
                      />
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={goToShop}
              className="mt-1 w-full rounded-3xl border border-gray-200 bg-white px-5 py-3 shadow-sm"
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
                <Ionicons name="bag-handle" size={19} color="#000000" />
                <Text className="ml-2 text-center text-sm font-black text-black">
                  More actions in Shop
                </Text>
              </View>
            </Pressable>
          </>
        ) : (
          <>
            <ScrollView
              ref={selectedActionsScrollRef}
              className="mt-3"
              style={{ maxHeight: SELECTED_ACTION_BOX_MAX_HEIGHT }}
              nestedScrollEnabled
              showsVerticalScrollIndicator={hasSelectedActionsOverflow}
              onContentSizeChange={(_, height) => {
                setSelectedActionsContentHeight(height);
              }}
            >
              <View className="flex-row flex-wrap gap-2 pb-1">
                {selectedActions.map((action) => {
                  const isSelected = selectedActionId === action.id;

                  return (
                    <Pressable
                      key={action.id}
                      onPress={() => onChooseAction(action.id)}
                      disabled={savingAction}
                      className={`rounded-full border px-3 py-2 ${
                        isSelected
                          ? "border-green-600 bg-green-600"
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      <Text
                        className={`text-xs font-black ${
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
                  className="rounded-full border border-gray-200 bg-white px-3 py-2"
                >
                  <Text className="text-xs font-black text-black">+ Add</Text>
                </Pressable>
              </View>
            </ScrollView>

            {hasSelectedActionsOverflow ? (
              <View className="mt-2 flex-row items-center justify-center">
                <Ionicons name="chevron-down" size={14} color="#6B7280" />
                <Text className="ml-1 text-xs font-bold text-gray-500">
                  Scroll inside the box to see more options
                </Text>
              </View>
            ) : null}
          </>
        )}

        <View className="mt-3 rounded-[20px] border border-gray-200 bg-white p-3">
          <Text className="text-[10px] font-black uppercase tracking-wide text-gray-500">
            {isHelpFirst ? "Ready for your log" : "Saved to this log"}
          </Text>

          <Text className="mt-0.5 text-sm font-black text-black">
            {selectedActionTitle ?? "No replacement action selected"}
          </Text>
        </View>
      </View>
    );
  };

  const renderEnvironmentPicker = () => {
    if (!isEnvironmentStep) return null;

    const selectedLocationName =
      environmentLocations.find(
        (location) => location.id === selectedMovedToLocationId,
      )?.name ?? null;

    return (
      <View
        className={`${usesGuidedSpacing ? "mt-3 p-3" : "mt-4 p-4"} w-[96%] rounded-[26px] border border-gray-200 bg-gray-50 shadow-sm`}
      >
        <View className="flex-row items-center">
          <View className="h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white">
            <Ionicons name="navigate" size={21} color="#000000" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-sm font-black text-black">
              Where did you move to?
            </Text>
          </View>
          <Pressable
            onPress={openHelpTip}
            accessibilityRole="button"
            accessibilityLabel="Why this helps"
            hitSlop={8}
            className="ml-2 h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white"
          >
            <Ionicons name="bulb-outline" size={18} color="#000000" />
          </Pressable>
        </View>

        <ScrollView
          ref={environmentScrollRef}
          className="mt-3"
          style={{ maxHeight: SELECTED_ACTION_BOX_MAX_HEIGHT }}
          nestedScrollEnabled
          showsVerticalScrollIndicator={hasEnvironmentOverflow}
          onContentSizeChange={(_, height) => {
            setEnvironmentContentHeight(height);
          }}
        >
          <View className="flex-row flex-wrap gap-2 pb-1">
            {environmentLocations.map((location) => {
              const selected = selectedMovedToLocationId === location.id;
              return (
                <Pressable
                  key={location.id}
                  onPress={() => void onChooseMovedToLocation(location.id)}
                  disabled={savingLocation}
                  className={`rounded-full border px-3 py-2 ${
                    selected
                      ? "border-green-600 bg-green-600"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <Text
                    className={`text-xs font-black ${
                      selected ? "text-white" : "text-black"
                    }`}
                  >
                    {location.name}
                  </Text>
                </Pressable>
              );
            })}

            <Pressable
              onPress={goToLocations}
              disabled={savingLocation}
              className="rounded-full border border-gray-200 bg-white px-3 py-2"
            >
              <Text className="text-xs font-black text-black">+ Add</Text>
            </Pressable>
          </View>
        </ScrollView>

        {hasEnvironmentOverflow ? (
          <View className="mt-2 flex-row items-center justify-center">
            <Ionicons name="chevron-down" size={14} color="#6B7280" />
            <Text className="ml-1 text-xs font-bold text-gray-500">
              Scroll inside the box to see more options
            </Text>
          </View>
        ) : null}

        <View className="mt-3 rounded-[20px] border border-gray-200 bg-white p-3">
          <Text className="text-[10px] font-black uppercase tracking-wide text-gray-500">
            {isHelpFirst ? "Ready for your log" : "Saved to this log"}
          </Text>
          <Text className="mt-0.5 text-sm font-black text-black">
            {selectedLocationName ?? "No new location selected"}
          </Text>
        </View>
      </View>
    );
  };

  const primaryLabel =
    currentStep.kind === "done"
      ? isHelpFirst
        ? "Done"
        : "Complete Log"
      : choiceRequired
        ? hasRequiredChoice
          ? "Continue"
          : isEnvironmentStep
            ? "Choose a location"
            : "Choose an action"
        : "Done";
  const showGuidedSkip =
    mode === "guided" &&
    currentStep.kind !== "done" &&
    (!choiceRequired || !hasRequiredChoice);
  const showGuidedLogOption =
    mode === "guided" && currentStep.kind === "done" && isHelpFirst;

  return (
    <Screen className="px-5">
      <Modal
        visible={focusedHelpLog != null}
        animationType="slide"
        presentationStyle="pageSheet"
        allowSwipeDismissal={false}
        onRequestClose={() => {}}
      >
        {focusedHelpLog ? (
          <LogScreen
            focusedHelpLogOverride={focusedHelpLog}
            onFocusedHelpLogReturn={closeFocusedHelpLog}
          />
        ) : null}
      </Modal>

      <HelpTipModal
        visible={helpTipOpen}
        body={"tip" in currentStep ? (currentStep.tip ?? "") : ""}
        onClose={() => setHelpTipOpen(false)}
      />

      <ProgressBar
        visible={mode === "guided"}
        progressPct={progressPct}
        currentStepNumber={currentStepNumber}
        totalSteps={totalSteps}
      />

      <ScrollView
        ref={mainScrollViewRef}
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingTop: usesGuidedSpacing
            ? 8
            : usesCompactStepLayout
              ? 6
              : mode === "guided"
                ? 12
                : 42,
          paddingBottom: isGuidedMode ? 6 : usesCompactStepLayout ? 4 : 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center">
          <View className={iconWrapClassName}>
            <Ionicons name={currentStep.icon} size={iconSize} color="#000000" />
          </View>

          <Text
            className={titleClassName}
            numberOfLines={usesCompactStepLayout ? 1 : undefined}
            adjustsFontSizeToFit={usesCompactStepLayout}
            minimumFontScale={0.8}
          >
            {currentStep.title}
          </Text>

          <Text className={bodyClassName}>{currentStep.body}</Text>

          {"tip" in currentStep && currentStep.tip && !usesHelpTipBubble ? (
            <View
              className={`${isGuidedMode ? "mt-5 p-4" : "mt-8 p-5"} w-[96%] rounded-[28px] border border-gray-200 bg-gray-50 shadow-sm`}
            >
              <View className="flex-row items-center">
                <View
                  className={`${isGuidedMode ? "h-10 w-10" : "h-12 w-12"} items-center justify-center rounded-2xl border border-gray-200 bg-white`}
                >
                  <Ionicons
                    name="bulb"
                    size={isGuidedMode ? 20 : 24}
                    color="#000000"
                  />
                </View>

                <View className="ml-3 flex-1">
                  <Text
                    className={`${isGuidedMode ? "text-sm" : "text-base"} font-black text-black`}
                  >
                    Why this helps
                  </Text>

                  <Text className="mt-1 text-sm leading-5 text-gray-500">
                    {currentStep.tip}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {renderHelpMenu()}
          {renderEnvironmentPicker()}
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
              completeWithoutHelp();
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
              setMode("menu");
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
      ) : mode === "menu" ? (
        <View className="pb-4" />
      ) : mode === "single" ? (
        <View className="pb-8 pt-4">
          <Pressable
            onPress={markCurrentStepTried}
            disabled={choiceRequired && !hasRequiredChoice}
            accessibilityState={{
              disabled: choiceRequired && !hasRequiredChoice,
            }}
            className={`w-full rounded-3xl px-5 py-4 shadow-sm ${
              choiceRequired && !hasRequiredChoice
                ? "bg-gray-300"
                : "bg-green-600"
            }`}
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
              {choiceRequired && !hasRequiredChoice
                ? isEnvironmentStep
                  ? "Choose a location"
                  : "Choose an action"
                : "Complete step"}
            </Text>
          </Pressable>

          <Pressable
            onPress={finishHelp}
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
            <Text className="text-center text-lg font-black text-black">
              {isHelpFirst ? "Log this urge" : "Finish help"}
            </Text>
          </Pressable>
        </View>
      ) : mode === "log_choice" ? (
        <View className="pb-8 pt-4">
          <Pressable
            onPress={updateRecentLogAndExit}
            disabled={savingAction}
            className={`w-full rounded-3xl px-5 py-4 shadow-sm ${
              savingAction ? "bg-green-400" : "bg-green-600"
            }`}
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
              Update recent log
            </Text>
          </Pressable>

          <Pressable
            onPress={openFullLog}
            disabled={savingAction}
            className="mt-3 w-full rounded-3xl border border-gray-200 bg-white px-5 py-4 shadow-sm"
            style={({ pressed }) => ({
              transform: [{ translateY: pressed ? 1 : 0 }],
            })}
          >
            <Text className="text-center text-lg font-black text-black">
              Create a new log
            </Text>
          </Pressable>
        </View>
      ) : (
        <View className="pb-4 pt-2">
          {isFirstGuidedStep ? (
            <>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onPrimary();
                }}
                disabled={choiceRequired && !hasRequiredChoice}
                className={`w-full rounded-3xl px-4 py-3.5 shadow-sm ${
                  choiceRequired && !hasRequiredChoice
                    ? "bg-gray-300"
                    : "bg-green-600"
                }`}
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
                    size={21}
                    color="#FFFFFF"
                  />
                  <Text className="ml-2 text-center text-[17px] font-black text-white">
                    {primaryLabel}
                  </Text>
                </View>
              </Pressable>

              {showGuidedSkip ? (
                <Pressable
                  key="first-guided-skip"
                  onPress={skipCurrentStep}
                  className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-2"
                  style={({ pressed }) => ({
                    transform: [{ translateY: pressed ? 1 : 0 }],
                  })}
                >
                  <Text className="text-center text-sm font-black text-gray-700">
                    Skip for now
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <>
              <View className="flex-row items-center gap-2">
                {canGoBack ? (
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onBack();
                    }}
                    className="flex-1 rounded-3xl border border-gray-200 bg-white px-4 py-3.5 shadow-sm"
                    style={({ pressed }) => ({
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: pressed ? 1 : 4 },
                      shadowOpacity: 0.12,
                      shadowRadius: pressed ? 2 : 4,
                      elevation: pressed ? 2 : 5,
                      transform: [{ translateY: pressed ? 1 : 0 }],
                    })}
                  >
                    <Text className="text-center text-[17px] font-black text-black">
                      Back
                    </Text>
                  </Pressable>
                ) : (
                  <View className="flex-1" />
                )}

                <Pressable
                  onPress={() => {
                    if (showGuidedLogOption) {
                      completeGuidedHelp();
                      return;
                    }
                    if (currentStep.kind === "done") {
                      Haptics.notificationAsync(
                        Haptics.NotificationFeedbackType.Success,
                      );
                    } else {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    onPrimary();
                  }}
                  disabled={choiceRequired && !hasRequiredChoice}
                  className={`flex-1 rounded-3xl px-4 py-3.5 shadow-sm ${
                    choiceRequired && !hasRequiredChoice
                      ? "bg-gray-300"
                      : "bg-green-600"
                  }`}
                  style={({ pressed }) => ({
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: pressed ? 2 : 6 },
                    shadowOpacity: 0.25,
                    shadowRadius: pressed ? 3 : 6,
                    elevation: pressed ? 3 : 8,
                    transform: [{ translateY: pressed ? 2 : 0 }],
                  })}
                >
                  <Text
                    className="text-center text-[17px] font-black text-white"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {primaryLabel}
                  </Text>
                </Pressable>
              </View>

              {showGuidedSkip ? (
                <Pressable
                  key={`guided-skip-${stepIndex}`}
                  onPress={skipCurrentStep}
                  className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-2"
                  style={({ pressed }) => ({
                    transform: [{ translateY: pressed ? 1 : 0 }],
                  })}
                >
                  <Text className="text-center text-sm font-black text-gray-700">
                    Skip for now
                  </Text>
                </Pressable>
              ) : showGuidedLogOption ? (
                <Pressable
                  key="guided-log-option"
                  onPress={finishHelp}
                  className="mt-2 w-full rounded-3xl border border-gray-200 bg-white px-4 py-3.5 shadow-sm"
                  style={({ pressed }) => ({
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: pressed ? 1 : 4 },
                    shadowOpacity: 0.12,
                    shadowRadius: pressed ? 2 : 4,
                    elevation: pressed ? 2 : 5,
                    transform: [{ translateY: pressed ? 1 : 0 }],
                  })}
                >
                  <Text className="text-center text-[17px] font-black text-black">
                    Log this urge
                  </Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      )}
    </Screen>
  );
}
