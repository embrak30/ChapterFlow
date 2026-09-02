"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { adminUploadDraftManuscript, generatePeerReviewAssignments, reviewProposal, saveCallSettings, savePeerReviewSettings, sendPeerReviewReminders, submitPeerReview, submitProposal, uploadDraftManuscript } from "@/app/actions";
import { AuthButtons } from "@/components/auth-buttons";
import { workflowStages } from "@/lib/sample-data";

type BookRecord = {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  call_summary: string | null;
  author_guidelines: string | null;
  chapter_spaces: string | null;
  publication_target: string | null;
  public_status: string | null;
  proposal_deadline: string | null;
  decision_date: string | null;
  first_draft_deadline: string | null;
  second_draft_deadline: string | null;
  final_materials_deadline: string | null;
};

type SubmissionRecord = {
  id: string;
  stage: string;
  title: string | null;
  abstract: string | null;
  proposal_outline: string | null;
  author_biography: string | null;
  response_to_feedback: string | null;
  created_at: string;
  submission_files?: SubmissionFileRecord[];
};

type SubmissionFileRecord = {
  id: string;
  storage_path: string;
  file_name: string;
  content_type: string | null;
  byte_size: number | null;
  created_at: string;
};

type ReviewRecord = {
  id: string;
  decision: string;
  feedback: string | null;
  created_at: string;
};

type ChapterRecord = {
  id: string;
  book_id: string;
  title: string;
  abstract: string | null;
  proposal_outline: string | null;
  stage: string;
  status: string;
  current_deadline: string | null;
  created_at: string;
  profiles?: { full_name: string | null; email: string | null } | null;
  submissions?: SubmissionRecord[];
  reviews?: ReviewRecord[];
};

type PeerReviewSettingsRecord = {
  id: string;
  book_id: string;
  is_open: boolean;
  review_deadline: string | null;
  instructions: string | null;
};

type PeerReviewRecord = {
  id: string;
  assignment_id: string;
  structure_feedback: string | null;
  mission_alignment_feedback: string | null;
  story_feedback: string | null;
  practical_value_feedback: string | null;
  evidence_feedback: string | null;
  recommendations: string | null;
  overall_recommendation: string | null;
  created_at: string;
};

type PeerReviewAssignmentRecord = {
  id: string;
  book_id: string;
  chapter_id: string;
  reviewer_id: string;
  status: string;
  notified_at: string | null;
  reminder_sent_at: string | null;
  created_at: string;
  reviewer?: { full_name: string | null; email: string | null } | Array<{ full_name: string | null; email: string | null }> | null;
  chapter?: ChapterRecord | ChapterRecord[] | null;
  peer_reviews?: PeerReviewRecord[];
};

type ChapterFlowAppProps = {
  userEmail?: string | null;
  userName?: string | null;
  userRole?: "admin" | "facilitator" | "author" | null;
  books: BookRecord[];
  chapters: ChapterRecord[];
  peerReviewSettings: PeerReviewSettingsRecord[];
  peerReviewAssignments: PeerReviewAssignmentRecord[];
};

const reviewEmailTemplates = [
  {
    id: "proposal-approved-first-draft",
    label: "Proposal approved - first draft guidance",
    subject: "Your chapter proposal has been approved",
    body:
      "Thank you for your proposal. We are pleased to invite you to prepare your first draft for the edited collection.\n\nFirst draft guidance:\n- Submit your chapter as a Microsoft Word document (.docx).\n- Aim for 5,000 to 7,000 words, excluding references.\n- Use clear, accessible, story-led writing rooted in your lived leadership experience.\n- Connect your experience lightly to relevant leadership ideas, professional reading, or research where helpful.\n\nFormatting guidance:\n- Font: Times New Roman, 12 point.\n- Line spacing: 1.5.\n- Margins: standard/normal margins.\n- Referencing: APA 7th Edition for any sources cited.\n\nSuggested heading structure:\n1. Chapter title\n2. Author name, role, institution, and contact details\n3. Short chapter overview\n4. Introduction to the leadership story or experience\n5. School context and rationale\n6. What happened: decisions, tensions, and learning\n7. Practical implications for international school leaders\n8. Reflection and concluding recommendations\n9. References"
  },
  {
    id: "proposal-improvements",
    label: "Proposal needs improvements",
    subject: "Feedback on your chapter proposal",
    body:
      "Thank you for submitting your chapter proposal. We can see the potential in the idea, but we would like you to revise and strengthen the proposal before a final decision is made.\n\nPlease use the feedback below to clarify the focus of the chapter, the leadership story or experience you plan to draw on, and what other international school leaders might learn from it."
  },
  {
    id: "proposal-not-selected",
    label: "Proposal not selected",
    subject: "Update on your chapter proposal",
    body:
      "Thank you for taking the time to submit a chapter proposal. After review, we are not able to take this proposal forward for the current edited collection.\n\nWe appreciate the care and thought that went into your submission."
  },
  {
    id: "general-editorial-feedback",
    label: "General editorial feedback",
    subject: "Editorial feedback on your ChapterFlow submission",
    body:
      "Thank you for your submission. Please review the editorial feedback below and use it to guide your next revision or next stage of work."
  },
  {
    id: "september-writer-momentum",
    label: "September 1 - two-month writing reminder",
    subject: "Two-month writing reminder for your chapter",
    body:
      "I hope your chapter is beginning to take shape and that you are finding space to develop the story, reflection, and practical learning you want to share.\n\nSeptember 1 marks roughly the two-month point in our writing window, so this is a gentle reminder to keep the chapter moving. At this stage, you may not have a finished draft, but it would be helpful to have a clear direction, a working structure, and some early writing underway.\n\nPlease also look out for a forthcoming invitation to a short author meeting/webinar on getting your chapter ready. The session will offer guidance on structure, tone, expectations, and the next steps in the editorial process.\n\nIf you are unsure about the direction of your chapter, have hit a difficulty, or think you may need support with the timeline, please do get in touch early. We want this to be a thoughtful and supportive process, and it is much easier to help when we know what is happening.\n\nThank you again for being part of this project. Your contribution matters, and I am looking forward to seeing these chapters develop into a strong collection of real leadership stories from the field."
  }
];

