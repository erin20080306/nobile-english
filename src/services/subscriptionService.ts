import type {
  SubscriptionOffering,
  PurchaseResult,
  RestoreResult,
  CustomerInfo,
  PremiumEntitlement,
} from "@/types/subscription";

// Mock implementation for web. Will be replaced with RevenueCat in native app.
const MOCK_OFFERINGS: SubscriptionOffering[] = [
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
    // No-op for web mock
  },

  async getOfferings(): Promise<SubscriptionOffering[]> {
    return MOCK_OFFERINGS;
  },

  async purchase(productId: string): Promise<PurchaseResult> {
    // Mock purchase for web - will redirect to Stripe or similar
    return {
      success: false,
      error: "Web purchases not implemented yet. Please use native app.",
    };
  },

  async restorePurchases(): Promise<RestoreResult> {
    return {
      success: false,
      restoredCount: 0,
      error: "Restore not available on web",
    };
  },

  async getCustomerInfo(): Promise<CustomerInfo | null> {
    return null;
  },

  async getEntitlement(): Promise<PremiumEntitlement> {
    return {
      isActive: false,
      expiresAt: null,
      platform: "web",
      productId: "",
      willRenew: false,
    };
  },

  async openManageSubscriptions(): Promise<void> {
    // No-op for web
  },
};
