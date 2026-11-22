import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasSubmittedSecondDraft } from './second-draft-recipients.ts';

test('requires an actual second draft attachment', () => {
  assert.equal(hasSubmittedSecondDraft({}), false);
  assert.equal(hasSubmittedSecondDraft({ submissions: [{ stage: 'first_draft', submission_files: [{}] }] }), false);
  assert.equal(hasSubmittedSecondDraft({ submissions: [{ stage: 'second_draft', submission_files: [] }] }), false);
  assert.equal(hasSubmittedSecondDraft({ submissions: [{ stage: 'second_draft', submission_files: [{}] }] }), true);
});

test('retains eligibility after a later draft is uploaded', () => {
  assert.equal(hasSubmittedSecondDraft({ submissions: [
    { stage: 'second_draft', submission_files: [{}] },
    { stage: 'final_materials', submission_files: [{}] }
  ] }), true);
});