const fallbackBook: BookRecord = {
  id: "",
  title: "ChapterFlow",
  subtitle: "Call for chapter proposals",
  description: "Welcome to ChapterFlow. Sign in to create your author profile and submit your chapter proposal.",
  call_summary: "The editor has not published a call yet. Once the call is open, the story proposal form and deadlines will appear here.",
  author_guidelines: "Create an account, read the call carefully, then submit your proposed chapter title and story summary for review.",
  chapter_spaces: "",
  publication_target: "",
  public_status: "draft",
  proposal_deadline: null,
  decision_date: null,
  first_draft_deadline: null,
  second_draft_deadline: null,
  final_materials_deadline: null
};

function formatDate(date?: string | null) {
  if (!date) return "To be confirmed";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(date));
}

function displayStatus(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(status: string) {
  return `pill ${status.replaceAll("_", "-")}`;
}

function singleRecord<T>(value?: T | T[] | null) {
  return Array.isArray(value) ? value[0] : value;
}

function latestDraftSubmission(chapter?: ChapterRecord | null) {
  return [...(chapter?.submissions ?? [])]
    .filter((submission) => submission.stage.includes("draft"))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
}

function fileHref(file: SubmissionFileRecord) {
  if (file.storage_path.startsWith("http://") || file.storage_path.startsWith("https://")) return file.storage_path;
  return `/api/submission-files/${file.id}`;
}

export function ChapterFlowApp({ userEmail, userName, userRole, books, chapters, peerReviewSettings, peerReviewAssignments }: ChapterFlowAppProps) {
  const isSignedIn = Boolean(userEmail);
  const canViewAdmin = userRole === "admin";
  const canViewFacilitator = userRole === "facilitator" || canViewAdmin;
  const defaultView = !isSignedIn ? "public" : canViewAdmin ? "admin" : canViewFacilitator ? "facilitator" : "author";
  const [role, setRole] = useState<"public" | "admin" | "facilitator" | "author">(defaultView);
  const openBooks = books.filter((book) => book.public_status === "open");
  const visibleBooks = openBooks.length ? openBooks : books;
  const selectedBook = visibleBooks[0] ?? fallbackBook;
  const bookChapters = selectedBook.id ? chapters.filter((chapter) => chapter.book_id === selectedBook.id) : chapters;
  const selectedPeerReviewSettings = peerReviewSettings.find((settings) => settings.book_id === selectedBook.id);
  const selectedPeerReviewAssignments = selectedBook.id
    ? peerReviewAssignments.filter((assignment) => assignment.book_id === selectedBook.id)
    : peerReviewAssignments;
  const authorChapter = userEmail
    ? bookChapters.find((chapter) => chapter.profiles?.email?.toLowerCase() === userEmail.toLowerCase())
    : undefined;

  const stats = useMemo(
    () => [
      { label: "Proposals", value: bookChapters.filter((chapter) => chapter.stage.includes("proposal")).length },
      { label: "Awaiting review", value: bookChapters.filter((chapter) => chapter.status === "pending_review").length },
      { label: "Approved", value: bookChapters.filter((chapter) => chapter.status === "approved").length },
      { label: "Revisions", value: bookChapters.filter((chapter) => chapter.status === "revision_requested").length }
    ],
    [bookChapters]
  );

  return (
    <main>
      <header className="topbar">
        <div>
          <p className="eyebrow">Edited book workflow</p>
          <h1>ChapterFlow</h1>
        </div>
        <div className="top-actions">
          <div className="role-switch" aria-label="Choose view">
            <button className={role === "public" ? "active" : ""} onClick={() => setRole("public")}>Public</button>
            {isSignedIn ? <button className={role === "author" ? "active" : ""} onClick={() => setRole("author")}>Author</button> : null}
            {canViewFacilitator ? <button className={role === "facilitator" ? "active" : ""} onClick={() => setRole("facilitator")}>Facilitator</button> : null}
            {canViewAdmin ? <button className={role === "admin" ? "active" : ""} onClick={() => setRole("admin")}>Admin</button> : null}
          </div>
          <AuthButtons isSignedIn={isSignedIn} email={userEmail} />
        </div>
      </header>

      {role === "admin" && canViewAdmin ? (
        <AdminView book={selectedBook} books={books} chapters={bookChapters} stats={stats} peerReviewSettings={selectedPeerReviewSettings} peerReviewAssignments={selectedPeerReviewAssignments} />
      ) : role === "facilitator" && canViewFacilitator ? (
        <FacilitatorView book={selectedBook} chapters={bookChapters} stats={stats} />
      ) : role === "author" && isSignedIn ? (
        <AuthorView book={selectedBook} userName={userName} userEmail={userEmail} chapter={authorChapter} peerReviewSettings={selectedPeerReviewSettings} peerReviewAssignments={selectedPeerReviewAssignments} />
      ) : (
        <PublicView book={selectedBook} isSignedIn={isSignedIn} />
      )}
    </main>
  );
}

function PublicView({ book, isSignedIn }: { book: BookRecord; isSignedIn: boolean }) {
  return (
    <section className="public-view">
      <div className="intro-band">
        <p className="eyebrow">Welcome to ChapterFlow</p>
        <h2>{book.title}</h2>
        <p>{book.call_summary || book.description || "Create an account to view the call and submit your chapter proposal."}</p>
      </div>
      <article className="panel second-call-panel">
        <div className="second-call-copy">
          <p className="eyebrow">Second call now open</p>
          <h2>Thank you for the interest so far</h2>
          <p>
            We have been encouraged by the response to this project and are now inviting a second round of chapter proposals.
            This call is for story-led chapters that share real leadership experiences connected to Mission Integrity in
            international schools.
          </p>
          <p>
            If you would like to contribute, please create an account or sign in, then submit your chapter title and short
            proposal by <strong>August 31</strong>.
          </p>
        </div>
        <img
          className="second-call-graphic"
          src="/second-call-for-chapters-august-31.png"
          alt="Second Call for Chapters: Leadership With Mission Integrity. Deadline: August 31."
        />
      </article>
      <article className="panel deadline-card">
        <div className="section-heading">
          <p className="eyebrow">Key dates</p>
          <h2>Submission timeline</h2>
        </div>
        <DeadlineStrip book={book} />
        <AuthPrompt isSignedIn={isSignedIn} />
      </article>
      <AuthorGuidance />
    </section>
  );
}

function AuthorGuidance() {
  return (
    <section className="panel guidance-panel">
      <div className="section-heading">
        <p className="eyebrow">Author guidance</p>
        <h2>Story-led chapters from the field</h2>
        <p className="muted">We welcome contributions from experienced practitioners, researchers, and educational leaders across the international school sector. Chapters should be rooted in real experience and written for leaders who want to learn from honest, thoughtful stories of practice.</p>
      </div>
      <div className="guidance-grid">
        <GuidanceBlock title="What We Are Looking For">
          <p>Authors should propose a chapter that:</p>
          <ul>
            <li>Tells a real story or describes a lived leadership experience connected to Mission Integrity.</li>
            <li>Shows what happened, why it mattered, and what others can learn from it.</li>
            <li>Connects the experience lightly to relevant leadership ideas, research, or professional reading.</li>
            <li>Offers practical insight for aspiring and experienced international school leaders.</li>
          </ul>
        </GuidanceBlock>
        <GuidanceBlock title="Chapter Length">
          <p>5,000 to 7,000 words, excluding references.</p>
        </GuidanceBlock>
        <GuidanceBlock title="Possible Structure">
          <ul>
            <li>Introduce the leadership story, question, or moment of practice.</li>
            <li>Describe the school context and why mission or vision mattered.</li>
            <li>Explain what happened and the decisions, tensions, or learning involved.</li>
            <li>Draw out practical implications for other school leaders.</li>
            <li>Connect briefly to relevant ideas, frameworks, or research where helpful.</li>
            <li>Close with reflections, lessons learned, or recommendations.</li>
          </ul>
        </GuidanceBlock>
        <GuidanceBlock title="Use of Evidence">
          <ul>
            <li>Use research, frameworks, or professional literature to support the story, not overwhelm it.</li>
            <li>Keep the writing accessible to busy school leaders.</li>
            <li>Use APA 7th Edition for any sources you cite.</li>
            <li>Ensure all references are complete and accurate.</li>
          </ul>
        </GuidanceBlock>
        <GuidanceBlock title="Style Guidelines">
          <ul>
            <li>Write in clear, professional, human language.</li>
            <li>Use your own voice and avoid excessive jargon.</li>
            <li>Use headings and subheadings to improve readability.</li>
            <li>Clearly label tables and figures, with permissions where required.</li>
            <li>Define specialist terminology when first introduced, or choose simpler wording where possible.</li>
          </ul>
        </GuidanceBlock>
        <GuidanceBlock title="Originality">
          <p>By submitting a chapter, authors confirm that the work is original, has not been previously published, is not under consideration elsewhere, and has appropriate permissions for any copyrighted material.</p>
          <p>All submissions may be screened for originality.</p>
        </GuidanceBlock>
        <GuidanceBlock title="Review Process">
          <p>Each chapter will undergo editorial review. Authors may be asked to revise their work so that the chapter remains clear, useful, authentic, and aligned with the overall vision of the book.</p>
        </GuidanceBlock>
        <GuidanceBlock title="Submission Requirements">
          <ul>
            <li>Chapter manuscript in Microsoft Word (.docx)</li>
            <li>Author biography of 100 to 150 words</li>
            <li>Professional photograph, optional</li>
            <li>Institutional affiliation and contact details</li>
          </ul>
        </GuidanceBlock>
      </div>
      <SampleProposal />
    </section>
  );
}

function GuidanceBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="guidance-block">
      <h3>{title}</h3>
      {children}
    </article>
  );
}

