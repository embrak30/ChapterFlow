import test from 'node:test';
import assert from 'node:assert/strict';
import { draftWorkflow } from './draft-workflow.ts';
const first = { stage:'first_draft', submission_files:[{id:'original'}] };
test('proposal approval opens first draft, while a pending proposal stays locked',()=>{
  assert.equal(draftWorkflow({stage:'proposal',status:'pending_review'}).canUpload,false);
  assert.equal(draftWorkflow({stage:'first_draft',status:'approved'}).uploadStage,'first_draft');
});
test('released reviews open the second draft while first-draft history is retained',()=>{
  const chapter={stage:'first_draft',status:'submitted',submissions:[first],peer_review_feedback_packets:[{status:'sent'}]};
  assert.equal(draftWorkflow(chapter).uploadStage,'second_draft');
  assert.equal(draftWorkflow(chapter).canUpload,true);
  assert.equal(chapter.submissions[0].submission_files[0].id,'original');
});
test('failed feedback email does not open second draft',()=>{
  assert.equal(draftWorkflow({stage:'first_draft',status:'submitted',submissions:[first],peer_review_feedback_packets:[{status:'failed'}]}).secondOpen,false);
});
test('second draft can be uploaded again without reverting to first draft',()=>{
  const state=draftWorkflow({stage:'second_draft',status:'submitted',submissions:[first,{stage:'second_draft',submission_files:[{}]}]});
  assert.equal(state.secondDraft,true); assert.equal(state.uploadStage,'second_draft'); assert.equal(state.canUpload,true);
});
test('closed final stages and rejected chapters cannot upload',()=>{
  for(const stage of ['complete','final_materials']) assert.equal(draftWorkflow({stage,status:'approved',submissions:[first]}).canUpload,false);
  assert.equal(draftWorkflow({stage:'first_draft',status:'rejected',submissions:[first]}).canUpload,false);
});
test('an editor request opens a separate final draft without changing earlier versions',()=>{
  const state=draftWorkflow({stage:'second_draft',status:'submitted',submissions:[first,{stage:'second_draft',submission_files:[{}]}],chapter_production:{third_draft_requested_at:'2026-11-22',editorial_state:'revision_requested'}});
  assert.equal(state.uploadStage,'final_materials'); assert.equal(state.canUpload,true);
});
test('editorial completion closes further uploads',()=>{
  const state=draftWorkflow({stage:'second_draft',status:'submitted',submissions:[first,{stage:'second_draft',submission_files:[{}]}],chapter_production:{third_draft_requested_at:null,editorial_state:'complete'}});
  assert.equal(state.canUpload,false);
});
