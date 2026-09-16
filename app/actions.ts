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

function applyEmailPlaceholders(value: string, placeholders: Record<string, string>) {
  return Object.entries(placeholders).reduce(
    (current, [key, replacement]) => current.replaceAll(`{{${key}}}`, replacement),
    value
  );
}

function formValues(formData: FormData, key: string) {
  return formData.getAll(key).filter((value): value is string => typeof value === "string" && value.trim().length > 0);
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

function getDraftFile(formData: FormData) {
  const file = formData.get("manuscript");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Please choose a Word document before uploading your draft.");
  }

  const allowedTypes = [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword"
  ];
  const fileName = file.name || "chapter-draft.docx";
  const lowerFileName = fileName.toLowerCase();

  if (!lowerFileName.endsWith(".docx") && !lowerFileName.endsWith(".doc")) {
    throw new Error("Please upload your manuscript as a Microsoft Word file (.docx or .doc).");
  }

  if (file.type && !allowedTypes.includes(file.type)) {
    throw new Error("Please upload your manuscript as a Microsoft Word file (.docx or .doc).");
  }

  if (file.size > 20 * 1024 * 1024) {
    throw new Error("Please upload a file smaller than 20MB.");
  }

  return { file, fileName };
}

async function saveDraftUpload({
  supabase,
  bookId,
  chapterId,
  authorId,
  chapterTitle,
  responseToFeedback,
  file,
  fileName
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  bookId: string;
  chapterId: string;
  authorId: string;
  chapterTitle: string;
  responseToFeedback: string;
  file: File;
  fileName: string;
}) {
  const { data: book } = await supabase
    .from("books")
    .select("second_draft_deadline")
    .eq("id", bookId)
    .maybeSingle();

  const { data: submission, error: submissionError } = await supabase
    .from("submissions")
    .insert({
      chapter_id: chapterId,
      submitted_by: authorId,
      stage: "first_draft",
      title: chapterTitle,
      response_to_feedback: responseToFeedback
    })
    .select("id")
    .single();

  if (submissionError || !submission) {
    throw new Error(submissionError?.message ?? "The draft submission could not be created.");
  }

  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `${bookId}/${chapterId}/${authorId}/${Date.now()}-${safeFileName}`;
  const { error: uploadError } = await supabase.storage
    .from("chapter-drafts")
    .upload(storagePath, file, {
      contentType: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: false
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { error: fileError } = await supabase.from("submission_files").insert({
    submission_id: submission.id,
    storage_path: storagePath,
    file_name: fileName,
    content_type: file.type || null,
    byte_size: file.size
  });

  if (fileError) {
    throw new Error(fileError.message);
  }

  const { error: updateError } = await supabase
    .from("chapters")
    .update({
      stage: "first_draft",
      status: "submitted",
      current_deadline: book?.second_draft_deadline ?? null,
      updated_at: new Date().toISOString()
    })
    .eq("id", chapterId);

  if (updateError) {
    throw new Error(updateError.message);
  }
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

export async function uploadDraftManuscript(formData: FormData) {
  const { supabase, user } = await getSignedInProfile();

  const bookId = textValue(formData, "book_id");
  const chapterId = textValue(formData, "chapter_id");
  const responseToFeedback = textValue(formData, "response_to_feedback");
  const { file, fileName } = getDraftFile(formData);

  if (!bookId || !chapterId) {
    throw new Error("ChapterFlow could not identify the chapter for this draft.");
  }

  const { data: chapter, error: chapterError } = await supabase
    .from("chapters")
    .select("id, title, author_id")
    .eq("id", chapterId)
    .eq("book_id", bookId)
    .eq("author_id", user.id)
    .single();

  if (chapterError || !chapter) {
    throw new Error("This chapter could not be found for your account.");
  }

  await saveDraftUpload({
    supabase,
    bookId,
    chapterId,
    authorId: user.id,
    chapterTitle: chapter.title,
    responseToFeedback,
    file,
    fileName
  });

  revalidatePath("/");
}

export async function adminUploadDraftManuscript(formData: FormData) {
  const { supabase, profile } = await getSignedInProfile();

  if (!["admin", "editor"].includes(String(profile.role))) {
    throw new Error("Only an administrator can upload a draft for an author.");
  }

  const bookId = textValue(formData, "book_id");
  const chapterId = textValue(formData, "chapter_id");
  const responseToFeedback = textValue(formData, "response_to_feedback");
  const { file, fileName } = getDraftFile(formData);

  if (!bookId || !chapterId) {
    throw new Error("ChapterFlow could not identify the chapter for this draft.");
  }

  const { data: chapter, error: chapterError } = await supabase
    .from("chapters")
    .select("id, title, author_id")
    .eq("id", chapterId)
    .eq("book_id", bookId)
    .single();

  if (chapterError || !chapter) {
    throw new Error("This chapter could not be found.");
  }

  await saveDraftUpload({
    supabase,
    bookId,
    chapterId,
    authorId: chapter.author_id,
    chapterTitle: chapter.title,
    responseToFeedback,
    file,
    fileName
  });

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
    const placeholders = {
      author_name: authorName,
      book_title: book?.title ?? "the edited book project",
      chapter_title: chapter.title,
      next_deadline: formatDate(nextDeadline)
    };
    const message = applyEmailPlaceholders(combinedFeedback || feedback || "No additional feedback was added.", placeholders);
    const subject = applyEmailPlaceholders(emailSubject || `Update on your ChapterFlow proposal: ${chapter.title}`, placeholders);
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
      message,
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
      <p>${escapeHtml(message)}</p>
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

export async function sendBulkAuthorEmail(formData: FormData) {
  const { supabase, user, profile } = await getSignedInProfile();

  if (!["admin", "editor"].includes(String(profile.role))) {
    throw new Error("Only an administrator can send bulk author emails.");
  }

  const bookId = textValue(formData, "book_id");
  const audience = textValue(formData, "audience") || "current_authors";
  const emailTemplateName = textValue(formData, "email_template_name");
  const emailSubject = textValue(formData, "email_subject");
  const emailTemplateBody = textValue(formData, "email_template_body");
  const additionalMessage = textValue(formData, "additional_message");

  if (!bookId || !emailSubject || !emailTemplateBody) {
    throw new Error("Choose a template before sending to authors.");
  }

  const { data: book, error: bookError } = await supabase
    .from("books")
    .select("title")
    .eq("id", bookId)
    .single();

  if (bookError || !book) {
    throw new Error(bookError?.message ?? "This book project could not be found.");
  }

  const { data: chapters, error: chaptersError } = await supabase
    .from("chapters")
    .select("id, title, status, stage, current_deadline, profiles:author_id(full_name, email)")
    .eq("book_id", bookId)
    .order("created_at", { ascending: true });

  if (chaptersError) {
    throw new Error(chaptersError.message);
  }

  const recipients = (chapters ?? [])
    .filter((chapter) => {
      if (audience === "first_drafts") return chapter.stage === "first_draft" || chapter.status === "submitted";
      if (audience === "all_proposals") return chapter.status !== "rejected";
      return chapter.status === "approved" || chapter.status === "submitted" || chapter.status === "complete" || !String(chapter.stage).includes("proposal");
    })
    .map((chapter) => {
      const author = Array.isArray(chapter.profiles) ? chapter.profiles[0] : chapter.profiles;
      return {
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        nextDeadline: chapter.current_deadline,
        authorName: author?.full_name || "there",
        email: author?.email || ""
      };
    })
    .filter((recipient, index, allRecipients) =>
      recipient.email && allRecipients.findIndex((match) => match.email.toLowerCase() === recipient.email.toLowerCase()) === index
    );

  if (!recipients.length) {
    throw new Error("No matching authors with email addresses were found for this audience.");
  }

  const chapterFlowUrl = getSiteUrl();
  const failedEmails: string[] = [];

  for (const recipient of recipients) {
    const placeholders = {
      author_name: recipient.authorName,
      book_title: book.title,
      chapter_title: recipient.chapterTitle,
      next_deadline: formatDate(recipient.nextDeadline)
    };
    const subject = applyEmailPlaceholders(emailSubject, placeholders);
    const message = applyEmailPlaceholders(
      [emailTemplateBody, additionalMessage ? `Additional note:\n${additionalMessage}` : ""].filter(Boolean).join("\n\n"),
      placeholders
    );
    const body = [
      `Hello ${recipient.authorName},`,
      "",
      `This is an update about your chapter for ${book.title}.`,
      "",
      `Chapter proposal: ${recipient.chapterTitle}`,
      "",
      emailTemplateName ? `Email template: ${emailTemplateName}` : "",
      "Message:",
      message,
      "",
      `You can sign in to ChapterFlow here: ${chapterFlowUrl}`,
      "",
      "Best wishes,",
      "The ChapterFlow editorial team"
    ].join("\n");
    const html = `
      <p>Hello ${escapeHtml(recipient.authorName)},</p>
      <p>This is an update about your chapter for <strong>${escapeHtml(book.title)}</strong>.</p>
      <p><strong>Chapter proposal:</strong> ${escapeHtml(recipient.chapterTitle)}</p>
      ${emailTemplateName ? `<p><strong>Email template:</strong> ${escapeHtml(emailTemplateName)}</p>` : ""}
      <p><strong>Message:</strong></p>
      <p>${escapeHtml(message)}</p>
      <p><a href="${chapterFlowUrl}">Sign in to ChapterFlow</a></p>
      <p>Best wishes,<br />The ChapterFlow editorial team</p>
    `;

    try {
      await sendResendEmail({
        to: recipient.email,
        subject,
        text: body,
        html
      });

      await supabase.from("email_logs").insert({
        chapter_id: recipient.chapterId,
        recipient_email: recipient.email,
        subject,
        body,
        status: "sent",
        sent_by: user.id,
        sent_at: new Date().toISOString()
      });
    } catch {
      failedEmails.push(recipient.email);
      await supabase.from("email_logs").insert({
        chapter_id: recipient.chapterId,
        recipient_email: recipient.email,
        subject,
        body,
        status: "failed",
        sent_by: user.id
      });
    }
  }

  if (failedEmails.length) {
    throw new Error(`Some emails could not be sent: ${failedEmails.join(", ")}`);
  }

  revalidatePath("/");
}

export async function savePeerReviewSettings(formData: FormData) {
  const { supabase, user, profile } = await getSignedInProfile();

  if (!["admin", "editor"].includes(String(profile.role))) {
    throw new Error("Only an administrator can open or edit peer review.");
  }

  const bookId = textValue(formData, "book_id");
  const isOpen = textValue(formData, "is_open") === "open";
  const requiredReviewCount = Math.min(3, Math.max(2, Number(textValue(formData, "required_review_count")) || 2));
  const reviewDeadline = optionalDate(formData, "review_deadline");
  const instructions = textValue(formData, "instructions");

  if (!bookId) {
    throw new Error("Choose a book project before editing peer review.");
  }

  const { error } = await supabase.from("peer_review_settings").upsert(
    {
      book_id: bookId,
      is_open: isOpen,
      required_review_count: requiredReviewCount,
      review_deadline: reviewDeadline,
      instructions,
      opened_by: isOpen ? user.id : null,
      opened_at: isOpen ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    },
    { onConflict: "book_id" }
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
}

export async function generatePeerReviewAssignments(formData: FormData) {
  const { supabase, user, profile } = await getSignedInProfile();

  if (!["admin", "editor"].includes(String(profile.role))) {
    throw new Error("Only an administrator can create peer review assignments.");
  }

  const bookId = textValue(formData, "book_id");
  const shouldNotify = textValue(formData, "_action") === "notify";

  if (!bookId) {
    throw new Error("Choose a book project before creating peer review assignments.");
  }

  const { data: book } = await supabase
    .from("books")
    .select("title")
    .eq("id", bookId)
    .single();
  const { data: settings } = await supabase
    .from("peer_review_settings")
    .select("is_open, required_review_count, review_deadline, instructions")
    .eq("book_id", bookId)
    .maybeSingle();
  const { data: chapters, error: chapterError } = await supabase
    .from("chapters")
    .select("id, title, author_id, profiles:author_id(full_name, email)")
    .eq("book_id", bookId)
    .in("status", ["approved", "submitted", "complete"])
    .order("created_at", { ascending: true });

  if (chapterError) {
    throw new Error(chapterError.message);
  }

  const eligibleChapters = (chapters ?? []).filter((chapter) => chapter.author_id);

  const requiredReviewCount = Math.min(3, Math.max(2, Number(settings?.required_review_count) || 2));

  if (eligibleChapters.length < requiredReviewCount + 1) {
    throw new Error(`At least ${requiredReviewCount + 1} approved chapters are needed so each author can review ${requiredReviewCount} chapters without reviewing their own.`);
  }

  await supabase.from("peer_review_assignments").delete().eq("book_id", bookId);

  const assignments = eligibleChapters.flatMap((chapter, index) => {
    const reviewerChapters = Array.from({ length: requiredReviewCount }, (_, offset) => eligibleChapters[(index + offset + 1) % eligibleChapters.length]);
    return reviewerChapters.map((reviewerChapter) => ({
      book_id: bookId,
      chapter_id: chapter.id,
      reviewer_id: reviewerChapter.author_id,
      assigned_by: user.id,
      status: "assigned",
      notified_at: shouldNotify ? new Date().toISOString() : null
    }));
  });

  const { error: assignmentError } = await supabase.from("peer_review_assignments").insert(assignments);

  if (assignmentError) {
    throw new Error(assignmentError.message);
  }

  if (shouldNotify) {
    const siteUrl = getSiteUrl();
    const assignmentsByReviewer = new Map<string, { email: string; name: string; chapters: string[] }>();

    eligibleChapters.forEach((chapter, index) => {
      const reviewerChapters = Array.from({ length: requiredReviewCount }, (_, offset) => eligibleChapters[(index + offset + 1) % eligibleChapters.length]);
      reviewerChapters.forEach((reviewerChapter) => {
        const reviewerProfile = Array.isArray(reviewerChapter.profiles) ? reviewerChapter.profiles[0] : reviewerChapter.profiles;
        if (!reviewerProfile?.email) return;
        const current = assignmentsByReviewer.get(reviewerChapter.author_id) ?? {
          email: reviewerProfile.email,
          name: reviewerProfile.full_name || "there",
          chapters: [] as string[]
        };
        current.chapters.push(chapter.title);
        assignmentsByReviewer.set(reviewerChapter.author_id, current);
      });
    });

    for (const reviewer of assignmentsByReviewer.values()) {
      const subject = "Your blind peer review assignments are ready";
      const chapterList = reviewer.chapters.map((title, index) => `${index + 1}. ${title}`).join("\n");
      const body = [
        `Hello ${reviewer.name},`,
        "",
        `The blind peer review stage for ${book?.title ?? "the edited book project"} is now open.`,
        "",
        `You have been assigned ${requiredReviewCount} chapter${requiredReviewCount === 1 ? "" : "s"} to review:`,
        chapterList,
        "",
        `Please complete your reviews by ${formatDate(settings?.review_deadline)}.`,
        "",
        "The review process is guided in ChapterFlow. You will be asked to comment on structure, alignment with Mission Integrity, clarity of the story, practical value for school leaders, use of evidence, and recommended improvements.",
        "",
        settings?.instructions ? `Additional guidance:\n${settings.instructions}\n` : "",
        `Sign in to ChapterFlow here: ${siteUrl}`,
        "",
        "Best wishes,",
        "The ChapterFlow editorial team"
      ].filter(Boolean).join("\n");
      const html = `
        <p>Hello ${escapeHtml(reviewer.name)},</p>
        <p>The blind peer review stage for <strong>${escapeHtml(book?.title ?? "the edited book project")}</strong> is now open.</p>
        <p>You have been assigned two chapters to review:</p>
        <ol>${reviewer.chapters.map((title) => `<li>${escapeHtml(title)}</li>`).join("")}</ol>
        <p>Please complete your reviews by <strong>${formatDate(settings?.review_deadline)}</strong>.</p>
        <p>The review process is guided in ChapterFlow. You will be asked to comment on structure, alignment with Mission Integrity, clarity of the story, practical value for school leaders, use of evidence, and recommended improvements.</p>
        ${settings?.instructions ? `<p><strong>Additional guidance:</strong><br />${escapeHtml(settings.instructions)}</p>` : ""}
        <p><a href="${siteUrl}">Sign in to ChapterFlow</a></p>
        <p>Best wishes,<br />The ChapterFlow editorial team</p>
      `;

      await sendResendEmail({ to: reviewer.email, subject, text: body, html });
    }
  }

  revalidatePath("/");
}

export async function submitPeerReview(formData: FormData) {
  const { supabase, user } = await getSignedInProfile();

  const assignmentId = textValue(formData, "assignment_id");
  const chapterId = textValue(formData, "chapter_id");
  const structureItems = formValues(formData, "structure_items");
  const structureRating = textValue(formData, "structure_rating");
  const structureFeedback = textValue(formData, "structure_feedback");
  const missionAlignmentRating = textValue(formData, "mission_alignment_rating");
  const missionAlignmentFeedback = textValue(formData, "mission_alignment_feedback");
  const flowRating = textValue(formData, "flow_rating");
  const flowFeedback = textValue(formData, "flow_feedback");
  const storyRating = textValue(formData, "story_rating");
  const storyFeedback = textValue(formData, "story_feedback");
  const writingRating = textValue(formData, "writing_rating");
  const writingFeedback = textValue(formData, "writing_feedback");
  const anonymityRating = textValue(formData, "anonymity_rating");
  const anonymityFeedback = textValue(formData, "anonymity_feedback");
  const recommendations = textValue(formData, "recommendations");
  const overallRecommendation = textValue(formData, "overall_recommendation");

  const requiredTextFields = [structureFeedback, missionAlignmentFeedback, flowFeedback, storyFeedback, writingFeedback, anonymityFeedback, recommendations];
  const hasThinFeedback = requiredTextFields.some((value) => value.length < 120);

  if (!assignmentId || !chapterId || !structureItems.length || !structureRating || !missionAlignmentRating || !flowRating || !storyRating || !writingRating || !anonymityRating || !overallRecommendation || hasThinFeedback) {
    throw new Error("Please complete the required peer review fields before submitting.");
  }

  const { data: assignment, error: assignmentError } = await supabase
    .from("peer_review_assignments")
    .select("id, reviewer_id")
    .eq("id", assignmentId)
    .eq("reviewer_id", user.id)
    .single();

  if (assignmentError || !assignment) {
    throw new Error("This peer review assignment could not be found for your account.");
  }

  const { error: reviewError } = await supabase.from("peer_reviews").upsert(
    {
      assignment_id: assignmentId,
      chapter_id: chapterId,
      reviewer_id: user.id,
      structure_items: structureItems,
      structure_rating: structureRating,
      structure_feedback: structureFeedback,
      mission_alignment_rating: missionAlignmentRating,
      mission_alignment_feedback: missionAlignmentFeedback,
      flow_rating: flowRating,
      flow_feedback: flowFeedback,
      story_rating: storyRating,
      story_feedback: storyFeedback,
      writing_rating: writingRating,
      writing_feedback: writingFeedback,
      anonymity_rating: anonymityRating,
      anonymity_feedback: anonymityFeedback,
      recommendations,
      overall_recommendation: overallRecommendation,
      updated_at: new Date().toISOString()
    },
    { onConflict: "assignment_id" }
  );

  if (reviewError) {
    throw new Error(reviewError.message);
  }

  await supabase.from("peer_review_assignments").update({ status: "completed" }).eq("id", assignmentId);

  revalidatePath("/");
}

export async function sendPeerReviewFeedbackPacket(formData: FormData) {
  const { supabase, user, profile } = await getSignedInProfile();

  if (!["admin", "editor"].includes(String(profile.role))) {
    throw new Error("Only an administrator can send peer review feedback to authors.");
  }

  const chapterId = textValue(formData, "chapter_id");
  const includedReviewIds = formValues(formData, "included_review_ids");

  if (!chapterId || !includedReviewIds.length) {
    throw new Error("Choose at least one peer review to send.");
  }

  const { data: chapter, error: chapterError } = await supabase
    .from("chapters")
    .select("title, books:book_id(title), profiles:author_id(full_name, email)")
    .eq("id", chapterId)
    .single();

  if (chapterError || !chapter) {
    throw new Error(chapterError?.message ?? "This chapter could not be found.");
  }

  const author = Array.isArray(chapter.profiles) ? chapter.profiles[0] : chapter.profiles;
  const book = Array.isArray(chapter.books) ? chapter.books[0] : chapter.books;

  if (!author?.email) {
    throw new Error("This author does not have an email address.");
  }

  const reviewSections = includedReviewIds.map((reviewId, index) => {
    const content = textValue(formData, `edited_review_${reviewId}`);
    return `Reviewer ${index + 1}\n\n${content}`;
  });
  const subject = `Anonymised peer review feedback for ${chapter.title}`;
  const body = [
    `Hello ${author.full_name || "there"},`,
    "",
    `Please find below anonymised feedback from the peer review process for your chapter, "${chapter.title}".`,
    "",
    "The reviewers are labelled as Reviewer 1, Reviewer 2, and Reviewer 3 where applicable. Please use this feedback to guide the next stage of revision.",
    "",
    ...reviewSections.map((section) => `${section}\n`),
    `You can sign in to ChapterFlow here: ${getSiteUrl()}`,
    "",
    "Best wishes,",
    "The ChapterFlow editorial team"
  ].join("\n");
  const html = `
    <p>Hello ${escapeHtml(author.full_name || "there")},</p>
    <p>Please find below anonymised feedback from the peer review process for your chapter, <strong>${escapeHtml(chapter.title)}</strong>.</p>
    <p>The reviewers are labelled as Reviewer 1, Reviewer 2, and Reviewer 3 where applicable. Please use this feedback to guide the next stage of revision.</p>
    ${reviewSections.map((section) => `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(section)}</pre>`).join("")}
    <p><a href="${getSiteUrl()}">Sign in to ChapterFlow</a></p>
    <p>Best wishes,<br />The ChapterFlow editorial team</p>
  `;

  try {
    await sendResendEmail({ to: author.email, subject, text: body, html });
    await supabase.from("peer_review_feedback_packets").insert({
      chapter_id: chapterId,
      sent_by: user.id,
      included_review_ids: includedReviewIds,
      subject,
      body,
      status: "sent",
      sent_at: new Date().toISOString()
    });
    await supabase.from("email_logs").insert({
      chapter_id: chapterId,
      recipient_email: author.email,
      subject,
      body,
      status: "sent",
      sent_by: user.id,
      sent_at: new Date().toISOString()
    });
  } catch (error) {
    await supabase.from("peer_review_feedback_packets").insert({
      chapter_id: chapterId,
      sent_by: user.id,
      included_review_ids: includedReviewIds,
      subject,
      body,
      status: "failed"
    });
    throw error;
  }

  revalidatePath("/");
}

export async function sendPeerReviewReminders(formData: FormData) {
  const { supabase, user, profile } = await getSignedInProfile();

  if (!["admin", "editor"].includes(String(profile.role))) {
    throw new Error("Only an administrator can send peer review reminders.");
  }

  const bookId = textValue(formData, "book_id");

  if (!bookId) {
    throw new Error("Choose a book project before sending reminders.");
  }

  const { data: settings } = await supabase
    .from("peer_review_settings")
    .select("review_deadline")
    .eq("book_id", bookId)
    .maybeSingle();
  const { data: book } = await supabase.from("books").select("title").eq("id", bookId).single();
  const { data: assignments, error } = await supabase
    .from("peer_review_assignments")
    .select("id, reviewer_id, profiles:reviewer_id(full_name, email), chapters:chapter_id(title)")
    .eq("book_id", bookId)
    .neq("status", "completed");

  if (error) {
    throw new Error(error.message);
  }

  const siteUrl = getSiteUrl();

  for (const assignment of assignments ?? []) {
    const reviewer = Array.isArray(assignment.profiles) ? assignment.profiles[0] : assignment.profiles;
    const chapter = Array.isArray(assignment.chapters) ? assignment.chapters[0] : assignment.chapters;
    if (!reviewer?.email) continue;

    const subject = "Reminder: your ChapterFlow peer review is due";
    const body = [
      `Hello ${reviewer.full_name || "there"},`,
      "",
      `This is a gentle reminder that your peer review for ${book?.title ?? "the edited book project"} is still outstanding.`,
      "",
      `Assigned chapter: ${chapter?.title ?? "Assigned chapter"}`,
      `Review deadline: ${formatDate(settings?.review_deadline)}`,
      "",
      "Please sign in to ChapterFlow and complete the guided review as soon as you can. Your feedback will help the author strengthen the structure, clarity, practical value, and alignment of their chapter.",
      "",
      "If there is a problem with completing the review, please email the editorial team so we can support the process.",
      "",
      `ChapterFlow: ${siteUrl}`,
      "",
      "Best wishes,",
      "The ChapterFlow editorial team"
    ].join("\n");
    const html = `
      <p>Hello ${escapeHtml(reviewer.full_name || "there")},</p>
      <p>This is a gentle reminder that your peer review for <strong>${escapeHtml(book?.title ?? "the edited book project")}</strong> is still outstanding.</p>
      <p><strong>Assigned chapter:</strong> ${escapeHtml(chapter?.title ?? "Assigned chapter")}<br />
      <strong>Review deadline:</strong> ${formatDate(settings?.review_deadline)}</p>
      <p>Please sign in to ChapterFlow and complete the guided review as soon as you can. Your feedback will help the author strengthen the structure, clarity, practical value, and alignment of their chapter.</p>
      <p>If there is a problem with completing the review, please email the editorial team so we can support the process.</p>
      <p><a href="${siteUrl}">Sign in to ChapterFlow</a></p>
      <p>Best wishes,<br />The ChapterFlow editorial team</p>
    `;

    await sendResendEmail({ to: reviewer.email, subject, text: body, html });
    await supabase
      .from("peer_review_assignments")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", assignment.id);
  }

  revalidatePath("/");
}
