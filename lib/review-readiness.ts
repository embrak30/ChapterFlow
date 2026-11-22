type Candidate={id:string;author_id?:string;stage:string;status:string;submissions?:{stage:string;submission_files?:unknown[]}[];peer_review_files?:{status:string}[]};
export function reviewReadiness(chapter:Candidate,assignments:{chapter_id:string;reviewer_id:string}[]) {
  if(chapter.status==='rejected'||chapter.stage==='complete') return 'Chapter is rejected or complete';
  if(!chapter.submissions?.some(submission=>submission.stage==='first_draft'&&submission.submission_files?.length)) return 'First-draft file not uploaded';
  if(!chapter.peer_review_files?.some(file=>file.status==='approved')) return 'Approved anonymised copy needed';
  if(assignments.some(assignment=>assignment.chapter_id===chapter.id)) return 'Reviewers already assigned to this chapter';
  if(assignments.some(assignment=>assignment.reviewer_id===chapter.author_id)) return 'Author is already reviewing in another group';
  return null;
}
