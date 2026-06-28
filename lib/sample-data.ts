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
  {
    id: 1,
    title: "Community Archives and Public Memory",
    author: "Dr Amara Lewis",
    email: "amara.lewis@example.com",
    stage: "First draft",
    status: "Submitted",
    deadline: "2026-07-15",
    submitted: "2026-06-17",
    abstract: "Examines how community-led archives reshape public memory and broaden participation in historical record-making.",
    biography: "Amara Lewis is a lecturer in cultural history whose work focuses on community archives and public humanities.",
    latestFile: "lewis-first-draft.pdf",
    editorNote: "Strong fit. Needs a clearer methods section before external review."
  },
  {
    id: 2,
    title: "Digital Tools for Participatory Research",
    author: "Prof Malik Stone",
    email: "malik.stone@example.com",
    stage: "Proposal",
    status: "Pending review",
    deadline: "2026-06-28",
    submitted: "2026-06-16",
    abstract: "Proposes a chapter on digital platforms that support co-designed research with community partners.",
    biography: "Malik Stone researches participatory methods, civic technology, and knowledge exchange.",
    latestFile: "proposal-outline.docx",
    editorNote: "Awaiting decision."
  },
  {
    id: 3,
    title: "Ethics, Consent, and Shared Authority",
    author: "Dr Priya Nair",
    email: "priya.nair@example.com",
    stage: "Second draft",
    status: "Revision requested",
    deadline: "2026-07-01",
    submitted: "2026-06-08",
    abstract: "Explores ethical responsibilities in edited collections that include practitioner and community voices.",
    biography: "Priya Nair is an ethics adviser and researcher working across education, heritage, and policy.",
    latestFile: "nair-revised-draft.pdf",
    editorNote: "Ask for a shorter introduction and fuller conclusion."
  },
  {
    id: 4,
    title: "Building the Final Manuscript as a Collective Text",
    author: "Dr Theo Bennett",
    email: "theo.bennett@example.com",
    stage: "Final materials",
    status: "Overdue",
    deadline: "2026-06-14",
    submitted: "2026-05-29",
    abstract: "Considers the editorial work of shaping individual chapters into a coherent shared manuscript.",
    biography: "Theo Bennett writes on collaborative publishing, editorial process, and academic project management.",
    latestFile: "bennett-final-draft.docx",
    editorNote: "Biography and final abstract still required."
  }
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
    title: "LYIS Leadership With Mission Integrity",
    subtitle: "Call for chapter proposals",
    summary:
      "LYIS members are invited to submit personal leadership chapter proposals that support the mission and values of LYIS and reflect next year's conference theme: leading with mission integrity.",
    details: [
      "Open to current LYIS members.",
      "Chapters should be personal leadership accounts written in the author's own voice.",
      "There are 12 chapter spaces available, with two reserve spaces.",
      "Authors must be able to meet the project deadlines and participate in promoting the publication.",
      "Selected chapters may also be considered for journal publication or presentation at the LYIS conference next March."
    ],
    publicationTarget: "In print February next year",
    chapterSpaces: "12 chapters + 2 reserve spaces",
    proposalDeadline: "2026-06-28",
    decisionDate: "2026-07-05",
    firstDraftDeadline: "2026-07-15",
    secondDraftDeadline: "2026-08-30",
    finalDeadline: "2026-10-01",
    status: "Open"
  }
];
