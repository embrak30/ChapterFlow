-- Preserves all existing submissions and Word files. No new enum values required.
begin;
alter table public.chapters add column if not exists editorial_submission_id uuid references public.submissions(id) on delete set null;
create or replace function public.validate_editorial_draft()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.editorial_submission_id is distinct from old.editorial_submission_id and new.editorial_submission_id is not null then
    if not public.can_edit_project(new.book_id) then raise exception 'Only this project editor can select the editorial draft'; end if;
    if not exists(select 1 from public.submissions s join public.submission_files f on f.submission_id=s.id where s.id=new.editorial_submission_id and s.chapter_id=new.id and s.stage::text='second_draft') then
      raise exception 'Select an uploaded second draft belonging to this chapter';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists validate_editorial_draft on public.chapters;
create trigger validate_editorial_draft before update on public.chapters for each row execute function public.validate_editorial_draft();
commit;
