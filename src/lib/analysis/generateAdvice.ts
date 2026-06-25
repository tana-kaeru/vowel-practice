import type { AdviceMessage, AnalysisFrame } from "@/types/vowel";
import { getVowelTarget } from "@/lib/data/vowelTargets";

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
        "母音を選んで発声",
        "マイクを開始して、選んだ母音を1から2秒ほど同じ強さで伸ばしてみてください。",
      ),
    ];
  }

  const selectedTarget = getVowelTarget(frame.selectedVowel);
  const nearestTarget = frame.classification
    ? getVowelTarget(frame.classification.nearestVowel)
    : null;
  const advice: AdviceMessage[] = [];

  if (frame.volume < 0.12) {
    advice.push(
      createAdvice(
        "volume-low",
        "warning",
        "もう少し声を乗せる",
        "入力音量が少し小さめです。無理のない範囲で、マイクに近づくか声を少し安定させてみてください。",
      ),
    );
  } else {
    advice.push(
      createAdvice(
        "volume-good",
        "success",
        "声はしっかり出ています",
        "このくらいの音量を保てると、母音マップ上の動きが見やすくなります。",
      ),
    );
  }

  if (!frame.formants || !frame.classification || !selectedTarget) {
    advice.push(
      createAdvice(
        "no-formants",
        "info",
        "推定を待っています",
        "短い音や周囲の音が多い場合は推定が出にくいことがあります。母音を少し長めに伸ばしてみてください。",
      ),
    );
    return advice;
  }

  if (frame.classification.isInsideTargetRange) {
    advice.push(
      createAdvice(
        "inside-target",
        "success",
        "目標エリアに入っています",
        `今の推定値は「${selectedTarget.label}」の目標範囲に入っています。口の形と響きをそのまま保ってみましょう。`,
      ),
    );
  } else {
    if (frame.classification.f1Diff < -80) {
      advice.push(
        createAdvice(
          "f1-low",
          "info",
          "口の開きを少し足す",
          `もう少し口を大きく開けると「${selectedTarget.label}」に近づく可能性があります。`,
        ),
      );
    }

    if (frame.classification.f1Diff > 80) {
      advice.push(
        createAdvice(
          "f1-high",
          "info",
          "口の開きを少し抑える",
          "口が開きすぎている可能性があります。力を抜いて、少しだけ開きを小さくしてみてください。",
        ),
      );
    }

    if (frame.classification.f2Diff < -160) {
      advice.push(
        createAdvice(
          "f2-low",
          "info",
          "響きを少し前へ",
          "響きが奥寄りになっている可能性があります。舌先や唇の力を抜きながら、少し前寄りの響きを試してみてください。",
        ),
      );
    }

    if (frame.classification.f2Diff > 160) {
      advice.push(
        createAdvice(
          "f2-high",
          "info",
          "前寄りになりすぎないように",
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
        "warning",
        `少し「${nearestTarget.label}」に近い響きです`,
        `現在の推定位置は「${selectedTarget.label}」より「${nearestTarget.label}」の中心に近く出ています。母音マップ上の対象エリアへゆっくり寄せてみてください。`,
      ),
    );
  }

  if (frame.stability.score < 0.42) {
    advice.push(
      createAdvice(
        "stability-low",
        "info",
        "ゆっくり一定に伸ばす",
        "推定位置の揺れが少し大きめです。息の量と口の形を急に変えず、同じ母音を保ってみてください。",
      ),
    );
  }

  return advice;
}
