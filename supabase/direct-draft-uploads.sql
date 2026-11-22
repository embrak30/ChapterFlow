-- Author manuscripts upload directly to private Storage; only metadata crosses Vercel.
begin;
create table if not exists public.draft_upload_sessions (
 id uuid primary key,chapter_id uuid not null references public.chapters(id) on delete cascade,
 author_id uuid not null references public.profiles(id),storage_path text not null unique,
 file_name text not null,expected_size bigint not null check(expected_size between 1 and 20971520),
 content_type text not null,stage public.chapter_stage not null check(stage::text in ('first_draft','second_draft','final_materials')),
 notes text check(length(notes)<=20000),expires_at timestamptz not null default now()+interval '2 hours',
 submission_id uuid references public.submissions(id),created_at timestamptz not null default now()
);
alter table public.draft_upload_sessions enable row level security;
drop policy if exists own_upload_sessions_read on public.draft_upload_sessions;
create policy own_upload_sessions_read on public.draft_upload_sessions for select using(author_id=auth.uid());
drop policy if exists own_upload_sessions_create on public.draft_upload_sessions;
create policy own_upload_sessions_create on public.draft_upload_sessions for insert with check(
 author_id=auth.uid() and public.owns_chapter(chapter_id)
 and storage_path=public.chapter_project(chapter_id)::text||'/'||chapter_id::text||'/'||auth.uid()::text||'/direct/'||id::text||'/manuscript.'||case when content_type='application/msword' then 'doc' else 'docx' end
 and content_type in ('application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document')
 and submission_id is null
);
create or replace function public.complete_direct_draft_upload(p_session_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare u public.draft_upload_sessions%rowtype;c public.chapters%rowtype;expected text;first_exists boolean;second_exists boolean;released boolean;prod public.chapter_production%rowtype;object_size bigint;object_type text;result uuid;deadline date;
begin
 select * into u from public.draft_upload_sessions where id=p_session_id and author_id=auth.uid() for update;
 if not found then raise exception 'Upload session does not belong to your account'; end if;
 if u.submission_id is not null then return u.submission_id; end if;
 if u.expires_at<now() then raise exception 'The upload session has expired. Please select the file and try again'; end if;
 select * into c from public.chapters where id=u.chapter_id and author_id=auth.uid() for update;
 if not found or c.status::text='rejected' or c.stage::text='complete' then raise exception 'Draft upload is not open for this chapter'; end if;
 select * into prod from public.chapter_production where chapter_id=c.id;
 if prod.editorial_state='complete' then raise exception 'Editorial review is complete; contact the editor before submitting another draft'; end if;
 select exists(select 1 from public.submissions s join public.submission_files f on f.submission_id=s.id where s.chapter_id=c.id and s.stage::text='first_draft') into first_exists;
 select exists(select 1 from public.submissions s join public.submission_files f on f.submission_id=s.id where s.chapter_id=c.id and s.stage::text='second_draft') into second_exists;
 select exists(select 1 from public.peer_review_feedback_packets where chapter_id=c.id and status='sent') into released;
 expected:=case when first_exists and second_exists and prod.third_draft_requested_at is not null then 'final_materials' when first_exists and (released or c.stage::text='second_draft') then 'second_draft' else 'first_draft' end;
 if u.stage::text<>expected or (expected='first_draft' and c.status::text<>'approved' and c.stage::text<>'first_draft') or (c.stage::text='final_materials' and expected<>'final_materials') then raise exception 'The draft stage changed. Refresh the page before uploading'; end if;
 select (metadata->>'size')::bigint,metadata->>'mimetype' into object_size,object_type from storage.objects where bucket_id='chapter-drafts' and name=u.storage_path;
 if object_size is null or object_size<>u.expected_size or object_type is distinct from u.content_type then raise exception 'The uploaded file is missing or its size/type does not match. Please retry'; end if;
 insert into public.submissions(chapter_id,submitted_by,stage,title,response_to_feedback) values(c.id,auth.uid(),u.stage,c.title,u.notes) returning id into result;
 insert into public.submission_files(submission_id,storage_path,file_name,content_type,byte_size) values(result,u.storage_path,u.file_name,u.content_type,u.expected_size);
 select case when expected='first_draft' then second_draft_deadline when expected='second_draft' then final_materials_deadline else null end into deadline from public.books where id=c.book_id;
 update public.chapters set stage=u.stage,status='submitted',current_deadline=deadline,updated_at=now() where id=c.id;
 update public.draft_upload_sessions set submission_id=result where id=u.id;
 return result;
end;
$$;
revoke all on function public.complete_direct_draft_upload(uuid) from public;
grant execute on function public.complete_direct_draft_upload(uuid) to authenticated;
commit;
