create extension if not exists pgcrypto;

create table if not exists public.manual_payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  user_email text not null,
  plan_period text not null check (plan_period in ('monthly', 'yearly')),
  product_id text not null,
  amount_twd integer not null check (amount_twd > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  promo_code text,
  bank_account text not null default '901560071034',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  review_note text
);

create unique index if not exists manual_payment_requests_one_pending_per_user
  on public.manual_payment_requests (user_id)
  where status = 'pending';

create index if not exists manual_payment_requests_status_created_idx
  on public.manual_payment_requests (status, created_at desc);

create table if not exists public.manual_subscription_records (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.manual_payment_requests(id) on delete set null,
  user_id text not null,
  user_email text not null,
  action text not null default 'activate' check (action in ('activate', 'extend', 'approve_payment')),
  plan_period text not null check (plan_period in ('monthly', 'yearly', 'custom')),
  product_id text not null,
  amount_twd integer not null default 0 check (amount_twd >= 0),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  source text not null default 'admin_manual' check (source in ('admin_manual', 'bank_transfer_request')),
  admin_email text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists manual_subscription_records_user_idx
  on public.manual_subscription_records (user_email, created_at desc);

create index if not exists manual_subscription_records_expires_idx
  on public.manual_subscription_records (expires_at desc);

alter table public.manual_payment_requests enable row level security;
alter table public.manual_subscription_records enable row level security;

comment on table public.manual_payment_requests is 'Bank transfer notifications submitted by users for administrator review.';
comment on table public.manual_subscription_records is 'Audit log for subscriptions manually activated or approved by an administrator.';
