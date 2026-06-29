"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ReviewDecision = "approved" | "revision_requested" | "rejected";

async function getSignedInProfile() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in to do that.");
  }

  const { data: profile, error } = await supabase.from("profiles").select("id, role").eq("id", user.id).single();

  if (error || !profile) {
    throw new Error("Your contributor profile could not be found.");
  }

  return { supabase, user, profile };
}

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalDate(formData: FormData, key: string) {
  const value = textValue(formData, key);
  return value || null;
}

export async function saveCallSettings(formData: FormData) {
  const { supabase, user, profile } = await getSignedInProfile();

  if (!["admin", "editor"].includes(String(profile.role))) {
    throw new Error("Only an administrator can edit the public call.");
  }

  const bookId = textValue(formData, "book_id");
  const payload = {
    title: textValue(formData, "title") || "Untitled edited book",
    subtitle: textValue(formData, "subtitle") || "Call for chapter proposals",
    description: textValue(formData, "description"),
    call_summary: textValue(formData, "call_summary"),
    author_guidelines: textValue(formData, "author_guidelines"),
    chapter_spaces: textValue(formData, "chapter_spaces"),
    publication_target: textValue(formData, "publication_target"),
    public_status: textValue(formData, "public_status") || "draft",
    proposal_deadline: optionalDate(formData, "proposal_deadline"),
    decision_date: optionalDate(formData, "decision_date"),
    first_draft_deadline: optionalDate(formData, "first_draft_deadline"),
    second_draft_deadline: optionalDate(formData, "second_draft_deadline"),
    final_materials_deadline: optionalDate(formData, "final_materials_deadline")
  };

  const response = bookId
    ? await supabase.from("books").update(payload).eq("id", bookId)
    : await supabase.from("books").insert({ ...payload, editor_id: user.id });

  if (response.error) {
    throw new Error(response.error.message);
  }

  revalidatePath("/");
}

export async function submitProposal(formData: FormData) {
  const { supabase, user } = await getSignedInProfile();

  const bookId = textValue(formData, "book_id");
  const title = textValue(formData, "title");
  const abstract = textValue(formData, "abstract");
  const proposalOutline = textValue(formData, "proposal_outline");
  const biography = textValue(formData, "biography");

  if (!bookId || !title || !proposalOutline) {
    throw new Error("Please add a chapter title and proposal summary before submitting.");
  }

  if (biography) {
    await supabase.from("profiles").update({ biography }).eq("id", user.id);
  }

  const { data: book } = await supabase.from("books").select("proposal_deadline").eq("id", bookId).maybeSingle();
  const { data: existingChapter } = await supabase
    .from("chapters")
    .select("id, status")
    .eq("book_id", bookId)
    .eq("author_id", user.id)
    .maybeSingle();

  const chapterPayload = {
    book_id: bookId,
    author_id: user.id,
    title,
    abstract,
    proposal_outline: proposalOutline,
    stage: "proposal",
    status: "pending_review",
    current_deadline: book?.proposal_deadline ?? null
  };

  const chapterResponse = existingChapter
    ? await supabase.from("chapters").update(chapterPayload).eq("id", existingChapter.id).select("id").single()
    : await supabase.from("chapters").insert(chapterPayload).select("id").single();

  if (chapterResponse.error || !chapterResponse.data) {
    throw new Error(chapterResponse.error?.message ?? "The proposal could not be saved.");
  }

  const { error: submissionError } = await supabase.from("submissions").insert({
    chapter_id: chapterResponse.data.id,
    submitted_by: user.id,
    stage: "proposal",
    title,
    abstract,
    proposal_outline: proposalOutline,
    author_biography: biography
  });

  if (submissionError) {
    throw new Error(submissionError.message);
  }

  revalidatePath("/");
}

export async function reviewProposal(formData: FormData) {
  const { supabase, user, profile } = await getSignedInProfile();
  const role = String(profile.role);

  if (!["admin", "editor", "facilitator"].includes(role)) {
    throw new Error("Only administrators and facilitators can review proposals.");
  }

  const chapterId = textValue(formData, "chapter_id");
  const bookId = textValue(formData, "book_id");
  const decision = textValue(formData, "decision") as ReviewDecision;
  const feedback = textValue(formData, "feedback");

  if (!chapterId || !bookId || !["approved", "revision_requested", "rejected"].includes(decision)) {
    throw new Error("Choose a valid review decision.");
  }

  const { data: book } = await supabase.from("books").select("first_draft_deadline, proposal_deadline").eq("id", bookId).single();
  const nextStage = decision === "approved" ? "first_draft" : decision === "revision_requested" ? "proposal_revision" : "proposal";
  const nextDeadline = decision === "approved" ? book?.first_draft_deadline ?? null : book?.proposal_deadline ?? null;

  const { error: updateError } = await supabase
    .from("chapters")
    .update({
      status: decision,
      stage: nextStage,
      current_deadline: nextDeadline
    })
    .eq("id", chapterId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: reviewError } = await supabase.from("reviews").insert({
    chapter_id: chapterId,
    reviewer_id: user.id,
    decision,
    feedback
  });

  if (reviewError) {
    throw new Error(reviewError.message);
  }

  revalidatePath("/");
}
