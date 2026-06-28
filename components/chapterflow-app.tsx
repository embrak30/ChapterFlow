"use client";

import { useMemo, useState } from "react";
import { AuthButtons } from "@/components/auth-buttons";
import { callsForChapters, chapters, emailTemplates, workflowStages, type Status } from "@/lib/sample-data";

const statusOptions: Status[] = ["Pending review", "Approved", "Revision requested", "Rejected", "Submitted", "Overdue", "Complete"];

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(date));
}

function statusClass(status: Status) {
  return `pill ${status.toLowerCase().replaceAll(" ", "-")}`;
}

type ChapterFlowAppProps = {
  userEmail?: string | null;
  userName?: string | null;
  userRole?: "admin" | "facilitator" | "author" | null;
};

export function ChapterFlowApp({ userEmail, userName, userRole }: ChapterFlowAppProps) {
  const isSignedIn = Boolean(userEmail);
  const canViewAdmin = userRole === "admin";
  const canViewFacilitator = userRole === "facilitator" || canViewAdmin;
  const defaultView = !isSignedIn ? "public" : canViewAdmin ? "admin" : canViewFacilitator ? "facilitator" : "author";
  const [role, setRole] = useState<"public" | "admin" | "facilitator" | "author">(defaultView);
  const [selectedCallId, setSelectedCallId] = useState(callsForChapters[0].id);
  const [registeredName, setRegisteredName] = useState(userName ?? "");
  const [registeredEmail, setRegisteredEmail] = useState(userEmail ?? "");
  const [proposalTitle, setProposalTitle] = useState("");
  const [proposalSummary, setProposalSummary] = useState("");
  const [authorBiography, setAuthorBiography] = useState("");
  const [proposalSubmitted, setProposalSubmitted] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(chapters[0]?.id ?? null);
  const [decision, setDecision] = useState<Status>("Revision requested");
  const [comment, setComment] = useState("");
  const selected = chapters.find((chapter) => chapter.id === selectedId) ?? chapters[0];
  const selectedCall = callsForChapters.find((call) => call.id === selectedCallId) ?? callsForChapters[0];
  const selectedMilestones = [
    { label: "Proposal due", date: selectedCall.proposalDeadline },
    { label: "Proposal decisions", date: selectedCall.decisionDate },
    { label: "First draft due", date: selectedCall.firstDraftDeadline },
    { label: "Second draft due", date: selectedCall.secondDraftDeadline },
    { label: "Final materials due", date: selectedCall.finalDeadline }
  ];

  function registerForCall(callId: string) {
    setSelectedCallId(callId);
    setProposalSubmitted(false);
    if (isSignedIn) setRole("author");
  }

  const stats = useMemo(
    () => [
      { label: "Active chapters", value: chapters.length },
      { label: "Awaiting review", value: chapters.filter((chapter) => chapter.status === "Pending review" || chapter.status === "Submitted").length },
      { label: "Revisions requested", value: chapters.filter((chapter) => chapter.status === "Revision requested").length },
      { label: "Overdue", value: chapters.filter((chapter) => chapter.status === "Overdue").length }
    ],
    []
  );

  const selectedTemplate =
    emailTemplates.find((template) => template.name.includes(decision === "Approved" ? "approved" : "Revision")) ?? emailTemplates[1];

  return (
    <main>
      <header className="topbar">
        <div>
          <p className="eyebrow">Edited book management</p>
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

      {role === "public" ? (
        <section className="public-view">
          <div className="intro-band">
            <p className="eyebrow">Welcome to ChapterFlow</p>
            <h2>Run an edited-book project from call for chapters to final manuscript.</h2>
            <p>ChapterFlow gives editors one place to open calls, register authors, collect proposals, review drafts, and track every deadline.</p>
          </div>
          <div className="call-grid">
            {callsForChapters.map((call) => (
              <article className="panel call-card" key={call.id}>
                <div>
                  <span className="pill submitted">{call.status}</span>
                  <p className="eyebrow">{call.subtitle}</p>
                  <h2>{call.title}</h2>
                </div>
                <p className="muted">{call.summary}</p>
                <div className="call-details">
                  <p><strong>{call.chapterSpaces}</strong></p>
                  <p>{call.publicationTarget}</p>
                  <ul>{call.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
                </div>
                <div className="date-strip">
                  <span><strong>Proposal</strong>{formatDate(call.proposalDeadline)}</span>
                  <span><strong>First draft</strong>{formatDate(call.firstDraftDeadline)}</span>
                  <span><strong>Final</strong>{formatDate(call.finalDeadline)}</span>
                </div>
                <button className="primary" onClick={() => registerForCall(call.id)}>{isSignedIn ? "Continue to author profile" : "Sign in to register"}</button>
              </article>
            ))}
          </div>
          <section className="panel registration-panel">
            <div className="section-heading">
              <p className="eyebrow">Contributor registration</p>
              <h2>Create your contributor profile</h2>
            </div>
            <div className="form-grid">
              <label>Full name<input placeholder="Your name" value={registeredName} onChange={(event) => setRegisteredName(event.target.value)} /></label>
              <label>Email<input placeholder="you@example.com" value={registeredEmail} onChange={(event) => setRegisteredEmail(event.target.value)} /></label>
              <label>Project<select value={selectedCallId} onChange={(event) => setSelectedCallId(event.target.value)}>{callsForChapters.map((call) => <option key={call.id} value={call.id}>{call.title}</option>)}</select></label>
              <label>Role<select disabled><option>Author / contributor</option></select></label>
            </div>
            <button onClick={() => registerForCall(selectedCallId)}>{isSignedIn ? "Continue to profile" : "Sign in above to continue"}</button>
          </section>
        </section>
      ) : role === "admin" && canViewAdmin ? (
        <AdminView stats={stats} selected={selected} selectedId={selectedId} setSelectedId={setSelectedId} decision={decision} setDecision={setDecision} comment={comment} setComment={setComment} selectedTemplate={selectedTemplate} />
      ) : role === "facilitator" && canViewFacilitator ? (
        <FacilitatorView selected={selected} selectedId={selectedId} setSelectedId={setSelectedId} />
      ) : (
        <section className="author-view">
          <div className="panel author-summary">
            <div>
              <p className="eyebrow">Author dashboard</p>
              <h2>{selectedCall.title}</h2>
              <p>Signed in as <strong>{registeredName}</strong> for <strong>{selectedCall.subtitle.toLowerCase()}</strong></p>
            </div>
            <span className={proposalSubmitted ? "pill submitted" : "pill pending-review"}>{proposalSubmitted ? "Proposal submitted" : "Proposal not submitted"}</span>
          </div>
          <div className="author-grid">
            <section className="panel profile-card"><div className="section-heading"><p className="eyebrow">Contributor profile</p><h2>{registeredName}</h2></div><div className="meta-list"><p><strong>Email</strong>{registeredEmail}</p><p><strong>Project</strong>{selectedCall.title}</p><p><strong>Role</strong>Author / contributor</p></div></section>
            <section className="panel timeline"><div className="section-heading"><p className="eyebrow">Project dates</p><h2>Submission timeline</h2></div><ol>{selectedMilestones.map((milestone) => <li key={milestone.label}><strong>{milestone.label}</strong> {formatDate(milestone.date)}</li>)}</ol></section>
            <section className="panel"><div className="section-heading"><p className="eyebrow">First action</p><h2>Submit chapter proposal</h2></div><p className="muted">Start with a chapter title and short proposal. When the editor approves it, your dashboard will move you to the first draft stage.</p><label>Proposed chapter title<input placeholder="Enter your proposed chapter title" value={proposalTitle} onChange={(event) => setProposalTitle(event.target.value)} /></label><label>Proposal summary<textarea placeholder="Briefly describe the chapter, its focus, and how it fits the project." value={proposalSummary} onChange={(event) => setProposalSummary(event.target.value)} /></label><button className="primary" onClick={() => setProposalSubmitted(true)}>{proposalSubmitted ? "Proposal submitted" : "Submit proposal"}</button>{proposalSubmitted ? <div className="notice">Your proposal is now awaiting admin review.</div> : null}</section>
            <section className="panel"><div className="section-heading"><p className="eyebrow">Profile</p><h2>Biography and abstract</h2></div><label>Chapter abstract<textarea placeholder="Add or refine the chapter abstract as the project develops." value={proposalSummary} onChange={(event) => setProposalSummary(event.target.value)} /></label><label>Author biography<textarea placeholder="Add the biography that should appear with your chapter." value={authorBiography} onChange={(event) => setAuthorBiography(event.target.value)} /></label><button>Save profile details</button></section>
          </div>
        </section>
      )}
    </main>
  );
}

function AdminView({ stats, selected, selectedId, setSelectedId, decision, setDecision, comment, setComment, selectedTemplate }: any) {
  return (
    <section className="workspace">
      <aside className="panel sidebar">
        <div className="section-heading"><p className="eyebrow">Admin Control Centre</p><h2>ChapterFlow project settings</h2><p className="muted">Signed in as administrator. Configure public calls, manage roles, and oversee every submission as authors move through the workflow.</p></div>
        <div className="stat-grid">{stats.map((stat: any) => <div className="stat" key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}</div>
        <div className="admin-tools"><h3>Site controls</h3><label>Public call status<select defaultValue="Open"><option>Open</option><option>Closed</option><option>Draft</option></select></label><label>Chapter spaces<input placeholder="Example: 12 chapters + 2 reserve spaces" /></label><button className="primary">Save public project settings</button></div>
        <div className="stage-list">{workflowStages.map((stage) => <div className="stage" key={stage.name}><span>{stage.name}</span><small>{stage.owner}</small></div>)}</div>
      </aside>
      <SubmissionTable title="Admin Submission Board" selectedId={selectedId} setSelectedId={setSelectedId} />
      <aside className="panel detail-panel">
        {selected ? (
          <>
            <div className="section-heading"><p className="eyebrow">Review</p><h2>{selected.title}</h2></div><Meta selected={selected} /><div className="document-preview"><span>PDF / DOCX preview</span><p>{selected.abstract}</p></div><label>Decision<select value={decision} onChange={(event) => setDecision(event.target.value as Status)}>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></label><label>Admin comment<textarea placeholder="Write the message that should be sent to the author." value={comment} onChange={(event) => setComment(event.target.value)} /></label><div className="email-draft"><strong>{selectedTemplate.subject}</strong><p>{selectedTemplate.body}</p>{comment ? <p>{comment}</p> : null}</div><button className="primary">Approve email and update status</button>
          </>
        ) : (
          <EmptyState title="No submission selected" message="Submitted proposals and draft files will appear here when authors start using the platform." />
        )}
      </aside>
    </section>
  );
}

function FacilitatorView({ selected, selectedId, setSelectedId }: any) {
  return (
    <section className="workspace">
      <aside className="panel sidebar"><div className="section-heading"><p className="eyebrow">Facilitator Review Workspace</p><h2>Assigned Projects</h2><p className="muted">Facilitators can view assigned project work and support review decisions without editing site settings.</p></div><div className="stat-grid"><div className="stat"><strong>0</strong><span>Assigned projects</span></div><div className="stat"><strong>{chapters.length}</strong><span>Visible submissions</span></div><div className="stat"><strong>0</strong><span>Need response</span></div><div className="stat"><strong>0</strong><span>Site controls</span></div></div></aside>
      <SubmissionTable title="Facilitator Review Queue" selectedId={selectedId} setSelectedId={setSelectedId} />
      <aside className="panel detail-panel">
        {selected ? (
          <>
            <div className="section-heading"><p className="eyebrow">Facilitator recommendation</p><h2>{selected.title}</h2></div><Meta selected={selected} /><div className="document-preview"><span>Read-only proposal / draft preview</span><p>{selected.abstract}</p></div><label>Recommendation<select defaultValue="Revision requested"><option>Approve</option><option>Revision requested</option><option>Reject</option></select></label><label>Facilitator notes<textarea placeholder="Add a recommendation for the administrator." /></label><button className="primary">Save facilitator recommendation</button>
          </>
        ) : (
          <EmptyState title="No assigned submissions yet" message="When an administrator assigns a project or submission to you, the review details will appear here." />
        )}
      </aside>
    </section>
  );
}

function SubmissionTable({ title, selectedId, setSelectedId }: any) {
  return <section className="panel table-panel"><div className="section-heading"><p className="eyebrow">Submissions</p><h2>{title}</h2></div><div className="chapter-table"><div className="table-row table-head"><span>Chapter</span><span>Author</span><span>Stage</span><span>Status</span><span>Deadline</span></div>{chapters.length ? chapters.map((chapter) => <button className={`table-row ${selectedId === chapter.id ? "selected" : ""}`} key={chapter.id} onClick={() => setSelectedId(chapter.id)}><span>{chapter.title}</span><span>{chapter.author}</span><span>{chapter.stage}</span><span className={statusClass(chapter.status)}>{chapter.status}</span><span>{formatDate(chapter.deadline)}</span></button>) : <div className="empty-table"><strong>No submissions yet</strong><span>Author proposals and uploaded drafts will appear here once entries are saved to Supabase.</span></div>}</div></section>;
}

function Meta({ selected }: any) {
  return <div className="meta-list"><p><strong>Author</strong>{selected.author}</p><p><strong>Submitted</strong>{formatDate(selected.submitted)}</p><p><strong>Latest file</strong>{selected.latestFile}</p></div>;
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return <div className="empty-state"><p className="eyebrow">Waiting for data</p><h2>{title}</h2><p className="muted">{message}</p></div>;
}
