# Project access rollout

1. Back up the database, then run `schema.sql` followed by `project-access.sql` in the Supabase SQL editor. On later updates always run `project-access.sql` last; the older schema contains platform-wide policies that this migration replaces.
2. Before committing the migration in production, check the `platform_owners` seed: existing `books.editor_id` accounts become super admins on the first run. Remove any seed accounts that should not own the platform. Subsequent runs preserve the owner list.
3. Deploy the app. Select a project and use the Super admin project-team form to assign an existing account as admin or facilitator. Users must have signed in once before assignment.
4. Test with separate accounts: a magazine editor, a facilitator, an author, and the platform owner. Verify the magazine editor cannot read Mission Integrity drafts, email its authors, or change its settings, including direct file links. Verify facilitators cannot write. Public open calls remain discoverable.

Magazine projects support issues and an article proposal/draft/feedback workflow. Issue submission records are separate per author and issue. Publication layout and combined PDF generation are not included in this migration.

No production database migration or live account isolation tests are performed by the local build. Apply and verify these policies in a test Supabase project before using delegated accounts in production.
