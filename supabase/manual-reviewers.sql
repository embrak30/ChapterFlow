-- Run after peer-review-batches.sql. Does not alter existing assignments.
begin;
alter table public.peer_review_assignments add column if not exists review_deadline date;
alter table public.peer_review_assignments add column if not exists is_manual boolean not null default false;
create or replace function public.assign_additional_reviewer(p_book_id uuid,p_chapter_id uuid,p_email text,p_deadline date)
returns uuid language plpgsql security definer set search_path=public as $$
declare person uuid; chapter_author uuid; batch uuid; result uuid; required integer;
begin
  if not public.can_edit_project(p_book_id) then raise exception 'Only this project editor can assign reviewers'; end if;
  perform id from public.books where id=p_book_id for update;
  select author_id into chapter_author from public.chapters where id=p_chapter_id and book_id=p_book_id and status::text<>'rejected' and stage::text<>'complete';
  if chapter_author is null then raise exception 'Select an active chapter in this project'; end if;
  if p_deadline is null then raise exception 'Set a review deadline'; end if;
  if not exists(select 1 from public.submissions s join public.submission_files f on f.submission_id=s.id where s.chapter_id=p_chapter_id and s.stage::text='first_draft') or not exists(select 1 from public.peer_review_files f where f.chapter_id=p_chapter_id and f.status='approved') then raise exception 'This chapter needs a first draft and approved anonymised review copy'; end if;
  select id into person from public.profiles where lower(email)=lower(trim(p_email));
  if person is null then raise exception 'Ask this reviewer to sign in once, then use the exact Google sign-in email'; end if;
  if person=chapter_author then raise exception 'Authors cannot review their own chapter'; end if;
  if exists(select 1 from public.peer_review_assignments where chapter_id=p_chapter_id and reviewer_id=person) then raise exception 'This person is already assigned to this chapter; the existing assignment has been kept'; end if;
  select batch_id into batch from public.peer_review_assignments where chapter_id=p_chapter_id and batch_id is not null order by created_at limit 1;
  if batch is null then
    select coalesce(required_review_count,2) into required from public.peer_review_settings where book_id=p_book_id;
    insert into public.peer_review_batches(book_id,name,review_deadline,required_review_count,created_by) values(p_book_id,'Manual review: ' || (select title from public.chapters where id=p_chapter_id),p_deadline,coalesce(required,2),auth.uid()) returning id into batch;
  end if;
  insert into public.peer_review_assignments(book_id,batch_id,chapter_id,reviewer_id,assigned_by,status,review_deadline,is_manual)
    values(p_book_id,batch,p_chapter_id,person,auth.uid(),'assigned',p_deadline,true) returning id into result;
  return result;
end;
$$;
revoke all on function public.assign_additional_reviewer(uuid,uuid,text,date) from public;
grant execute on function public.assign_additional_reviewer(uuid,uuid,text,date) to authenticated;
drop policy if exists assigned_reviewers_project on public.books;
create policy assigned_reviewers_project on public.books for select using(exists(select 1 from public.peer_review_assignments a where a.book_id=books.id and a.reviewer_id=auth.uid()));
drop policy if exists assigned_reviewers_settings on public.peer_review_settings;
create policy assigned_reviewers_settings on public.peer_review_settings for select using(is_open and exists(select 1 from public.peer_review_assignments a where a.book_id=peer_review_settings.book_id and a.reviewer_id=auth.uid()));
drop policy if exists assigned_reviewer_contacts on public.profiles;
create policy assigned_reviewer_contacts on public.profiles for select using(exists(select 1 from public.peer_review_assignments a where a.reviewer_id=profiles.id and public.can_edit_project(a.book_id)));
commit;
