"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ReviewDecision = "approved" | "revision_requested" | "rejected";

function formatDate(date?: string | null) {
  if (!date) return "to be confirmed";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(date));
}

function displayDecision(decision: ReviewDecision) {
  if (decision === "approved") return "Approved";
  if (decision === "revision_requested") return "Improvements requested";
  return "Not accepted";
}

function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "https://chapterflow.xyz";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
    .replaceAll("\n", "<br />");
}

async function sendResendEmail({
  to,
  subject,
  text,
  html
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "ChapterFlow <onboarding@resend.dev>";
  const replyTo = process.env.EMAIL_REPLY_TO || "editor@chapterflow.xyz";

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set. Add it in Vercel Environment Variables before sending notifications.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      reply_to: replyTo,
      subject,
      text,
      html
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend could not send the email: ${body}`);
  }
}

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
    throw new Error("Please add a chapter title and story proposal before submitting.");
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

  if (!["admin", "editor"].includes(role)) {
    throw new Error("Only administrators can review proposals and send decisions.");
  }

  const chapterId = textValue(formData, "chapter_id");
  const bookId = textValue(formData, "book_id");
  const decision = textValue(formData, "decision") as ReviewDecision;
  const feedback = textValue(formData, "feedback");
  const emailTemplateName = textValue(formData, "email_template_name");
  const emailSubject = textValue(formData, "email_subject");
  const emailTemplateBody = textValue(formData, "email_template_body");
  const shouldNotify = textValue(formData, "_action") === "notify";

  if (!chapterId || !bookId || !["approved", "revision_requested", "rejected"].includes(decision)) {
    throw new Error("Choose a valid review decision.");
  }

  const { data: book } = await supabase
    .from("books")
    .select("title, first_draft_deadline, proposal_deadline")
    .eq("id", bookId)
    .single();
  const nextStage = decision === "approved" ? "first_draft" : decision === "revision_requested" ? "proposal_revision" : "proposal";
  const nextDeadline = decision === "approved" ? book?.first_draft_deadline ?? null : book?.proposal_deadline ?? null;
  const combinedFeedback = [
    emailTemplateBody || "",
    feedback ? `Additional feedback:\n${feedback}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");

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
    feedback: combinedFeedback || feedback
  });

  if (reviewError) {
    throw new Error(reviewError.message);
  }

  if (shouldNotify) {
    const { data: chapter, error: chapterError } = await supabase
      .from("chapters")
      .select("title, profiles:author_id(full_name, email)")
      .eq("id", chapterId)
      .single();

    if (chapterError || !chapter) {
      throw new Error(chapterError?.message ?? "Could not find the author email for this proposal.");
    }

    const author = Array.isArray(chapter.profiles) ? chapter.profiles[0] : chapter.profiles;
    const recipientEmail = author?.email;

    if (!recipientEmail) {
      throw new Error("This author does not have an email address on their profile.");
    }

    const authorName = author?.full_name || "there";
    const decisionLabel = displayDecision(decision);
    const subject = emailSubject || `Update on your ChapterFlow proposal: ${chapter.title}`;
    const chapterFlowUrl = getSiteUrl();
    const body = [
      `Hello ${authorName},`,
      "",
      `There is an update on your chapter proposal for ${book?.title ?? "the edited book project"}.`,
      "",
      `Chapter proposal: ${chapter.title}`,
      `Decision: ${decisionLabel}`,
      `Next deadline: ${formatDate(nextDeadline)}`,
      "",
      emailTemplateName ? `Email template: ${emailTemplateName}` : "",
      "Message:",
      combinedFeedback || feedback || "No additional feedback was added.",
      "",
      `You can sign in to ChapterFlow here: ${chapterFlowUrl}`,
      "",
      "Best wishes,",
      "The ChapterFlow editorial team"
    ].join("\n");

    const html = `
      <p>Hello ${escapeHtml(authorName)},</p>
      <p>There is an update on your chapter proposal for <strong>${escapeHtml(book?.title ?? "the edited book project")}</strong>.</p>
      <p><strong>Chapter proposal:</strong> ${escapeHtml(chapter.title)}<br />
      <strong>Decision:</strong> ${escapeHtml(decisionLabel)}<br />
      <strong>Next deadline:</strong> ${formatDate(nextDeadline)}</p>
      ${emailTemplateName ? `<p><strong>Email template:</strong> ${escapeHtml(emailTemplateName)}</p>` : ""}
      <p><strong>Message:</strong></p>
      <p>${escapeHtml(combinedFeedback || feedback || "No additional feedback was added.")}</p>
      <p><a href="${chapterFlowUrl}">Sign in to ChapterFlow</a></p>
      <p>Best wishes,<br />The ChapterFlow editorial team</p>
    `;

    try {
      await sendResendEmail({
        to: recipientEmail,
        subject,
        text: body,
        html
      });

      await supabase.from("email_logs").insert({
        chapter_id: chapterId,
        recipient_email: recipientEmail,
        subject,
        body,
        status: "sent",
        sent_by: user.id,
        sent_at: new Date().toISOString()
      });
    } catch (error) {
      await supabase.from("email_logs").insert({
        chapter_id: chapterId,
        recipient_email: recipientEmail,
        subject,
        body,
        status: "failed",
        sent_by: user.id
      });

      throw error;
    }
  }

  revalidatePath("/");
}
