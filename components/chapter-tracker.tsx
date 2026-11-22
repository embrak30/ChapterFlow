"use client";

import { useActionState, useState } from "react";
import { chapterProgress, type TrackingChapter } from "@/lib/chapter-progress";
import { saveChapterProduction, submitFinalAuthorMaterials, selectEditorialDraft } from "@/app/actions";
import type { ProductionRecord } from "@/lib/chapter-progress";

type Assignment = { chapter_id:string;batch_id?:string|null;peer_reviews?:{id:string}[] };
function date(value?:string|null) { return value ? new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(new Date(value)) : '—'; }

export function ChapterTracker({chapters,assignments,batches,required,acceptances,agreementId}:{
  chapters:TrackingChapter[];assignments:Assignment[];batches:{id:string;required_review_count:number}[];
  required:number;acceptances:{chapter_id:string;agreement_id:string;accepted_at:string}[];agreementId?:string;
}) {
  const [search,setSearch]=useState(''); const [filter,setFilter]=useState('all'); const [view,setView]=useState('reviews'); const [selectedId,setSelectedId]=useState('');
  const rows=chapters.map(chapter=>{
    const batch=batches.find(batch=>assignments.some(assignment=>assignment.chapter_id===chapter.id && assignment.batch_id===batch.id));
    const acceptance=acceptances.find(acceptance=>acceptance.chapter_id===chapter.id && (!agreementId || acceptance.agreement_id===agreementId));
    return {chapter,progress:chapterProgress(chapter,assignments,batch?.required_review_count ?? required,acceptance?.accepted_at)};
  });
  const shown=rows.filter(({chapter,progress:p})=>`${chapter.title} ${chapter.profiles?.full_name ?? ''}`.toLowerCase().includes(search.toLowerCase()) && (filter==='all'||(filter==='ready'&&p.next==='Send peer review feedback')||(filter==='author'&&p.next.startsWith('Awaiting'))||(filter==='editorial'&&/Editorial review|Review revised/.test(p.next))||(filter==='agreement'&&!p.signedAt)||(filter==='publication'&&p.next==='Ready for publication')));
  const selected=rows.find(row=>row.chapter.id===selectedId);
  const groups=[{id:'reviews',label:'Peer review & second draft'},{id:'editorial',label:'Editorial & final draft'},{id:'materials',label:'Agreement & author details'}];
  return <section className="panel chapter-tracker">
    <div className="section-heading"><p className="eyebrow">Chapter tracking</p><h2>Where each chapter stands</h2><p className="muted">{rows.filter(row=>row.progress.next==='Send peer review feedback').length} ready for feedback · {rows.filter(row=>row.progress.next==='Awaiting second draft').length} awaiting second draft · {rows.filter(row=>row.progress.next==='Ready for publication').length} ready for publication</p></div>
    <div className="form-grid"><label>Find chapter or author<input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search" /></label><label>Next action<select value={filter} onChange={event=>setFilter(event.target.value)}><option value="all">All chapters</option><option value="ready">Ready to send peer feedback</option><option value="author">Awaiting an author response</option><option value="editorial">Editorial review needed</option><option value="agreement">Agreement not signed</option><option value="publication">Ready for publication</option></select></label></div>
    <nav className="peer-section-tabs" aria-label="Tracking stages">{groups.map(group=><button type="button" key={group.id} className={view===group.id?'active':''} aria-pressed={view===group.id} onClick={()=>setView(group.id)}>{group.label}</button>)}</nav>
    <div className="tracking-table-wrap"><table className="tracking-table"><thead><tr><th>Chapter / author</th>{view==='reviews'?<><th>First draft</th><th>Reviewers assigned</th><th>Reviews received</th><th>Feedback sent / second draft requested</th><th>Second draft</th></>:view==='editorial'?<><th>Second draft</th><th>Working draft</th><th>Editorial review</th><th>Further revision requested</th><th>Third / final draft</th></>:<><th>Agreement requested</th><th>Agreement signed</th><th>Author details requested</th><th>Current biography</th><th>Affiliation</th></>}<th>Next action</th></tr></thead>
    <tbody>{shown.map(({chapter,progress:p})=><tr key={chapter.id}><th scope="row"><button type="button" onClick={()=>setSelectedId(chapter.id)}>{chapter.title}</button><small>{chapter.profiles?.full_name || chapter.profiles?.email || 'Author'}</small></th>{view==='reviews'?<><td>{p.first?'Received':'Awaiting'}<small>{date(p.first?.created_at)}</small></td><td>{p.assigned}/{p.required}</td><td><strong className={p.reviewCount>=p.required?'milestone-complete':''}>{p.reviewCount}/{p.required}{p.reviewCount>=p.required?' complete':''}</strong></td><td>{p.sharedCount?`${p.sharedCount}/${p.required} shared`:p.reviewCount>=p.required?'Ready to send':'Not sent'}<small>{date(p.feedbackSentAt)}</small></td><td>{p.second?'Received':p.feedbackSentAt?'Awaiting author':'Not yet requested'}<small>{date(p.second?.created_at)}</small></td></>:view==='editorial'?<><td>{date(p.second?.created_at)}</td><td>{chapter.editorial_submission_id?'Selected':'Not selected'}</td><td>{p.production?.editorial_state?.replaceAll('_',' ') || 'Not started'}<small>{date(p.production?.editorial_completed_at)}</small></td><td>{date(p.production?.third_draft_requested_at)}</td><td>{p.revisionReturned?'Received':p.production?.third_draft_requested_at?'Awaiting author':'Not required'}<small>{date(p.final?.created_at)}</small></td></>:<><td>{date(p.agreementRequestedAt)}</td><td>{p.signedAt?'Signed':'Awaiting signature'}<small>{date(p.signedAt)}</small></td><td>{date(p.production?.final_materials_requested_at)}</td><td>{p.production?.biography_received_at?'Received':'Missing'}<small>{date(p.production?.biography_received_at)}</small></td><td>{p.production?.final_affiliation || 'Missing'}</td></>}<td><strong>{p.next}</strong><button type="button" onClick={()=>setSelectedId(chapter.id)}>Manage chapter</button></td></tr>)}</tbody></table>{!shown.length?<p className="muted">No chapters match this filter.</p>:null}</div>
    {selected?<ChapterMilestoneEditor key={selected.chapter.id} chapter={selected.chapter} production={selected.progress.production}/>:null}
  </section>;
}

