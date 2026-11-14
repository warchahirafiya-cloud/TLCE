/** Provider-neutral voice productivity contracts. No audio capture, transcription, AI calls or task execution occur here. */
export type ProductivityIntent = "capture-idea" | "create-project" | "software-task" | "marketing-task" | "operations-task";
export type TaskKind = "research" | "design" | "development" | "testing" | "content" | "campaign" | "operations";
export interface VoiceCapture { transcript: string; language?: string; capturedAt: string; source: "voice-transcription" | "manual"; }
export interface TaskDraft { id: string; title: string; kind: TaskKind; status: "draft"; requiresApproval: true; }
export interface ProjectDraft { id: string; title: string; summary: string; sourceTranscript: string; tasks: TaskDraft[]; status: "draft"; requiresApproval: true; }
export interface ProductivityDraft { intent: ProductivityIntent; normalizedIdea: string; project: ProjectDraft | null; tasks: TaskDraft[]; requiresApproval: true; executionEnabled: false; }
const cleanText = (value: string): string => value.trim().replace(/\\s+/g, " ");
/** Creates suggestions only; the caller supplies a transcript, classified intent and stable IDs. */
export function createProductivityDraft(capture: VoiceCapture, intent: ProductivityIntent, ids: { projectId: string; taskIds: string[] }): ProductivityDraft {
  const transcript = cleanText(capture.transcript);
  if (!transcript) throw new Error("A non-empty transcript is required");
  const kinds: TaskKind[] = intent === "software-task" ? ["research", "development", "testing"]
    : intent === "marketing-task" ? ["research", "content", "campaign"]
    : intent === "operations-task" ? ["research", "operations"]
    : intent === "create-project" ? ["research", "design", "development", "testing"] : [];
  if (ids.taskIds.length < kinds.length) throw new Error("A unique task ID is required for every suggested task");
  const labels: Record<TaskKind, string> = {
    research: "Clarify requirements and success criteria", design: "Prepare the solution and user-flow design",
    development: "Implement the approved solution", testing: "Validate quality, security and acceptance criteria",
    content: "Draft and review the marketing content", campaign: "Plan the campaign, audience and measurement",
    operations: "Define the operational steps and owner",
  };
  const tasks = kinds.map((kind, i): TaskDraft => ({ id: ids.taskIds[i], title: labels[kind], kind, status: "draft", requiresApproval: true }));
  const project = intent === "create-project" ? {
    id: ids.projectId, title: transcript.length > 80 ? transcript.slice(0, 77) + "..." : transcript,
    summary: transcript, sourceTranscript: capture.transcript, tasks, status: "draft" as const, requiresApproval: true as const,
  } : null;
  return { intent, normalizedIdea: transcript, project, tasks: project ? [] : tasks, requiresApproval: true, executionEnabled: false };
}
