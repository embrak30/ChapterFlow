# Supabase Setup

Run `supabase/schema.sql` in the Supabase SQL Editor.

Set Google OAuth in Supabase Authentication Providers, then set these redirect URLs:

```text
http://localhost:3000/auth/callback
https://YOUR-VERCEL-URL.vercel.app/auth/callback
```

After first sign-in, set roles in `Table Editor > profiles`:

```text
role = admin
role = facilitator
role = author
```

Use `facilitator_books` to assign facilitator users to the projects they can review.
