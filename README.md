# ChapterFlow

ChapterFlow is a Vercel-ready platform prototype for managing an edited book from chapter proposals through final manuscript materials.

## Current Features

- Public call for chapter proposals.
- Google sign-in through Supabase.
- Role-aware dashboards for admin, facilitator, and author.
- Admin control centre for project settings and all submissions.
- Facilitator workspace for assigned review support.
- Author dashboard for proposals, timeline, biography, abstract, and drafts.
- Supabase schema for profiles, books, chapters, submissions, files, reviews, email logs, and facilitator assignments.

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
RESEND_API_KEY=
EMAIL_FROM=
```

## Local Development

```bash
pnpm install
pnpm run dev
```

## Supabase Roles

- `admin`: can edit site/project settings and view all submissions.
- `facilitator`: can view assigned project submissions and make recommendations.
- `author`: can only view and manage their own work.
- legacy `editor` is treated as admin by the app.
