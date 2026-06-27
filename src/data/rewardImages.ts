export const rewardImages = {
  excellent: "/assets/rewards/07BC4F18-27ED-4E00-9525-3E20CA3E1004.png",
  veryGood: "/assets/rewards/0321EB45-76C3-4D8C-90A0-9FF248BF705E.png",
  good: "/assets/rewards/C887C3E4-25B4-46D2-B3F9-9A6CD2F29F4C.png",
  letsGo: "/assets/rewards/910BFBAB-4830-4833-9F89-C8168681206F.png",
  keepGoing: "/assets/rewards/9FDB7250-CD4F-4008-9187-6B1B644CB90D.png",
  almost: "/assets/rewards/10206450-C606-4FF7-8874-8C36F0C01317.png",
  great: "/assets/rewards/8D517E3D-DD80-4703-B598-F1381D24E2BD.png",
};

export function rewardImageForScore(score: number) {
  if (score >= 98) return rewardImages.excellent;
  if (score >= 90) return rewardImages.veryGood;
  if (score >= 82) return rewardImages.great;
  if (score >= 72) return rewardImages.good;
  if (score >= 60) return rewardImages.letsGo;
  if (score >= 45) return rewardImages.keepGoing;
  return rewardImages.almost;
}
