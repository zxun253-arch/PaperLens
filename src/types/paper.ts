export type PaperStatus =
  | "unparsed"
  | "parsing"
  | "parsed"
  | "parse_failed"
  | "noted";

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
