export function getTimeDomainData(analyser: AnalyserNode): Float32Array {
  const values = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(values);
  return values;
}
