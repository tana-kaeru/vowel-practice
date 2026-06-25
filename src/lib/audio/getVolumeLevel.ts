export function getVolumeLevel(timeDomainData: Float32Array): number {
  if (timeDomainData.length === 0) {
    return 0;
  }

  const sumSquares = timeDomainData.reduce((sum, value) => {
    return sum + value * value;
  }, 0);

  return Math.min(1, Math.sqrt(sumSquares / timeDomainData.length) * 4);
}
