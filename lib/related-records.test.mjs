import assert from "node:assert/strict";
import test from "node:test";
import { relatedRecords } from "./related-records.ts";

test("a unique embedded review is available to counts and the review packet", () => {
  const review = { id: "review-1", structure_feedback: "The introduction needs clearer context." };
  const assignment = { peer_reviews: relatedRecords(review) };
  assert.equal(assignment.peer_reviews.length, 1);
  assert.equal(assignment.peer_reviews[0].structure_feedback, review.structure_feedback);
});

test("array relationships remain intact", () => {
  const reviews = [{ id: "review-1" }];
  assert.deepEqual(relatedRecords(reviews), reviews);
});

test("an assignment with no saved review has no received feedback", () => {
  assert.deepEqual(relatedRecords(null), []);
  assert.deepEqual(relatedRecords(undefined), []);
  assert.deepEqual(relatedRecords([]), []);
});
