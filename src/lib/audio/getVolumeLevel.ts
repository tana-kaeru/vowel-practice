export function getVolumeLevel(timeDomainData: Uint8Array): number {
  if (timeDomainData.length === 0) {
    return 0;
  }

  const sumSquares = timeDomainData.reduce((sum, value) => {
    const centered = (value - 128) / 128;
    return sum + centered * centered;
  }, 0);

  return Math.min(1, Math.sqrt(sumSquares / timeDomainData.length) * 3);
}
