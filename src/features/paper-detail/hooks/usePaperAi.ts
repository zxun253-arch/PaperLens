import { useState, type Dispatch, type SetStateAction } from "react";
import { createPaperNote } from "../../../lib/db/paperNotes";
import {
  answerQuestionWithAI,
  extractPaperMetadataWithAI,
  generateReadingNoteWithAI,
  runPaperAgentWorkflow,
  type AiSettings,
  type PaperAgentWorkflow,
} from "../../../lib/llm";
import type { AiOutput, Paper, PaperChunk, PaperQa } from "../../../types/paper";

type UsePaperAiArgs = {
  paperId: string | undefined;
  paper: Paper | null;
  chunks: PaperChunk[];
  qaHistory: PaperQa[];
  aiSettings: AiSettings | null;
  loadPageData: (id: string) => Promise<void>;
  setMessage: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setIsSavingNote: Dispatch<SetStateAction<boolean>>;
};

export function usePaperAi({
  paper,
  chunks,
  qaHistory,
  aiSettings,
  loadPageData,
  setMessage,
  setError,
  setIsSavingNote,
}: UsePaperAiArgs) {
  const [isCallingAi, setIsCallingAi] = useState(false);
  const [aiQuestion, setAiQuestion] = useState("这篇论文的主要创新点是什么？");
  const [qaQuestion, setQaQuestion] = useState("");
  const [aiGeneratedTitle, setAiGeneratedTitle] = useState("AI 生成精读笔记");
  const [aiGeneratedContent, setAiGeneratedContent] = useState("");
  const [paperAgentWorkflow, setPaperAgentWorkflow] =
    useState<PaperAgentWorkflow>("paper_agent_review");
  const [metadataRaw, setMetadataRaw] = useState("");

  const ensureAiReady = () => {
    if (!aiSettings) {
      throw new Error("请先在设置页配置并保存 AI Provider。");
    }
    if (chunks.length === 0) {
      throw new Error("请先解析 PDF 后再使用 AI 论文功能。");
    }
    return aiSettings;
  };

  const handleExtractMetadata = async () => {
    if (!paper) return;
    setIsCallingAi(true);
    setError(null);
    setMessage(null);
    try {
      const settings = ensureAiReady();
      const result = await extractPaperMetadataWithAI(paper, chunks, settings);
      setMetadataRaw(result.rawContent);
      await loadPageData(paper.id);
      setMessage(
        result.metadata
          ? "论文信息已提取并保存。"
          : "模型返回结果无法解析为结构化元数据。",
      );
    } catch (aiError) {
      setError(
        aiError instanceof Error ? aiError.message : "提取论文信息失败。",
      );
    } finally {
      setIsCallingAi(false);
    }
  };

  const handleGenerateReadingNote = async () => {
    if (!paper) return;
    setIsCallingAi(true);
    setError(null);
    setMessage(null);
    try {
      const settings = ensureAiReady();
      const result = await generateReadingNoteWithAI(paper.id, chunks, settings);
      setAiGeneratedTitle("AI 生成精读笔记");
      setAiGeneratedContent(result.content);
      await loadPageData(paper.id);
      setMessage("精读笔记已生成。建议先核对再保存为正式笔记。");
    } catch (aiError) {
      setError(
        aiError instanceof Error ? aiError.message : "生成精读笔记失败。",
      );
    } finally {
      setIsCallingAi(false);
    }
  };

  const handleSaveAiGeneratedNote = async () => {
    if (!paper || !aiGeneratedContent.trim()) return;
    setIsSavingNote(true);
    setError(null);
    setMessage(null);
    try {
      await createPaperNote({
        paper_id: paper.id,
        title: aiGeneratedTitle,
        note_type: "ai_generated",
        note_content: aiGeneratedContent,
      });
      await loadPageData(paper.id);
      setMessage("AI 结果已保存为阅读笔记。");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "保存 AI 笔记失败。",
      );
    } finally {
      setIsSavingNote(false);
    }
  };

  const askQuestion = async (question: string, history: PaperQa[]) => {
    if (!paper || !question.trim()) return;
    setIsCallingAi(true);
    setError(null);
    setMessage(null);
    try {
      const settings = ensureAiReady();
      const result = await answerQuestionWithAI(
        paper.id,
        chunks,
        question,
        settings,
        history,
      );
      await loadPageData(paper.id);
      setAiGeneratedTitle("AI 论文问答");
      setAiGeneratedContent(result.llm.content);
      setMessage("问答已完成并保存。");
      setQaQuestion("");
    } catch (aiError) {
      setError(aiError instanceof Error ? aiError.message : "论文问答失败。");
    } finally {
      setIsCallingAi(false);
    }
  };

  const handleAskWithAi = async () => {
    await askQuestion(aiQuestion, []);
  };

  const handleAskFollowUp = async (historyUntil?: PaperQa[]) => {
    const history = historyUntil ?? [...qaHistory].reverse();
    await askQuestion(qaQuestion, history);
  };

  const handleRunPaperAgentWorkflow = async () => {
    if (!paper) return;
    setIsCallingAi(true);
    setError(null);
    setMessage(null);
    try {
      const settings = ensureAiReady();
      const result = await runPaperAgentWorkflow(
        paper.id,
        chunks,
        settings,
        paperAgentWorkflow,
      );
      await loadPageData(paper.id);
      setAiGeneratedTitle("Paper Agent 工作流结果");
      setAiGeneratedContent(result.content);
      setMessage("Paper Agent 工作流已完成并保存。");
    } catch (aiError) {
      setError(
        aiError instanceof Error
          ? aiError.message
          : "Paper Agent 工作流执行失败。",
      );
    } finally {
      setIsCallingAi(false);
    }
  };

  const saveAiOutputAsNote = async (output: AiOutput) => {
    if (!paper) return;
    setIsSavingNote(true);
    setError(null);
    setMessage(null);
    try {
      await createPaperNote({
        paper_id: paper.id,
        title: output.title || "AI 生成结果",
        note_type: "ai_generated",
        note_content: output.content,
      });
      await loadPageData(paper.id);
      setMessage("AI 结果已保存为阅读笔记。");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "保存 AI 结果失败。",
      );
    } finally {
      setIsSavingNote(false);
    }
  };

  return {
    isCallingAi,
    aiQuestion,
    qaQuestion,
    aiGeneratedTitle,
    aiGeneratedContent,
    paperAgentWorkflow,
    metadataRaw,
    setAiQuestion,
    setQaQuestion,
    setAiGeneratedContent,
    setPaperAgentWorkflow,
    handleExtractMetadata,
    handleGenerateReadingNote,
    handleSaveAiGeneratedNote,
    handleAskWithAi,
    handleAskFollowUp,
    handleRunPaperAgentWorkflow,
    saveAiOutputAsNote,
  };
}
