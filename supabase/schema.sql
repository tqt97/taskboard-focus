-- Taskboard Focus schema v2. Configure Auth/RLS before storing private tasks in a public deployment.
create extension if not exists pgcrypto;
create table if not exists public.board_snapshots(
 owner_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null check (jsonb_typeof(data) = 'object'),
 schema_version integer not null default 1,
 updated_at timestamptz not null default now()
);
alter table public.board_snapshots enable row level security;
drop policy if exists board_snapshots_owner_policy on public.board_snapshots;
create policy board_snapshots_owner_policy on public.board_snapshots
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
insert into storage.buckets (id, name, public)
values ('taskboard-attachments', 'taskboard-attachments', true)
on conflict (id) do nothing;
drop policy if exists taskboard_attachment_read on storage.objects;
create policy taskboard_attachment_read on storage.objects
  for select to authenticated
  using (bucket_id = 'taskboard-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists taskboard_attachment_insert on storage.objects;
create policy taskboard_attachment_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'taskboard-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists taskboard_attachment_delete on storage.objects;
create policy taskboard_attachment_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'taskboard-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create table if not exists public.members(
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) default auth.uid(), name text not null check (char_length(name) <= 120), role text not null default '' check (char_length(role) <= 120), color text not null default 'blue' check (color in ('blue', 'violet', 'orange', 'green')), active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.tasks(
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) default auth.uid(), code text not null default '' check (char_length(code) <= 100), title text not null check (char_length(title) <= 500), description text not null default '' check (char_length(description) <= 10000),
 status text not null default 'todo' check(status in ('todo','in_progress','blocked','done')),
 priority text not null default 'medium' check(priority in ('urgent','high','medium','low')),
 severity text not null default 'medium' check(severity in ('critical','high','medium','low')),
 next_action text not null default '' check (char_length(next_action) <= 1000),
 review_note text not null default '' check (char_length(review_note) <= 2000),
 blocked_by jsonb not null default '[]'::jsonb check (jsonb_typeof(blocked_by) = 'array'),
 activity jsonb not null default '[]'::jsonb check (jsonb_typeof(activity) = 'array'),
 primary_links jsonb not null default '[]'::jsonb check (jsonb_typeof(primary_links) = 'array'),
 secondary_links jsonb not null default '[]'::jsonb check (jsonb_typeof(secondary_links) = 'array'),
 -- Deprecated compatibility column. New writes should use task_assignees.
 assignee_id uuid references public.members(id) on delete set null,
 dev_up timestamptz, staging_up timestamptz, release_at timestamptz, deadline timestamptz,
 order_index integer not null default 0, links jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.tasks add column if not exists archived_at timestamptz;
alter table public.tasks add column if not exists recurrence jsonb not null default '{}'::jsonb check (jsonb_typeof(recurrence) = 'object');
alter table public.tasks add column if not exists template_id text;
alter table public.tasks add column if not exists attachments jsonb not null default '[]'::jsonb check (jsonb_typeof(attachments) = 'array');
create index if not exists tasks_archived_at_idx on public.tasks(archived_at);
create or replace function public.set_task_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_task_updated_at();
create index if not exists members_owner_id_idx on public.members(owner_id);
create index if not exists tasks_owner_id_idx on public.tasks(owner_id);
create index if not exists tasks_status_idx on public.tasks(status);
create index if not exists tasks_priority_idx on public.tasks(priority);
create index if not exists tasks_deadline_idx on public.tasks(deadline);
create index if not exists tasks_order_idx on public.tasks(order_index);
create table if not exists public.task_assignees(
 task_id uuid not null references public.tasks(id) on delete cascade,
 member_id uuid not null references public.members(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key (task_id, member_id)
);
create index if not exists task_assignees_member_id_idx on public.task_assignees(member_id);
insert into public.task_assignees(task_id, member_id)
select id, assignee_id from public.tasks
where assignee_id is not null
on conflict (task_id, member_id) do nothing;
alter table public.members enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
drop policy if exists members_owner_policy on public.members;
create policy members_owner_policy on public.members
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
drop policy if exists tasks_owner_policy on public.tasks;
create policy tasks_owner_policy on public.tasks
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
drop policy if exists task_assignees_owner_policy on public.task_assignees;
create policy task_assignees_owner_policy on public.task_assignees
  for all to authenticated
  using (
    exists (
      select 1 from public.tasks
      where tasks.id = task_assignees.task_id
        and tasks.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.tasks
      where tasks.id = task_assignees.task_id
        and tasks.owner_id = (select auth.uid())
    )
    and exists (
      select 1 from public.members
      where members.id = task_assignees.member_id
        and members.owner_id = (select auth.uid())
    )
  );
create table if not exists public.notification_runs(
 owner_id uuid not null references auth.users(id) on delete cascade,
 run_key text not null,
 channel text not null default 'chatwork',
 sent_at timestamptz,
 primary key (owner_id, run_key, channel)
);
alter table public.notification_runs enable row level security;
drop policy if exists notification_runs_owner_policy on public.notification_runs;
create policy notification_runs_owner_policy on public.notification_runs
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
