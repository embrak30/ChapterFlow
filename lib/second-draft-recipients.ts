export function hasSubmittedSecondDraft(chapter: {
  submissions?: { stage: string; submission_files?: unknown[] | null }[] | null;
}) {
  return (chapter.submissions ?? []).some(
    (submission) => submission.stage === 'second_draft' && (submission.submission_files?.length ?? 0) > 0
  );
}
