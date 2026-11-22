"use client";
import {useActionState,useState} from 'react';
import {assignAdditionalReviewer,sendSingleReviewerInvitation} from '@/app/actions';
type Chapter={id:string;title:string;profiles?:{full_name:string|null;email:string|null}|null};
type Assignment={id:string;chapter_id:string;is_manual?:boolean;notified_at:string|null;review_deadline?:string|null;status:string;reviewer?:{full_name:string|null;email:string|null}|{full_name:string|null;email:string|null}[]|null};

export function ManualReviewerAssigner({bookId,chapters,assignments}:{bookId:string;chapters:Chapter[];assignments:Assignment[]}) {
  const [formKey,setFormKey]=useState(0);
  return <section className="peer-coverage-list"><h3>Assign an additional reviewer</h3><ManualReviewerForm key={formKey} bookId={bookId} chapters={chapters} onNext={()=>setFormKey(formKey+1)}/>
    <details><summary>Additional reviewer assignments ({assignments.filter(assignment=>assignment.is_manual).length})</summary>{assignments.filter(assignment=>assignment.is_manual).map(assignment=>{
      const reviewer=Array.isArray(assignment.reviewer)?assignment.reviewer[0]:assignment.reviewer;
      return <div className="review-history" key={assignment.id}><strong>{chapters.find(chapter=>chapter.id===assignment.chapter_id)?.title || 'Assigned chapter'}</strong><p>{reviewer?.full_name || reviewer?.email || 'Reviewer'} · {assignment.status==='completed'?'Review completed':'Review outstanding'}</p>{assignment.notified_at?<p className="muted">Invitation sent</p>:<SingleReviewInvitation assignmentId={assignment.id}/>}</div>;
    })}</details>
  </section>;
}

function ManualReviewerForm({bookId,chapters,onNext}:{bookId:string;chapters:Chapter[];onNext:()=>void}) {
  const [chapterId,setChapterId]=useState('');const [email,setEmail]=useState('');const [deadline,setDeadline]=useState('');const [confirmed,setConfirmed]=useState(false);
  const [state,action,pending]=useActionState(assignAdditionalReviewer,{success:false,error:'',assignmentId:''});
  const frozen=pending||state.success;
  const contacts=[...new Map(chapters.filter(chapter=>chapter.profiles?.email).map(chapter=>[chapter.profiles?.email,chapter.profiles])).values()];
  return <>
    <form action={action}>
      <input type="hidden" name="book_id" value={bookId}/>
      <label>Chapter<select name="chapter_id" value={chapterId} required disabled={frozen} onChange={event=>{setChapterId(event.target.value);setConfirmed(false);}}><option value="">Select an approved anonymised chapter</option>{chapters.map(chapter=><option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</select></label>
      <label>Reviewer Google sign-in email<input name="reviewer_email" type="email" list="manual-reviewer-contacts" required value={email} disabled={frozen} onChange={event=>{setEmail(event.target.value);setConfirmed(false);}}/></label>
      <datalist id="manual-reviewer-contacts">{contacts.map(contact=><option key={contact?.email} value={contact?.email ?? ''}>{contact?.full_name}</option>)}</datalist>
      <label>Review deadline<input name="review_deadline" type="date" required value={deadline} disabled={frozen} onChange={event=>{setDeadline(event.target.value);setConfirmed(false);}}/></label>
      <p className="muted">External reviewers must sign in once before assignment. Creating this assignment does not send email or change existing reviews.</p>
      {chapterId&&email?<p className="notice">Assign {chapters.find(chapter=>chapter.id===chapterId)?.title} to {email}. This reviewer receives only the approved anonymised copy.</p>:null}
      <label className="check-row"><input type="checkbox" checked={confirmed} disabled={frozen} onChange={event=>setConfirmed(event.target.checked)}/><span>I have checked the chapter and reviewer.</span></label>
      <button type="submit" className="primary" disabled={frozen||!confirmed}>{pending?'Assigning...':'Create additional assignment'}</button>
      {state.error?<p role="alert">{state.error}</p>:null}
      {state.success?<p role="status">Assignment created. Send its invitation below when ready.</p>:null}
    </form>
    {state.success?<><SingleReviewInvitation assignmentId={state.assignmentId}/><button type="button" onClick={onNext}>Assign another reviewer</button></>:null}
  </>;
}
function SingleReviewInvitation({assignmentId}:{assignmentId:string}) {
  const [state,action,pending]=useActionState(sendSingleReviewerInvitation,{success:false,error:''});
  return <form action={action} onSubmit={event=>{if(!window.confirm('Send this reviewer an invitation for this assignment only?'))event.preventDefault();}}><input type="hidden" name="assignment_id" value={assignmentId}/><button type="submit" disabled={pending||state.success}>{pending?'Sending invitation...':state.success?'Invitation sent':'Send reviewer invitation'}</button>{state.error?<p role="alert">{state.error}</p>:null}</form>;
}
