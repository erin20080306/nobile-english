import { storageService, KEYS } from "@/services/storageService";

// Duck mascot reward images used across all scoring screens:
// 抽考 (pop quiz), 場景對話練習測驗, 單字練習, and exam results.
export const rewardImages = {
  perfect100A: "/assets/rewards/duck-100-a.png",
  perfect100B: "/assets/rewards/duck-100-b.png",
  great: "/assets/rewards/duck-great.png",
  keepGoing: "/assets/rewards/duck-keep-going.png",
  tryHarder: "/assets/rewards/duck-try-harder.png",
};

// 100 分（全對）時，兩張「100分」圖片輪流顯示。
function nextPerfectImage(): string {
  const useB = storageService.get<boolean>(KEYS.perfectScoreToggle, false);
  storageService.set(KEYS.perfectScoreToggle, !useB);
  return useB ? rewardImages.perfect100B : rewardImages.perfect100A;
}

/**
 * 依分數回傳對應的鴨鴨評分圖：
 * 100 分（全對）－ 兩張 100 分圖輪流
 * 80~99 分 － 很棒
 * 60~79 分 － 加油
 * 50 分以下 － 努力一下
 */
export function rewardImageForScore(score: number): string {
  if (score >= 100) return nextPerfectImage();
  if (score >= 80) return rewardImages.great;
  if (score >= 60) return rewardImages.keepGoing;
  return rewardImages.tryHarder;
}
