type DraftChapter = { stage: string; status: string; submissions?: { stage: string; submission_files?: unknown[] }[]; peer_review_feedback_packets?: { status: string }[]; chapter_production?: {third_draft_requested_at:string|null;editorial_state:string} | {third_draft_requested_at:string|null;editorial_state:string}[] | null };
export function canEditProposal(chapter?: DraftChapter | null) {
  if(!chapter) return true;
  return chapter.stage.includes('proposal') && chapter.status==='revision_requested' && !chapter.submissions?.some(submission=>submission.stage.includes('draft') && submission.submission_files?.length);
}
export function draftWorkflow(chapter?: DraftChapter) {
  const firstDraft = Boolean(chapter?.submissions?.some((submission) => submission.stage === "first_draft" && submission.submission_files?.length));
  const secondDraft = Boolean(chapter?.submissions?.some((submission) => submission.stage === "second_draft" && submission.submission_files?.length));
  const finalDraft = Boolean(chapter?.submissions?.some((submission) => submission.stage === "final_materials" && submission.submission_files?.length));
  const production=Array.isArray(chapter?.chapter_production)?chapter?.chapter_production[0]:chapter?.chapter_production;
  const thirdOpen=Boolean(firstDraft && secondDraft && production?.third_draft_requested_at);
  const secondOpen = firstDraft && (Boolean(chapter?.peer_review_feedback_packets?.some((packet) => packet.status === "sent")) || chapter?.stage === "second_draft");
  const canUpload = Boolean(chapter && chapter.status !== "rejected" && chapter.stage !== "complete" && production?.editorial_state !== 'complete' && (chapter.stage !== "final_materials" || thirdOpen) && (chapter.status === "approved" || chapter.stage === "first_draft" || secondOpen || thirdOpen));
  return { firstDraft, secondDraft, finalDraft, thirdOpen, secondOpen, canUpload, uploadStage: thirdOpen ? "final_materials" as const : secondOpen ? "second_draft" as const : "first_draft" as const };
}
