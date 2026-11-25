-- Taskboard Focus schema v3. Configure Auth/RLS before storing private tasks in a public deployment.
create extension if not exists pgcrypto;
create table if not exists public.workspaces(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 name text not null check (char_length(name) between 1 and 120),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.workspace_members(
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null default 'member' check (role in ('owner','admin','member','viewer')),
 created_at timestamptz not null default now(),
 primary key (workspace_id, user_id)
);
create index if not exists workspace_members_user_id_idx on public.workspace_members(user_id);
create or replace function public.guard_workspace_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_owner uuid;
begin
  if tg_op = 'DELETE' then
    select owner_id into workspace_owner from public.workspaces where id = old.workspace_id;
  else
    select owner_id into workspace_owner from public.workspaces where id = new.workspace_id;
  end if;
  if tg_op <> 'INSERT' and old.user_id = workspace_owner and (tg_op = 'DELETE' or new.role <> 'owner') then
    raise exception 'Workspace owner membership cannot be removed or downgraded';
  end if;
  if tg_op = 'INSERT' and new.role = 'owner' and new.user_id <> workspace_owner then
    raise exception 'Only workspace owner can have owner role';
  end if;
  if tg_op = 'UPDATE' and new.role = 'owner' and old.role <> 'owner' then
    raise exception 'Only workspace owner can have owner role';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
drop trigger if exists workspace_members_owner_guard on public.workspace_members;
create trigger workspace_members_owner_guard
before insert or update or delete on public.workspace_members
for each row execute function public.guard_workspace_owner_membership();
create or replace function public.workspace_role(target_workspace uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from public.workspaces
      where id = target_workspace and owner_id = (select auth.uid())
    ) then 'owner'
    else (
      select role from public.workspace_members
      where workspace_id = target_workspace and user_id = (select auth.uid())
    )
  end
$$;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
drop policy if exists workspaces_owner_policy on public.workspaces;
drop policy if exists workspaces_read_policy on public.workspaces;
drop policy if exists workspaces_owner_write_policy on public.workspaces;
create policy workspaces_read_policy on public.workspaces
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.workspace_role(id) is not null);
create policy workspaces_owner_write_policy on public.workspaces
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
drop policy if exists workspace_members_owner_policy on public.workspace_members;
drop policy if exists workspace_members_read_policy on public.workspace_members;
drop policy if exists workspace_members_manage_policy on public.workspace_members;
create policy workspace_members_read_policy on public.workspace_members
  for select to authenticated
  using (user_id = (select auth.uid()) or public.workspace_role(workspace_id) is not null);
create policy workspace_members_manage_policy on public.workspace_members
  for all to authenticated
  using (public.workspace_role(workspace_id) in ('owner', 'admin'))
  with check (public.workspace_role(workspace_id) in ('owner', 'admin'));
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
create table if not exists public.workspace_snapshots(
 workspace_id uuid primary key references public.workspaces(id) on delete cascade,
 data jsonb not null check (jsonb_typeof(data) = 'object'),
 schema_version integer not null default 1,
 updated_at timestamptz not null default now()
);
alter table public.workspace_snapshots enable row level security;
drop policy if exists workspace_snapshots_access_policy on public.workspace_snapshots;
drop policy if exists workspace_snapshots_read_policy on public.workspace_snapshots;
drop policy if exists workspace_snapshots_write_policy on public.workspace_snapshots;
create policy workspace_snapshots_read_policy on public.workspace_snapshots
  for select to authenticated
  using (public.workspace_role(workspace_id) is not null);
create policy workspace_snapshots_write_policy on public.workspace_snapshots
  for all to authenticated
  using (public.workspace_role(workspace_id) in ('owner', 'admin', 'member'))
  with check (public.workspace_role(workspace_id) in ('owner', 'admin', 'member'));
insert into storage.buckets (id, name, public)
values ('taskboard-attachments', 'taskboard-attachments', false)
on conflict (id) do nothing;
update storage.buckets
set public = false
where id = 'taskboard-attachments';
drop policy if exists taskboard_attachment_read on storage.objects;
create policy taskboard_attachment_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'taskboard-attachments'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.workspace_role((storage.foldername(name))[1]::uuid) is not null
    )
  );
