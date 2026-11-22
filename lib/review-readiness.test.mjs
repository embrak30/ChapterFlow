import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewReadiness } from './review-readiness.ts';
const chapter={id:'c',author_id:'a',stage:'proposal',status:'approved',submissions:[{stage:'first_draft',submission_files:[{id:'file'}]}],peer_review_files:[{status:'approved'}]};
test('legacy first draft and approved copy qualify despite stale proposal status',()=>assert.equal(reviewReadiness(chapter,[]),null));
test('existing chapter assignments and author commitments remain protected',()=>{
 assert.equal(reviewReadiness(chapter,[{chapter_id:'c',reviewer_id:'other'}]),'Reviewers already assigned to this chapter');
 assert.equal(reviewReadiness(chapter,[{chapter_id:'other',reviewer_id:'a'}]),'Author is already reviewing in another group');
});
test('missing draft or approved copy explains the exclusion',()=>{
 assert.equal(reviewReadiness({...chapter,submissions:[]},[]),'First-draft file not uploaded');
 assert.equal(reviewReadiness({...chapter,peer_review_files:[]},[]),'Approved anonymised copy needed');
});
test('closed chapters do not enter another review round',()=>assert.equal(reviewReadiness({...chapter,stage:'complete'},[]),'Chapter is rejected or complete'));
