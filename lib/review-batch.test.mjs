import test from 'node:test';
import assert from 'node:assert/strict';
import { previewReviewBatch } from './review-batch.ts';
test('three-person batch gives each author the other two chapters', () => {
  const result=previewReviewBatch(['A','B','C'],2);
  assert.equal(result.length,6);
  for(const id of ['A','B','C']) {
    assert.equal(result.filter(x=>x.chapterId===id).length,2);
    assert.equal(result.filter(x=>x.reviewerChapterId===id).length,2);
  }
  assert.ok(result.every(x=>x.chapterId!==x.reviewerChapterId));
  assert.equal(previewReviewBatch(['A','B','C'],3).length,0);
});
test('second intake never references the original group', () => {
  const result=previewReviewBatch(['new1','new2','new3'],2);
  assert.ok(result.every(x=>x.chapterId.startsWith('new') && x.reviewerChapterId.startsWith('new')));
});
test('invalid or duplicate participant selections cannot be previewed',()=>{
  assert.deepEqual(previewReviewBatch(['A','B'],2),[]);
  assert.deepEqual(previewReviewBatch(['A','A','B'],2),[]);
});