drop policy if exists taskboard_attachment_insert on storage.objects;
create policy taskboard_attachment_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'taskboard-attachments'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.workspace_role((storage.foldername(name))[1]::uuid) in ('owner', 'admin', 'member')
    )
  );
drop policy if exists taskboard_attachment_delete on storage.objects;
create policy taskboard_attachment_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'taskboard-attachments'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.workspace_role((storage.foldername(name))[1]::uuid) in ('owner', 'admin', 'member')
    )
  );
create table if not exists public.members(
 id text primary key default gen_random_uuid()::text, owner_id uuid not null references auth.users(id) default auth.uid(), name text not null check (char_length(name) <= 120), role text not null default '' check (char_length(role) <= 120), color text not null default 'blue' check (color in ('blue', 'violet', 'orange', 'green')), active boolean not null default true, created_at timestamptz not null default now()
);
alter table public.members add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
create table if not exists public.tasks(
 id text primary key default gen_random_uuid()::text, owner_id uuid not null references auth.users(id) default auth.uid(), code text not null default '' check (char_length(code) <= 100), custom_code boolean not null default false, title text not null check (char_length(title) <= 500), description text not null default '' check (char_length(description) <= 10000),
 status text not null default 'todo' check(status in ('todo','in_progress','review','blocked','done')),
 priority text not null default 'medium' check(priority in ('urgent','high','medium','low')),
 severity text not null default 'medium' check(severity in ('critical','high','medium','low')),
 next_action text not null default '' check (char_length(next_action) <= 1000),
 review_note text not null default '' check (char_length(review_note) <= 2000),
 blocked_by jsonb not null default '[]'::jsonb check (jsonb_typeof(blocked_by) = 'array'),
 activity jsonb not null default '[]'::jsonb check (jsonb_typeof(activity) = 'array'),
 primary_links jsonb not null default '[]'::jsonb check (jsonb_typeof(primary_links) = 'array'),
 secondary_links jsonb not null default '[]'::jsonb check (jsonb_typeof(secondary_links) = 'array'),
 -- Deprecated compatibility column. New writes should use task_assignees.
 assignee_id text references public.members(id) on delete set null,
 dev_up timestamptz, staging_up timestamptz, release_at timestamptz, deadline timestamptz,
 order_index integer not null default 0, links jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.tasks add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check check(status in ('todo','in_progress','review','blocked','done'));
alter table public.tasks add column if not exists archived_at timestamptz;
alter table public.tasks add column if not exists custom_code boolean not null default false;
alter table public.tasks add column if not exists recurrence jsonb not null default '{}'::jsonb check (jsonb_typeof(recurrence) = 'object');
alter table public.tasks add column if not exists template_id text;
alter table public.tasks add column if not exists attachments jsonb not null default '[]'::jsonb check (jsonb_typeof(attachments) = 'array');
alter table public.tasks add column if not exists checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array');
alter table public.tasks add column if not exists inbox boolean not null default false;
alter table public.tasks add column if not exists snoozed_until timestamptz;
-- Realtime DELETE payloads need the previous updated_at for stale-delete protection.
alter table public.tasks replica identity full;
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
create index if not exists members_workspace_id_idx on public.members(workspace_id);

-- Local/legacy exports use stable IDs such as `t1` and `m1`; task and member
-- identities must not be forced through UUID before they can be synced.
-- Keep owner/workspace/user IDs as UUIDs, but preserve task/member IDs as text.
do $$
declare
  members_are_uuid boolean;
  tasks_are_uuid boolean;
  assignee_is_uuid boolean;
  task_assignment_is_uuid boolean;
  member_assignment_is_uuid boolean;
begin
  select data_type = 'uuid' into members_are_uuid
  from information_schema.columns
  where table_schema = 'public' and table_name = 'members' and column_name = 'id';
  select data_type = 'uuid' into tasks_are_uuid
  from information_schema.columns
  where table_schema = 'public' and table_name = 'tasks' and column_name = 'id';
  select data_type = 'uuid' into assignee_is_uuid
  from information_schema.columns
  where table_schema = 'public' and table_name = 'tasks' and column_name = 'assignee_id';
  select data_type = 'uuid' into task_assignment_is_uuid
  from information_schema.columns
  where table_schema = 'public' and table_name = 'task_assignees' and column_name = 'task_id';
  select data_type = 'uuid' into member_assignment_is_uuid
  from information_schema.columns
  where table_schema = 'public' and table_name = 'task_assignees' and column_name = 'member_id';

  if coalesce(members_are_uuid, false)
    or coalesce(tasks_are_uuid, false)
    or coalesce(assignee_is_uuid, false)
    or coalesce(task_assignment_is_uuid, false)
    or coalesce(member_assignment_is_uuid, false) then
    if to_regclass('public.task_assignees') is not null then
      drop policy if exists task_assignees_owner_policy on public.task_assignees;
      drop policy if exists task_assignees_read_policy on public.task_assignees;
      drop policy if exists task_assignees_write_policy on public.task_assignees;
      alter table public.task_assignees
        drop constraint if exists task_assignees_task_id_fkey,
        drop constraint if exists task_assignees_member_id_fkey;
    end if;
    alter table public.tasks drop constraint if exists tasks_assignee_id_fkey;
    if coalesce(members_are_uuid, false) then
      alter table public.members alter column id type text using id::text;
    end if;
    if coalesce(tasks_are_uuid, false) then
      alter table public.tasks alter column id type text using id::text;
    end if;
    if coalesce(assignee_is_uuid, false) then
      alter table public.tasks alter column assignee_id type text using assignee_id::text;
    end if;
    if coalesce(task_assignment_is_uuid, false) then
      alter table public.task_assignees alter column task_id type text using task_id::text;
    end if;
    if coalesce(member_assignment_is_uuid, false) then
      alter table public.task_assignees alter column member_id type text using member_id::text;
    end if;
    alter table public.members alter column id set default gen_random_uuid()::text;
    alter table public.tasks alter column id set default gen_random_uuid()::text;
  end if;
end;
$$;

create index if not exists tasks_owner_id_idx on public.tasks(owner_id);
create index if not exists tasks_workspace_id_idx on public.tasks(workspace_id);
create index if not exists tasks_workspace_order_idx on public.tasks(workspace_id, order_index);
create index if not exists tasks_status_idx on public.tasks(status);
create index if not exists tasks_priority_idx on public.tasks(priority);
create index if not exists tasks_deadline_idx on public.tasks(deadline);
create index if not exists tasks_order_idx on public.tasks(order_index);
create table if not exists public.task_assignees(
 task_id text not null references public.tasks(id) on delete cascade,
 member_id text not null references public.members(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key (task_id, member_id)
);
alter table public.task_assignees drop constraint if exists task_assignees_task_id_fkey;
alter table public.task_assignees drop constraint if exists task_assignees_member_id_fkey;
alter table public.task_assignees
  add constraint task_assignees_task_id_fkey
  foreign key (task_id) references public.tasks(id) on delete cascade;
alter table public.task_assignees
  add constraint task_assignees_member_id_fkey
  foreign key (member_id) references public.members(id) on delete cascade;
alter table public.tasks drop constraint if exists tasks_assignee_id_fkey;
alter table public.tasks
  add constraint tasks_assignee_id_fkey
  foreign key (assignee_id) references public.members(id) on delete set null;
create index if not exists task_assignees_member_id_idx on public.task_assignees(member_id);
delete from public.task_assignees as assignments
using public.tasks as assigned_tasks, public.members as assigned_members
where assignments.task_id = assigned_tasks.id
  and assignments.member_id = assigned_members.id
  and assigned_tasks.workspace_id is distinct from assigned_members.workspace_id;
create or replace function public.guard_task_assignee_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  task_workspace uuid;
  member_workspace uuid;
begin
  select workspace_id into task_workspace
  from public.tasks
  where id = new.task_id;
  select workspace_id into member_workspace
  from public.members
  where id = new.member_id;
  if task_workspace is distinct from member_workspace then
    raise exception 'Task và người phụ trách phải thuộc cùng workspace';
  end if;
  return new;
end;
$$;
drop trigger if exists task_assignees_workspace_guard on public.task_assignees;
create trigger task_assignees_workspace_guard
before insert or update on public.task_assignees
for each row execute function public.guard_task_assignee_workspace();
insert into public.task_assignees(task_id, member_id)
select id, assignee_id from public.tasks
where assignee_id is not null
on conflict (task_id, member_id) do nothing;
alter table public.members enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
drop policy if exists members_owner_policy on public.members;
drop policy if exists members_read_policy on public.members;
drop policy if exists members_write_policy on public.members;
create policy members_read_policy on public.members
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.workspace_role(workspace_id) is not null);
create policy members_write_policy on public.members
  for all to authenticated
  using (owner_id = (select auth.uid()) or public.workspace_role(workspace_id) in ('owner', 'admin'))
  with check (owner_id = (select auth.uid()) or public.workspace_role(workspace_id) in ('owner', 'admin'));
drop policy if exists tasks_owner_policy on public.tasks;
drop policy if exists tasks_read_policy on public.tasks;
drop policy if exists tasks_write_policy on public.tasks;
create policy tasks_read_policy on public.tasks
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.workspace_role(workspace_id) is not null);
create policy tasks_write_policy on public.tasks
  for all to authenticated
  using (owner_id = (select auth.uid()) or public.workspace_role(workspace_id) in ('owner', 'admin', 'member'))
  with check (owner_id = (select auth.uid()) or public.workspace_role(workspace_id) in ('owner', 'admin', 'member'));
