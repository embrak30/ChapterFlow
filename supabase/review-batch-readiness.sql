-- Apply after peer-review-batches.sql and two-author-review-batches.sql.
-- Changes readiness checks only; no assignments, drafts or chapter statuses are modified.
begin;
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
    and c.book_id=p_book_id and c.status::text<>'rejected' and c.stage::text<>'complete'
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

create or replace function public.create_editor_pair_batch(p_book_id uuid,p_name text,p_chapter_ids uuid[],p_deadline date)
returns uuid language plpgsql security definer set search_path=public as $$
declare batch uuid; ids uuid[]; authors uuid[]; n integer; i integer;
begin
  if not public.can_edit_project(p_book_id) then raise exception 'Only this project editor can create this batch'; end if;
  perform id from public.books where id=p_book_id for update;
  if length(trim(coalesce(p_name,'')))=0 or p_deadline is null then raise exception 'Enter the batch name and deadline'; end if;
  if cardinality(p_chapter_ids) is distinct from 2 or (select count(distinct x) from unnest(p_chapter_ids) x)<>2 then raise exception 'Select exactly two distinct chapters'; end if;
  select count(*) into n from public.chapters c where c.id=any(p_chapter_ids) and c.book_id=p_book_id
    and c.status::text<>'rejected' and c.stage::text<>'complete'
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

