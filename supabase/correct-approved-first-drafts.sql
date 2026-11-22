-- Targeted repair for the two Mission Integrity first drafts discussed with the editor.
-- Changes status only. It does not send emails or alter files, reviews or assignments.
begin;
do $$
declare targets uuid[]; matched integer;
begin
  select array_agg(c.id),count(*) into targets,matched
  from public.chapters c join public.books b on b.id=c.book_id
  where b.title ilike '%mission integrity%'
    and c.status::text='approved' and c.stage::text='first_draft'
    and exists(select 1 from public.submissions s join public.submission_files f on f.submission_id=s.id where s.chapter_id=c.id and s.stage::text='first_draft')
    and exists(select 1 from public.peer_review_files f where f.chapter_id=c.id and f.status='approved')
    and not exists(select 1 from public.submissions s join public.submission_files f on f.submission_id=s.id where s.chapter_id=c.id and s.stage::text in ('second_draft','final_materials'));
  if matched=0 then raise notice 'No matching approved first drafts found. No changes made.';
  elsif matched<>2 then raise exception 'Expected exactly two matching chapters, found %. No changes made; inspect the records before proceeding.',matched;
  else
    update public.chapters set status='submitted',updated_at=now() where id=any(targets);
  end if;
end;
$$;
select c.title,p.full_name as author,c.stage,c.status
from public.chapters c join public.books b on b.id=c.book_id
join public.profiles p on p.id=c.author_id
where b.title ilike '%mission integrity%' and c.stage::text='first_draft'
order by c.title;
commit;
