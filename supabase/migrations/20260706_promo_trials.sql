-- Promo-code based limited trials.
--
-- qwe931016@ grants a 30-day trial to at most 2 distinct users. It is not a
-- full paid subscription: feature usage is capped per account, per feature,
-- per Taipei calendar day, so deleting and reinstalling the app cannot reset
-- the daily allowance.

create extension if not exists pgcrypto;

create table if not exists promo_trial_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code text not null,
  user_id text not null,
  user_email text,
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  trial_days integer not null default 30,
  max_feature_uses integer not null default 20,
  redeemed_slot integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (promo_code, user_id),
  unique (promo_code, redeemed_slot)
);

create index if not exists promo_trial_redemptions_user_idx
  on promo_trial_redemptions (user_id);

create index if not exists promo_trial_redemptions_active_idx
  on promo_trial_redemptions (promo_code, status, expires_at)
  where status = 'active';

create table if not exists promo_trial_feature_usage (
  id uuid primary key default gen_random_uuid(),
  promo_code text not null,
  user_id text not null,
  feature_key text not null,
  usage_date date not null default ((now() at time zone 'Asia/Taipei')::date),
  used_count integer not null default 0 check (used_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table promo_trial_feature_usage
  add column if not exists usage_date date;

update promo_trial_feature_usage
set usage_date = ((created_at at time zone 'Asia/Taipei')::date)
where usage_date is null;

alter table promo_trial_feature_usage
  alter column usage_date set default ((now() at time zone 'Asia/Taipei')::date),
  alter column usage_date set not null;

alter table promo_trial_feature_usage
  drop constraint if exists promo_trial_feature_usage_promo_code_user_id_feature_key_key;

create unique index if not exists promo_trial_feature_usage_daily_key
  on promo_trial_feature_usage (promo_code, user_id, feature_key, usage_date);

create index if not exists promo_trial_feature_usage_user_idx
  on promo_trial_feature_usage (user_id);

create index if not exists promo_trial_feature_usage_daily_lookup_idx
  on promo_trial_feature_usage (promo_code, user_id, usage_date);

create or replace function update_promo_trial_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists promo_trial_redemptions_updated_at on promo_trial_redemptions;
create trigger promo_trial_redemptions_updated_at
  before update on promo_trial_redemptions
  for each row execute function update_promo_trial_updated_at();

drop trigger if exists promo_trial_feature_usage_updated_at on promo_trial_feature_usage;
create trigger promo_trial_feature_usage_updated_at
  before update on promo_trial_feature_usage
  for each row execute function update_promo_trial_updated_at();

alter table promo_trial_redemptions enable row level security;
alter table promo_trial_feature_usage enable row level security;

drop policy if exists promo_trial_redemptions_service_role on promo_trial_redemptions;
create policy promo_trial_redemptions_service_role
  on promo_trial_redemptions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists promo_trial_feature_usage_service_role on promo_trial_feature_usage;
create policy promo_trial_feature_usage_service_role
  on promo_trial_feature_usage
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

grant all on promo_trial_redemptions to service_role;
grant all on promo_trial_feature_usage to service_role;

create or replace function redeem_promo_trial(
  p_promo_code text,
  p_user_id text,
  p_user_email text default null,
  p_trial_days integer default 30,
  p_max_users integer default 2,
  p_max_feature_uses integer default 20
)
returns table (
  ok boolean,
  error_code text,
  starts_at timestamptz,
  expires_at timestamptz,
  redeemed_slot integer,
  max_feature_uses integer
) as $$
declare
  v_code text := lower(trim(p_promo_code));
  v_user_id text := trim(p_user_id);
  v_email text := nullif(lower(trim(coalesce(p_user_email, ''))), '');
  v_existing promo_trial_redemptions%rowtype;
  v_count integer;
  v_slot integer;
  v_starts_at timestamptz;
  v_expires_at timestamptz;
begin
  if v_code = '' or v_user_id = '' then
    return query select false, 'INVALID_REQUEST', null::timestamptz, null::timestamptz, null::integer, p_max_feature_uses;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('promo_trial:' || v_code));

  select * into v_existing
  from promo_trial_redemptions
  where promo_code = v_code and user_id = v_user_id
  limit 1;

  if found then
    if v_existing.status = 'active' and v_existing.expires_at > now() then
      return query select true, null::text, v_existing.starts_at, v_existing.expires_at, v_existing.redeemed_slot, v_existing.max_feature_uses;
      return;
    end if;

    return query select false, 'ALREADY_REDEEMED_EXPIRED', v_existing.starts_at, v_existing.expires_at, v_existing.redeemed_slot, v_existing.max_feature_uses;
    return;
  end if;

  select count(*) into v_count
  from promo_trial_redemptions
  where promo_code = v_code;

  if v_count >= p_max_users then
    return query select false, 'PROMO_LIMIT_REACHED', null::timestamptz, null::timestamptz, null::integer, p_max_feature_uses;
    return;
  end if;

  v_slot := v_count + 1;
  v_starts_at := now();
  v_expires_at := v_starts_at + make_interval(days => p_trial_days);

  insert into promo_trial_redemptions (
    promo_code,
    user_id,
    user_email,
    status,
    starts_at,
    expires_at,
    trial_days,
    max_feature_uses,
    redeemed_slot
  ) values (
    v_code,
    v_user_id,
    v_email,
    'active',
    v_starts_at,
    v_expires_at,
    p_trial_days,
    p_max_feature_uses,
    v_slot
  );

  return query select true, null::text, v_starts_at, v_expires_at, v_slot, p_max_feature_uses;
end;
$$ language plpgsql security definer;

drop function if exists use_promo_trial_feature(text, text, text, integer);

create or replace function use_promo_trial_feature(
  p_promo_code text,
  p_user_id text,
  p_feature_key text,
  p_max_feature_uses integer default 20
)
returns table (
  ok boolean,
  error_code text,
  used_count integer,
  remaining_count integer,
  usage_date date
) as $$
declare
  v_code text := lower(trim(p_promo_code));
  v_user_id text := trim(p_user_id);
  v_feature text := trim(p_feature_key);
  v_redemption promo_trial_redemptions%rowtype;
  v_used integer;
  v_usage_date date := (now() at time zone 'Asia/Taipei')::date;
begin
  if v_code = '' or v_user_id = '' or v_feature = '' then
    return query select false, 'INVALID_REQUEST', 0, 0, v_usage_date;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('promo_trial_usage:' || v_code || ':' || v_user_id || ':' || v_feature));

  select * into v_redemption
  from promo_trial_redemptions
  where promo_code = v_code
    and user_id = v_user_id
    and status = 'active'
  limit 1;

  if not found then
    return query select false, 'PROMO_NOT_REDEEMED', 0, 0, v_usage_date;
    return;
  end if;

  if v_redemption.expires_at <= now() then
    update promo_trial_redemptions
    set status = 'expired'
    where id = v_redemption.id;

    return query select false, 'PROMO_EXPIRED', 0, 0, v_usage_date;
    return;
  end if;

  select used_count into v_used
  from promo_trial_feature_usage
  where promo_code = v_code
    and user_id = v_user_id
    and feature_key = v_feature
    and usage_date = v_usage_date
  limit 1;

  v_used := coalesce(v_used, 0);
  if v_used >= p_max_feature_uses then
    return query select false, 'FEATURE_LIMIT_REACHED', v_used, 0, v_usage_date;
    return;
  end if;

  v_used := v_used + 1;

  insert into promo_trial_feature_usage (
    promo_code,
    user_id,
    feature_key,
    usage_date,
    used_count
  ) values (
    v_code,
    v_user_id,
    v_feature,
    v_usage_date,
    v_used
  )
  on conflict (promo_code, user_id, feature_key, usage_date)
  do update set
    used_count = excluded.used_count,
    updated_at = now();

  return query select true, null::text, v_used, greatest(0, p_max_feature_uses - v_used), v_usage_date;
end;
$$ language plpgsql security definer;
