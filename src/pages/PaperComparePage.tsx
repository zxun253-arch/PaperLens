import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { createAiOutput } from "../lib/db/aiOutputs";
import {
  createLiteratureReview,
  listLiteratureReviews,
} from "../lib/db/literatureReviews";
import {
  exportLiteratureReviewMarkdown,
  exportLiteratureReviewWord,
} from "../lib/export/literatureReview";
import { callLLM, getCurrentAiSettings } from "../lib/llm";
import type { AiSettings } from "../lib/llm";
import {
  buildComparePrompt,
  buildLiteratureReviewWorkflowPrompt,
  loadPaperCompareItems,
  type PaperCompareItem,
} from "../lib/research/compare";
import type { LiteratureReview } from "../types/paper";

function titleOf(item: PaperCompareItem) {
  return item.paper.title || item.paper.file_name;
}

function parsePaperIds(raw: string | null) {
  return (raw ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 5);
}

export function PaperComparePage() {
  const [searchParams] = useSearchParams();
  const paperIds = useMemo(
    () => parsePaperIds(searchParams.get("paperIds")),
    [searchParams],
  );
  const [items, setItems] = useState<PaperCompareItem[]>([]);
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [savedReviews, setSavedReviews] = useState<LiteratureReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCallingAi, setIsCallingAi] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [reviewPrompt, setReviewPrompt] = useState("");
  const [resultTitle, setResultTitle] = useState("多论文对比结果");
  const [resultContent, setResultContent] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    Promise.all([
      loadPaperCompareItems(paperIds),
      getCurrentAiSettings(),
      listLiteratureReviews(),
    ])
      .then(([paperItems, aiSettings, reviews]) => {
        setItems(paperItems);
        setSettings(aiSettings);
        setSavedReviews(reviews);
        setPrompt(buildComparePrompt(paperItems));
        setReviewPrompt(buildLiteratureReviewWorkflowPrompt(paperItems));
      })
      .catch((loadError) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : "读取对比论文失败。请返回论文库重新选择论文。",
        ),
      )
      .finally(() => setIsLoading(false));
  }, [paperIds]);

  const canCallApi = settings?.mode === "custom_api";

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(`${label} 已复制到剪贴板。`);
      setError(null);
    } catch {
      setError("复制失败。请手动选中文本后复制。");
    }
  };

  const callApiFor = async (kind: "compare" | "review") => {
    if (!settings || settings.mode !== "custom_api") {
      setError(
        "请先在设置页切换到自定义大模型 API 模式，并完成 Provider 配置。",
      );
      return;
    }
    if (items.length < 2) {
      setError("请至少选择 2 篇论文。");
      return;
    }

    const content = kind === "compare" ? prompt : reviewPrompt;
    setIsCallingAi(true);
    setError(null);
    setMessage(null);
    try {
      const result = await callLLM(
        {
          messages: [
            {
              role: "system",
              content:
                "你是严谨的中文科研阅读助手。回答必须基于用户提供的论文内容，不要编造。",
            },
            { role: "user", content },
          ],
          temperature: 0.2,
          maxTokens: 4096,
        },
        settings,
      );
      const title =
        kind === "compare" ? "AI 多论文对比结果" : "AI 文献综述草稿";
      setResultTitle(title);
      setResultContent(result.content);
      await createAiOutput({
        paper_id: items[0].paper.id,
        action: "literature_review",
        provider: result.provider,
        model: result.model,
        title,
        content: result.content,
        source_chunk_ids: JSON.stringify(items.map((item) => item.paper.id)),
        status: "success",
      });
      setMessage("AI 结果已生成，并保存到首篇论文的 AI 结果历史。");
    } catch (callError) {
      setError(
        callError instanceof Error
          ? callError.message
          : "调用模型失败。请检查 API Key、Base URL 和 Model Name。",
      );
    } finally {
      setIsCallingAi(false);
    }
  };

  const saveReview = async () => {
    if (!resultContent.trim()) {
      setError("请先生成或粘贴综述草稿内容。");
      return;
    }
    try {
      await createLiteratureReview({
        title: resultTitle,
        paper_ids: items.map((item) => item.paper.id),
        content: resultContent,
      });
      setSavedReviews(await listLiteratureReviews());
      setMessage("文献综述草稿已保存到本地。");
      setError(null);
    } catch {
      setError("保存综述草稿失败。请稍后重试，或检查数据库是否可写。");
    }
  };

  const exportMarkdown = async () => {
    setIsExporting(true);
    try {
      const result = await exportLiteratureReviewMarkdown(
        resultTitle,
        resultContent || reviewPrompt,
      );
      setMessage(
        result.status === "cancelled"
          ? "已取消导出。"
          : `综述 Markdown 已导出：${result.filePath}`,
      );
      setError(null);
    } catch {
      setError(
        "导出综述 Markdown 失败。请检查保存路径是否可写，或文件是否被占用。",
      );
    } finally {
      setIsExporting(false);
    }
  };

  const exportWord = async () => {
    setIsExporting(true);
    try {
      const result = await exportLiteratureReviewWord(
        resultTitle,
        resultContent || reviewPrompt,
      );
      setMessage(
        result.status === "cancelled"
          ? "已取消导出。"
          : `综述 Word 已导出：${result.filePath}`,
      );
      setError(null);
    } catch {
      setError(
        "导出综述 Word 失败。请检查保存路径是否可写，或文件是否被占用。",
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section>
      <PageHeader
        title="多论文对比"
        description="对 2-5 篇论文进行基础对比，生成 Prompt，或在自定义 API 模式下生成综述草稿。"
      />

      {message ? (
        <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded border border-slate-200 bg-white p-8 text-sm text-slate-500">
          正在加载对比数据...
        </div>
      ) : items.length < 2 ? (
        <div className="rounded border border-dashed border-slate-300 bg-white p-10 text-center">
          <h3 className="text-lg font-semibold text-slate-900">论文数量不足</h3>
          <p className="mt-3 text-sm text-slate-500">
            请回到论文库选择 2-5 篇论文后再进行对比。
          </p>
          <Link
            className="mt-4 inline-block text-sm font-semibold text-cyan-800"
            to="/library"
          >
            返回论文库
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded border border-cyan-200 bg-cyan-50 p-4 text-sm leading-6 text-cyan-900">
            <strong>工作流说明：</strong>
            基础对比不需要 API；Prompt 可以复制到外部 AI；
            只有切换到自定义大模型 API 模式后，才会在 App
            内调用用户自己的模型服务。
          </div>

          <div className="overflow-x-auto rounded border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3">论文</th>
                  <th className="px-4 py-3">作者</th>
                  <th className="px-4 py-3">年份</th>
                  <th className="px-4 py-3">研究领域</th>
                  <th className="px-4 py-3">关键词</th>
                  <th className="px-4 py-3">标签</th>
                  <th className="px-4 py-3">笔记摘要</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    className="border-t border-slate-200 align-top"
                    key={item.paper.id}
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      <Link
                        className="hover:text-cyan-800"
                        to={`/papers/${item.paper.id}`}
                      >
                        {titleOf(item)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.paper.authors || "原文未明确说明"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.paper.year || "原文未明确说明"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.paper.research_field || "原文未明确说明"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.keywords.join("、") ||
                        item.paper.keywords ||
                        "未提取"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.tags.join("、") || "未添加"}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-slate-600">
                      {item.noteSummary || "暂无笔记"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded border border-slate-200 bg-white p-5">
              <h3 className="text-base font-semibold text-slate-950">
                多论文对比 Prompt
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                无 API 时可复制到外部 AI；custom_api 模式下可在 App 内生成。
              </p>
              <textarea
                className="mt-4 h-80 w-full resize-y rounded border border-slate-300 bg-slate-50 p-3 text-xs leading-6 text-slate-700"
                readOnly
                value={prompt}
              />
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  onClick={() => void copyText(prompt, "对比 Prompt")}
                  type="button"
                >
                  复制对比 Prompt
                </button>
                <button
                  className="rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-cyan-400"
                  disabled={!canCallApi || isCallingAi}
                  onClick={() => void callApiFor("compare")}
                  type="button"
                >
                  {isCallingAi ? "生成中..." : "使用 API 生成对比"}
                </button>
              </div>
            </div>

            <div className="rounded border border-slate-200 bg-white p-5">
              <h3 className="text-base font-semibold text-slate-950">
                文献综述辅助
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                可生成综述 Prompt、保存草稿，并导出 Markdown / Word。AI
                内容请结合原文核对。
              </p>
              <textarea
                className="mt-4 h-56 w-full resize-y rounded border border-slate-300 bg-slate-50 p-3 text-xs leading-6 text-slate-700"
                readOnly
                value={reviewPrompt}
              />
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  onClick={() => void copyText(reviewPrompt, "综述 Prompt")}
                  type="button"
                >
                  复制综述 Prompt
                </button>
                <button
                  className="rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-cyan-400"
                  disabled={!canCallApi || isCallingAi}
                  onClick={() => void callApiFor("review")}
                  type="button"
                >
                  {isCallingAi ? "生成中..." : "使用 API 生成综述"}
                </button>
              </div>

              <label className="mt-5 block">
                <span className="text-sm font-medium text-slate-700">
                  草稿标题
                </span>
                <input
                  className="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  value={resultTitle}
                  onChange={(event) => setResultTitle(event.target.value)}
                />
              </label>
              <label className="mt-3 block">
                <span className="text-sm font-medium text-slate-700">
                  综述草稿 / 对比结果
                </span>
                <textarea
                  className="mt-2 h-72 w-full resize-y rounded border border-slate-300 p-3 text-sm leading-6"
                  value={resultContent}
                  onChange={(event) => setResultContent(event.target.value)}
                  placeholder="可粘贴外部 AI 结果，或使用自定义 API 生成。"
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  className="rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white"
                  onClick={() => void saveReview()}
                  type="button"
                >
                  保存综述草稿
                </button>
                <button
                  className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                  disabled={isExporting}
                  onClick={() => void exportMarkdown()}
                  type="button"
                >
                  {isExporting ? "导出中..." : "导出综述 Markdown"}
                </button>
                <button
                  className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                  disabled={isExporting}
                  onClick={() => void exportWord()}
                  type="button"
                >
                  {isExporting ? "导出中..." : "导出综述 Word"}
                </button>
              </div>

              <div className="mt-5 rounded border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-sm font-semibold text-slate-900">
                  已保存综述草稿
                </h4>
                {savedReviews.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">
                    暂无本地综述草稿。
                  </p>
                ) : (
                  <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                    {savedReviews.slice(0, 8).map((review) => (
                      <button
                        key={review.id}
                        className="block w-full rounded border border-slate-200 bg-white p-3 text-left text-sm hover:border-cyan-700"
                        type="button"
                        onClick={() => {
                          setResultTitle(review.title);
                          setResultContent(review.content);
                        }}
                      >
                        <span className="font-semibold text-slate-900">
                          {review.title}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          更新时间：
                          {new Date(review.updated_at).toLocaleString("zh-CN")}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
