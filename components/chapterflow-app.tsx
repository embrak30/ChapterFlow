"use client";

import { useMemo, useState } from "react";
import { reviewProposal, saveCallSettings, submitProposal } from "@/app/actions";
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
  proposal_outline: string | null;
  author_biography: string | null;
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
};

type ChapterFlowAppProps = {
  userEmail?: string | null;
  userName?: string | null;
  userRole?: "admin" | "facilitator" | "author" | null;
  books: BookRecord[];
  chapters: ChapterRecord[];
};

const fallbackBook: BookRecord = {
  id: "",
  title: "ChapterFlow",
  subtitle: "Call for chapter proposals",
  description: "Welcome to ChapterFlow. Sign in to create your author profile and submit your chapter proposal.",
  call_summary: "The editor has not published a call yet. Once the call is open, the proposal form and deadlines will appear here.",
  author_guidelines: "Create an account, read the call carefully, then submit your proposed chapter title and summary for review.",
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

export function ChapterFlowApp({ userEmail, userName, userRole, books, chapters }: ChapterFlowAppProps) {
  const isSignedIn = Boolean(userEmail);
  const canViewAdmin = userRole === "admin";
  const canViewFacilitator = userRole === "facilitator" || canViewAdmin;
  const defaultView = !isSignedIn ? "public" : canViewAdmin ? "admin" : canViewFacilitator ? "facilitator" : "author";
  const [role, setRole] = useState<"public" | "admin" | "facilitator" | "author">(defaultView);
  const openBooks = books.filter((book) => book.public_status === "open");
  const visibleBooks = openBooks.length ? openBooks : books;
  const selectedBook = visibleBooks[0] ?? fallbackBook;
  const bookChapters = selectedBook.id ? chapters.filter((chapter) => chapter.book_id === selectedBook.id) : chapters;
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
        <AdminView book={selectedBook} books={books} chapters={bookChapters} stats={stats} />
      ) : role === "facilitator" && canViewFacilitator ? (
        <ReviewWorkspace title="Facilitator Review Queue" book={selectedBook} chapters={bookChapters} canDecide />
      ) : role === "author" && isSignedIn ? (
        <AuthorView book={selectedBook} userName={userName} userEmail={userEmail} chapter={authorChapter} />
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
        <h2>Chapter submission expectations</h2>
        <p className="muted">We welcome contributions from experienced practitioners, researchers, and educational leaders from across the international school sector.</p>
      </div>
      <div className="guidance-grid">
        <GuidanceBlock title="Chapter Expectations">
          <p>Authors should submit a chapter that:</p>
          <ul>
            <li>Aligns clearly with the central theme of Mission Integrity.</li>
            <li>Combines scholarly evidence with practical application.</li>
            <li>Offers original insights, case studies, frameworks, or examples that can support leaders in international schools.</li>
            <li>Is written in an accessible style for both aspiring and experienced school leaders.</li>
          </ul>
        </GuidanceBlock>
        <GuidanceBlock title="Chapter Length">
          <p>5,000 to 7,000 words, excluding references.</p>
        </GuidanceBlock>
        <GuidanceBlock title="Suggested Structure">
          <ul>
            <li>Introduction</li>
            <li>Context and rationale</li>
            <li>Key concepts and discussion</li>
            <li>Practical implications for school leaders</li>
            <li>Case study or examples, where appropriate</li>
            <li>Reflection and concluding recommendations</li>
          </ul>
        </GuidanceBlock>
        <GuidanceBlock title="Referencing">
          <ul>
            <li>Use APA 7th Edition throughout.</li>
            <li>Ensure all references are complete and accurate.</li>
            <li>Where possible, include recent research alongside seminal literature.</li>
          </ul>
        </GuidanceBlock>
        <GuidanceBlock title="Style Guidelines">
          <ul>
            <li>Write in clear, professional English.</li>
            <li>Avoid excessive jargon.</li>
            <li>Use headings and subheadings to improve readability.</li>
            <li>Clearly label tables and figures, with permissions where required.</li>
            <li>Define specialist terminology when first introduced.</li>
          </ul>
        </GuidanceBlock>
        <GuidanceBlock title="Originality">
          <p>By submitting a chapter, authors confirm that the work is original, has not been previously published, is not under consideration elsewhere, and has appropriate permissions for any copyrighted material.</p>
          <p>All submissions may be screened for originality.</p>
        </GuidanceBlock>
        <GuidanceBlock title="Review Process">
          <p>Each chapter will undergo editorial review. Authors may be asked to revise their work based on feedback to ensure consistency, quality, and alignment with the overall vision of the book.</p>
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
          <p>Leading With Mission Integrity During Strategic Change in International Schools</p>
        </div>
        <div>
          <strong>Short chapter abstract</strong>
          <p>This chapter explores how school leaders can protect mission integrity while navigating strategic change, growth, and competing stakeholder expectations. Drawing on research into values-led leadership and practical experience in international school settings, it offers a framework for aligning decisions, communication, and accountability with the stated mission of the school.</p>
        </div>
        <div>
          <strong>Proposal summary</strong>
          <p>The chapter will examine the tension between aspirational mission statements and the daily decisions that shape school culture. It will begin by defining mission integrity and explaining why it matters in international schools, particularly during periods of expansion, curriculum change, accreditation, or leadership transition.</p>
          <p>The chapter will then present a practical framework that leaders can use to test whether strategic decisions remain aligned with mission, values, and community commitments. A short case example will illustrate how leaders can use reflective questions, stakeholder dialogue, and evidence-informed decision-making to maintain trust and coherence.</p>
          <p>The chapter will conclude with recommendations for aspiring and experienced school leaders, including how to communicate mission-aligned decisions, avoid performative values language, and build review processes that keep mission integrity visible over time.</p>
        </div>
        <div>
          <strong>Author biography</strong>
          <p>Dr Alex Morgan is an international school leader and researcher with experience in strategic planning, leadership development, and school improvement. Their work focuses on values-led leadership, organisational culture, and the practical application of research in international education.</p>
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
  chapter
}: {
  book: BookRecord;
  userName?: string | null;
  userEmail?: string | null;
  chapter?: ChapterRecord;
}) {
  const proposalApproved = chapter?.status === "approved" || chapter?.stage === "first_draft";
  const hasProposal = Boolean(chapter);

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
              <p className="muted">Submit your proposed chapter title and a short summary. Draft manuscript upload will unlock after approval.</p>
              <div className="proposal-form-grid">
                <label>Proposed chapter title<input name="title" required placeholder="Enter your proposed chapter title" defaultValue={chapter?.title ?? ""} /></label>
                <label>Short chapter abstract<textarea name="abstract" placeholder="A short public abstract or outline of the chapter." defaultValue={chapter?.abstract ?? ""} /></label>
                <label>Proposal summary<textarea name="proposal_outline" required placeholder="Describe what the chapter will cover and how it fits the call." defaultValue={chapter?.proposal_outline ?? ""} /></label>
                <label>Author biography<textarea name="biography" placeholder="Add the biography you want the editor to hold with your chapter." defaultValue={chapter?.submissions?.[0]?.author_biography ?? ""} /></label>
              </div>
              <button className="primary" type="submit">{hasProposal ? "Update proposal" : "Submit proposal"}</button>
            </form>
          )}
        </section>
        <section className="panel draft-panel">
          <div className="section-heading"><p className="eyebrow">Next stage</p><h2>First draft manuscript</h2></div>
          <div className="empty-state">
            <h2>{proposalApproved ? "Ready for draft upload" : "Locked until proposal approval"}</h2>
            <p className="muted">Authors will upload a Word document here once the proposal has been approved and the first draft deadline is active.</p>
          </div>
        </section>
      </div>
    </section>
  );
}