function SampleProposal() {
  return (
    <article className="sample-proposal">
      <div className="section-heading">
        <p className="eyebrow">Example proposal</p>
        <h2>What a completed chapter proposal could look like</h2>
      </div>
      <div className="sample-fields">
        <div>
          <strong>Proposed chapter title</strong>
          <p>When the Mission Was Tested: Leading a School Community Through a Difficult Decision</p>
        </div>
        <div>
          <strong>Short chapter overview</strong>
          <p>This chapter will tell the story of a moment when our school had to make a difficult decision that tested the meaning of its mission. It will describe the context, the competing pressures, the leadership choices involved, and the lessons learned about keeping mission and values alive when decisions are complex.</p>
        </div>
        <div>
          <strong>Story proposal</strong>
          <p>The chapter will begin with a real leadership situation from an international school context. The school had a clear mission statement, but a particular decision created tension between what the school said it valued and what different stakeholders expected it to do. The chapter will describe the situation honestly, including the uncertainty, conversations, and trade-offs involved.</p>
          <p>Rather than presenting a simple success story, the chapter will explore what it felt like to lead through the process, what helped the team stay connected to the mission, and where the experience revealed gaps between language and practice. It will include practical examples of how leaders used dialogue, reflection, and evidence to make decisions that were more closely aligned with the school’s stated values.</p>
          <p>The chapter will draw lightly on leadership thinking about values-led decision-making and organisational culture, but the main focus will remain on the lived experience. It will close with lessons that other international school leaders could use when mission, vision, and real-world pressures come into conflict.</p>
        </div>
        <div>
          <strong>Author biography</strong>
          <p>Alex Morgan is an international school leader with experience in school improvement, strategic planning, and staff development. Their professional interests include values-led leadership, school culture, and helping leadership teams turn mission statements into meaningful everyday practice.</p>
        </div>
      </div>
    </article>
  );
}

function AuthPrompt({ isSignedIn }: { isSignedIn: boolean }) {
  return <div className="notice">{isSignedIn ? "You are signed in. Open the Author tab to submit or review your proposal." : "Sign in with Google above to create your author profile and submit a proposal."}</div>;
}

