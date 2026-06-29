do $$
begin
  if not exists (select 1 from pg_type where typname = 'book_role') then
    create type public.book_role as enum ('admin', 'facilitator', 'editor', 'author');
  end if;
end;
$$;

alter type public.book_role add value if not exists 'admin';
alter type public.book_role add value if not exists 'facilitator';

do $$
begin
  if not exists (select 1 from pg_type where typname = 'chapter_stage') then
    create type public.chapter_stage as enum ('proposal', 'proposal_revision', 'first_draft', 'second_draft', 'final_materials', 'complete');
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'chapter_status') then
    create type public.chapter_status as enum ('pending_review', 'approved', 'revision_requested', 'rejected', 'submitted', 'overdue', 'complete');
  end if;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role public.book_role not null default 'author',
  biography text,
  created_at timestamptz not null default now()
);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text default 'Call for chapter proposals',
  description text,
  call_summary text,
  author_guidelines text,
  chapter_spaces text,
  publication_target text,
  public_status text not null default 'draft',
  editor_id uuid not null references public.profiles(id),
  proposal_deadline date,
  decision_date date,
  first_draft_deadline date,
  second_draft_deadline date,
  final_materials_deadline date,
  created_at timestamptz not null default now()
);

alter table public.books add column if not exists subtitle text default 'Call for chapter proposals';
alter table public.books add column if not exists call_summary text;
alter table public.books add column if not exists author_guidelines text;
alter table public.books add column if not exists chapter_spaces text;
alter table public.books add column if not exists publication_target text;
alter table public.books add column if not exists public_status text not null default 'draft';
alter table public.books add column if not exists decision_date date;

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  title text not null,
  abstract text,
  proposal_outline text,
  stage public.chapter_stage not null default 'proposal',
  status public.chapter_status not null default 'pending_review',
  current_deadline date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id),
  stage public.chapter_stage not null,
  title text,
  abstract text,
  proposal_outline text,
  author_biography text,
  response_to_feedback text,
  created_at timestamptz not null default now()
);

create table if not exists public.submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  content_type text,
  byte_size bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  submission_id uuid references public.submissions(id) on delete set null,
  reviewer_id uuid not null references public.profiles(id),
  decision public.chapter_status not null,
  feedback text,
  created_at timestamptz not null default now()
);

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  recipient_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'draft',
  sent_by uuid references public.profiles(id),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.facilitator_books (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (facilitator_id, book_id)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'New contributor'), coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.chapters enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_files enable row level security;
alter table public.reviews enable row level security;
alter table public.email_logs enable row level security;
alter table public.facilitator_books enable row level security;

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role::text in ('admin', 'editor'));
$$;

create or replace function public.is_facilitator_for(target_book_id uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.facilitator_books fb
    join public.profiles p on p.id = fb.facilitator_id
    where fb.book_id = target_book_id and fb.facilitator_id = auth.uid() and p.role::text = 'facilitator'
  );
$$;

drop policy if exists "Admins can manage all profiles" on public.profiles;
create policy "Admins can manage all profiles" on public.profiles using (public.is_admin());
drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile" on public.profiles for select using (id = auth.uid());
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile" on public.profiles for insert with check (id = auth.uid() and role = 'author');
drop policy if exists "Facilitators can view assigned author profiles" on public.profiles;
create policy "Facilitators can view assigned author profiles" on public.profiles for select using (
  exists (
    select 1
    from public.chapters c
    where c.author_id = profiles.id
      and public.is_facilitator_for(c.book_id)
  )
);
drop policy if exists "Admins can manage books" on public.books;
create policy "Admins can manage books" on public.books using (public.is_admin());
drop policy if exists "Authors can view books" on public.books;
create policy "Authors can view books" on public.books for select using (true);
drop policy if exists "Admins can manage chapters" on public.chapters;
create policy "Admins can manage chapters" on public.chapters using (public.is_admin());
drop policy if exists "Facilitators can view assigned chapters" on public.chapters;
create policy "Facilitators can view assigned chapters" on public.chapters for select using (public.is_facilitator_for(book_id));
drop policy if exists "Authors can view their chapters" on public.chapters;
create policy "Authors can view their chapters" on public.chapters for select using (author_id = auth.uid());
drop policy if exists "Authors can create chapters" on public.chapters;
create policy "Authors can create chapters" on public.chapters for insert with check (author_id = auth.uid());
drop policy if exists "Admins can manage submissions" on public.submissions;
create policy "Admins can manage submissions" on public.submissions using (public.is_admin());
drop policy if exists "Facilitators can view assigned submissions" on public.submissions;
create policy "Facilitators can view assigned submissions" on public.submissions for select using (
  exists (
    select 1
    from public.chapters c
    where c.id = submissions.chapter_id
      and public.is_facilitator_for(c.book_id)
  )
);
drop policy if exists "Authors can manage their submissions" on public.submissions;
create policy "Authors can manage their submissions" on public.submissions using (submitted_by = auth.uid()) with check (submitted_by = auth.uid());
drop policy if exists "Admins can manage submission files" on public.submission_files;
create policy "Admins can manage submission files" on public.submission_files using (public.is_admin());
drop policy if exists "Authors can manage their submission files" on public.submission_files;
create policy "Authors can manage their submission files" on public.submission_files using (
  exists (select 1 from public.submissions s where s.id = submission_files.submission_id and s.submitted_by = auth.uid())
) with check (
  exists (select 1 from public.submissions s where s.id = submission_files.submission_id and s.submitted_by = auth.uid())
);
drop policy if exists "Facilitators can view assigned submission files" on public.submission_files;
create policy "Facilitators can view assigned submission files" on public.submission_files for select using (
  exists (
    select 1
    from public.submissions s
    join public.chapters c on c.id = s.chapter_id
    where s.id = submission_files.submission_id
      and public.is_facilitator_for(c.book_id)
  )
);
drop policy if exists "Admins can manage reviews" on public.reviews;
create policy "Admins can manage reviews" on public.reviews using (public.is_admin());
drop policy if exists "Facilitators can review assigned chapters" on public.reviews;
create policy "Facilitators can review assigned chapters" on public.reviews using (
  exists (select 1 from public.chapters c where c.id = reviews.chapter_id and public.is_facilitator_for(c.book_id))
) with check (
  reviewer_id = auth.uid()
  and exists (select 1 from public.chapters c where c.id = reviews.chapter_id and public.is_facilitator_for(c.book_id))
);
drop policy if exists "Authors can read reviews for their chapters" on public.reviews;
create policy "Authors can read reviews for their chapters" on public.reviews for select using (exists (select 1 from public.chapters c where c.id = reviews.chapter_id and c.author_id = auth.uid()));
drop policy if exists "Admins can manage facilitator assignments" on public.facilitator_books;
create policy "Admins can manage facilitator assignments" on public.facilitator_books using (public.is_admin());
drop policy if exists "Facilitators can read their assignments" on public.facilitator_books;
create policy "Facilitators can read their assignments" on public.facilitator_books for select using (facilitator_id = auth.uid());
