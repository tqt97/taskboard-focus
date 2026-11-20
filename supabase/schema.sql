-- Taskboard Focus schema v1. Configure Auth/RLS before storing private tasks in a public deployment.
create extension if not exists pgcrypto;
create table if not exists public.members(
 id uuid primary key default gen_random_uuid(), name text not null, role text not null default '', color text not null default 'blue', active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.tasks(
 id uuid primary key default gen_random_uuid(), code text not null default '', title text not null, description text not null default '',
 status text not null default 'todo' check(status in ('todo','in_progress','blocked','done')),
 priority text not null default 'medium' check(priority in ('urgent','high','medium','low')),
 severity text not null default 'medium' check(severity in ('critical','high','medium','low')),
 -- Deprecated compatibility column. New writes should use task_assignees.
 assignee_id uuid references public.members(id) on delete set null,
 dev_up timestamptz, staging_up timestamptz, release_at timestamptz, deadline timestamptz,
 order_index integer not null default 0, links jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
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
-- No anon policies are created intentionally. Add authenticated policies only after configuring Supabase Auth.