function AuthorView({
  book,
  userName,
  userEmail,
  chapter,
  peerReviewSettings,
  peerReviewAssignments
}: {
  book: BookRecord;
  userName?: string | null;
  userEmail?: string | null;
  chapter?: ChapterRecord;
  peerReviewSettings?: PeerReviewSettingsRecord;
  peerReviewAssignments: PeerReviewAssignmentRecord[];
}) {
  const proposalApproved = chapter?.status === "approved" || chapter?.stage === "first_draft";
  const hasProposal = Boolean(chapter);
  const submissions = [...(chapter?.submissions ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const hasDraftFile = submissions.some((submission) => (submission.submission_files ?? []).length > 0);
  const reviewerAssignments = userEmail
    ? peerReviewAssignments.filter((assignment) => singleRecord(assignment.reviewer)?.email?.toLowerCase() === userEmail.toLowerCase())
    : [];

  return (
    <section className="author-view">
      <div className="panel author-summary">
        <div>
          <p className="eyebrow">Author dashboard</p>
          <h2>{book.title}</h2>
          <p>Signed in as <strong>{userName || userEmail}</strong></p>
        </div>
        <span className={hasProposal ? statusClass(chapter?.status ?? "pending_review") : "pill pending-review"}>
          {hasProposal ? displayStatus(chapter?.status ?? "pending_review") : "Proposal not submitted"}
        </span>
      </div>
      <div className="author-grid">
        <section className="panel author-deadlines"><div className="section-heading"><p className="eyebrow">Project dates</p><h2>Deadlines</h2></div><DeadlineStrip book={book} /></section>
        <section className="panel proposal-panel">
          <div className="section-heading">
            <p className="eyebrow">First stage</p>
            <h2>Submit chapter proposal</h2>
          </div>
          {proposalApproved ? (
            <div className="notice">Your proposal is approved. The first draft stage is now open. File upload for Word manuscripts is the next build step.</div>
          ) : (
            <form action={submitProposal}>
              <input type="hidden" name="book_id" value={book.id} />
              <p className="muted">Submit your proposed chapter title and a short story-led summary. Draft manuscript upload will unlock after approval.</p>
              <div className="proposal-form-grid">
                <label>Proposed chapter title<input name="title" required placeholder="Enter your proposed chapter title" defaultValue={chapter?.title ?? ""} /></label>
                <label>Short chapter overview<textarea name="abstract" placeholder="Briefly introduce the leadership story or experience you want to write about." defaultValue={chapter?.abstract ?? ""} /></label>
                <label>Story proposal<textarea name="proposal_outline" required placeholder="Describe the real experience, why it matters, what others could learn from it, and any light research or leadership ideas you may connect to it." defaultValue={chapter?.proposal_outline ?? ""} /></label>
                <label>Author biography<textarea name="biography" placeholder="Add the biography you want the editor to hold with your chapter." defaultValue={chapter?.submissions?.[0]?.author_biography ?? ""} /></label>
              </div>
              <button className="primary" type="submit">{hasProposal ? "Update proposal" : "Submit proposal"}</button>
            </form>
          )}
        </section>
        <section className="panel draft-panel">
          <div className="section-heading"><p className="eyebrow">Next stage</p><h2>First draft manuscript</h2></div>
          {proposalApproved ? (
            <form action={uploadDraftManuscript} className="draft-upload-form">
              <input type="hidden" name="book_id" value={book.id} />
              <input type="hidden" name="chapter_id" value={chapter?.id ?? ""} />
              <p className="muted">{hasDraftFile ? "You can upload a newer version if the editor has asked for an updated first draft." : "Upload your first draft manuscript as a Microsoft Word document."}</p>
              <label>Word manuscript<input name="manuscript" type="file" accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required /></label>
              <label>Notes or response to feedback<textarea name="response_to_feedback" placeholder="Optional: tell the editor what you have changed, or add any context for this draft." /></label>
              <DraftUploadButton hasDraftFile={hasDraftFile} />
            </form>
          ) : (
            <div className="empty-state">
              <h2>Locked until proposal approval</h2>
              <p className="muted">You will be able to upload your Word manuscript here once your proposal has been approved.</p>
            </div>
          )}
        </section>
        <section className="panel submissions-panel">
          <div className="section-heading">
            <p className="eyebrow">Your records</p>
            <h2>Submitted work and feedback</h2>
            <p className="muted">This is the work ChapterFlow currently has recorded against your author profile.</p>
          </div>
          {submissions.length ? (
            <div className="submission-list">
              {submissions.map((submission) => (
                <article className="submission-card" key={submission.id}>
                  <div className="submission-card-header">
                    <div>
                      <p className="eyebrow">{displayStatus(submission.stage)}</p>
                      <h3>{submission.title || chapter?.title || "Submitted chapter work"}</h3>
                    </div>
                    <span>{formatDate(submission.created_at)}</span>
                  </div>
                  {submission.abstract ? <p><strong>Overview</strong>{submission.abstract}</p> : null}
                  {submission.proposal_outline ? <p><strong>Proposal</strong>{submission.proposal_outline}</p> : null}
                  {submission.response_to_feedback ? <p><strong>Response to feedback</strong>{submission.response_to_feedback}</p> : null}
                  {(submission.submission_files ?? []).length ? (
                    <div className="file-list">
                      {(submission.submission_files ?? []).map((file) => {
                        return (
                          <div className="file-row" key={file.id}>
                            <span>{file.file_name}</span>
                            <a className="button-link" href={fileHref(file)} target="_blank" rel="noreferrer">View file</a>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h2>No submissions recorded yet</h2>
              <p className="muted">Once you submit a proposal or draft through ChapterFlow, it will appear here.</p>
            </div>
          )}
        </section>
        {peerReviewSettings?.is_open ? (
          <PeerReviewAuthorPanel settings={peerReviewSettings} assignments={reviewerAssignments} />
        ) : null}
      </div>
    </section>
  );
}

function PeerReviewAuthorPanel({
  settings,
  assignments
}: {
  settings: PeerReviewSettingsRecord;
  assignments: PeerReviewAssignmentRecord[];
}) {
  return (
    <section className="panel peer-review-panel">
      <div className="section-heading">
        <p className="eyebrow">Blind peer review</p>
        <h2>Your review assignments</h2>
        <p className="muted">Please complete two guided reviews. Author names are hidden in this reviewer view.</p>
      </div>
      <div className="peer-review-guidance">
        <strong>Review deadline: {formatDate(settings.review_deadline)}</strong>
        <p>{settings.instructions || "Focus on helping the author strengthen the chapter structure, connection to Mission Integrity, clarity of the story, practical value, and use of supporting evidence."}</p>
      </div>
      {assignments.length ? (
        <div className="peer-assignment-list">
          {assignments.map((assignment, index) => (
            <PeerReviewAssignmentCard assignment={assignment} index={index} key={assignment.id} />
          ))}
        </div>
      ) : (
        <EmptyState title="No peer review assignments yet" message="When the editor assigns chapters to you, they will appear here." />
      )}
    </section>
  );
}

function DraftUploadButton({ hasDraftFile }: { hasDraftFile: boolean }) {
  const { pending } = useFormStatus();
  return <button className="primary" disabled={pending} type="submit">{pending ? "Uploading draft..." : hasDraftFile ? "Upload updated draft" : "Upload first draft"}</button>;
}

function PeerReviewAssignmentCard({ assignment, index }: { assignment: PeerReviewAssignmentRecord; index: number }) {
  const chapter = singleRecord(assignment.chapter);
  const existingReview = assignment.peer_reviews?.[0];
  const draftSubmission = latestDraftSubmission(chapter);
  const draftFiles = draftSubmission?.submission_files ?? [];

  return (
    <article className="peer-assignment-card">
      <div className="submission-card-header">
        <div>
          <p className="eyebrow">Assigned chapter {index + 1}</p>
          <h3>{chapter?.title || "Untitled chapter"}</h3>
        </div>
        <span className={statusClass(existingReview ? "complete" : assignment.status)}>{existingReview ? "Review submitted" : displayStatus(assignment.status)}</span>
      </div>
      <div className="document-preview compact-preview">
        <span>Draft available to review</span>
        {draftFiles.length ? (
          <div className="file-list">
            {draftFiles.map((file) => {
              return (
                <div className="file-row" key={file.id}>
                  <span>{file.file_name}</span>
                  <a className="button-link" href={fileHref(file)} target="_blank" rel="noreferrer">View draft</a>
                </div>
              );
            })}
          </div>
        ) : (
          <p>{draftSubmission?.abstract || chapter?.abstract || chapter?.proposal_outline || "No draft file is attached yet. Use the chapter information available here until the editor adds the draft file."}</p>
        )}
      </div>
      <form action={submitPeerReview} className="peer-review-form">
        <input type="hidden" name="assignment_id" value={assignment.id} />
        <input type="hidden" name="chapter_id" value={assignment.chapter_id} />
        <label>Structure and flow<textarea name="structure_feedback" required defaultValue={existingReview?.structure_feedback ?? ""} placeholder="Comment on the chapter shape, sequence, headings, and whether the reader can follow the argument or story." /></label>
        <label>Mission Integrity alignment<textarea name="mission_alignment_feedback" required defaultValue={existingReview?.mission_alignment_feedback ?? ""} placeholder="Where does the chapter connect clearly to mission, values, vision, or integrity in leadership practice?" /></label>
        <label>Strength of the story<textarea name="story_feedback" required defaultValue={existingReview?.story_feedback ?? ""} placeholder="Comment on the lived experience, authenticity, clarity of context, and whether the story feels useful to other leaders." /></label>
        <label>Practical value for leaders<textarea name="practical_value_feedback" defaultValue={existingReview?.practical_value_feedback ?? ""} placeholder="What practical learning, tools, questions, or implications could be made clearer?" /></label>
        <label>Use of evidence<textarea name="evidence_feedback" defaultValue={existingReview?.evidence_feedback ?? ""} placeholder="Suggest where research, professional reading, or frameworks could support the chapter without making it too heavy." /></label>
        <label>Recommendations for improvement<textarea name="recommendations" required defaultValue={existingReview?.recommendations ?? ""} placeholder="Give clear, specific, constructive recommendations the author can act on." /></label>
        <label>Overall recommendation<select name="overall_recommendation" defaultValue={existingReview?.overall_recommendation ?? "revise_and_resubmit"}><option value="minor_revisions">Minor revisions</option><option value="revise_and_resubmit">Revise and strengthen</option><option value="major_revisions">Major revisions needed</option><option value="ready_for_editorial_review">Ready for editorial review</option></select></label>
        <PeerReviewSubmitButton hasExistingReview={Boolean(existingReview)} />
      </form>
    </article>
  );
}

function PeerReviewSubmitButton({ hasExistingReview }: { hasExistingReview: boolean }) {
  const { pending } = useFormStatus();
  return <button className="primary" disabled={pending} type="submit">{pending ? "Saving review..." : hasExistingReview ? "Update peer review" : "Submit peer review"}</button>;
}

function AdminView({
  book,
  books,
  chapters,
  stats,
  peerReviewSettings,
  peerReviewAssignments
}: {
  book: BookRecord;
  books: BookRecord[];
  chapters: ChapterRecord[];
  stats: Array<{ label: string; value: number }>;
  peerReviewSettings?: PeerReviewSettingsRecord;
  peerReviewAssignments: PeerReviewAssignmentRecord[];
}) {
  const approvedChapters = chapters.filter((chapter) => chapter.status === "approved" || !chapter.stage.includes("proposal"));
  const [adminTab, setAdminTab] = useState<"call" | "authors" | "proposals" | "peer-review" | "workflow">("proposals");
  const adminTabs = [
    { id: "proposals", label: "Proposals" },
    { id: "peer-review", label: "Peer review" },
    { id: "authors", label: "Authors & email" },
    { id: "call", label: "Call settings" },
    { id: "workflow", label: "Workflow" }
  ] as const;

  return (
    <section className="admin-page">
      <div className="panel admin-hero">
        <div className="section-heading">
          <p className="eyebrow">Admin Control Centre</p>
          <h2>{book.title}</h2>
          <p className="muted">Use the tabs to work in one focused admin space at a time: proposals, peer review, author emails, public call settings, and workflow tracking.</p>
        </div>
        <div className="stat-grid admin-metrics">{stats.map((stat) => <div className="stat" key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}</div>
        <div className="admin-tabs" aria-label="Admin sections">
          {adminTabs.map((tab) => (
            <button key={tab.id} className={adminTab === tab.id ? "active" : ""} onClick={() => setAdminTab(tab.id)} type="button">
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-tab-panel">
        {adminTab === "proposals" ? <ReviewWorkspace title="Admin Proposal Board" book={book} chapters={chapters} canDecide /> : null}
        {adminTab === "peer-review" ? <PeerReviewAdminPanel book={book} chapters={approvedChapters} settings={peerReviewSettings} assignments={peerReviewAssignments} /> : null}
        {adminTab === "authors" ? <ApprovedAuthorsPanel chapters={approvedChapters} /> : null}
        {adminTab === "call" ? <CallSettingsForm book={book.id ? book : undefined} hasBooks={books.length > 0} /> : null}
        {adminTab === "workflow" ? <WorkflowPanel book={book} stats={stats} /> : null}
      </div>
    </section>
  );
}

function ApprovedAuthorsPanel({ chapters }: { chapters: ChapterRecord[] }) {
  const approvedAuthors = chapters
    .map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      name: chapter.profiles?.full_name || "Author",
      email: chapter.profiles?.email || ""
    }))
    .filter((author) => author.email);
  const emailList = approvedAuthors.map((author) => author.email).join(", ");
  const mailtoHref = emailList ? `mailto:?bcc=${encodeURIComponent(emailList)}&subject=${encodeURIComponent("ChapterFlow update for approved authors")}` : "";

  async function copyEmails() {
    if (!emailList) return;
    await navigator.clipboard.writeText(emailList);
  }

  return (
    <div className="admin-tools approved-authors">
      <div>
        <h3>Approved authors</h3>
        <p className="muted">{approvedAuthors.length ? `${approvedAuthors.length} approved author${approvedAuthors.length === 1 ? "" : "s"} with email addresses.` : "Approved author emails will appear here."}</p>
      </div>
      {approvedAuthors.length ? (
        <>
          <div className="author-contact-list">
            {approvedAuthors.map((author) => (
              <div className="author-contact" key={author.id}>
                <strong>{author.name}</strong>
                <span>{author.email}</span>
                <small>{author.title}</small>
              </div>
            ))}
          </div>
          <textarea readOnly value={emailList} aria-label="Approved author email addresses" />
          <div className="button-row">
            <button type="button" onClick={copyEmails}>Copy email list</button>
            <a className="button-link" href={mailtoHref}>Open email draft</a>
          </div>
        </>
      ) : null}
    </div>
  );
}

function PeerReviewAdminPanel({
  book,
  chapters,
  settings,
  assignments
}: {
  book: BookRecord;
  chapters: ChapterRecord[];
  settings?: PeerReviewSettingsRecord;
  assignments: PeerReviewAssignmentRecord[];
}) {
  const chapterCoverage = chapters.map((chapter) => {
    const chapterAssignments = assignments.filter((assignment) => assignment.chapter_id === chapter.id);
    const completed = chapterAssignments.filter((assignment) => assignment.peer_reviews?.length || assignment.status === "completed").length;
    return { chapter, assigned: chapterAssignments.length, completed };
  });
  const incompleteAssignments = assignments.filter((assignment) => !assignment.peer_reviews?.length && assignment.status !== "completed");
  const canGenerate = chapters.length >= 3;

  return (
    <div className="admin-tools peer-admin">
      <div>
        <h3>Blind peer review</h3>
        <p className="muted">Open the stage only when drafts are ready. ChapterFlow assigns two reviewers to each approved chapter and two chapters to each author.</p>
      </div>
      <form action={savePeerReviewSettings}>
        <input type="hidden" name="book_id" value={book.id} />
        <label>Peer review status<select name="is_open" defaultValue={settings?.is_open ? "open" : "closed"}><option value="closed">Closed to authors</option><option value="open">Open to reviewers</option></select></label>
        <label>Review deadline<input type="date" name="review_deadline" defaultValue={settings?.review_deadline ?? ""} /></label>
        <label>Reviewer guidance<textarea name="instructions" defaultValue={settings?.instructions ?? "Please provide constructive, specific feedback on structure, alignment with Mission Integrity, clarity of the story, practical value for other leaders, and light use of evidence."} /></label>
        <button className="primary" type="submit">Save peer review settings</button>
      </form>
      <div className="peer-admin-actions">
        <form action={generatePeerReviewAssignments}>
          <input type="hidden" name="book_id" value={book.id} />
          <button disabled={!canGenerate} type="submit" name="_action" value="save">Generate assignments</button>
          <button className="primary" disabled={!canGenerate} type="submit" name="_action" value="notify">Generate and email reviewers</button>
        </form>
        {!canGenerate ? <p className="muted">At least three approved chapters are needed for blind peer review without self-review.</p> : null}
        <form action={sendPeerReviewReminders}>
          <input type="hidden" name="book_id" value={book.id} />
          <button disabled={!incompleteAssignments.length} type="submit">Send late review reminders</button>
        </form>
      </div>
      <div className="peer-coverage-list">
        <strong>Review coverage</strong>
        {chapterCoverage.length ? chapterCoverage.map(({ chapter, assigned, completed }) => (
          <div className="peer-coverage-row" key={chapter.id}>
            <span>{chapter.title}</span>
            <small>{assigned}/2 assigned · {completed}/2 submitted</small>
          </div>
        )) : <p className="muted">Approved chapters will appear here when they are ready for peer review.</p>}
      </div>
      <div className="email-draft">
        <strong>Assignment email template</strong>
        <p>When you choose “Generate and email reviewers”, each reviewer receives their two chapter assignments, the review deadline, your reviewer guidance, and a link back to ChapterFlow.</p>
        <strong>Late reminder template</strong>
        <p>The reminder asks reviewers to complete outstanding reviews, names the assigned chapter, repeats the deadline, and invites them to contact the editorial team if there is a problem.</p>
      </div>
    </div>
  );
}

function WorkflowPanel({ book, stats }: { book: BookRecord; stats: Array<{ label: string; value: number }> }) {
  return (
    <section className="panel workflow-panel">
      <div className="section-heading">
        <p className="eyebrow">Workflow overview</p>
        <h2>Project stages and deadlines</h2>
        <p className="muted">Use this page as the simple map of where the book process is heading.</p>
      </div>
      <div className="stat-grid admin-metrics">{stats.map((stat) => <div className="stat" key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}</div>
      <div className="admin-two-column">
        <div className="admin-tools">
          <h3>Deadline sequence</h3>
          <DeadlineStrip book={book} />
          <div className="timeline"><DeadlineList book={book} /></div>
        </div>
        <div className="admin-tools">
          <h3>Editorial stages</h3>
          <div className="stage-list">{workflowStages.map((stage) => <div className="stage" key={stage.name}><span>{stage.name}</span><small>{stage.owner}</small></div>)}</div>
        </div>
      </div>
    </section>
  );
}

function FacilitatorView({
  book,
  chapters,
  stats
}: {
  book: BookRecord;
  chapters: ChapterRecord[];
  stats: Array<{ label: string; value: number }>;
}) {
  const stageCounts = [
    { label: "Proposal stage", value: chapters.filter((chapter) => chapter.stage.includes("proposal")).length },
    { label: "First drafts", value: chapters.filter((chapter) => chapter.stage === "first_draft").length },
    { label: "Second drafts", value: chapters.filter((chapter) => chapter.stage === "second_draft").length },
    { label: "Final materials", value: chapters.filter((chapter) => chapter.stage === "final_materials" || chapter.stage === "complete").length }
  ];

  return (
    <section className="workspace">
      <aside className="panel sidebar">
        <div className="section-heading">
          <p className="eyebrow">Facilitator Overview</p>
          <h2>Read-only project tracking</h2>
          <p className="muted">Facilitators can see projects, proposals, stages, timelines, and decisions. Approval, rejection, and email notifications remain admin-only.</p>
        </div>
        <div className="stat-grid">{stats.map((stat) => <div className="stat" key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}</div>
        <div className="admin-tools">
          <h3>Project timeline</h3>
          <DeadlineStrip book={book} />
        </div>
        <div className="stat-grid">{stageCounts.map((stat) => <div className="stat" key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}</div>
      </aside>
      <ReviewWorkspace title="Facilitator Oversight Board" book={book} chapters={chapters} canDecide={false} />
    </section>
  );
}

function CallSettingsForm({ book, hasBooks }: { book?: BookRecord; hasBooks: boolean }) {
  return (
    <form action={saveCallSettings} className="admin-tools">
      <h3>{hasBooks ? "Public call settings" : "Create your first call"}</h3>
      <input type="hidden" name="book_id" value={book?.id ?? ""} />
      <label>Book / project title<input name="title" required defaultValue={book?.title ?? ""} placeholder="Example: Leadership With Mission Integrity" /></label>
      <label>Short public welcome<textarea name="call_summary" defaultValue={book?.call_summary ?? ""} placeholder="Welcome authors and explain the kind of story-led chapter you are inviting them to propose." /></label>
      <label>Chapter spaces<input name="chapter_spaces" defaultValue={book?.chapter_spaces ?? ""} placeholder="Example: 12 chapters + 2 reserve spaces" /></label>
      <label>Publication target<input name="publication_target" defaultValue={book?.publication_target ?? ""} placeholder="Example: Planned publication February 2027" /></label>
      <label>Public status<select name="public_status" defaultValue={book?.public_status ?? "draft"}><option value="draft">Draft</option><option value="open">Open</option><option value="closed">Closed</option></select></label>
      <div className="form-grid">
        <label>Proposal due<input name="proposal_deadline" type="date" defaultValue={book?.proposal_deadline ?? ""} /></label>
        <label>Proposal decisions<input name="decision_date" type="date" defaultValue={book?.decision_date ?? ""} /></label>
        <label>First draft due<input name="first_draft_deadline" type="date" defaultValue={book?.first_draft_deadline ?? ""} /></label>
        <label>Second draft due<input name="second_draft_deadline" type="date" defaultValue={book?.second_draft_deadline ?? ""} /></label>
        <label>Final materials due<input name="final_materials_deadline" type="date" defaultValue={book?.final_materials_deadline ?? ""} /></label>
      </div>
      <button className="primary" type="submit">Save public call</button>
    </form>
  );
}

function ReviewWorkspace({
  title,
  book,
  chapters,
  canDecide
}: {
  title: string;
  book: BookRecord;
  chapters: ChapterRecord[];
  canDecide: boolean;
}) {
  const [selectedId, setSelectedId] = useState(chapters[0]?.id ?? "");
  const selected = chapters.find((chapter) => chapter.id === selectedId) ?? chapters[0];

  return (
    <section className="proposal-review-page">
      <section className="panel table-panel">
        <div className="section-heading"><p className="eyebrow">Submissions</p><h2>{title}</h2></div>
        <div className="chapter-table">
          <div className="table-row table-head"><span>Chapter</span><span>Author</span><span>Stage</span><span>Status</span><span>Deadline</span></div>
          {chapters.length ? chapters.map((chapter) => (
            <button className={`table-row ${selected?.id === chapter.id ? "selected" : ""}`} key={chapter.id} onClick={() => setSelectedId(chapter.id)}>
              <span>{chapter.title}</span>
              <span>{chapter.profiles?.full_name || chapter.profiles?.email || "Author"}</span>
              <span>{displayStatus(chapter.stage)}</span>
              <span className={statusClass(chapter.status)}>{displayStatus(chapter.status)}</span>
              <span>{formatDate(chapter.current_deadline)}</span>
            </button>
          )) : <div className="empty-table"><strong>No proposals yet</strong><span>Submitted proposals will appear here as soon as authors send them through ChapterFlow.</span></div>}
        </div>
      </section>
      <section className="panel detail-panel review-detail-full">
        {selected ? (
          <>
            <div className="section-heading"><p className="eyebrow">Proposal review</p><h2>{selected.title}</h2></div>
            <div className="meta-list"><p><strong>Author</strong>{selected.profiles?.full_name || selected.profiles?.email || "Author"}</p><p><strong>Current stage</strong>{displayStatus(selected.stage)}</p><p><strong>Deadline</strong>{formatDate(selected.current_deadline)}</p></div>
            <div className="document-preview"><span>Story proposal</span><p>{selected.proposal_outline || selected.abstract || "No proposal text supplied."}</p></div>
            {canDecide ? <AdminDraftUploadForm book={book} chapter={selected} /> : null}
            <ChapterDraftFiles chapter={selected} />
            <ReviewHistory reviews={selected.reviews ?? []} />
            {canDecide ? <ReviewForm book={book} chapter={selected} /> : null}
          </>
        ) : (
          <EmptyState title="No proposal selected" message="Once authors submit proposals, you will be able to review them here." />
        )}
      </section>
    </section>
  );
}

function AdminDraftUploadForm({ book, chapter }: { book: BookRecord; chapter: ChapterRecord }) {
  return (
    <form action={adminUploadDraftManuscript} className="admin-tools draft-upload-form">
      <h3>Upload draft for this author</h3>
      <p className="muted">Use this if the author sends you their Word file by email or cannot upload it themselves. The draft will appear on their author profile.</p>
      <input type="hidden" name="book_id" value={book.id} />
      <input type="hidden" name="chapter_id" value={chapter.id} />
      <label>Word manuscript<input name="manuscript" type="file" accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required /></label>
      <label>Admin note<textarea name="response_to_feedback" placeholder="Optional: add a note such as 'Uploaded by admin on behalf of author after email submission.'" /></label>
      <DraftUploadButton hasDraftFile={Boolean(latestDraftSubmission(chapter)?.submission_files?.length)} />
    </form>
  );
}

function ChapterDraftFiles({ chapter }: { chapter: ChapterRecord }) {
  const draftSubmissions = [...(chapter.submissions ?? [])]
    .filter((submission) => submission.stage.includes("draft") || (submission.submission_files ?? []).length)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="review-history">
      <strong>Draft manuscript files</strong>
      {draftSubmissions.length ? draftSubmissions.map((submission) => (
        <div className="review-note" key={submission.id}>
          <small>{displayStatus(submission.stage)} · {formatDate(submission.created_at)}</small>
          {submission.response_to_feedback ? <p>{submission.response_to_feedback}</p> : null}
          {(submission.submission_files ?? []).length ? (
            <div className="file-list">
              {(submission.submission_files ?? []).map((file) => (
                <div className="file-row" key={file.id}>
                  <span>{file.file_name}</span>
                  <a className="button-link" href={fileHref(file)} target="_blank" rel="noreferrer">Open draft</a>
                </div>
              ))}
            </div>
          ) : <p className="muted">No file attached to this draft record.</p>}
        </div>
      )) : <p className="muted">No draft manuscript has been uploaded yet.</p>}
    </div>
  );
}

function ReviewHistory({ reviews }: { reviews: ReviewRecord[] }) {
  return (
    <div className="review-history">
      <strong>Decision history</strong>
      {reviews.length ? reviews.map((review) => (
        <div className="review-note" key={review.id}>
          <span className={statusClass(review.decision)}>{displayStatus(review.decision)}</span>
          <small>{formatDate(review.created_at)}</small>
          {review.feedback ? <p>{review.feedback}</p> : null}
        </div>
      )) : <p className="muted">No decisions have been recorded yet.</p>}
    </div>
  );
}

function ReviewForm({ book, chapter }: { book: BookRecord; chapter: ChapterRecord }) {
  const defaultTemplate = chapter.status === "revision_requested" ? "proposal-improvements" : "proposal-approved-first-draft";
  const [decision, setDecision] = useState("approved");
  const [selectedTemplateId, setSelectedTemplateId] = useState(defaultTemplate);
  const [feedback, setFeedback] = useState("");
  const selectedTemplate = reviewEmailTemplates.find((template) => template.id === selectedTemplateId) ?? reviewEmailTemplates[0];

  function updateDecision(nextDecision: string) {
    setDecision(nextDecision);
    if (nextDecision === "approved") setSelectedTemplateId("proposal-approved-first-draft");
    if (nextDecision === "revision_requested") setSelectedTemplateId("proposal-improvements");
    if (nextDecision === "rejected") setSelectedTemplateId("proposal-not-selected");
  }

  return (
    <form action={reviewProposal}>
      <input type="hidden" name="book_id" value={book.id} />
      <input type="hidden" name="chapter_id" value={chapter.id} />
      <input type="hidden" name="email_template_name" value={selectedTemplate.label} />
      <input type="hidden" name="email_subject" value={selectedTemplate.subject} />
      <input type="hidden" name="email_template_body" value={selectedTemplate.body} />
      <label>Decision<select name="decision" value={decision} onChange={(event) => updateDecision(event.target.value)}><option value="approved">Approve proposal</option><option value="revision_requested">Request improvements</option><option value="rejected">Reject proposal</option></select></label>
      <label>Email template<select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>{reviewEmailTemplates.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}</select></label>
      <label>Additional feedback to author<textarea name="feedback" value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Add specific feedback for this author. It will be added beneath the selected template." /></label>
      <div className="email-draft">
        <strong>Email preview</strong>
        <p><strong>Subject:</strong> {selectedTemplate.subject}</p>
        <pre>{selectedTemplate.body}</pre>
        {feedback ? <p><strong>Additional feedback:</strong><br />{feedback}</p> : null}
        <p>Approved proposals move to first draft and show the first draft deadline: {formatDate(book.first_draft_deadline)}.</p>
      </div>
      <ReviewButtons />
    </form>
  );
}

function ReviewButtons() {
  const { pending } = useFormStatus();

  return (
    <div className="button-row">
      <button disabled={pending} type="submit" name="_action" value="save">
        {pending ? "Saving..." : "Save decision only"}
      </button>
      <button className={`primary notify-button ${pending ? "sending" : ""}`} disabled={pending} type="submit" name="_action" value="notify">
        {pending ? "Sending notification..." : "Save and send notification"}
      </button>
    </div>
  );
}

function DeadlineStrip({ book }: { book: BookRecord }) {
  return (
    <div className="date-strip">
      <span><strong>Proposal</strong>{formatDate(book.proposal_deadline)}</span>
      <span><strong>First draft</strong>{formatDate(book.first_draft_deadline)}</span>
      <span><strong>Final</strong>{formatDate(book.final_materials_deadline)}</span>
    </div>
  );
}

function DeadlineList({ book }: { book: BookRecord }) {
  const deadlines = [
    ["Submit proposal by", book.proposal_deadline],
    ["Proposal decision by", book.decision_date],
    ["First draft due", book.first_draft_deadline],
    ["Second draft due", book.second_draft_deadline],
    ["Final materials due", book.final_materials_deadline]
  ];

  return <ol>{deadlines.map(([label, date]) => <li key={label}><strong>{label}</strong> {formatDate(date)}</li>)}</ol>;
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return <div className="empty-state"><p className="eyebrow">Waiting for data</p><h2>{title}</h2><p className="muted">{message}</p></div>;
}
