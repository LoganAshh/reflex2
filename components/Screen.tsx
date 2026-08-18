import type { ReactNode, Ref } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewProps,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

type ScreenProps = {
  children: ReactNode;
  className?: string;
  edges?: Edge[];
  keyboardAvoiding?: boolean;
  keyboardVerticalOffset?: number;
  scroll?: boolean;
  scrollViewRef?: Ref<ScrollView>;
  scrollViewProps?: Omit<ScrollViewProps, "children">;
};

const DEFAULT_EDGES: Edge[] = ["left", "right"];

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function Screen({
  children,
  className,
  edges = DEFAULT_EDGES,
  keyboardAvoiding = false,
  keyboardVerticalOffset = 0,
  scroll = false,
  scrollViewRef,
  scrollViewProps,
}: ScreenProps) {
  const content = scroll ? (
    <ScrollView
      {...scrollViewProps}
      ref={scrollViewRef}
      className={joinClassNames("flex-1", scrollViewProps?.className)}
    >
      {children}
    </ScrollView>
  ) : (
    children
  );

  const screen = (
    <SafeAreaView
      edges={edges}
      className={joinClassNames("flex-1 bg-white", className)}
    >
      {content}
    </SafeAreaView>
  );

  if (!keyboardAvoiding) return screen;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={keyboardVerticalOffset}
      className="flex-1 bg-white"
    >
      {screen}
    </KeyboardAvoidingView>
  );
}
