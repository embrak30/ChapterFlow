import test from 'node:test';
import assert from 'node:assert/strict';
import { manuscriptMetadata } from './manuscript-metadata.ts';
test('Word files above the function payload threshold are valid direct uploads',()=>{
 const meta=manuscriptMetadata('Revised chapter.DOCX',8*1024*1024);assert.equal(meta.size,8*1024*1024);assert.equal(meta.contentType,'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
});
test('empty, oversized and non-Word uploads are rejected',()=>{
 for(const size of [0,21*1024*1024,NaN,-1])assert.throws(()=>manuscriptMetadata('chapter.docx',size));
 assert.throws(()=>manuscriptMetadata('chapter.exe',100));
});
test('legacy Word documents retain the correct content type',()=>assert.equal(manuscriptMetadata('chapter.doc',100).contentType,'application/msword'));
