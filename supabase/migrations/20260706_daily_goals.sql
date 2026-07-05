-- Daily practice goals: learner picks how many word review / scene practice /
-- dialogue practice sessions they want to do each day. Progress for "today"
-- and a recap of "yesterday" are shown in a dismissible dashboard card.

create table if not exists daily_goals (
  user_id text not null,
  date date not null,
  word_review_target integer not null default 0,
  scene_target integer not null default 0,
  dialogue_target integer not null default 0,
  word_review_count integer not null default 0,
  scene_count integer not null default 0,
  dialogue_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

create index if not exists daily_goals_user_date_idx
  on daily_goals (user_id, date desc);

drop trigger if exists daily_goals_set_updated_at on daily_goals;
create trigger daily_goals_set_updated_at
  before update on daily_goals
  for each row execute function set_updated_at();

alter table daily_goals enable row level security;

drop policy if exists "Users can read their own daily goals" on daily_goals;
create policy "Users can read their own daily goals" on daily_goals
  for select using (auth.uid()::text = user_id);

drop policy if exists "Users can insert their own daily goals" on daily_goals;
create policy "Users can insert their own daily goals" on daily_goals
  for insert with check (auth.uid()::text = user_id);

drop policy if exists "Users can update their own daily goals" on daily_goals;
create policy "Users can update their own daily goals" on daily_goals
  for update using (auth.uid()::text = user_id);

grant select, insert, update on daily_goals to authenticated;
grant all on daily_goals to service_role;
