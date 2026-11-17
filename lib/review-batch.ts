export function previewReviewBatch(chapterIds: string[], reviewsPerChapter: number) {
  if (![2, 3].includes(reviewsPerChapter) || chapterIds.length <= reviewsPerChapter || new Set(chapterIds).size !== chapterIds.length) return [];
  return chapterIds.flatMap((chapterId, index) => Array.from({ length: reviewsPerChapter }, (_, offset) => ({
    chapterId,
    reviewerChapterId: chapterIds[(index + offset + 1) % chapterIds.length]
  })));
}
