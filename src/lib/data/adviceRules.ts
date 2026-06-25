import type { AdviceMessage } from "@/types/vowel";

export const BASE_ADVICE: AdviceMessage = {
  id: "base",
  level: "info",
  title: "短く一定に発声",
  body: "選んだ母音を1から2秒ほど同じ強さで伸ばすと、グラフと位置の変化を見やすくなります。",
};

export const LOW_VOLUME_ADVICE: AdviceMessage = {
  id: "low-volume",
  level: "warning",
  title: "入力音量が小さめ",
  body: "マイクに少し近づくか、周囲の音を減らしてからもう一度発声してください。",
};

export const STABLE_ADVICE: AdviceMessage = {
  id: "stable",
  level: "success",
  title: "安定しています",
  body: "音量と推定位置の揺れが小さく、同じ母音を保てています。",
};

export const UNSTABLE_ADVICE: AdviceMessage = {
  id: "unstable",
  level: "warning",
  title: "揺れが大きめ",
  body: "口の形と舌の位置を急に変えず、息の量を一定にして伸ばしてみてください。",
};
