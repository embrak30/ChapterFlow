-- Read-only: distinguish saved reviews from assignment status issues.
select b.title as project, p.full_name as reviewer, p.email,
  c.title as chapter, a.status as assignment_status,
  r.id is not null as review_saved, r.updated_at as last_review_save
from public.peer_review_assignments a
join public.books b on b.id=a.book_id
join public.profiles p on p.id=a.reviewer_id
join public.chapters c on c.id=a.chapter_id
left join public.peer_reviews r on r.assignment_id=a.id
order by b.title, p.full_name, c.title;
