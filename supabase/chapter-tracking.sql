-- Run after project-access.sql and editorial-drafts.sql. Existing drafts/reviews stay intact.
begin;
create table if not exists public.chapter_production (
  chapter_id uuid primary key references public.chapters(id) on delete cascade,
  editorial_state text not null default 'not_started' check(editorial_state in ('not_started','in_progress','revision_requested','complete')),
  editorial_notes text,
  editorial_completed_at timestamptz,
  third_draft_requested_at timestamptz,
  final_materials_requested_at timestamptz,
  final_biography text,
  final_affiliation text,
  biography_received_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.chapter_production enable row level security;
drop policy if exists production_read on public.chapter_production;
create policy production_read on public.chapter_production for select using(public.can_read_chapter(chapter_id));

create or replace function public.record_chapter_production(p_chapter_id uuid,p_state text,p_notes text,p_revision_sent boolean default false,p_materials_sent boolean default false)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.can_edit_project(public.chapter_project(p_chapter_id)) then raise exception 'Only this project editor can update editorial milestones'; end if;
  if p_state not in ('not_started','in_progress','revision_requested','complete') then raise exception 'Select a valid editorial state'; end if;
  insert into public.chapter_production(chapter_id,editorial_state,editorial_notes,editorial_completed_at,third_draft_requested_at,final_materials_requested_at)
  values(p_chapter_id,p_state,p_notes,case when p_state='complete' then now() end,case when p_revision_sent then now() end,case when p_materials_sent then now() end)
  on conflict(chapter_id) do update set
    editorial_state=excluded.editorial_state, editorial_notes=excluded.editorial_notes,
    editorial_completed_at=case when p_state='complete' then now() else null end,
    third_draft_requested_at=case when p_revision_sent then now() else chapter_production.third_draft_requested_at end,
    final_materials_requested_at=case when p_materials_sent then now() else chapter_production.final_materials_requested_at end,
    updated_at=now();
end;
$$;
create or replace function public.submit_final_author_materials(p_chapter_id uuid,p_biography text,p_affiliation text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.owns_chapter(p_chapter_id) then raise exception 'You can only submit materials for your own chapter'; end if;
  if length(trim(coalesce(p_biography,'')))<50 or length(trim(coalesce(p_affiliation,'')))=0 then raise exception 'Please add your current biography and affiliation'; end if;
  if not exists(select 1 from public.chapter_production where chapter_id=p_chapter_id and final_materials_requested_at is not null) then raise exception 'The editor has not requested final materials yet'; end if;
  insert into public.chapter_production(chapter_id,final_biography,final_affiliation,biography_received_at)
  values(p_chapter_id,trim(p_biography),trim(p_affiliation),now())
  on conflict(chapter_id) do update set final_biography=excluded.final_biography,final_affiliation=excluded.final_affiliation,biography_received_at=now(),updated_at=now();
end;
$$;
revoke all on function public.record_chapter_production(uuid,text,text,boolean,boolean) from public;
revoke all on function public.submit_final_author_materials(uuid,text,text) from public;
grant execute on function public.record_chapter_production(uuid,text,text,boolean,boolean) to authenticated;
grant execute on function public.submit_final_author_materials(uuid,text,text) to authenticated;
alter table public.email_logs add column if not exists email_kind text;
create or replace function public.validate_editorial_draft()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.editorial_submission_id is distinct from old.editorial_submission_id and new.editorial_submission_id is not null then
    if not public.can_edit_project(new.book_id) then raise exception 'Only this project editor can select the editorial draft'; end if;
    if not exists(select 1 from public.submissions s join public.submission_files f on f.submission_id=s.id where s.id=new.editorial_submission_id and s.chapter_id=new.id and s.stage::text in ('second_draft','final_materials')) then raise exception 'Select an uploaded revised draft belonging to this chapter'; end if;
  end if;
  return new;
end;
$$;
commit;
