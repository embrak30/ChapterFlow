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
      <article className="panel call-card">
        <div>
          <span className={book.public_status === "open" ? "pill approved" : "pill pending-review"}>{book.public_status === "open" ? "Open call" : "Call not yet open"}</span>
          <p className="eyebrow">{book.subtitle || "Call for chapter proposals"}</p>
          <h2>Author instructions</h2>
        </div>
        <div className="call-details">
          {book.chapter_spaces ? <p><strong>{book.chapter_spaces}</strong></p> : null}
          {book.publication_target ? <p>{book.publication_target}</p> : null}
          <p>{book.author_guidelines || "Sign in with Google, create your contributor profile, then submit a proposed chapter title and short proposal summary for editorial review."}</p>
        </div>
        <DeadlineStrip book={book} />
        <AuthPrompt isSignedIn={isSignedIn} />
      </article>
    </section>
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
        <section className="panel timeline"><div className="section-heading"><p className="eyebrow">Project dates</p><h2>Deadlines</h2></div><DeadlineList book={book} /></section>
        <section className="panel">
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
              <label>Proposed chapter title<input name="title" required placeholder="Enter your proposed chapter title" defaultValue={chapter?.title ?? ""} /></label>
              <label>Short chapter abstract<textarea name="abstract" placeholder="A short public abstract or outline of the chapter." defaultValue={chapter?.abstract ?? ""} /></label>
              <label>Proposal summary<textarea name="proposal_outline" required placeholder="Describe what the chapter will cover and how it fits the call." defaultValue={chapter?.proposal_outline ?? ""} /></label>
              <label>Author biography<textarea name="biography" placeholder="Add the biography you want the editor to hold with your chapter." defaultValue={chapter?.submissions?.[0]?.author_biography ?? ""} /></label>
              <button className="primary" type="submit">{hasProposal ? "Update proposal" : "Submit proposal"}</button>
            </form>
          )}
        </section>
        <section className="panel">
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
      <label>Subtitle<input name="subtitle" defaultValue={book?.subtitle ?? "Call for chapter proposals"} /></label>
      <label>Short public welcome<textarea name="call_summary" defaultValue={book?.call_summary ?? ""} placeholder="Welcome authors and explain what they are being invited to submit." /></label>
      <label>Author instructions<textarea name="author_guidelines" defaultValue={book?.author_guidelines ?? ""} placeholder="Explain who can submit, what the proposal should include, and what happens after review." /></label>
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
