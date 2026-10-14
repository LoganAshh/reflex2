export type DurationInputUnit = "minutes" | "hours";

function cleanAmount(value: number) {
  return Math.round(value * 100) / 100;
}

export function durationInputToMinutes(value: number, unit: DurationInputUnit) {
  return unit === "hours" ? value * 60 : value;
}

export function minutesToDurationInput(value: number, unit: DurationInputUnit) {
  return cleanAmount(unit === "hours" ? value / 60 : value);
}

export function convertDurationInput(
  value: string,
  fromUnit: DurationInputUnit,
  toUnit: DurationInputUnit,
) {
  if (fromUnit === toUnit || !value.trim()) return value;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return `${minutesToDurationInput(
    durationInputToMinutes(amount, fromUnit),
    toUnit,
  )}`;
}

export function preferredDurationInput(value: number | null | undefined) {
  const unit: DurationInputUnit =
    value != null && value >= 60 ? "hours" : "minutes";
  return {
    unit,
    value: value == null ? "" : `${minutesToDurationInput(value, unit)}`,
  };
}

export function durationInputLabel(unit: DurationInputUnit, value: string) {
  const singular = Number(value) === 1;
  if (unit === "hours") return singular ? "Hour" : "Hours";
  return singular ? "Minute" : "Minutes";
}
