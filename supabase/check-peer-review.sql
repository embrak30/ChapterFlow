-- Read-only checks. Run in the Supabase SQL editor; no assignments are changed.
select b.id as book_id, b.title, s.is_open, s.updated_at,
  (select count(*) from public.peer_review_assignments a where a.book_id=b.id) as assignment_count
from public.books b
left join public.peer_review_settings s on s.book_id=b.id
order by b.created_at;

select column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='peer_review_settings'
order by ordinal_position;

select policyname, cmd, qual, with_check
from pg_policies
where schemaname='public' and tablename='peer_review_settings';

select to_regprocedure('public.can_edit_project(uuid)') as project_permission_function;
