export type PaperStatus =
  | "unparsed"
  | "parsing"
  | "parsed"
  | "parse_failed"
  | "noted";

export type PaperReadingStatus = "unread" | "reading" | "read" | "archived";

export interface Paper {
  id: string;
  title: string | null;
  authors: string | null;
  year: string | null;
  journal: string | null;
  file_name: string;
  file_path: string | null;
  file_size: number | null;
  abstract: string | null;
  keywords: string | null;
  paper_type: string | null;
  research_field: string | null;
  status: PaperStatus;
  reading_status: PaperReadingStatus;
  is_favorite: number;
  created_at: string;
  updated_at: string;
}

export interface CreatePaperInput {
  id?: string;
  title?: string | null;
  authors?: string | null;
  year?: string | null;
  journal?: string | null;
  file_name: string;
  file_path?: string | null;
  file_size?: number | null;
  abstract?: string | null;
  keywords?: string | null;
  paper_type?: string | null;
  research_field?: string | null;
  status?: PaperStatus;
  reading_status?: PaperReadingStatus;
  is_favorite?: number;
}

export interface PaperChunk {
  id: string;
  paper_id: string;
  chunk_index: number;
  section_title: string | null;
  content: string;
  created_at: string;
}

export interface PaperChunkInput {
  chunk_index: number;
  section_title: string | null;
  content: string;
}

export type PaperNoteType = "manual" | "ai_paste" | "ai_generated";

export interface PaperNote {
  id: string;
  paper_id: string;
  note_type: PaperNoteType;
  title: string;
  note_content: string;
  created_at: string;
  updated_at: string;
}

export interface PaperNoteInput {
  paper_id: string;
  note_type: PaperNoteType;
  title: string;
  note_content: string;
}

export interface PaperNoteUpdateInput {
  note_type?: PaperNoteType;
  title?: string;
  note_content?: string;
}

export interface PaperQa {
  id: string;
  paper_id: string;
  question: string;
  answer: string;
  evidence: string | null;
  created_at: string;
}

export interface PaperQaInput {
  paper_id: string;
  question: string;
  answer: string;
  evidence?: string | null;
}

export type LlmAction =
  | "test_connection"
  | "extract_metadata"
  | "generate_reading_note"
  | "paper_qa"
  | "literature_review";

export type LlmCallStatus = "success" | "failed";

export type LlmErrorType =
  | "missing_config"
  | "unsupported_provider"
  | "network_error"
  | "auth_error"
  | "endpoint_error"
  | "model_error"
  | "rate_limit"
  | "quota_error"
  | "response_format_error"
  | "timeout"
  | "unknown_error";

export interface LlmCallLog {
  id: string;
  provider: string;
  adapter: string;
  model: string | null;
  base_url: string | null;
  action: LlmAction;
  status: LlmCallStatus;
  error_type: LlmErrorType | null;
  message: string | null;
  created_at: string;
}

export interface LlmCallLogInput {
  provider: string;
  adapter: string;
  model?: string | null;
  base_url?: string | null;
  action: LlmAction;
  status: LlmCallStatus;
  error_type?: LlmErrorType | null;
  message?: string | null;
}

export type AiOutputAction =
  | "extract_metadata"
  | "generate_reading_note"
  | "paper_qa"
  | "literature_review";

export type AiOutputStatus = "success" | "failed";

export interface AiOutput {
  id: string;
  paper_id: string;
  action: AiOutputAction;
  provider: string;
  model: string | null;
  title: string;
  content: string;
  structured_json: string | null;
  source_chunk_ids: string | null;
  status: AiOutputStatus;
  created_at: string;
  updated_at: string;
}

export interface AiOutputInput {
  paper_id: string;
  action: AiOutputAction;
  provider: string;
  model?: string | null;
  title: string;
  content: string;
  structured_json?: string | null;
  source_chunk_ids?: string | null;
  status: AiOutputStatus;
}

export type AiOutputUpdateInput = Partial<
  Pick<
    AiOutput,
    "title" | "content" | "structured_json" | "source_chunk_ids" | "status"
  >
>;

export interface QaEvidenceItem {
  chunk_index: number;
  chunk_id?: string;
  section_title: string | null;
  snippet: string;
}

export interface PaperTag {
  id: string;
  paper_id: string;
  tag: string;
  created_at: string;
}

export interface PaperWithTags extends Paper {
  tags: string[];
  note_count?: number;
  chunk_count?: number;
}

export type GlobalSearchHitType =
  | "paper"
  | "abstract"
  | "chunk"
  | "note"
  | "qa"
  | "tag";

export interface GlobalSearchResult {
  id: string;
  paper_id: string;
  paper_title: string | null;
  file_name: string;
  hit_type: GlobalSearchHitType;
  label: string;
  snippet: string;
  chunk_id?: string | null;
  chunk_index?: number | null;
  created_at?: string | null;
}

export interface LiteratureReview {
  id: string;
  title: string;
  paper_ids: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface LiteratureReviewInput {
  title: string;
  paper_ids: string[];
  content: string;
}
