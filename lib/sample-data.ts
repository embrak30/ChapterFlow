export type Stage =
  | "Proposal"
  | "Proposal revision"
  | "First draft"
  | "Second draft"
  | "Final materials"
  | "Complete";

export type Status =
  | "Pending review"
  | "Approved"
  | "Revision requested"
  | "Rejected"
  | "Submitted"
  | "Overdue"
  | "Complete";

export type Chapter = {
  id: number;
  title: string;
  author: string;
  email: string;
  stage: Stage;
  status: Status;
  deadline: string;
  submitted: string;
  abstract: string;
  biography: string;
  latestFile: string;
  editorNote: string;
};

export const workflowStages: Array<{ name: Stage; description: string; owner: "Author" | "Editor" }> = [
  { name: "Proposal", description: "Authors submit chapter title, outline, and fit with the book theme.", owner: "Author" },
  { name: "Proposal revision", description: "Editors request refinement before accepting a chapter.", owner: "Editor" },
  { name: "First draft", description: "Approved contributors upload the first full chapter draft.", owner: "Author" },
  { name: "Second draft", description: "Authors respond to editorial feedback and upload a revised document.", owner: "Author" },
  { name: "Final materials", description: "Final chapter, abstract, biography, and permissions are confirmed.", owner: "Author" },
  { name: "Complete", description: "Chapter is accepted into the manuscript package.", owner: "Editor" }
];

export const chapters: Chapter[] = [
];

export const emailTemplates = [
  {
    name: "Proposal approved",
    subject: "Your chapter proposal has been approved",
    body: "Thank you for your proposal. We are pleased to invite you to submit a first draft for the edited collection."
  },
  {
    name: "Revision requested",
    subject: "Editorial feedback on your submission",
    body: "Thank you for your submission. We would like you to revise the chapter using the comments below before the next deadline."
  }
];

export const callsForChapters = [
  {
    id: "public-scholarship",
    title: "Leadership With Mission Integrity",
    subtitle: "Call for chapter proposals",
    summary:
      "ChapterFlow helps editorial teams collect proposals, manage draft deadlines, review submissions, and keep every contributor informed from first idea to final manuscript.",
    details: [
      "Collect chapter titles, abstracts, biographies, and proposal summaries in one place.",
      "Move accepted contributors through first draft, revision, and final material stages.",
      "Give editors and facilitators a clear review board for decisions, notes, and follow-up messages.",
      "Keep authors focused with visible deadlines, submission history, and next actions."
    ],
    publicationTarget: "Designed for edited books, conference volumes, and collaborative publications.",
    chapterSpaces: "Configured by the editorial team",
    proposalDeadline: "2026-06-28",
    decisionDate: "2026-07-05",
    firstDraftDeadline: "2026-07-15",
    secondDraftDeadline: "2026-08-30",
    finalDeadline: "2026-10-01",
    status: "Open"
  }
];
