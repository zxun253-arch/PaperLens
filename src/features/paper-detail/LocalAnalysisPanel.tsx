import type {
  PaperAnalysisResult,
  PaperSearchResult,
} from "../../lib/analysis/types";
import { yesNo } from "./formatters";

interface LocalAnalysisPanelProps {
  analysis: PaperAnalysisResult | null;
  searchQuery: string;
  searchResults: PaperSearchResult[];
  onSearchQueryChange: (value: string) => void;
}

export function LocalAnalysisPanel({
  analysis,
  searchQuery,
  searchResults,
  onSearchQueryChange,
}: LocalAnalysisPanelProps) {
  return (
    <article className="rounded border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">本地分析</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        以下内容由本地规则和文本算法生成，不是 AI 总结，仅供辅助阅读。
      </p>

      {!analysis ? (
        <div className="mt-5 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          请先解析 PDF，生成论文分块后查看本地分析。
        </div>
      ) : (
        <div className="mt-5 grid gap-5">
          <div className="rounded border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-base font-semibold text-slate-950">
              论文基础统计
            </h3>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <Stat label="总字符数" value={analysis.stats.totalCharacters} />
              <Stat label="总分块数" value={analysis.stats.totalChunks} />
              <Stat
                label="识别章节数"
                value={analysis.stats.detectedSectionCount}
              />
              <Stat
                label="包含摘要"
                value={yesNo(analysis.stats.hasAbstract)}
              />
              <Stat
                label="包含引言"
                value={yesNo(analysis.stats.hasIntroduction)}
              />
              <Stat label="包含方法" value={yesNo(analysis.stats.hasMethods)} />
              <Stat label="包含结果" value={yesNo(analysis.stats.hasResults)} />
              <Stat
                label="包含结论"
                value={yesNo(analysis.stats.hasConclusion)}
              />
              <Stat
                label="包含参考文献"
                value={yesNo(analysis.stats.hasReferences)}
              />
            </dl>
            {analysis.stats.structureMayBeIncomplete ? (
              <p className="mt-4 text-xs text-amber-700">
                章节识别可能不完整。
              </p>
            ) : null}
          </div>

          <div className="rounded border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-base font-semibold text-slate-950">
              章节结构概览
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {analysis.sections.length === 0 ? (
                <span className="text-sm text-slate-500">
                  暂未识别到稳定章节。
                </span>
              ) : (
                analysis.sections.map((section) => (
                  <span
                    className="rounded border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700"
                    key={section.title}
                  >
                    {section.title}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="rounded border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-base font-semibold text-slate-950">
              本地关键词
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {analysis.keywords.length === 0 ? (
                <span className="text-sm text-slate-500">
                  未提取到有效关键词。
                </span>
              ) : (
                analysis.keywords.map((keyword) => (
                  <span
                    className="rounded border border-cyan-200 bg-cyan-50 px-3 py-1 text-sm text-cyan-800"
                    key={keyword.text}
                    title={`出现 ${keyword.count} 次`}
                  >
                    {keyword.text}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="rounded border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-base font-semibold text-slate-950">
              本地关键句
            </h3>
            <div className="mt-4 space-y-3">
              {analysis.keySentences.length === 0 ? (
                <p className="text-sm text-slate-500">暂未提取到稳定关键句。</p>
              ) : (
                analysis.keySentences.map((sentence) => (
                  <blockquote
                    className="rounded border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700"
                    key={`${sentence.chunkIndex}-${sentence.text}`}
                  >
                    <p>{sentence.text}</p>
                    <footer className="mt-2 text-xs text-slate-500">
                      chunk {sentence.chunkIndex + 1}
                      {sentence.sectionTitle
                        ? ` / ${sentence.sectionTitle}`
                        : ""}
                    </footer>
                  </blockquote>
                ))
              )}
            </div>
          </div>

          <div className="rounded border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-base font-semibold text-slate-950">
              论文内容搜索
            </h3>
            <input
              className="mt-3 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100"
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="输入关键词，在当前论文分块中搜索"
              value={searchQuery}
            />
            <div className="mt-4 space-y-3">
              {searchQuery.trim() && searchResults.length === 0 ? (
                <p className="text-sm text-slate-500">没有找到匹配内容。</p>
              ) : null}
              {searchResults.slice(0, 8).map((result) => (
                <a
                  className="block rounded border border-slate-200 bg-white p-3 text-sm transition hover:border-cyan-700"
                  href={`#chunk-${result.chunk.id}`}
                  key={result.chunk.id}
                >
                  <span className="font-semibold text-slate-900">
                    chunk {result.chunk.chunk_index + 1}
                    {result.chunk.section_title
                      ? ` / ${result.chunk.section_title}`
                      : ""}
                  </span>
                  <span className="ml-2 text-xs text-slate-500">
                    命中 {result.matchCount} 次
                  </span>
                  <p className="mt-2 whitespace-pre-wrap leading-6 text-slate-600">
                    {result.snippet}
                  </p>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-900">{value}</dd>
    </div>
  );
}
