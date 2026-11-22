
export type ProductionRecord = {
  chapter_id: string; editorial_state: string; editorial_notes: string | null;
  editorial_completed_at: string | null; third_draft_requested_at: string | null;
  final_materials_requested_at: string | null; final_biography: string | null;
  final_affiliation: string | null; biography_received_at: string | null;
};
export type TrackingChapter = {
  id: string; title: string; stage: string; status: string;
  profiles?: { full_name: string | null; email: string | null } | null;
  editorial_submission_id?: string | null;
  submissions?: { id: string; stage: string; created_at: string; submission_files?: { id: string; file_name?: string }[] }[];
  peer_review_feedback_packets?: { status: string; sent_at: string | null; included_review_ids?: string[] }[];
  email_logs?: { status: string; sent_at: string | null; subject: string; email_kind?: string | null }[];
  chapter_production?: ProductionRecord | ProductionRecord[] | null;
};
export function chapterProgress(chapter: TrackingChapter, assignments: { chapter_id: string; batch_id?: string | null; peer_reviews?: { id: string }[] }[], required: number, signedAt?: string) {
  const uploaded = (stage: string) => [...(chapter.submissions ?? [])].filter((submission) => submission.stage===stage && submission.submission_files?.length).sort((a,b)=>b.created_at.localeCompare(a.created_at))[0];
  const first = uploaded('first_draft'), second = uploaded('second_draft'), final = uploaded('final_materials');
  const work = assignments.filter((assignment)=>assignment.chapter_id===chapter.id);
  const reviews = new Set(work.flatMap((assignment)=>(assignment.peer_reviews ?? []).map((review)=>review.id)));
  const packets = (chapter.peer_review_feedback_packets ?? []).filter((packet)=>packet.status==='sent' && packet.sent_at).sort((a,b)=>(b.sent_at ?? '').localeCompare(a.sent_at ?? ''));
  const shared = new Set(packets.flatMap((packet)=>packet.included_review_ids ?? []));
  const production = Array.isArray(chapter.chapter_production) ? chapter.chapter_production[0] : chapter.chapter_production ?? undefined;
  const agreementRequest = (chapter.email_logs ?? []).filter((log)=>log.status==='sent' && (log.email_kind==='agreement_request' || /author agreement|contribution and publication licence agreement/i.test(log.subject))).sort((a,b)=>(b.sent_at ?? '').localeCompare(a.sent_at ?? ''))[0];
  const revisionReturned = Boolean(final && (!production?.third_draft_requested_at || final.created_at >= production.third_draft_requested_at));
  const currentBiography = Boolean(production?.biography_received_at && (!production.final_materials_requested_at || production.biography_received_at >= production.final_materials_requested_at));
  let next = 'Awaiting first draft';
  if (first) {
    if (reviews.size<required) next=work.length ? 'Awaiting peer reviews' : 'Assign peer reviewers';
    else if (shared.size<required) next='Send peer review feedback';
    else if (!second) next='Awaiting second draft';
    else if (production?.third_draft_requested_at && !revisionReturned) next='Awaiting final draft';
    else if (revisionReturned && chapter.editorial_submission_id!==final?.id) next='Select final editorial draft';
    else if (production?.editorial_state!=='complete') next=revisionReturned ? 'Review revised final draft' : 'Editorial review';
    else if (!signedAt) next=agreementRequest ? 'Awaiting signed agreement' : 'Request agreement';
    else if (!currentBiography) next=production?.final_materials_requested_at ? 'Awaiting author materials' : 'Request author materials';
    else next='Ready for publication';
  }
  return {first,second,final,assigned:work.length,reviewCount:reviews.size,required,sharedCount:shared.size,feedbackSentAt:packets[0]?.sent_at,agreementRequestedAt:agreementRequest?.sent_at,signedAt,production,next,revisionReturned,currentBiography};
}
