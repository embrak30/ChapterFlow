type DraftChapter = { stage: string; status: string; submissions?: { stage: string; submission_files?: unknown[] }[]; peer_review_feedback_packets?: { status: string }[] };
export function draftWorkflow(chapter?: DraftChapter) {
  const firstDraft = Boolean(chapter?.submissions?.some((submission) => submission.stage === "first_draft" && submission.submission_files?.length));
  const secondDraft = Boolean(chapter?.submissions?.some((submission) => submission.stage === "second_draft" && submission.submission_files?.length));
  const secondOpen = firstDraft && (Boolean(chapter?.peer_review_feedback_packets?.some((packet) => packet.status === "sent")) || chapter?.stage === "second_draft");
  const canUpload = Boolean(chapter && chapter.status !== "rejected" && chapter.stage !== "complete" && chapter.stage !== "final_materials" && (chapter.status === "approved" || chapter.stage === "first_draft" || secondOpen));
  return { firstDraft, secondDraft, secondOpen, canUpload, uploadStage: secondOpen ? "second_draft" as const : "first_draft" as const };
}
