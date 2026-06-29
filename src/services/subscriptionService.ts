import type {
  SubscriptionOffering,
  PurchaseResult,
  RestoreResult,
  CustomerInfo,
  PremiumEntitlement,
} from "@/types/subscription";

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
    // In native app, this will call RevenueCat
    // For web, return inactive
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
};
