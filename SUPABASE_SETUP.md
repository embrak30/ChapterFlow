# Supabase Setup for ChapterFlow

This sets up Google sign-in and database recording for contributor profiles, calls for chapters, proposals, drafts, reviews, and email logs.

## 1. Create or Choose a Supabase Project

Use a fresh Supabase project if possible. If your free account already has two active projects, either pause/delete an unused project or create the ChapterFlow project under another account/organization you control long term.

Copy these from Supabase:

- Project URL
- anon/publishable key

Add them locally in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Use the same values later in Vercel Environment Variables.

For this project, Codex needs these two values from you to finish local wiring:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Do not paste your service-role key into chat unless we explicitly need server-only admin automation later.

## 2. Run the Database Schema

In Supabase:

1. Open your project.
2. Go to `SQL Editor`.
3. Paste the contents of `supabase/schema.sql`.
4. Run it.

This creates:

- `profiles`
- `books`
- `chapters`
- `submissions`
- `submission_files`
- `reviews`
- `email_logs`
- Row Level Security policies
- A trigger that creates a profile automatically when someone signs in with Google

## 3. Enable Google Sign-In in Supabase

In Supabase:

1. Go to `Authentication`.
2. Go to `Providers`.
3. Open `Google`.
4. Enable Google.
5. Keep this page open because it shows the callback URL you need for Google Cloud.

The callback URL usually looks like:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

## 4. Create Google OAuth Credentials

In Google Cloud Console:

1. Create or select a Google Cloud project.
2. Go to `APIs & Services`.
3. Open `OAuth consent screen` and complete the basic app details.
4. Go to `Credentials`.
5. Create `OAuth client ID`.
6. Choose `Web application`.
7. Add the Supabase callback URL as an authorized redirect URI.
8. Copy the Google Client ID and Client Secret.

Return to Supabase `Authentication > Providers > Google` and paste:

- Client ID
- Client Secret

Save the provider.

## 5. Set Supabase Redirect URLs

In Supabase `Authentication > URL Configuration`, set:

Local development:

```text
Site URL: http://localhost:3000
Redirect URL: http://localhost:3000/auth/callback
```

Vercel production later:

```text
Site URL: https://YOUR-APP.vercel.app
Redirect URL: https://YOUR-APP.vercel.app/auth/callback
```

## 6. Set Admin, Facilitator, and Author Roles

After you sign in with Google once, Supabase will create your user and the database trigger will create your `profiles` row.

Then go to `Table Editor > profiles`, find your email address, and set one of these roles:

```text
role = admin
```

Use `admin` for the site owner/administrator. Admin users can configure the public call, manage projects, manage roles, and see all submissions.

Use:

```text
role = facilitator
```

for people who can support review work. Facilitators can view assigned project submissions and make recommendations, but should not edit site-wide settings.

Use:

```text
role = author
```

for normal contributors. Authors should only see their own profile, proposal, drafts, and feedback.

If your existing database still has the older `editor` role, the app treats `editor` as `admin` for backwards compatibility.

Facilitator project assignment is stored in `facilitator_books`, linking a facilitator profile to the book/project they can support.

## 7. Add the First Book Project

Once your profile is marked as editor, create the first book/call record in `books`.

Fields to complete:

- `title`: `LYIS Leadership With Mission Integrity`
- `description`: the short call description
- `editor_id`: your profile/user id
- proposal and draft deadlines

## 8. What Gets Recorded

When the app is connected to Supabase:

- Google sign-in creates a user in `auth.users`.
- The trigger creates their row in `profiles`.
- Their selected call links to a `books` record.
- Their proposal becomes a `chapters` row plus a `submissions` row.
- Later drafts create new `submissions`.
- Uploaded files are tracked in `submission_files`.
- Editor decisions and feedback are stored in `reviews`.
- Sent messages are stored in `email_logs`.

## Official Docs

- Supabase Google login: https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase Next.js auth: https://supabase.com/docs/guides/auth/server-side/nextjs
- Vercel environment variables: https://vercel.com/docs/environment-variables
