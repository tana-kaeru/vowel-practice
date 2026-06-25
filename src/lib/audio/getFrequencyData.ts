import type { FrequencyBin } from "@/types/vowel";

export const DEFAULT_MAX_VISIBLE_FREQUENCY_HZ = 5000;

export function getFrequencyData(
  analyser: AnalyserNode,
  sampleRate: number,
  maxFrequencyHz = DEFAULT_MAX_VISIBLE_FREQUENCY_HZ,
): FrequencyBin[] {
  const values = new Float32Array(analyser.frequencyBinCount);
  analyser.getFloatFrequencyData(values);

  const binWidth = sampleRate / analyser.fftSize;
  const maxIndex = Math.min(values.length, Math.floor(maxFrequencyHz / binWidth));
  const bins: FrequencyBin[] = [];
  const decibelRange = analyser.maxDecibels - analyser.minDecibels;

  for (let index = 0; index < maxIndex; index += 1) {
    const decibels = Number.isFinite(values[index])
      ? values[index]
      : analyser.minDecibels;
    const level =
      decibelRange > 0
        ? (decibels - analyser.minDecibels) / decibelRange
        : 0;

    bins.push({
      frequencyHz: Math.round(index * binWidth),
      decibels,
      level: Math.max(0, Math.min(1, level)),
    });
  }

  return bins;
}
