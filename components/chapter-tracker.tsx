"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { chapterProgress, type TrackingChapter } from "@/lib/chapter-progress";
import { saveChapterProduction, submitFinalAuthorMaterials, selectEditorialDraft } from "@/app/actions";
import type { ProductionRecord } from "@/lib/chapter-progress";

type Assignment = { chapter_id:string;batch_id?:string|null;peer_reviews?:{id:string}[]; reviewer?:{full_name:string|null;email:string|null}|{full_name:string|null;email:string|null}[]|null };
function date(value?:string|null) { return value ? new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(new Date(value)) : '—'; }

export function ChapterTracker({chapters,assignments,batches,required,acceptances,agreementId,onOpenPeerReview}:{
  chapters:TrackingChapter[];assignments:Assignment[];batches:{id:string;required_review_count:number}[];
  required:number;acceptances:{chapter_id:string;agreement_id:string;accepted_at:string}[];agreementId?:string;onOpenPeerReview?:()=>void;
}) {
  const [search,setSearch]=useState(''); const [filter,setFilter]=useState('all'); const [view,setView]=useState('reviews'); const [selectedId,setSelectedId]=useState('');
  const chapterHeading=useRef<HTMLHeadingElement>(null);
  const trackerHeading=useRef<HTMLHeadingElement>(null);
  const [chapterView,setChapterView]=useState('overview');
  useEffect(()=>{if(selectedId){chapterHeading.current?.focus();chapterHeading.current?.scrollIntoView({block:'start'});} },[selectedId]);
  function openChapter(id:string){setChapterView('overview');setSelectedId(id);}
  function back(){setSelectedId('');requestAnimationFrame(()=>{trackerHeading.current?.focus();trackerHeading.current?.scrollIntoView({block:'start'});});}
  const rows=chapters.map(chapter=>{
    const batch=batches.find(batch=>assignments.some(assignment=>assignment.chapter_id===chapter.id && assignment.batch_id===batch.id));
    const acceptance=acceptances.find(acceptance=>acceptance.chapter_id===chapter.id && (!agreementId || acceptance.agreement_id===agreementId));
    return {chapter,progress:chapterProgress(chapter,assignments,batch?.required_review_count ?? required,acceptance?.accepted_at)};
  });
  const shown=rows.filter(({chapter,progress:p})=>`${chapter.title} ${chapter.profiles?.full_name ?? ''}`.toLowerCase().includes(search.toLowerCase()) && (filter==='all'||(filter==='unassigned'&&p.first&&!p.assigned)||(filter==='missingdraft'&&!p.first)||(filter==='ready'&&p.next==='Send peer review feedback')||(filter==='author'&&p.next.startsWith('Awaiting'))||(filter==='editorial'&&/Editorial review|Review revised|Select final editorial/.test(p.next))||(filter==='agreement'&&!p.signedAt)||(filter==='publication'&&p.next==='Ready for publication')));
  const selected=rows.find(row=>row.chapter.id===selectedId);
  const groups=[{id:'reviews',label:'Peer review & second draft'},{id:'editorial',label:'Editorial & final draft'},{id:'materials',label:'Agreement & author details'}];
  if(selected) {
    const {chapter,progress:p}=selected;
    const chapterAssignments=assignments.filter(assignment=>assignment.chapter_id===chapter.id);
    return <section className="panel chapter-tracker chapter-focus">
      <button className="chapter-back" type="button" onClick={back}>Back to chapter tracking</button>
      <header><p className="eyebrow">Chapter workspace</p><h2 ref={chapterHeading} tabIndex={-1}>{chapter.title}</h2><p className="muted">{chapter.profiles?.full_name || 'Author'} · {chapter.profiles?.email}</p></header>
      <p className="notice">Next action: {p.next}</p>
      <nav className="peer-section-tabs" aria-label="Chapter workspace sections">{[{id:'overview',label:'Status & reviews'},{id:'drafts',label:'Draft files'},{id:'editorial',label:'Editorial actions'}].map(tab=><button key={tab.id} type="button" aria-pressed={chapterView===tab.id} className={chapterView===tab.id?'active':''} onClick={()=>setChapterView(tab.id)}>{tab.label}</button>)}</nav>
      <section hidden={chapterView!=='overview'} className="chapter-focus-section">
        <dl className="chapter-milestones"><div><dt>First draft file</dt><dd>{p.first?`Uploaded ${date(p.first.created_at)}`:'No first-draft file uploaded'}</dd></div><div><dt>Peer reviewers assigned</dt><dd>{p.assigned} of {p.required}</dd></div><div><dt>Written reviews received</dt><dd>{p.reviewCount} of {p.required}</dd></div><div><dt>Reviews shared with author</dt><dd>{p.sharedCount} of {p.required} · {date(p.feedbackSentAt)}</dd></div><div><dt>Second draft file</dt><dd>{p.second?`Uploaded ${date(p.second.created_at)}`:p.feedbackSentAt?'Awaiting author':'Not yet requested'}</dd></div><div><dt>Agreement</dt><dd>{p.signedAt?`Signed ${date(p.signedAt)}`:p.agreementRequestedAt?`Requested ${date(p.agreementRequestedAt)}`:'Not requested'}</dd></div></dl>
        {p.first?.submission_files?.map(file=><a className="button-link" key={file.id} href={`/api/submission-files/${file.id}`} target="_blank" rel="noreferrer">View first draft: {file.file_name || 'Word manuscript'}</a>)}
        <h3>Assigned reviewers</h3>
        {chapterAssignments.length?chapterAssignments.map((assignment,index)=>{const person=Array.isArray(assignment.reviewer)?assignment.reviewer[0]:assignment.reviewer;return <p key={index}>{person?.full_name || person?.email || `Reviewer ${index+1}`} · {assignment.peer_reviews?.length?'Review received':'Review outstanding'}</p>;}):<p className="muted">No peer reviewers have been assigned to this chapter.</p>}
        {onOpenPeerReview?<button type="button" onClick={onOpenPeerReview}>Open peer-review workspace</button>:null}
      </section>
      <section hidden={chapterView!=='drafts'} className="chapter-focus-section"><h3>Uploaded manuscript history</h3>
        {[...(chapter.submissions ?? [])].filter(submission=>submission.submission_files?.length).sort((a,b)=>b.created_at.localeCompare(a.created_at)).map(submission=><article className="review-history" key={submission.id}><strong>{submission.stage==='final_materials'?'Third / final draft':submission.stage.replaceAll('_',' ')} · {date(submission.created_at)}</strong>{submission.id===chapter.editorial_submission_id?<span className="pill approved">Selected for editorial review</span>:null}{submission.submission_files?.map(file=><a key={file.id} href={`/api/submission-files/${file.id}`} target="_blank" rel="noreferrer">{file.file_name || 'Open manuscript'}</a>)}</article>)}
        {!chapter.submissions?.some(submission=>submission.submission_files?.length)?<p className="muted">No manuscript files are recorded for this chapter.</p>:null}
      </section>
      <section hidden={chapterView!=='editorial'} className="chapter-focus-section"><ChapterMilestoneEditor key={chapter.id} chapter={chapter} production={p.production}/></section>
    </section>;
  }
  return <section className="panel chapter-tracker">
    <div className="section-heading"><p className="eyebrow">Chapter tracking</p><h2 ref={trackerHeading} tabIndex={-1}>Where each chapter stands</h2><p className="muted">{rows.filter(row=>row.progress.first).length} first-draft files uploaded · {rows.filter(row=>row.progress.first&&!row.progress.assigned).length} awaiting reviewer assignment · {rows.filter(row=>row.progress.next==='Send peer review feedback').length} ready to send feedback · {rows.filter(row=>row.progress.next==='Awaiting second draft').length} awaiting second draft</p></div>
    <div className="form-grid"><label>Find chapter or author<input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search" /></label><label>Next action<select value={filter} onChange={event=>setFilter(event.target.value)}><option value="all">All chapters</option><option value="unassigned">First draft uploaded, reviewers not assigned</option><option value="missingdraft">First draft not uploaded</option><option value="ready">Ready to send peer feedback</option><option value="author">Awaiting an author response</option><option value="editorial">Editorial review needed</option><option value="agreement">Agreement not signed</option><option value="publication">Ready for publication</option></select></label></div>
    <nav className="peer-section-tabs" aria-label="Tracking stages">{groups.map(group=><button type="button" key={group.id} className={view===group.id?'active':''} aria-pressed={view===group.id} onClick={()=>setView(group.id)}>{group.label}</button>)}</nav>
    <div className="tracking-table-wrap"><table className="tracking-table"><thead><tr><th>Chapter / author</th>{view==='reviews'?<><th>First draft file</th><th>Reviewers assigned</th><th>Reviews received</th><th>Feedback sent / second draft requested</th><th>Second draft</th></>:view==='editorial'?<><th>Second draft</th><th>Working draft</th><th>Editorial review</th><th>Further revision requested</th><th>Third / final draft</th></>:<><th>Agreement requested</th><th>Agreement signed</th><th>Author details requested</th><th>Current biography</th><th>Affiliation</th></>}<th>Next action</th></tr></thead>
    <tbody>{shown.map(({chapter,progress:p})=><tr key={chapter.id}><th scope="row"><button type="button" onClick={()=>openChapter(chapter.id)}>{chapter.title}</button><small>{chapter.profiles?.full_name || chapter.profiles?.email || 'Author'}</small></th>{view==='reviews'?<><td>{p.first?'Uploaded':'Not uploaded'}<small>{date(p.first?.created_at)}</small>{p.first?.submission_files?.[0]?.id?<a href={`/api/submission-files/${p.first.submission_files[0].id}`} target="_blank" rel="noreferrer">View first draft</a>:null}</td><td>{p.assigned}/{p.required}</td><td><strong className={p.reviewCount>=p.required?'milestone-complete':''}>{p.reviewCount}/{p.required}{p.reviewCount>=p.required?' complete':''}</strong></td><td>{p.sharedCount?`${p.sharedCount}/${p.required} shared`:p.reviewCount>=p.required?'Ready to send':'Not sent'}<small>{date(p.feedbackSentAt)}</small></td><td>{p.second?'Received':p.feedbackSentAt?'Awaiting author':'Not yet requested'}<small>{date(p.second?.created_at)}</small></td></>:view==='editorial'?<><td>{date(p.second?.created_at)}</td><td>{chapter.editorial_submission_id?'Selected':'Not selected'}</td><td>{p.production?.editorial_state?.replaceAll('_',' ') || 'Not started'}<small>{date(p.production?.editorial_completed_at)}</small></td><td>{date(p.production?.third_draft_requested_at)}</td><td>{p.revisionReturned?'Received':p.production?.third_draft_requested_at?'Awaiting author':'Not required'}<small>{date(p.final?.created_at)}</small></td></>:<><td>{date(p.agreementRequestedAt)}</td><td>{p.signedAt?'Signed':'Awaiting signature'}<small>{date(p.signedAt)}</small></td><td>{date(p.production?.final_materials_requested_at)}</td><td>{p.production?.biography_received_at?'Received':'Missing'}<small>{date(p.production?.biography_received_at)}</small></td><td>{p.production?.final_affiliation || 'Missing'}</td></>}<td><strong>{p.next}</strong><button type="button" onClick={()=>openChapter(chapter.id)}>Manage chapter</button></td></tr>)}</tbody></table>{!shown.length?<p className="muted">No chapters match this filter.</p>:null}</div>
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
