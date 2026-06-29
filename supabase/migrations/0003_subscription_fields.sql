-- Add subscription fields to profiles table for RevenueCat integration
-- This migration adds columns to track subscription status, platform, and entitlements

do $$ begin
  create type subscription_platform as enum ('ios', 'android', 'web', 'stripe');
  create type subscription_status as enum ('active', 'expired', 'cancelled', 'pending', 'grace_period', 'refunded');
exception when duplicate_object then null; end $$;

alter table profiles
  add column if not exists subscription_platform subscription_platform,
  add column if not exists subscription_status subscription_status,
  add column if not exists subscription_product_id text,
  add column if not exists subscription_expires_at timestamptz,
  add column if not exists subscription_entitlement text,
  add column if not exists revenuecat_app_user_id text,
  add column if not exists subscription_updated_at timestamptz default now();

-- Index for fast lookups by revenuecat_app_user_id
create index if not exists profiles_revenuecat_user_idx
  on profiles (revenuecat_app_user_id)
  where revenuecat_app_user_id is not null;

-- Index for active subscriptions
create index if not exists profiles_active_subscription_idx
  on profiles (subscription_status, subscription_expires_at)
  where subscription_status = 'active';

-- Function to update subscription_updated_at
create or replace function update_subscription_updated_at()
returns trigger as $$
begin
  new.subscription_updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to auto-update subscription_updated_at
drop trigger if exists profiles_subscription_updated_at on profiles;
create trigger profiles_subscription_updated_at
  before update of subscription_platform, subscription_status, subscription_product_id, subscription_expires_at, subscription_entitlement, revenuecat_app_user_id
  on profiles
  for each row execute function update_subscription_updated_at();
