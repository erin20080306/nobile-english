export type SubscriptionPlatform = "ios" | "android" | "web" | "stripe" | "paypal";
export type SubscriptionStatus = "active" | "expired" | "cancelled" | "pending" | "grace_period" | "refunded";

export interface SubscriptionOffering {
  id: string;
  packageId: string;
  productId: string;
  price: number;
  currency: string;
  period: "monthly" | "yearly";
  description: string;
  isFirstYearOffer?: boolean;
  firstYearPrice?: number;
}

export interface PurchaseResult {
  success: boolean;
  productId?: string;
  transactionId?: string;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  restoredCount: number;
  error?: string;
}

export interface CustomerInfo {
  entitlements: Record<string, EntitlementInfo>;
  allPurchasedProductIdentifiers: string[];
  activeSubscriptions: string[];
  latestExpirationDate: string | null;
}

export interface EntitlementInfo {
  isActive: boolean;
  periodType: string;
  latestPurchaseDate: string;
  latestExpirationDate: string;
  productIdentifier: string;
  willRenew: boolean;
}

export interface PremiumEntitlement {
  isActive: boolean;
  expiresAt: string | null;
  platform: SubscriptionPlatform;
  productId: string;
  willRenew: boolean;
}

export interface SubscriptionProfile {
  userId: string;
  subscriptionPlatform: SubscriptionPlatform | null;
  subscriptionStatus: SubscriptionStatus | null;
  subscriptionProductId: string | null;
  subscriptionExpiresAt: string | null;
  subscriptionEntitlement: string | null;
  revenuecatAppUserId: string | null;
  updatedAt: string;
}
