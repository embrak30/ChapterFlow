-- Run after schema.sql. Existing project owners become platform owners.
begin;
create table if not exists public.platform_owners (
  user_id uuid primary key references public.profiles(id)
);
insert into public.platform_owners select distinct editor_id from public.books where not exists(select 1 from public.platform_owners)
on conflict do nothing;
create table if not exists public.project_members (
  book_id uuid references public.books(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text not null check (role in ('admin','facilitator','author')),
  primary key(book_id,user_id)
);
insert into public.project_members select book_id, facilitator_id, 'facilitator' from public.facilitator_books on conflict do nothing;
alter table public.books add column if not exists project_type text not null default 'book' check (project_type in ('book','magazine'));
create table if not exists public.magazine_issues (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  title text not null,
  submission_deadline date,
  created_at timestamptz not null default now()
);
alter table public.chapters add column if not exists issue_id uuid references public.magazine_issues(id);
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from platform_owners where user_id=auth.uid());
$$;
create or replace function public.project_role(b uuid) returns text language sql stable security definer set search_path=public as $$
 select role from project_members where book_id=b and user_id=auth.uid();
$$;
create or replace function public.can_edit_project(b uuid) returns boolean language sql stable security definer set search_path=public as $$
 select public.is_admin() or coalesce(public.project_role(b)='admin',false);
$$;
create or replace function public.can_read_project(b uuid) returns boolean language sql stable security definer set search_path=public as $$
 select public.can_edit_project(b) or public.project_role(b) is not null or exists(select 1 from chapters where book_id=b and author_id=auth.uid());
$$;
create or replace function public.chapter_project(c uuid) returns uuid language sql stable security definer set search_path=public as $$ select book_id from chapters where id=c; $$;
create or replace function public.owns_chapter(c uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from chapters where id=c and author_id=auth.uid()); $$;
create or replace function public.can_read_chapter(c uuid) returns boolean language sql stable security definer set search_path=public as $$
 select public.owns_chapter(c) or public.can_edit_project(public.chapter_project(c)) or public.project_role(public.chapter_project(c))='facilitator';
$$;
-- Replace permissive legacy policies, including the original-draft reviewer policies.
do $$ declare p record; begin
 for p in select tablename,policyname from pg_policies where schemaname='public' and tablename in
 ('profiles','books','chapters','submissions','submission_files','reviews','email_logs','facilitator_books','peer_review_settings','peer_review_assignments','peer_reviews','peer_review_feedback_packets','book_agreements','agreement_acceptances','peer_review_files','platform_owners','project_members','magazine_issues')
 loop execute format('drop policy %I on public.%I',p.policyname,p.tablename); end loop;
