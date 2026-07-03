-- Temporary PayPal payment records for pre-App-Store subscription testing.
-- App unlock still reads the existing subscription status contract.

alter type subscription_platform add value if not exists 'paypal';

create table if not exists paypal_subscription_payments (
  id uuid primary key default gen_random_uuid(),
  paypal_event_id text not null unique,
  paypal_resource_id text,
  paypal_capture_id text,
  paypal_order_id text,
  user_id text,
  user_email text,
  payer_email text,
  payer_name text,
  product_id text not null,
  plan_period text not null check (plan_period in ('monthly', 'yearly')),
  amount_twd integer not null,
  currency text not null default 'TWD',
  status subscription_status not null default 'active',
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  raw_event jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists paypal_subscription_payments_user_id_idx
  on paypal_subscription_payments (user_id)
  where user_id is not null;

create index if not exists paypal_subscription_payments_user_email_idx
  on paypal_subscription_payments (lower(user_email))
  where user_email is not null;

create index if not exists paypal_subscription_payments_payer_email_idx
  on paypal_subscription_payments (lower(payer_email))
  where payer_email is not null;

create index if not exists paypal_subscription_payments_active_idx
  on paypal_subscription_payments (status, expires_at)
  where status = 'active';

create index if not exists paypal_subscription_payments_capture_idx
  on paypal_subscription_payments (paypal_capture_id)
  where paypal_capture_id is not null;

create or replace function update_paypal_subscription_payments_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists paypal_subscription_payments_updated_at on paypal_subscription_payments;
create trigger paypal_subscription_payments_updated_at
  before update on paypal_subscription_payments
  for each row execute function update_paypal_subscription_payments_updated_at();

alter table paypal_subscription_payments enable row level security;

drop policy if exists paypal_subscription_payments_service_role on paypal_subscription_payments;
create policy paypal_subscription_payments_service_role
  on paypal_subscription_payments
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

grant all on paypal_subscription_payments to service_role;

create table if not exists app_user_sessions (
  user_id text primary key,
  email text not null,
  name text,
  provider text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  raw_user jsonb not null default '{}'::jsonb
);

create index if not exists app_user_sessions_email_idx
  on app_user_sessions (lower(email));

create index if not exists app_user_sessions_last_seen_idx
  on app_user_sessions (last_seen_at desc);

alter table app_user_sessions enable row level security;

drop policy if exists app_user_sessions_service_role on app_user_sessions;
create policy app_user_sessions_service_role
  on app_user_sessions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

grant all on app_user_sessions to service_role;
