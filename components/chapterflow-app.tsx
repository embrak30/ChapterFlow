"use client";

import { useMemo, useState } from "react";
import { AuthButtons } from "@/components/auth-buttons";
import {
  callsForChapters,
  chapters,
  emailTemplates,
  workflowStages,
  type Status
} from "@/lib/sample-data";

const statusOptions: Status[] = [
  "Pending review",
  "Approved",
  "Revision requested",
  "Rejected",
  "Submitted",
  "Overdue",
  "Complete"
];

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(date));
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
  const [registeredName, setRegisteredName] = useState(userName ?? "Dr Priya Nair");
  const [registeredEmail, setRegisteredEmail] = useState(userEmail ?? "priya.nair@example.com");
  const [proposalTitle, setProposalTitle] = useState("Ethics, Consent, and Shared Authority");
  const [proposalSummary, setProposalSummary] = useState(
    "Explores ethical responsibilities in edited collections that include practitioner and community voices."
  );
  const [proposalSubmitted, setProposalSubmitted] = useState(false);
  const [selectedId, setSelectedId] = useState(chapters[0].id);
  const [decision, setDecision] = useState<Status>("Revision requested");
  const [comment, setComment] = useState(
    "Thank you for the submission. Please strengthen the chapter structure and return the next version by the deadline."
  );
  const selected = chapters.find((chapter) => chapter.id === selectedId) ?? chapters[0];
  const authorChapter = chapters[2];
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
    if (isSignedIn) {
      setRole("author");
    }
  }

  const stats = useMemo(
    () => [
      { label: "Active chapters", value: chapters.length },
      {
        label: "Awaiting review",
        value: chapters.filter((chapter) => chapter.status === "Pending review" || chapter.status === "Submitted").length
      },
      { label: "Revisions requested", value: chapters.filter((chapter) => chapter.status === "Revision requested").length },
      { label: "Overdue", value: chapters.filter((chapter) => chapter.status === "Overdue").length }
    ],
    []
  );

  const selectedTemplate =
    emailTemplates.find((template) => template.name.includes(decision === "Approved" ? "approved" : "Revision")) ??
    emailTemplates[1];

  return (
    <main>
      <header className="topbar">
        <div>
          <p className="eyebrow">Edited book management</p>
          <h1>ChapterFlow</h1>
        </div>
        <div className="top-actions">
          <div className="role-switch" aria-label="Choose view">
            <button className={role === "public" ? "active" : ""} onClick={() => setRole("public")}>
              Public
            </button>
            {isSignedIn ? (
              <button className={role === "author" ? "active" : ""} onClick={() => setRole("author")}>
                Author
              </button>
            ) : null}
            {canViewFacilitator ? (
              <button className={role === "facilitator" ? "active" : ""} onClick={() => setRole("facilitator")}>
                Facilitator
              </button>
            ) : null}
            {canViewAdmin ? (
              <button className={role === "admin" ? "active" : ""} onClick={() => setRole("admin")}>
                Admin
              </button>
            ) : null}
          </div>
          <AuthButtons isSignedIn={isSignedIn} email={userEmail} />
        </div>
      </header>

      {role === "public" ? (
        <section className="public-view">
          <div className="intro-band">
            <p className="eyebrow">Welcome to ChapterFlow</p>
            <h2>Find your edited-book project, register, and follow each submission stage from one profile.</h2>
            <p>
              Contributors can browse open calls, choose the project they are joining, and begin with a short chapter
              proposal. Editors manage decisions, deadlines, documents, and the final manuscript package.
            </p>
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
                {call.details ? (
                  <div className="call-details">
                    <p>
                      <strong>{call.chapterSpaces}</strong>
                    </p>
                    <p>{call.publicationTarget}</p>
                    <ul>
                      {call.details.map((detail) => (
                        <li key={detail}>{detail}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="date-strip">
                  <span>
                    <strong>Proposal</strong>
                    {formatDate(call.proposalDeadline)}
                  </span>
                  <span>
                    <strong>First draft</strong>
                    {formatDate(call.firstDraftDeadline)}
                  </span>
                  <span>
                    <strong>Final</strong>
                    {formatDate(call.finalDeadline)}
                  </span>
                </div>
                <button className="primary" onClick={() => registerForCall(call.id)}>
                  {isSignedIn ? "Continue to author profile" : "Sign in to register"}
                </button>
              </article>
            ))}
          </div>

          <section className="panel registration-panel">
            <div className="section-heading">
              <p className="eyebrow">Registration preview</p>
              <h2>Create your contributor profile</h2>
            </div>
            <div className="form-grid">
              <label>
                Full name
                <input value={registeredName} onChange={(event) => setRegisteredName(event.target.value)} />
              </label>
              <label>
                Email
                <input value={registeredEmail} onChange={(event) => setRegisteredEmail(event.target.value)} />
              </label>
              <label>
                Project
                <select value={selectedCallId} onChange={(event) => setSelectedCallId(event.target.value)}>
                  {callsForChapters.map((call) => (
                    <option key={call.id} value={call.id}>
                      {call.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Role
                <select disabled>
                  <option>Author / contributor</option>
                </select>
              </label>
            </div>
            <button onClick={() => registerForCall(selectedCallId)}>
              {isSignedIn ? "Continue to profile" : "Sign in above to continue"}
            </button>
          </section>
        </section>
      ) : role === "admin" && canViewAdmin ? (
        <section className="workspace">
          <aside className="panel sidebar">
            <div className="section-heading">
              <p className="eyebrow">Admin Control Centre</p>
              <h2>LYIS Leadership With Mission Integrity</h2>
              <p className="muted">Signed in as administrator. You can configure projects, manage roles, and oversee every submission.</p>
            </div>
            <div className="stat-grid">
              {stats.map((stat) => (
                <div className="stat" key={stat.label}>
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
            <div className="admin-tools">
              <h3>Site controls</h3>
              <label>
                Public call status
                <select defaultValue="Open">
                  <option>Open</option>
                  <option>Closed</option>
                  <option>Draft</option>
                </select>
              </label>
              <label>
                Chapter spaces
                <input defaultValue="12 chapters + 2 reserve spaces" />
              </label>
              <button className="primary">Save public project settings</button>
            </div>
            <div className="stage-list">
              {workflowStages.map((stage) => (
                <div className="stage" key={stage.name}>
                  <span>{stage.name}</span>
                  <small>{stage.owner}</small>
                </div>
              ))}
            </div>
          </aside>

          <section className="panel table-panel">
            <div className="section-heading">
              <p className="eyebrow">Submissions</p>
              <h2>Admin Submission Board</h2>
            </div>
            <div className="chapter-table" role="table" aria-label="Chapter submissions">
              <div className="table-row table-head" role="row">
                <span>Chapter</span>
                <span>Author</span>
                <span>Stage</span>
                <span>Status</span>
                <span>Deadline</span>
              </div>
              {chapters.map((chapter) => (
                <button
                  className={`table-row ${selectedId === chapter.id ? "selected" : ""}`}
                  key={chapter.id}
                  onClick={() => setSelectedId(chapter.id)}
                  role="row"
                >
                  <span>{chapter.title}</span>
                  <span>{chapter.author}</span>
                  <span>{chapter.stage}</span>
                  <span className={statusClass(chapter.status)}>{chapter.status}</span>
                  <span>{formatDate(chapter.deadline)}</span>
                </button>
              ))}
            </div>
          </section>

          <aside className="panel detail-panel">
            <div className="section-heading">
              <p className="eyebrow">Review</p>
              <h2>{selected.title}</h2>
            </div>
            <div className="meta-list">
              <p>
                <strong>Author</strong>
                {selected.author}
              </p>
              <p>
                <strong>Submitted</strong>
                {formatDate(selected.submitted)}
              </p>
              <p>
                <strong>Latest file</strong>
                {selected.latestFile}
              </p>
            </div>
            <div className="document-preview">
              <span>PDF / DOCX preview</span>
              <p>{selected.abstract}</p>
            </div>
            <label>
              Decision
              <select value={decision} onChange={(event) => setDecision(event.target.value as Status)}>
                {statusOptions.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
            <label>
              Editor comment
              <textarea value={comment} onChange={(event) => setComment(event.target.value)} />
            </label>
            <div className="email-draft">
              <strong>{selectedTemplate.subject}</strong>
              <p>{selectedTemplate.body}</p>
              <p>{comment}</p>
            </div>
            <button className="primary">Approve email and update status</button>
          </aside>
        </section>
      ) : role === "facilitator" && canViewFacilitator ? (
        <section className="workspace">
          <aside className="panel sidebar">
            <div className="section-heading">
              <p className="eyebrow">Facilitator Review Workspace</p>
              <h2>Assigned Projects</h2>
              <p className="muted">Facilitators can view assigned project work and support review decisions without editing site settings.</p>
            </div>
            <div className="stat-grid">
              <div className="stat">
                <strong>1</strong>
                <span>Assigned projects</span>
              </div>
              <div className="stat">
                <strong>{chapters.length}</strong>
                <span>Visible submissions</span>
              </div>
              <div className="stat">
                <strong>2</strong>
                <span>Need response</span>
              </div>
              <div className="stat">
                <strong>0</strong>
                <span>Site controls</span>
              </div>
            </div>
            <div className="stage-list">
              <div className="stage">
                <span>LYIS Leadership With Mission Integrity</span>
                <small>Assigned</small>
              </div>
              <div className="stage">
                <span>Can review proposals</span>
                <small>Yes</small>
              </div>
              <div className="stage">
                <span>Can edit public call</span>
                <small>No</small>
              </div>
            </div>
          </aside>

          <section className="panel table-panel">
            <div className="section-heading">
              <p className="eyebrow">Assigned submissions</p>
              <h2>Facilitator Review Queue</h2>
            </div>
            <div className="chapter-table" role="table" aria-label="Assigned chapter submissions">
              <div className="table-row table-head" role="row">
                <span>Chapter</span>
                <span>Author</span>
                <span>Stage</span>
                <span>Status</span>
                <span>Deadline</span>
              </div>
              {chapters.map((chapter) => (
                <button
                  className={`table-row ${selectedId === chapter.id ? "selected" : ""}`}
                  key={chapter.id}
                  onClick={() => setSelectedId(chapter.id)}
                  role="row"
                >
                  <span>{chapter.title}</span>
                  <span>{chapter.author}</span>
                  <span>{chapter.stage}</span>
                  <span className={statusClass(chapter.status)}>{chapter.status}</span>
                  <span>{formatDate(chapter.deadline)}</span>
                </button>
              ))}
            </div>
          </section>

          <aside className="panel detail-panel">
            <div className="section-heading">
              <p className="eyebrow">Facilitator recommendation</p>
              <h2>{selected.title}</h2>
            </div>
            <div className="meta-list">
              <p>
                <strong>Author</strong>
                {selected.author}
              </p>
              <p>
                <strong>Submitted</strong>
                {formatDate(selected.submitted)}
              </p>
              <p>
                <strong>Latest file</strong>
                {selected.latestFile}
              </p>
            </div>
            <div className="document-preview">
              <span>Read-only proposal / draft preview</span>
              <p>{selected.abstract}</p>
            </div>
            <label>
              Recommendation
              <select defaultValue="Revision requested">
                <option>Approve</option>
                <option>Revision requested</option>
                <option>Reject</option>
              </select>
            </label>
            <label>
              Facilitator notes
              <textarea defaultValue="Suggested response for the administrator to review before a final message is sent." />
            </label>
            <button className="primary">Save facilitator recommendation</button>
          </aside>
        </section>
      ) : (
        <section className="author-view">
          <div className="panel author-summary">
            <div>
              <p className="eyebrow">Author dashboard</p>
              <h2>{selectedCall.title}</h2>
              <p>
                Signed in as <strong>{registeredName}</strong> for <strong>{selectedCall.subtitle.toLowerCase()}</strong>
              </p>
            </div>
            <span className={proposalSubmitted ? "pill submitted" : "pill pending-review"}>
              {proposalSubmitted ? "Proposal submitted" : "Proposal not submitted"}
            </span>
          </div>

          <div className="author-grid">
            <section className="panel profile-card">
              <div className="section-heading">
                <p className="eyebrow">Contributor profile</p>
                <h2>{registeredName}</h2>
              </div>
              <div className="meta-list">
                <p>
                  <strong>Email</strong>
                  {registeredEmail}
                </p>
                <p>
                  <strong>Project</strong>
                  {selectedCall.title}
                </p>
                <p>
                  <strong>Role</strong>
                  Author / contributor
                </p>
              </div>
            </section>

            <section className="panel timeline">
              <div className="section-heading">
                <p className="eyebrow">Project dates</p>
                <h2>Submission timeline</h2>
              </div>
              <ol>
                {selectedMilestones.map((milestone) => (
                  <li key={milestone.label}>
                    <strong>{milestone.label}</strong> {formatDate(milestone.date)}
                  </li>
                ))}
              </ol>
            </section>

            <section className="panel">
              <div className="section-heading">
                <p className="eyebrow">First action</p>
                <h2>Submit chapter proposal</h2>
              </div>
              <p className="muted">
                Start with a title and short text proposal. Once approved, this panel becomes your first draft upload.
              </p>
              <label>
                Proposed chapter title
                <input value={proposalTitle} onChange={(event) => setProposalTitle(event.target.value)} />
              </label>
              <label>
                Proposal summary
                <textarea value={proposalSummary} onChange={(event) => setProposalSummary(event.target.value)} />
              </label>
              <button className="primary" onClick={() => setProposalSubmitted(true)}>
                {proposalSubmitted ? "Proposal submitted" : "Submit proposal"}
              </button>
              {proposalSubmitted ? (
                <div className="notice">
                  Your proposal is now awaiting editor review. When approved, your next action will change to first
                  draft upload.
                </div>
              ) : null}
            </section>

            <section className="panel">
              <div className="section-heading">
                <p className="eyebrow">Profile</p>
                <h2>Biography and abstract</h2>
              </div>
              <label>
                Chapter abstract
                <textarea value={proposalSummary} onChange={(event) => setProposalSummary(event.target.value)} />
              </label>
              <label>
                Author biography
                <textarea defaultValue={authorChapter.biography} />
              </label>
              <button>Save profile details</button>
            </section>

            <section className="panel">
              <div className="section-heading">
                <p className="eyebrow">After approval</p>
                <h2>Draft upload area</h2>
              </div>
              <p className="muted">
                This unlocks after an editor approves the proposal. It will hold first, second, and final draft
                submissions.
              </p>
              <label>
                Draft file
                <input type="file" />
              </label>
              <label>
                Notes for editor
                <textarea placeholder="Add any context for the uploaded draft." />
              </label>
              <button>Upload draft</button>
            </section>

            <section className="panel timeline">
              <div className="section-heading">
                <p className="eyebrow">History</p>
                <h2>Feedback timeline</h2>
              </div>
              <ol>
                <li>Proposal approved by editor</li>
                <li>First draft submitted</li>
                <li>Revision requested: {authorChapter.editorNote}</li>
              </ol>
            </section>
          </div>
        </section>
      )}
    </main>
  );
}
