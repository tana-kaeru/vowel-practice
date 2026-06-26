import type { AdviceMessage, AnalysisFrame } from "@/types/vowel";
import { getVowelTarget } from "@/lib/data/vowelTargets";
import { VOLUME_THRESHOLDS } from "@/lib/analysis/stabilizeFormants";

function createAdvice(
  id: string,
  level: AdviceMessage["level"],
  title: string,
  body: string,
): AdviceMessage {
  return {
    id,
    level,
    title,
    body,
  };
}

export function generateAdvice(frame: AnalysisFrame | null): AdviceMessage[] {
  if (!frame) {
    return [
      createAdvice(
        "start",
        "info",
        "準備ができています",
        "母音を選び、マイクを開始すると声の特徴を表示します。",
      ),
      createAdvice(
        "start-next",
        "info",
        "次に試すこと",
        "選んだ母音を1から2秒ほど同じ強さで伸ばしてみてください。",
      ),
    ];
  }

  if (frame.status === "calibrating_noise") {
    return [
      createAdvice(
        "calibrating-good",
        "info",
        "マイクを準備しています",
        "入力は取得できています。環境音の基準を短く測定しています。",
      ),
      createAdvice(
        "calibrating-next",
        "info",
        "次に試すこと",
        "測定が終わったら、選んだ母音を自然な声量で伸ばしてみてください。",
      ),
    ];
  }

  if (frame.status === "no_voice") {
    return [
      createAdvice(
        "no-voice-good",
        "info",
        "マイクは待機しています",
        "環境音に近い入力として見ています。発声すると母音マップに軌跡が残ります。",
      ),
      createAdvice(
        "no-voice-next",
        "info",
        "次に試すこと",
        "選んだ母音を少し長めに伸ばしてみてください。Bluetoothマイクでは感度を高めると安定する場合があります。",
      ),
    ];
  }

  if (frame.status === "too_quiet") {
    return [
      createAdvice(
        "volume-detected",
        "info",
        "声は拾えています",
        "マイクに入る音量が少し控えめですが、入力は検出できています。",
      ),
      createAdvice(
        "volume-next",
        "info",
        "次に試すこと",
        "マイク感度を「高」または「最大」にするか、もう少しだけはっきり発音してみてください。",
      ),
    ];
  }

  const selectedTarget = getVowelTarget(frame.selectedVowel);
  const nearestTarget = frame.classification
    ? getVowelTarget(frame.classification.nearestVowel)
    : null;
  const advice: AdviceMessage[] = [];

  if (frame.isReferenceResult) {
    advice.push(
      createAdvice(
        "reference-result",
        "info",
        "短めの発声から推定しています",
        "1回分の発声軌跡から代表値を出しています。今回は参考ヒントとして見てください。",
      ),
    );
  } else if (frame.effectiveRms >= VOLUME_THRESHOLDS.good) {
    advice.push(
      createAdvice(
        "volume-good",
        "success",
        "声はしっかり拾えています",
        "音量は十分です。このまま口の形を保って母音を伸ばしてみましょう。",
      ),
    );
  } else {
    advice.push(
      createAdvice(
        "voice-detected",
        "info",
        "声は拾えています",
        "もう少しだけ長く伸ばすと、母音の位置が安定しやすくなります。",
      ),
    );
  }

  if (!frame.formants || !frame.classification || !selectedTarget) {
    advice.push(
      createAdvice(
        "listening-next",
        "info",
        "次に試すこと",
        "母音を少し長く伸ばしてみてください。F1/F2が取れると、口の開きや響きの方向を表示します。",
      ),
    );
    return advice.slice(0, 2);
  }

  if (frame.classification.isInsideTargetRange) {
    advice.push(
      createAdvice(
        "inside-target",
        "success",
        "次に試すこと",
        `今の推定値は「${selectedTarget.label}」の目標範囲に入っています。口の形と響きをそのまま保ってみましょう。`,
      ),
    );
  } else {
    if (frame.classification.f1Diff < -80) {
      advice.push(
        createAdvice(
          "f1-low",
          "info",
          "次に試すこと",
          `もう少し口を大きく開けると「${selectedTarget.label}」に近づく可能性があります。`,
        ),
      );
    }

    if (frame.classification.f1Diff > 80) {
      advice.push(
        createAdvice(
          "f1-high",
          "info",
          "次に試すこと",
          "口が開きすぎている可能性があります。力を抜いて、少しだけ開きを小さくしてみてください。",
        ),
      );
    }

    if (frame.classification.f2Diff < -160) {
      advice.push(
        createAdvice(
          "f2-low",
          "info",
          "次に試すこと",
          "響きが奥寄りになっている可能性があります。舌先や唇の力を抜きながら、少し前寄りの響きを試してみてください。",
        ),
      );
    }

    if (frame.classification.f2Diff > 160) {
      advice.push(
        createAdvice(
          "f2-high",
          "info",
          "次に試すこと",
          "響きが前寄りになっている可能性があります。口を横に引きすぎないように意識してみてください。",
        ),
      );
    }
  }

  if (
    nearestTarget &&
    frame.classification.nearestVowel !== frame.classification.selectedVowel
  ) {
    advice.push(
      createAdvice(
        "nearest-vowel",
        "info",
        "参考ヒント",
        `少し「${nearestTarget.label}」に近い響きが出ています。母音マップ上の対象エリアへゆっくり寄せてみてください。`,
      ),
    );
  }

  if (advice.length < 2 && frame.stability.score < 0.42) {
    advice.push(
      createAdvice(
        "stability-low",
        "info",
        "次に試すこと",
        "次は少し口の形を保って発声してみましょう。母音マップの点がまとまりやすくなります。",
      ),
    );
  }

  if (advice.length < 2) {
    advice.push(
      createAdvice(
        "keep-going",
        "info",
        "次に試すこと",
        "同じ母音をもう一度伸ばして、軌跡が目標エリアに近づくか見てみましょう。",
      ),
    );
  }

  return advice.slice(0, 2);
}
