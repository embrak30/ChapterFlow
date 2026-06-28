# ChapterFlow

ChapterFlow is a Vercel-ready prototype for managing an edited book from call for chapter proposals through final manuscript materials.

## What is built

- Editor dashboard with book-level progress metrics.
- Submission board for proposals, drafts, revisions, and final materials.
- Chapter detail panel with document preview placeholder, decision control, editor comments, and email draft approval.
- Public project/call page where contributors choose the edited-book project they are joining.
- Registration preview that captures contributor name, email, role, and selected project.
- Author dashboard with contributor profile, project dates, proposal submission, draft upload placeholder, feedback timeline, biography, and abstract.
- Supabase schema draft for auth profiles, books, chapters, submissions, files, reviews, and email logs.

## Phase 1 status

Phase 1 is implemented as a front-end prototype: public calls, contributor registration intent, selected-project author profile, project timeline, and text-based proposal submission state. The same flow is also available as a static browser preview in `preview/index.html`.

## Recommended production stack

- App and hosting: Next.js on Vercel.
- Auth: Supabase Auth with Google OAuth.
- Database: Supabase Postgres.
- File storage: Supabase Storage bucket named `chapter-files`.
- Email: Resend or Postmark.
- PDF preview: browser PDF rendering for uploaded PDF files, plus DOCX download for Word files.

## Local development

Install dependencies and run:

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

This workspace currently has Node available but no `npm` binary on the shell path, so the source has been created without installing packages locally.

## Environment variables for the real build

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
RESEND_API_KEY=
EMAIL_FROM=
```

## Next implementation steps

1. Connect Google login and assign the first editor account.
2. Replace sample data in `lib/sample-data.ts` with Supabase queries.
3. Add protected routes for `/editor` and `/author`.
4. Store uploads in Supabase Storage and record file metadata in `submission_files`.
5. Send editor-approved decision emails through Resend and log them in `email_logs`.
6. Add manuscript export tools once final chapter files are complete.
