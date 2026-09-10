export const INPUT_LIMITS = {
  profileName: 30,
  habitName: 30,
  cueName: 40,
  locationName: 40,
  replacementAction: 50,
  logNotes: 300,
} as const;

export function managedItemInputLimit(type: "habits" | "cues" | "locations") {
  if (type === "habits") return INPUT_LIMITS.habitName;
  if (type === "cues") return INPUT_LIMITS.cueName;
  return INPUT_LIMITS.locationName;
}
