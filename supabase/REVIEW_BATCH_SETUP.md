# Review batches

Run `peer-review-batches.sql` in Supabase after the existing project-access migration, then deploy the updated application. This migration keeps all assignments and reviews and tags existing assignments as the Original review group. Do not reset peer review or regenerate the original group.

In Admin > Peer review > Assignments:

1. Prepare and approve the anonymised copies for the new authors.
2. Enter a batch name and deadline, choose two reviews per chapter, and select only the three new authors.
3. Check the assignment preview. It will contain six assignments, with every participant reviewing the other two chapters.
4. Confirm and create the batch. Creation does not send email.
5. Select the new Review group, ensure the project is open to reviewers in Settings, then Send batch invitations.

Use the Review group selector to view progress and received feedback for one batch or all batches. Reminders use the selected group's deadline. Previously assigned authors cannot join a new batch through this workflow.

The database creates all assignments in one transaction and rejects overlapping participants, wrong-project chapters, duplicate authors and chapters without approved review copies. Apply the migration in a test database before production. Local automated checks cover the assignment preview, not live Supabase execution.