function ChapterMilestoneEditor({chapter,production}:{chapter:TrackingChapter;production?:ProductionRecord}) {
  const [state,action,pending]=useActionState(saveChapterProduction,{success:false,error:''});
  return <section className="admin-tools"><form action={selectEditorialDraft}><input type="hidden" name="chapter_id" value={chapter.id}/><label>Working manuscript<select name="submission_id" defaultValue={chapter.editorial_submission_id ?? ''} required><option value="">Select a revised draft</option>{chapter.submissions?.filter(submission=>['second_draft','final_materials'].includes(submission.stage)&&submission.submission_files?.length).map(submission=><option value={submission.id} key={submission.id}>{submission.stage==='second_draft'?'Second draft':'Third / final draft'} · {date(submission.created_at)}</option>)}</select></label><button type="submit">Select for editorial review</button></form><form action={action} onSubmit={event=>{
    const button=(event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
    if(button?.value!=='save' && !window.confirm('Send this request to the author and record the successful send?')) event.preventDefault();
  }}>
    <h3>{chapter.title}</h3><input type="hidden" name="chapter_id" value={chapter.id}/>
    <label>Editorial review<select name="editorial_state" defaultValue={production?.editorial_state ?? 'not_started'}><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="revision_requested">Further revision needed</option><option value="complete">Editorial review completed</option></select></label>
    <label>Editorial feedback / message to author<textarea name="editorial_notes" defaultValue={production?.editorial_notes ?? ''}/></label>
    <div className="button-row"><button disabled={pending} type="submit" name="mode" value="save">{pending?'Saving...':'Save editorial decision'}</button><button disabled={pending} type="submit" name="mode" value="revision">Send request for third / final draft</button><button disabled={pending} type="submit" name="mode" value="agreement">Send agreement request</button><button disabled={pending} type="submit" name="mode" value="materials">Request current biography & affiliation</button></div>
    {state.error?<p role="alert">{state.error}</p>:null}{state.success?<p role="status">Saved. Any requested email has been sent and recorded.</p>:null}
    {production?.final_biography?<details><summary>Current publication biography</summary><p>{production.final_biography}</p><p>{production.final_affiliation}</p></details>:null}
  </form></section>;
}

export function FinalAuthorMaterials({chapterId,production}:{chapterId:string;production?:ProductionRecord}) {
  const [state,action,pending]=useActionState(submitFinalAuthorMaterials,{success:false,error:''});
  if(!production?.final_materials_requested_at) return null;
  return <form action={action} className="admin-tools"><h3>Final author details</h3><input type="hidden" name="chapter_id" value={chapterId}/><label>Current publication biography<textarea name="biography" minLength={50} required defaultValue={production.final_biography ?? ''}/></label><label>Institutional affiliation / professional role<input name="affiliation" required defaultValue={production.final_affiliation ?? ''}/></label><button className="primary" disabled={pending} type="submit">{pending?'Saving...':'Submit final author details'}</button>{state.error?<p role="alert">{state.error}</p>:null}{state.success?<p role="status">Your final author details have been received.</p>:null}</form>;
}
