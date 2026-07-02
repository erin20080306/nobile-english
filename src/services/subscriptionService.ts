import type {
  SubscriptionOffering,
  PurchaseResult,
  RestoreResult,
  CustomerInfo,
  PremiumEntitlement,
} from "@/types/subscription";
import { authService } from "./authService";

const REVENUECAT_PUBLIC_API_KEY = process.env.NEXT_PUBLIC_REVENUECAT_PUBLIC_API_KEY || "";

// Fallback offerings for web or when RevenueCat is not configured
const FALLBACK_OFFERINGS: SubscriptionOffering[] = [
  {
    id: "monthly",
    packageId: "mobileenglish_monthly_399",
    productId: "mobileenglish_monthly_399",
    price: 399,
    currency: "TWD",
    period: "monthly",
    description: "月費訂閱",
  },
  {
    id: "yearly",
    packageId: "mobileenglish_yearly_2199",
    productId: "mobileenglish_yearly_2199",
    price: 1290,
    currency: "TWD",
    period: "yearly",
    description: "首年優惠年費",
    isFirstYearOffer: true,
    firstYearPrice: 1290,
  },
];

export const subscriptionService = {
  async configure(userId: string): Promise<void> {
    if (!REVENUECAT_PUBLIC_API_KEY) {
      console.warn("RevenueCat public API key not configured");
      return;
    }
    // RevenueCat will be configured in native app
    // For web, this is a no-op
  },

  async getOfferings(): Promise<SubscriptionOffering[]> {
    return FALLBACK_OFFERINGS;
  },

  async purchase(productId: string): Promise<PurchaseResult> {
    // In native app, this will call RevenueCat
    // For web, return error
    return {
      success: false,
      error: "Web purchases not implemented yet. Please use native app.",
    };
  },

  async restorePurchases(): Promise<RestoreResult> {
    // In native app, this will call RevenueCat
    // For web, return error
    return {
      success: false,
      restoredCount: 0,
      error: "Restore not available on web",
    };
  },

  async getCustomerInfo(): Promise<CustomerInfo | null> {
    // In native app, this will call RevenueCat
    // For web, return null
    return null;
  },

  async getEntitlement(): Promise<PremiumEntitlement> {
    const user = authService.getCurrentUser();
    if (typeof fetch !== "undefined" && user?.id) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const response = await fetch(`/api/subscriptions/status?userId=${encodeURIComponent(user.id)}`, {
          cache: "no-store",
          signal: controller.signal,
        }).finally(() => clearTimeout(timeout));
        if (response.ok) {
          const data = await response.json();
          return {
            isActive: Boolean(data.isActive),
            expiresAt: data.expiresAt || null,
            platform: data.platform || "web",
            productId: data.productId || "",
            willRenew: data.status === "active",
          };
        }
      } catch {
        // Keep web/offline usable. Native RevenueCat can replace this method.
      }
    }

    return {
      isActive: false,
      expiresAt: null,
      platform: "web",
      productId: "",
      willRenew: false,
    };
  },

  async openManageSubscriptions(): Promise<void> {
    // In native app, this will open native subscription management
    // For web, no-op
  },

  /**
   * 檢查是否可以閱讀完整每日文章
   */
  async canReadFullArticle(): Promise<boolean> {
    const entitlement = await this.getEntitlement();
    return entitlement.isActive;
  },

  /**
   * 檢查是否可以播放全文語音
   */
  async canPlayFullAudio(): Promise<boolean> {
    const entitlement = await this.getEntitlement();
    return entitlement.isActive;
  },

  /**
   * 檢查是否可以調整播放速度
   */
  async canAdjustPlaybackSpeed(): Promise<boolean> {
    const entitlement = await this.getEntitlement();
    return entitlement.isActive;
  },

  /**
   * 檢查是否可以使用完整單字卡
   */
  async canUseFullWordCards(): Promise<boolean> {
    const entitlement = await this.getEntitlement();
    return entitlement.isActive;
  },

  /**
   * 檢查是否可以完成閱讀複習
   */
  async canCompleteQuiz(): Promise<boolean> {
    const entitlement = await this.getEntitlement();
    return entitlement.isActive;
  },

  /**
   * 檢查是否可以領取完整農場獎勵
   */
  async canClaimFullRewards(): Promise<boolean> {
    const entitlement = await this.getEntitlement();
    return entitlement.isActive;
  },

  /**
   * 檢查是否可以離線下載
   */
  async canDownloadOffline(): Promise<boolean> {
    const entitlement = await this.getEntitlement();
    return entitlement.isActive;
  },

  /**
   * 檢查是否可以收藏文章
   */
  async canBookmarkArticle(): Promise<boolean> {
    const entitlement = await this.getEntitlement();
    return entitlement.isActive;
  },

  /**
   * 取得免費版限制
   */
  getFreeTierLimits() {
    return {
      // 免費版只能閱讀指定入門文章
      limitedArticleAccess: true,
      // 免費版只能播放有限句子
      limitedAudioPlayback: true,
      maxSentencesPerDay: 3,
      // 免費版只能查看基本單字卡
      limitedWordCards: true,
      // 免費版不能領取完整獎勵
      limitedRewards: true,
      // 免費版不能離線下載
      noOfflineDownload: true,
      // 免費版不能收藏
      noBookmarking: true,
    };
  },
};
