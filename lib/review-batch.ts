export function previewReviewBatch(chapterIds: string[], reviewsPerChapter: number, mode: 'standard' | 'editor_pair' = 'standard') {
  if(mode==='editor_pair') {
    if(chapterIds.length!==2 || new Set(chapterIds).size!==2) return [];
    return chapterIds.flatMap((chapterId,index)=>[{chapterId,reviewerChapterId:chapterIds[1-index]},{chapterId,reviewerChapterId:'editor'}]);
  }
  if (![2, 3].includes(reviewsPerChapter) || chapterIds.length <= reviewsPerChapter || new Set(chapterIds).size !== chapterIds.length) return [];
  return chapterIds.flatMap((chapterId, index) => Array.from({ length: reviewsPerChapter }, (_, offset) => ({
    chapterId,
    reviewerChapterId: chapterIds[(index + offset + 1) % chapterIds.length]
  })));
}
