import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewProgressFields } from './review-progress.ts';
test('partial feedback can be saved without final-review validation',()=>{
 const form=new FormData();form.set('structure_feedback','Opening needs work.');form.append('structure_items','Chapter overview');
 const result=reviewProgressFields(form);assert.equal(result.structure_feedback,'Opening needs work.');assert.deepEqual(result.structure_items,['Chapter overview']);assert.equal(result.writing_feedback,'');
});
test('progress ignores injected assignment and completion fields',()=>{
 const form=new FormData();form.set('reviewer_id','other-person');form.set('status','completed');form.set('assignment_id','other-assignment');
 const result=reviewProgressFields(form);assert.equal(result.reviewer_id,undefined);assert.equal(result.status,undefined);assert.equal(result.assignment_id,undefined);
});
test('oversized review progress is rejected',()=>{
 const form=new FormData();form.set('structure_feedback','x'.repeat(200001));assert.throws(()=>reviewProgressFields(form));
});
