-- Run after peer-review-batches.sql. Existing batches and reviews are unchanged.
begin;
alter table public.peer_review_batches add column if not exists editor_reviewer_id uuid references public.profiles(id);
create or replace function public.create_editor_pair_batch(p_book_id uuid,p_name text,p_chapter_ids uuid[],p_deadline date)
returns uuid language plpgsql security definer set search_path=public as $$
declare batch uuid; ids uuid[]; authors uuid[]; n integer; i integer;
begin
  if not public.can_edit_project(p_book_id) then raise exception 'Only this project editor can create this batch'; end if;
  perform id from public.books where id=p_book_id for update;
  if length(trim(coalesce(p_name,'')))=0 or p_deadline is null then raise exception 'Enter the batch name and deadline'; end if;
  if cardinality(p_chapter_ids) is distinct from 2 or (select count(distinct x) from unnest(p_chapter_ids) x)<>2 then raise exception 'Select exactly two distinct chapters'; end if;
  select count(*) into n from public.chapters c where c.id=any(p_chapter_ids) and c.book_id=p_book_id
    and c.stage::text='first_draft' and c.status::text='submitted'
    and exists(select 1 from public.submissions s join public.submission_files f on f.submission_id=s.id where s.chapter_id=c.id and s.stage::text='first_draft')
    and exists(select 1 from public.peer_review_files f where f.chapter_id=c.id and f.status='approved');
  if n<>2 then raise exception 'Both chapters need a submitted first draft and an approved anonymised copy'; end if;
  select array_agg(id order by id),array_agg(author_id order by id) into ids,authors from public.chapters where id=any(p_chapter_ids);
  if authors[1]=authors[2] or auth.uid()=any(authors) then raise exception 'The two authors and editor must be three different people'; end if;
  if exists(select 1 from public.peer_review_assignments a where a.chapter_id=any(ids) or (a.book_id=p_book_id and a.reviewer_id=any(authors))) then raise exception 'One of these authors or chapters already belongs to a batch'; end if;
  insert into public.peer_review_batches(book_id,name,review_deadline,required_review_count,created_by,editor_reviewer_id)
    values(p_book_id,trim(p_name),p_deadline,2,auth.uid(),auth.uid()) returning id into batch;
  for i in 1..2 loop
    insert into public.peer_review_assignments(book_id,batch_id,chapter_id,reviewer_id,assigned_by,status)
    values(p_book_id,batch,ids[i],authors[3-i],auth.uid(),'assigned'),(p_book_id,batch,ids[i],auth.uid(),auth.uid(),'assigned');
  end loop;
  return batch;
end;
$$;
revoke all on function public.create_editor_pair_batch(uuid,text,uuid[],date) from public;
grant execute on function public.create_editor_pair_batch(uuid,text,uuid[],date) to authenticated;
commit;
