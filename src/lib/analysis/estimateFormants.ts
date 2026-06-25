import type { FormantEstimate, FrequencyBin } from "@/types/vowel";

const MIN_VOLUME_FOR_FORMANTS = 0.08;
const F1_RANGE_HZ = { min: 200, max: 1000 };
const F2_RANGE_HZ = { min: 800, max: 3000 };
const MIN_PEAK_DECIBELS = -82;
const SMOOTHING_RADIUS = 2;

type SmoothedBin = FrequencyBin & {
  smoothedDecibels: number;
};

function smoothFrequencyData(frequencyData: FrequencyBin[]): SmoothedBin[] {
  return frequencyData.map((bin, index) => {
    const start = Math.max(0, index - SMOOTHING_RADIUS);
    const end = Math.min(frequencyData.length - 1, index + SMOOTHING_RADIUS);
    let total = 0;
    let count = 0;

    for (let current = start; current <= end; current += 1) {
      total += frequencyData[current].decibels;
      count += 1;
    }

    return {
      ...bin,
      smoothedDecibels: total / count,
    };
  });
}

function findPeak(
  bins: SmoothedBin[],
  range: { min: number; max: number },
  minFrequencyHz = range.min,
) {
  const candidates = bins.filter(
    (bin) =>
      bin.frequencyHz >= range.min &&
      bin.frequencyHz <= range.max &&
      bin.frequencyHz >= minFrequencyHz &&
      bin.smoothedDecibels >= MIN_PEAK_DECIBELS,
  );

  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((best, bin) =>
    bin.smoothedDecibels > best.smoothedDecibels ? bin : best,
  );
}

export function estimateFormants(
  frequencyData: FrequencyBin[],
  volume: number,
): FormantEstimate | null {
  if (volume < MIN_VOLUME_FOR_FORMANTS || frequencyData.length === 0) {
    return null;
  }

  const smoothedBins = smoothFrequencyData(frequencyData);
  const f1Peak = findPeak(smoothedBins, F1_RANGE_HZ);

  if (!f1Peak) {
    return null;
  }

  const f2Peak =
    findPeak(smoothedBins, F2_RANGE_HZ, f1Peak.frequencyHz + 250) ??
    findPeak(smoothedBins, F2_RANGE_HZ);

  if (!f2Peak) {
    return null;
  }

  const f1Prominence = Math.max(0, f1Peak.smoothedDecibels - MIN_PEAK_DECIBELS);
  const f2Prominence = Math.max(0, f2Peak.smoothedDecibels - MIN_PEAK_DECIBELS);
  const peakConfidence = Math.min(1, (f1Prominence + f2Prominence) / 80);
  const volumeConfidence = Math.min(1, volume / 0.35);

  return {
    f1Hz: f1Peak.frequencyHz,
    f2Hz: f2Peak.frequencyHz,
    confidence: Math.round(peakConfidence * volumeConfidence * 100) / 100,
  };
}
