import { createContext, useContext, type MutableRefObject } from "react";

export type HelpExitGuard = (proceed: () => void) => boolean;

export const HelpExitGuardContext =
  createContext<MutableRefObject<HelpExitGuard | null> | null>(null);

export function useHelpExitGuard() {
  return useContext(HelpExitGuardContext);
}
