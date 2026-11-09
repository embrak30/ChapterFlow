-- Run in Supabase SQL editor. Preserves assignments and review content.
begin;
create or replace function public.complete_saved_peer_review()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  update public.peer_review_assignments
  set status='completed'
  where id=new.assignment_id and chapter_id=new.chapter_id and reviewer_id=new.reviewer_id;
  if not found then
    raise exception 'The review does not match its assigned chapter and reviewer';
  end if;
  return new;
end;
$$;
drop trigger if exists complete_saved_peer_review on public.peer_reviews;
create trigger complete_saved_peer_review after insert or update on public.peer_reviews
for each row execute function public.complete_saved_peer_review();

-- Repair completion flags for reviews that were saved before this update.
update public.peer_review_assignments a set status='completed'
where exists(select 1 from public.peer_reviews r
  where r.assignment_id=a.id and r.chapter_id=a.chapter_id and r.reviewer_id=a.reviewer_id);
commit;
