export function paperMetadataPrompt(paperText: string, isTruncated: boolean) {
  return `你是一名严谨的中文科研阅读助手。请根据下面提供的论文内容，提取论文基础信息。

重要要求：
- 必须忠实原文，不允许编造。
- 如果原文没有明确说明，请写“原文未明确说明”。
- 使用中文回答。
- 结构化输出，适合科研学习和文献管理。
- 不要输出空泛套话。
- 回答时尽量引用依据所在的 chunk_index 和 section_title。
${isTruncated ? "- 注意：以下为论文节选内容，不是全文。请只基于已提供内容回答。" : ""}

请提取：
1. 标题
2. 作者
3. 年份
4. 期刊 / 会议
5. 摘要
6. 关键词
7. 研究领域
8. 论文类型
9. 研究对象
10. 研究方法
11. 主要结论

论文内容：
${paperText}`;
}