function AdminView({
  book,
  books,
  chapters,
  stats
}: {
  book: BookRecord;
  books: BookRecord[];
  chapters: ChapterRecord[];
  stats: Array<{ label: string; value: number }>;
}) {
  return (
    <section className="workspace">
      <aside className="panel sidebar">
        <div className="section-heading">
          <p className="eyebrow">Admin Control Centre</p>
          <h2>Design the call</h2>
          <p className="muted">Edit what authors see, set the workflow deadlines, and open or close the call.</p>
        </div>
        <div className="stat-grid">{stats.map((stat) => <div className="stat" key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}</div>
        <CallSettingsForm book={book.id ? book : undefined} hasBooks={books.length > 0} />
        <div className="stage-list">{workflowStages.map((stage) => <div className="stage" key={stage.name}><span>{stage.name}</span><small>{stage.owner}</small></div>)}</div>
      </aside>
      <ReviewWorkspace title="Admin Proposal Board" book={book} chapters={chapters} canDecide />
    </section>
  );
}

function CallSettingsForm({ book, hasBooks }: { book?: BookRecord; hasBooks: boolean }) {
  return (
    <form action={saveCallSettings} className="admin-tools">
      <h3>{hasBooks ? "Public call settings" : "Create your first call"}</h3>
      <input type="hidden" name="book_id" value={book?.id ?? ""} />
      <label>Book / project title<input name="title" required defaultValue={book?.title ?? ""} placeholder="Example: Leadership With Mission Integrity" /></label>
      <label>Short public welcome<textarea name="call_summary" defaultValue={book?.call_summary ?? ""} placeholder="Welcome authors and explain what they are being invited to submit." /></label>
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
    <>
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
      <aside className="panel detail-panel">
        {selected ? (
          <>
            <div className="section-heading"><p className="eyebrow">Proposal review</p><h2>{selected.title}</h2></div>
            <div className="meta-list"><p><strong>Author</strong>{selected.profiles?.full_name || selected.profiles?.email || "Author"}</p><p><strong>Current stage</strong>{displayStatus(selected.stage)}</p><p><strong>Deadline</strong>{formatDate(selected.current_deadline)}</p></div>
            <div className="document-preview"><span>Proposal summary</span><p>{selected.proposal_outline || selected.abstract || "No proposal text supplied."}</p></div>
            {canDecide ? <ReviewForm book={book} chapter={selected} /> : null}
          </>
        ) : (
          <EmptyState title="No proposal selected" message="Once authors submit proposals, you will be able to review them here." />
        )}
      </aside>
    </>
  );
}

function ReviewForm({ book, chapter }: { book: BookRecord; chapter: ChapterRecord }) {
  return (
    <form action={reviewProposal}>
      <input type="hidden" name="book_id" value={book.id} />
      <input type="hidden" name="chapter_id" value={chapter.id} />
      <label>Decision<select name="decision" defaultValue="approved"><option value="approved">Approve proposal</option><option value="revision_requested">Request improvements</option><option value="rejected">Reject proposal</option></select></label>
      <label>Feedback to author<textarea name="feedback" placeholder="Write the feedback or instruction that should be recorded for this author." /></label>
      <div className="email-draft"><strong>What happens next</strong><p>Approved proposals move to first draft and show the first draft deadline: {formatDate(book.first_draft_deadline)}.</p></div>
      <button className="primary" type="submit">Save decision</button>
    </form>
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
