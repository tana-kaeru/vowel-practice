import type { VowelTarget } from "@/types/vowel";

export const VOWEL_TARGETS: VowelTarget[] = [
  {
    vowel: "あ",
    label: "あ",
    roman: "a",
    f1Range: { min: 650, max: 950 },
    f2Range: { min: 1000, max: 1500 },
    mapPosition: { x: 28, y: 78 },
    colorClass: "bg-rose-500",
    color: "#f43f5e",
  },
  {
    vowel: "い",
    label: "い",
    roman: "i",
    f1Range: { min: 220, max: 420 },
    f2Range: { min: 2100, max: 3000 },
    mapPosition: { x: 82, y: 20 },
    colorClass: "bg-sky-500",
    color: "#0ea5e9",
  },
  {
    vowel: "う",
    label: "う",
    roman: "u",
    f1Range: { min: 250, max: 500 },
    f2Range: { min: 750, max: 1300 },
    mapPosition: { x: 22, y: 28 },
    colorClass: "bg-emerald-500",
    color: "#10b981",
  },
  {
    vowel: "え",
    label: "え",
    roman: "e",
    f1Range: { min: 400, max: 650 },
    f2Range: { min: 1700, max: 2400 },
    mapPosition: { x: 66, y: 48 },
    colorClass: "bg-amber-500",
    color: "#f59e0b",
  },
  {
    vowel: "お",
    label: "お",
    roman: "o",
    f1Range: { min: 400, max: 700 },
    f2Range: { min: 700, max: 1200 },
    mapPosition: { x: 18, y: 55 },
    colorClass: "bg-violet-500",
    color: "#8b5cf6",
  },
];

export function getVowelTarget(vowel: VowelTarget["vowel"]) {
  return VOWEL_TARGETS.find((target) => target.vowel === vowel);
}

export function getRangeCenter(range: { min: number; max: number }) {
  return (range.min + range.max) / 2;
}
