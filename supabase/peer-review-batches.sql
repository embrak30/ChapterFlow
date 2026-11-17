-- Apply after project-access.sql. Existing reviews and assignments are preserved.
begin;
create table if not exists public.peer_review_batches (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  name text not null check(length(trim(name)) > 0),
  review_deadline date,
  required_review_count integer not null check(required_review_count in (2,3)),
  is_legacy boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create unique index if not exists one_legacy_review_batch on public.peer_review_batches(book_id) where is_legacy;
alter table public.peer_review_assignments add column if not exists batch_id uuid references public.peer_review_batches(id);
insert into public.peer_review_batches(book_id,name,review_deadline,required_review_count,is_legacy)
select distinct a.book_id,'Original review group',s.review_deadline,coalesce(s.required_review_count,2),true
from public.peer_review_assignments a left join public.peer_review_settings s on s.book_id=a.book_id
where a.batch_id is null and not exists(select 1 from public.peer_review_batches b where b.book_id=a.book_id and b.is_legacy);
update public.peer_review_assignments a set batch_id=b.id
from public.peer_review_batches b where b.book_id=a.book_id and b.is_legacy and a.batch_id is null;

alter table public.peer_review_batches enable row level security;
drop policy if exists batch_admin on public.peer_review_batches;
create policy batch_admin on public.peer_review_batches for all using(public.can_edit_project(book_id)) with check(public.can_edit_project(book_id));
drop policy if exists batch_reader on public.peer_review_batches;
create policy batch_reader on public.peer_review_batches for select using(public.project_role(book_id)='facilitator' or exists(select 1 from public.peer_review_assignments a where a.batch_id=peer_review_batches.id and a.reviewer_id=auth.uid()));

-- Create the batch and its entire matrix together. The project lock prevents overlaps.
create or replace function public.create_peer_review_batch(p_book_id uuid,p_name text,p_chapter_ids uuid[],p_deadline date,p_count integer)
returns uuid language plpgsql security definer set search_path=public as $$
declare batch uuid; n integer; i integer; j integer; reviewer uuid; valid_count integer;
begin
  if not public.can_edit_project(p_book_id) then raise exception 'Only this project editor can create review batches'; end if;
  perform id from public.books where id=p_book_id for update;
  if length(trim(coalesce(p_name,'')))=0 or p_deadline is null or p_count not in (2,3) then raise exception 'Enter a batch name, deadline and two or three reviews per chapter'; end if;
  n:=cardinality(p_chapter_ids);
  if n is null or n < p_count+1 or n <> (select count(distinct x) from unnest(p_chapter_ids) x) then raise exception 'Select enough distinct chapters for this batch'; end if;
  select count(*) into valid_count from public.chapters c where c.id=any(p_chapter_ids)
    and c.book_id=p_book_id and c.stage::text='first_draft' and c.status::text='submitted'
    and exists(select 1 from public.submissions s join public.submission_files f on f.submission_id=s.id where s.chapter_id=c.id and s.stage::text='first_draft')
    and exists(select 1 from public.peer_review_files f where f.chapter_id=c.id and f.status='approved');
  if valid_count<>n then raise exception 'Each selected chapter must have a submitted first draft and an approved anonymised copy in this project'; end if;
  if (select count(distinct author_id) from public.chapters where id=any(p_chapter_ids))<>n then raise exception 'Select one chapter per author'; end if;
  if exists(select 1 from public.peer_review_assignments a where a.chapter_id=any(p_chapter_ids) or (a.book_id=p_book_id and a.reviewer_id in (select author_id from public.chapters where id=any(p_chapter_ids)))) then raise exception 'A selected chapter or author already belongs to a review group. Existing groups cannot be reassigned here'; end if;
  insert into public.peer_review_batches(book_id,name,review_deadline,required_review_count,created_by) values(p_book_id,trim(p_name),p_deadline,p_count,auth.uid()) returning id into batch;
  for i in 1..n loop
    for j in 1..p_count loop
      select author_id into reviewer from public.chapters where id=p_chapter_ids[((i-1+j)%n)+1];
      insert into public.peer_review_assignments(book_id,batch_id,chapter_id,reviewer_id,assigned_by,status)
      values(p_book_id,batch,p_chapter_ids[i],reviewer,auth.uid(),'assigned');
    end loop;
  end loop;
  return batch;
end;
$$;
revoke all on function public.create_peer_review_batch(uuid,text,uuid[],date,integer) from public;
grant execute on function public.create_peer_review_batch(uuid,text,uuid[],date,integer) to authenticated;
commit;
