import test from 'node:test';
import assert from 'node:assert/strict';
import { draftUploadError } from './upload-error.ts';
test('request size failures explain the upload problem',()=>assert.match(draftUploadError(new Error('413 Payload Too Large')),/hosting limit/));
test('unknown transport failures do not claim a saved draft is lost or certainly failed',()=>{
  assert.match(draftUploadError(new Error('Failed to fetch')),/could not be confirmed/);
  assert.match(draftUploadError(null),/Check Work & feedback/);
});