drop policy if exists task_assignees_owner_policy on public.task_assignees;
drop policy if exists task_assignees_read_policy on public.task_assignees;
drop policy if exists task_assignees_write_policy on public.task_assignees;
create policy task_assignees_read_policy on public.task_assignees
  for select to authenticated
  using (
    exists (
      select 1 from public.tasks
      where tasks.id = task_assignees.task_id
        and (tasks.owner_id = (select auth.uid()) or public.workspace_role(tasks.workspace_id) is not null)
    )
  );
create policy task_assignees_write_policy on public.task_assignees
  for all to authenticated
  using (
    exists (
      select 1 from public.tasks
      where tasks.id = task_assignees.task_id
        and (tasks.owner_id = (select auth.uid()) or public.workspace_role(tasks.workspace_id) in ('owner', 'admin', 'member'))
    )
  )
  with check (
    exists (
      select 1 from public.tasks
      where tasks.id = task_assignees.task_id
        and (tasks.owner_id = (select auth.uid()) or public.workspace_role(tasks.workspace_id) in ('owner', 'admin', 'member'))
    )
    and exists (
      select 1
      from public.members
      join public.tasks as assigned_tasks on assigned_tasks.id = task_assignees.task_id
      where members.id = task_assignees.member_id
        and members.workspace_id is not distinct from assigned_tasks.workspace_id
        and (members.owner_id = (select auth.uid()) or public.workspace_role(assigned_tasks.workspace_id) is not null)
    )
  );
create table if not exists public.notification_runs(
 owner_id uuid not null references auth.users(id) on delete cascade,
 run_key text not null,
 channel text not null default 'chatwork',
 status text not null default 'pending' check (status in ('pending','sent','failed')),
 attempts integer not null default 0 check (attempts >= 0),
 lease_until timestamptz,
 next_attempt_at timestamptz,
 last_error text,
 sent_at timestamptz,
 primary key (owner_id, run_key, channel)
);
alter table public.notification_runs add column if not exists status text not null default 'pending';
alter table public.notification_runs add column if not exists attempts integer not null default 0;
alter table public.notification_runs add column if not exists lease_until timestamptz;
alter table public.notification_runs add column if not exists next_attempt_at timestamptz;
alter table public.notification_runs add column if not exists last_error text;
alter table public.notification_runs enable row level security;
drop policy if exists notification_runs_owner_policy on public.notification_runs;
create policy notification_runs_owner_policy on public.notification_runs
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
