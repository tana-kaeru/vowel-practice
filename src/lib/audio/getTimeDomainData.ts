export function getTimeDomainData(analyser: AnalyserNode): Uint8Array {
  const values = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(values);
  return values;
}
