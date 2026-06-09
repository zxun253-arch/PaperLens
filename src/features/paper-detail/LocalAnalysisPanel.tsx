import type {
  PaperAnalysisResult,
  PaperSearchResult,
} from "../../lib/analysis/types";

interface LocalAnalysisPanelProps {
  analysis: PaperAnalysisResult | null;
  searchQuery: string;
  searchResults: PaperSearchResult[];
  isSemanticSearchEnabled: boolean;
  canUseSemanticSearch: boolean;
  isSearching: boolean;
  searchProgress: string | null;
  onSearchQueryChange: (value: string) => void;
  onSemanticSearchEnabledChange: (value: boolean) => void;
}

function yesNo(value: boolean) {
  return value ? "是" : "否";
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="font-medium text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-slate-900 dark:text-slate-100">{value}</dd>
    </div>
  );
}

export function LocalAnalysisPanel({
  analysis,
  searchQuery,
  searchResults,
  isSemanticSearchEnabled,
  canUseSemanticSearch,
  isSearching,
  searchProgress,
  onSearchQueryChange,
  onSemanticSearchEnabledChange,
}: LocalAnalysisPanelProps) {
  return (
    <article className="rounded border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">
        本地分析
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
        关键词、结构和句子提取基于本地文本规则；开启语义搜索后会调用已配置的 AI。
      </p>

      {!analysis ? (
        <div className="mt-5 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950 dark:text-amber-200">
          请先解析 PDF，生成论文分块后查看分析结果。
        </div>
      ) : (
        <div className="mt-5 grid gap-5">
          <div className="rounded border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900/60">
            <h3 className="text-base font-semibold text-slate-950 dark:text-slate-50">
              论文基础统计
            </h3>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <Stat label="总字符数" value={analysis.stats.totalCharacters} />
              <Stat label="总分块数" value={analysis.stats.totalChunks} />
              <Stat
                label="识别章节数"
                value={analysis.stats.detectedSectionCount}
              />
              <Stat label="包含摘要" value={yesNo(analysis.stats.hasAbstract)} />
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
          </div>

          <div className="rounded border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900/60">
            <h3 className="text-base font-semibold text-slate-950 dark:text-slate-50">
              论文内容搜索
            </h3>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-cyan-950"
                onChange={(event) => onSearchQueryChange(event.target.value)}
                placeholder="输入关键词，在当前论文分块中搜索"
                value={searchQuery}
              />
              <button
                className={[
                  "rounded border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                  isSemanticSearchEnabled
                    ? "border-cyan-700 bg-cyan-700 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:border-cyan-700 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200",
                ].join(" ")}
                disabled={!canUseSemanticSearch}
                onClick={() =>
                  onSemanticSearchEnabledChange(!isSemanticSearchEnabled)
                }
                type="button"
              >
                AI 语义搜索
              </button>
            </div>
            {searchProgress ? (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {isSearching ? "搜索中：" : ""}
                {searchProgress}
              </p>
            ) : null}
            <div className="mt-4 space-y-3">
              {searchQuery.trim() &&
              searchResults.length === 0 &&
              !isSearching ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  没有找到匹配内容。
                </p>
              ) : null}
              {searchResults.slice(0, 8).map((result) => (
                <a
                  className="block rounded border border-slate-200 bg-white p-3 text-sm transition hover:border-cyan-700 dark:border-slate-700 dark:bg-slate-800"
                  href={`#chunk-${result.chunk.id}`}
                  key={result.chunk.id}
                >
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    chunk {result.chunk.chunk_index + 1}
                    {result.chunk.section_title
                      ? ` / ${result.chunk.section_title}`
                      : ""}
                  </span>
                  <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                    命中 {result.matchCount} 次
                  </span>
                  <p className="mt-2 whitespace-pre-wrap leading-6 text-slate-600 dark:text-slate-300">
                    {result.snippet}
                  </p>
                </a>
              ))}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900/60">
              <h3 className="text-base font-semibold text-slate-950 dark:text-slate-50">
                本地关键词
              </h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {analysis.keywords.length === 0 ? (
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    未提取到有效关键词。
                  </span>
                ) : (
                  analysis.keywords.map((keyword) => (
                    <span
                      className="rounded border border-cyan-200 bg-cyan-50 px-3 py-1 text-sm text-cyan-800 dark:border-cyan-900/60 dark:bg-cyan-950 dark:text-cyan-200"
                      key={keyword.text}
                    >
                      {keyword.text}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="rounded border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900/60">
              <h3 className="text-base font-semibold text-slate-950 dark:text-slate-50">
                章节结构
              </h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {analysis.sections.length === 0 ? (
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    暂未识别到稳定章节。
                  </span>
                ) : (
                  analysis.sections.map((section) => (
                    <span
                      className="rounded border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      key={section.title}
                    >
                      {section.title}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
