-- Incomplete reviews are kept separately and do not count as submitted reviews.
begin;
create table if not exists public.peer_review_drafts (
  assignment_id uuid primary key references public.peer_review_assignments(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id),
  fields jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.peer_review_drafts enable row level security;
drop policy if exists reviewer_draft_read on public.peer_review_drafts;
create policy reviewer_draft_read on public.peer_review_drafts for select using(reviewer_id=auth.uid());
drop policy if exists reviewer_draft_write on public.peer_review_drafts;
create policy reviewer_draft_write on public.peer_review_drafts for all using(reviewer_id=auth.uid()) with check(reviewer_id=auth.uid() and exists(select 1 from public.peer_review_assignments a where a.id=assignment_id and a.reviewer_id=auth.uid()));
commit;
