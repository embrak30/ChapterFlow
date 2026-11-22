import test from 'node:test';
import assert from 'node:assert/strict';
import { chapterProgress } from './chapter-progress.ts';
const first={id:'first',stage:'first_draft',created_at:'2026-11-01T00:00:00Z',submission_files:[{}]};
const second={id:'second',stage:'second_draft',created_at:'2026-11-21T00:00:00Z',submission_files:[{}]};
const chapter={id:'c',title:'Chapter',stage:'first_draft',status:'submitted',submissions:[first]};
const assignments=[{chapter_id:'c',peer_reviews:[{id:'r1'}]},{chapter_id:'c',peer_reviews:[{id:'r2'}]}];
const sent={status:'sent',sent_at:'2026-11-20T00:00:00Z',included_review_ids:['r1','r2']};
test('two completed reviews are ready to send, not automatically shared',()=>{
  const p=chapterProgress(chapter,assignments,2); assert.equal(p.next,'Send peer review feedback'); assert.equal(p.sharedCount,0);
});
test('an additional reviewer does not increase the required review count',()=>{
  const result=chapterProgress(chapter,[...assignments,{chapter_id:'c',peer_reviews:[{id:'r3'}]}],2);
  assert.equal(result.assigned,3);assert.equal(result.reviewCount,3);assert.equal(result.required,2);assert.equal(result.next,'Send peer review feedback');
});
test('first draft uploaded requires a first-draft file, not just a proposal or empty record',()=>{
  assert.equal(chapterProgress({...chapter,submissions:[{...first,submission_files:[]}]},[],2).first,undefined);
  assert.equal(chapterProgress({...chapter,submissions:[{...first,stage:'proposal'}]},[],2).first,undefined);
  const uploaded=chapterProgress(chapter,[],2);
  assert.equal(uploaded.first.id,'first'); assert.equal(uploaded.assigned,0); assert.equal(uploaded.next,'Assign peer reviewers');
});
test('failed packets and only one shared review do not satisfy the sharing milestone',()=>{
  assert.equal(chapterProgress({...chapter,peer_review_feedback_packets:[{...sent,status:'failed'}]},assignments,2).sharedCount,0);
  assert.equal(chapterProgress({...chapter,peer_review_feedback_packets:[{...sent,included_review_ids:['r1']}]},assignments,2).next,'Send peer review feedback');
});
test('successful sends move to awaiting second draft and uploads move to editorial review',()=>{
  const shared={...chapter,peer_review_feedback_packets:[sent]};
  assert.equal(chapterProgress(shared,assignments,2).next,'Awaiting second draft');
  assert.equal(chapterProgress({...shared,submissions:[first,second]},assignments,2).next,'Editorial review');
});
test('agreement emails must be sent, and signatures are separate evidence',()=>{
  const ready={...chapter,submissions:[first,second],peer_review_feedback_packets:[sent],chapter_production:{editorial_state:'complete'},email_logs:[{subject:'Author agreement',status:'failed',sent_at:null}]};
  assert.equal(chapterProgress(ready,assignments,2).next,'Request agreement');
  assert.equal(chapterProgress({...ready,email_logs:[{subject:'Author agreement',status:'sent',sent_at:'2026-11-21'}]},assignments,2).next,'Awaiting signed agreement');
  assert.equal(chapterProgress(ready,assignments,2,'2026-11-22').next,'Request author materials');
});
test('an earlier final draft cannot satisfy a newer revision request',()=>{
  const c={...chapter,submissions:[first,second,{...second,id:'final',stage:'final_materials'}],peer_review_feedback_packets:[sent],chapter_production:{editorial_state:'revision_requested',third_draft_requested_at:'2026-11-22T00:00:00Z'}};
  assert.equal(chapterProgress(c,assignments,2).next,'Awaiting final draft');
});
test('readiness requires current biography, signature and completed editorial review',()=>{
  const c={...chapter,editorial_submission_id:'second',submissions:[first,second],peer_review_feedback_packets:[sent],chapter_production:{editorial_state:'complete',biography_received_at:'2026-11-22T00:00:00Z',final_materials_requested_at:'2026-11-21T00:00:00Z'}};
  assert.equal(chapterProgress(c,assignments,2,'2026-11-21').next,'Ready for publication');
  assert.equal(chapterProgress({...c,chapter_production:{...c.chapter_production,final_materials_requested_at:'2026-11-23T00:00:00Z'}},assignments,2,'2026-11-21').next,'Awaiting author materials');
});