end $$;
alter table public.platform_owners enable row level security;
alter table public.project_members enable row level security;
alter table public.magazine_issues enable row level security;
create policy owners_read on public.platform_owners for select using(user_id=auth.uid());
create policy members_manage on public.project_members for all using(public.is_admin()) with check(public.is_admin());
create policy members_read on public.project_members for select using(user_id=auth.uid() or public.can_edit_project(book_id));
create policy profiles_read on public.profiles for select using(id=auth.uid() or public.is_admin() or exists(select 1 from public.chapters c where c.author_id=profiles.id and public.can_read_chapter(c.id)));
create policy profiles_insert on public.profiles for insert with check(id=auth.uid() and role::text='author');
create policy profiles_update on public.profiles for update using(id=auth.uid()) with check(id=auth.uid());
create policy books_read on public.books for select using(public_status='open' or public.can_read_project(id));
create policy books_update on public.books for update using(public.can_edit_project(id)) with check(public.can_edit_project(id));
create policy books_insert on public.books for insert with check(public.is_admin());
create policy chapters_read on public.chapters for select using(public.can_read_chapter(id) or public.is_peer_reviewer_for(id));
create policy chapters_manage on public.chapters for all using(public.can_edit_project(book_id) or author_id=auth.uid()) with check(public.can_edit_project(book_id) or (author_id=auth.uid() and exists(select 1 from books b where b.id=chapters.book_id and (b.public_status='open' or public.owns_chapter(chapters.id)))));
create policy submissions_read on public.submissions for select using(public.can_read_chapter(chapter_id));
create policy submissions_manage on public.submissions for all using(public.can_edit_project(public.chapter_project(chapter_id)) or public.owns_chapter(chapter_id)) with check(public.can_edit_project(public.chapter_project(chapter_id)) or (public.owns_chapter(chapter_id) and submitted_by=auth.uid()));
create policy files_read on public.submission_files for select using(exists(select 1 from submissions s where s.id=submission_id and public.can_read_chapter(s.chapter_id)));
create policy files_manage on public.submission_files for all using(exists(select 1 from submissions s where s.id=submission_id and (public.can_edit_project(public.chapter_project(s.chapter_id)) or public.owns_chapter(s.chapter_id)))) with check(exists(select 1 from submissions s where s.id=submission_id and (public.can_edit_project(public.chapter_project(s.chapter_id)) or public.owns_chapter(s.chapter_id))));
do $$ declare t text; begin
 foreach t in array array['reviews','email_logs','peer_review_feedback_packets','agreement_acceptances'] loop
 execute format('create policy scoped_manage on public.%I for all using(public.can_edit_project(public.chapter_project(chapter_id))) with check(public.can_edit_project(public.chapter_project(chapter_id)))',t);
 execute format('create policy scoped_read on public.%I for select using(public.can_read_chapter(chapter_id))',t);
 end loop;
 foreach t in array array['peer_review_settings','book_agreements','magazine_issues','peer_review_files'] loop
 execute format('create policy scoped_manage on public.%I for all using(public.can_edit_project(book_id)) with check(public.can_edit_project(book_id))',t);
 execute format('create policy scoped_read on public.%I for select using(public.can_read_project(book_id))',t);
 end loop;
end $$;
create policy agreement_sign on public.agreement_acceptances for insert with check(author_id=auth.uid() and public.owns_chapter(chapter_id) and book_id=public.chapter_project(chapter_id));
create policy issues_public on public.magazine_issues for select using(exists(select 1 from books b where b.id=book_id and b.public_status='open'));
create policy reviewer_files on public.peer_review_files for select using(status='approved' and public.is_peer_reviewer_for(chapter_id));
create policy assignments_manage on public.peer_review_assignments for all using(public.can_edit_project(book_id)) with check(public.can_edit_project(book_id));
create policy assignments_read on public.peer_review_assignments for select using(reviewer_id=auth.uid() or public.project_role(book_id)='facilitator');
create policy reviews_manage on public.peer_reviews for all using(public.can_edit_project(public.chapter_project(chapter_id)) or reviewer_id=auth.uid()) with check(public.can_edit_project(public.chapter_project(chapter_id)) or (reviewer_id=auth.uid() and exists(select 1 from peer_review_assignments a where a.id=assignment_id and a.chapter_id=peer_reviews.chapter_id and a.reviewer_id=auth.uid())));
drop policy if exists "Users can read permitted chapter draft files" on storage.objects;
drop policy if exists "Authors can upload their chapter drafts" on storage.objects;
drop policy if exists "Admins can upload chapter drafts" on storage.objects;
drop policy if exists project_storage_read on storage.objects;
drop policy if exists project_storage_upload on storage.objects;
create policy project_storage_read on storage.objects for select using(bucket_id='chapter-drafts' and exists(select 1 from chapters c where c.id::text=(storage.foldername(name))[2] and (public.can_read_chapter(c.id) or exists(select 1 from peer_review_files f where f.storage_path=name and f.status='approved' and public.is_peer_reviewer_for(c.id)))));
create policy project_storage_upload on storage.objects for insert with check(bucket_id='chapter-drafts' and exists(select 1 from chapters c where c.id::text=(storage.foldername(name))[2] and (public.can_edit_project(c.book_id) or (public.owns_chapter(c.id) and (storage.foldername(name))[3] <> 'peer-review'))));
commit;
