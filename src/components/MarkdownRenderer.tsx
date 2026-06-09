import DOMPurify from "dompurify";
import { marked } from "marked";
import { useMemo } from "react";

type MarkdownRendererProps = {
  content: string;
  className?: string;
};

marked.setOptions({
  breaks: true,
  gfm: true,
});

export function MarkdownRenderer({
  content,
  className = "",
}: MarkdownRendererProps) {
  const html = useMemo(() => {
    const rawHtml = marked.parse(content || "", { async: false }) as string;
    return DOMPurify.sanitize(rawHtml);
  }, [content]);

  return (
    <div
      className={[
        "max-w-none text-sm leading-7 text-slate-700 dark:text-slate-200",
        "[&_a]:font-medium [&_a]:text-cyan-700 [&_a]:underline dark:[&_a]:text-cyan-300",
        "[&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:bg-slate-50 [&_blockquote]:px-4 [&_blockquote]:py-2 [&_blockquote]:text-slate-600 dark:[&_blockquote]:border-slate-600 dark:[&_blockquote]:bg-slate-900/60 dark:[&_blockquote]:text-slate-300",
        "[&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:text-slate-900 dark:[&_code]:bg-slate-900 dark:[&_code]:text-slate-100",
        "[&_h1]:mt-6 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-slate-950 dark:[&_h1]:text-slate-50",
        "[&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-slate-950 dark:[&_h2]:text-slate-50",
        "[&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-900 dark:[&_h3]:text-slate-100",
        "[&_h4]:mt-4 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:text-slate-900 dark:[&_h4]:text-slate-100",
        "[&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-slate-950 [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-slate-100 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6",
        "[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-2 dark:[&_td]:border-slate-700 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left dark:[&_th]:border-slate-700 dark:[&_th]:bg-slate-900",
        className,
      ].join(" ")}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
