import { createAiOutput } from "../db/aiOutputs";
import { createLlmCallLog } from "../db/llmCallLogs";
import { callLLM, classifyLlmError, sanitizeLlmMessage } from "./provider";
import { getProviderConfig } from "./settings";
import type { AiSettings, LLMCallResult } from "./types";
import type { AiOutputAction, PaperChunk } from "../../types/paper";

export type PaperAgentWorkflow =
  | "paper_agent_review"
  | "academic_rewrite"
  | "citation_check"
  | "source_verification"
  | "knowledge_card";

interface PaperAgentWorkflowConfig {
  id: PaperAgentWorkflow;
  label: string;
  title: string;
  description: string;
  maxTokens: number;
  buildPrompt: (context: string) => string;
}

interface PaperAgentContext {
  context: string;
  usedChunks: PaperChunk[];
  truncated: boolean;
}

const PAPER_AGENT_SYSTEM_PROMPT =
  "你是严谨的论文审查与科研写作 Agent。必须基于用户提供的论文分块工作，不编造数据、实验、参考文献、DOI 或结论；材料不足时要明确说明需要补充什么。默认使用中文输出，建议要具体、可执行，并按严重程度排序。";

export const paperAgentWorkflowOptions: PaperAgentWorkflowConfig[] = [
  {
    id: "paper_agent_review",
    label: "论文主审报告",
    title: "Paper Agent 论文主审报告",
    description: "综合检查结构、逻辑、方法、数据、图表、引用和可提交风险。",
    maxTokens: 5000,
    buildPrompt: (
      context,
    ) => `请按“主审负责制”审查以下论文内容，并输出《论文主审报告》。

审查要求：
1. 先判断论文类型、研究领域、研究方法和审查范围。
2. 按 S0/S1/S2/S3 标注问题严重程度。
3. 不要把零散意见堆叠成列表，要合并重复问题并按优先级排序。
4. 输出主审结论：通过 / 基本通过但建议修改 / 暂不通过需修改后再审。
5. 只基于给定论文内容判断；材料不足时说明缺口。

输出结构：
- 主审结论
- 论文类型与审查范围
- 核心问题汇总
- 专项审查结果：结构、逻辑、方法、数据、图表/公式、引用
- 必须修改项
- 建议修改项
- 可选优化项
- 下一步建议

论文内容：
${context}`,
  },
  {
    id: "academic_rewrite",
    label: "学术表达优化",
    title: "Paper Agent 学术表达优化",
    description: "在不改变原意、术语、数据和结论的前提下优化表达。",
    maxTokens: 4500,
    buildPrompt: (context) => `请对以下论文内容做学术表达审查和局部改写建议。

边界：
1. 不改变原意、研究对象、专业术语、数据、图表编号、引用编号和结论方向。
2. 不承诺降低重复率或 AIGC 检测率。
3. 不直接重写全文，只挑选最需要优化的段落或句子。

输出结构：
- 表达问题概览
- 重点优化片段
- 【优化后文本】
- 【修改说明】
- 【保留情况】
- 仍需作者核对的内容

论文内容：
${context}`,
  },
  {
    id: "citation_check",
    label: "引用与参考文献检查",
    title: "Paper Agent 引用检查报告",
    description: "检查哪些论断需要引用、引用支撑是否充分、参考文献格式风险。",
    maxTokens: 4500,
    buildPrompt: (context) => `请检查以下论文内容中的引用与参考文献风险。

要求：
1. 判断哪些句子或论断需要引用。
2. 判断现有引用是否足以支撑原文论断。
3. 不编造参考文献、DOI、作者、年份或期刊。
4. 无法核验来源时明确说明“需要用户提供来源或联网核验”。
5. 给出 citation_strength：strong / medium / weak / unusable。

输出结构：
- 引用风险总览
- 需要补充引用的句子
- 引用支撑不足的地方
- 参考文献格式或一致性问题
- 建议补充的来源类型
- 暂不能确定的内容

论文内容：
${context}`,
  },
  {
    id: "source_verification",
    label: "来源核验清单",
    title: "Paper Agent 来源核验清单",
    description: "整理待核验资料缺口和可执行检索式，不假装已经联网核验。",
    maxTokens: 4200,
    buildPrompt: (context) => `请基于以下论文内容整理“来源核验清单”。

重要边界：
1. 当前只基于给定文本工作，不要假装已经联网检索。
2. 不编造可用来源、DOI、链接或作者。
3. 识别需要外部来源支撑的背景、理论、数据、政策、行业事实和强结论。

输出结构：
- 资料缺口列表
- 每个缺口对应的推荐来源类型
- 推荐检索关键词
- 可使用的检索式草案
- source_status 初始标记：NEEDS_USER_FILE / NO_SOURCE_FOUND / FOUND_UNVERIFIED
- 用户需要补充的材料

论文内容：
${context}`,
  },
  {
    id: "knowledge_card",
    label: "知识卡片生成",
    title: "Paper Agent 知识卡片",
    description: "把论文内容整理为可沉淀的知识卡片，便于后续复习和综述写作。",
    maxTokens: 4200,
    buildPrompt: (context) => `请把以下论文内容整理成知识卡片。

要求：
1. 忠实原文，不编造实验、数据或结论。
2. 不大段复制原文。
3. 区分“原文明确内容”和“阅读归纳”。
4. 适合放入个人文献知识库。

输出结构：
- 卡片标题
- 研究方向
- 核心问题
- 方法与材料
- 关键结果
- 适合引用的观点
- 局限性
- 可用于文献综述的小节
- 需要回看原文的 chunk

论文内容：
${context}`,
  },
];

