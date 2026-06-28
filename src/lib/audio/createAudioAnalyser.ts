export type AudioAnalyserSession = {
  audioContext: AudioContext;
  analyser: AnalyserNode;
  source: MediaStreamAudioSourceNode;
  stream: MediaStream;
};

export const DEFAULT_FFT_SIZE = 2048;
export const DEFAULT_SMOOTHING_TIME_CONSTANT = 0.6;
export const DEFAULT_MIN_DECIBELS = -100;
export const DEFAULT_MAX_DECIBELS = -20;

type CreateAudioAnalyserOptions = {
  fftSize?: number;
  smoothingTimeConstant?: number;
  minDecibels?: number;
  maxDecibels?: number;
};

export async function createAudioAnalyser({
  fftSize = DEFAULT_FFT_SIZE,
  smoothingTimeConstant = DEFAULT_SMOOTHING_TIME_CONSTANT,
  minDecibels = DEFAULT_MIN_DECIBELS,
  maxDecibels = DEFAULT_MAX_DECIBELS,
}: CreateAudioAnalyserOptions = {}): Promise<AudioAnalyserSession> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    throw new Error("マイク入力はブラウザでのみ利用できます。");
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("このブラウザはマイク入力に対応していません。");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false,
    },
  });

  const AudioContextConstructor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextConstructor) {
    throw new Error("このブラウザは Web Audio API に対応していません。");
  }

  const audioContext = new AudioContextConstructor();

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  const analyser = audioContext.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = smoothingTimeConstant;
  analyser.minDecibels = minDecibels;
  analyser.maxDecibels = maxDecibels;

  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);

  return {
    audioContext,
    analyser,
    source,
    stream,
  };
}
