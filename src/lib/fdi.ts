// FDI two-digit tooth notation (permanent dentition): first digit = quadrant (1 upper right,
// 2 upper left, 3 lower left, 4 lower right, from the PATIENT's view), second = tooth 1 (central
// incisor) … 8 (third molar). Pure functions, unit-tested in tests/unit/fdi.test.ts.

/** Upper arch as the dentist faces the patient: patient's right (18) on the left of the screen. */
export const UPPER_ARCH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28] as const;
/** Lower arch, same orientation: 48 on the left, 38 on the right. */
export const LOWER_ARCH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38] as const;
export const ALL_TEETH: readonly number[] = [...UPPER_ARCH, ...LOWER_ARCH];

export type ToothType = "incisor" | "canine" | "premolar" | "molar";

export function isFdiTooth(n: unknown): n is number {
  if (typeof n !== "number" || !Number.isInteger(n)) return false;
  const quadrant = Math.floor(n / 10);
  const tooth = n % 10;
  return quadrant >= 1 && quadrant <= 4 && tooth >= 1 && tooth <= 8;
}

export const quadrantOf = (n: number) => Math.floor(n / 10);
export const archOf = (n: number): "upper" | "lower" => (quadrantOf(n) <= 2 ? "upper" : "lower");

export function toothType(n: number): ToothType {
  const t = n % 10;
  if (t <= 2) return "incisor";
  if (t === 3) return "canine";
  if (t <= 5) return "premolar";
  return "molar";
}

/** Chart order: upper arch left→right, then lower arch left→right. */
export function sortTeeth(teeth: readonly number[]) {
  return [...teeth].sort((a, b) => ALL_TEETH.indexOf(a) - ALL_TEETH.indexOf(b));
}

/** Selecting a tooth adds it; selecting it again removes it. Invalid numbers are ignored. */
export function toggleTooth(selected: readonly number[], tooth: number) {
  if (!isFdiTooth(tooth)) return sortTeeth(selected);
  return selected.includes(tooth)
    ? sortTeeth(selected.filter((t) => t !== tooth))
    : sortTeeth([...new Set([...selected, tooth])]);
}

export type ArrowKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Home" | "End";

/**
 * Keyboard navigation on the chart (roving focus): ←/→ move along the arch (stopping at its ends),
 * ↑/↓ jump to the opposite arch at the same position, Home/End go to the arch's ends.
 */
export function nextTooth(current: number, key: ArrowKey): number {
  const arch: readonly number[] = archOf(current) === "upper" ? UPPER_ARCH : LOWER_ARCH;
  const other: readonly number[] = arch === UPPER_ARCH ? LOWER_ARCH : UPPER_ARCH;
  const i = arch.indexOf(current);
  switch (key) {
    case "ArrowLeft":
      return arch[Math.max(0, i - 1)];
    case "ArrowRight":
      return arch[Math.min(arch.length - 1, i + 1)];
    case "ArrowUp":
    case "ArrowDown":
      return (key === "ArrowUp") === (arch === LOWER_ARCH) ? other[i] : current;
    case "Home":
      return arch[0];
    case "End":
      return arch[arch.length - 1];
  }
}