export function getPaperAgentWorkflowConfig(workflow: PaperAgentWorkflow) {
  return (
    paperAgentWorkflowOptions.find((option) => option.id === workflow) ??
    paperAgentWorkflowOptions[0]
  );
}

function isCoreSection(chunk: PaperChunk) {
  const title = `${chunk.section_title ?? ""}`.toLowerCase();
  return /abstract|摘要|introduction|引言|method|方法|experiment|实验|result|结果|discussion|讨论|conclusion|结论|reference|参考文献/.test(
    title,
  );
}

function buildPaperAgentContext(
  chunks: PaperChunk[],
  maxCharacters = 18000,
): PaperAgentContext {
  const ordered = [...chunks].sort((a, b) => a.chunk_index - b.chunk_index);
  const prioritized = [
    ...ordered.filter(isCoreSection),
    ...ordered.filter((chunk) => !isCoreSection(chunk)),
  ];
  const used: PaperChunk[] = [];
  let context = "";

  for (const chunk of prioritized) {
    const block = `\n\n[chunk_index=${chunk.chunk_index}; chunk_id=${chunk.id}; section=${chunk.section_title ?? "未识别章节"}]\n${chunk.content.trim()}`;
    if (context.length + block.length > maxCharacters) break;
    context += block;
    used.push(chunk);
  }

  const usedIds = new Set(used.map((chunk) => chunk.id));
  used.sort((a, b) => a.chunk_index - b.chunk_index);

  return {
    context:
      used.length < chunks.length
        ? `以下为论文节选内容，不是全文；请仅基于可见内容判断。\n${context}`
        : context,
    usedChunks: used,
    truncated: usedIds.size < chunks.length,
  };
}

function chunkIds(chunks: PaperChunk[]) {
  return JSON.stringify(chunks.map((chunk) => chunk.id));
}

async function logPaperAgentCall(
  settings: AiSettings,
  action: PaperAgentWorkflow,
  status: "success" | "failed",
  message: string,
  error?: unknown,
) {
  const config = getProviderConfig(settings.provider);
  await createLlmCallLog({
    provider: settings.provider,
    adapter: config.adapter,
    model: settings.model,
    base_url: settings.baseUrl,
    action,
    status,
    error_type: error ? classifyLlmError(error) : null,
    message: sanitizeLlmMessage(message, settings.apiKey),
  });
}

export async function runPaperAgentWorkflow(
  paperId: string,
  chunks: PaperChunk[],
  settings: AiSettings,
  workflow: PaperAgentWorkflow,
): Promise<LLMCallResult> {
  if (chunks.length === 0) {
    throw new Error("请先解析 PDF，生成论文分块后再运行 Paper Agent 工作流。");
  }

  const config = getPaperAgentWorkflowConfig(workflow);
  const paperContext = buildPaperAgentContext(chunks);
  const prompt = config.buildPrompt(paperContext.context);

  try {
    const llm = await callLLM(
      {
        messages: [
          { role: "system", content: PAPER_AGENT_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        maxTokens: config.maxTokens,
      },
      settings,
    );

    await createAiOutput({
      paper_id: paperId,
      action: workflow as AiOutputAction,
      provider: llm.provider,
      model: llm.model,
      title: config.title,
      content: llm.content,
      structured_json: JSON.stringify({
        workflow,
        truncated: paperContext.truncated,
        usedChunkCount: paperContext.usedChunks.length,
        totalChunkCount: chunks.length,
      }),
      source_chunk_ids: chunkIds(paperContext.usedChunks),
      status: "success",
    });

    await logPaperAgentCall(
      settings,
      workflow,
      "success",
      `${config.label}完成。`,
    );
    return llm;
  } catch (error) {
    await logPaperAgentCall(
      settings,
      workflow,
      "failed",
      error instanceof Error ? error.message : `${config.label}失败。`,
      error,
    );
    throw error;
  }
}
