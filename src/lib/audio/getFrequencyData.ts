import type { FrequencyBin } from "@/types/vowel";

export function getFrequencyData(
  analyser: AnalyserNode,
  sampleRate: number,
  maxFrequencyHz = 4000,
): FrequencyBin[] {
  const values = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(values);

  const binWidth = sampleRate / analyser.fftSize;
  const maxIndex = Math.min(values.length, Math.floor(maxFrequencyHz / binWidth));
  const step = Math.max(1, Math.floor(maxIndex / 96));
  const bins: FrequencyBin[] = [];

  for (let index = 0; index < maxIndex; index += step) {
    bins.push({
      frequencyHz: Math.round(index * binWidth),
      level: values[index] / 255,
    });
  }

  return bins;
}
