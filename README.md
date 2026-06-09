# 文献透镜 / PaperLens

**副标题：论文辅助工作台**

文献透镜是一款 Windows 桌面端论文辅助工具。当前版本已经调整为 **用户自定义大模型 API 模式**：用户在本机配置自己的 Provider、Base URL、API Key 和模型名称后，App 使用该配置完成论文信息提取、中文精读笔记、论文问答、Paper Agent 审查工作流、多论文对比和文献综述辅助。

项目不提供默认服务器，不内置免费模型额度，不写死任何 API Key。论文、分块、笔记、AI 结果历史、诊断日志和导出文件默认保存在本地。

## 核心功能

- PDF 导入、文本解析和论文分块
- SQLite 本地数据存储
- 论文库管理：标签、阅读状态、收藏、筛选、排序
- 本地分析：基础统计、章节结构、关键词、关键句、内容搜索
- 自定义大模型 API 与多 Provider 架构
- Provider 调用诊断日志
- App 内 AI 功能：论文信息提取、中文精读笔记、论文问答
- Paper Agent 工作流：论文主审、学术表达优化、引用检查、来源核验清单、知识卡片
- AI 结果历史结构化保存
- 论文问答 evidence chunk 定位
- 多论文对比和文献综述辅助
- 阅读笔记管理：手动笔记、外部 AI 回填、API 生成笔记
- Markdown / Word 导出
- 打开原 PDF
- OCR 预留与扫描版 PDF 提示优化

## 技术栈

- Tauri
- React
- TypeScript
- Vite
- Tailwind CSS
- SQLite
- Rust
- pdf-extract
- docx

## 使用流程

```text
导入 PDF
  -> 解析 PDF 文本
  -> 保存 paper_chunks
  -> 配置用户自己的大模型 API
  -> 提取论文信息 / 生成精读笔记 / 论文问答 / Paper Agent 审查
  -> 保存笔记、问答和 AI 结果历史
  -> Markdown / Word 导出

多论文工作流：
选择 2-5 篇论文
  -> 多论文对比
  -> 调用用户自定义 API 生成对比或综述辅助内容
  -> 保存综述草稿
  -> 导出 Markdown / Word
```

## Provider 支持状态

基础实现：

- OpenAI-compatible
- Anthropic / Claude
- Gemini / Google AI

复用 OpenAI-compatible：

- OpenAI
- DeepSeek
- Qwen / 通义千问
- OpenRouter
- Moonshot / Kimi
- 智谱 GLM

说明：

- 具体 Base URL、Model Name、计费方式和可用性请以服务商控制台为准。
- LM Studio 等本地兼容服务如果提供 OpenAI-compatible 接口，也可以按通用接口配置。

## Paper Agent 融合能力

本项目已将 `paper agent` 项目的核心论文审查思想融合为 API 工作流：

- 论文主审报告：综合检查结构、逻辑、方法、数据、图表、引用和提交风险。
- 学术表达优化：在不改变原意、术语、数据和结论的前提下优化表达。
- 引用检查：识别需要引用、引用支撑不足和参考文献风险。
- 来源核验清单：整理待核验资料缺口和检索建议，不假装已经联网核验。
- 知识卡片：把论文内容整理为适合沉淀到文献知识库的卡片。

所有 Paper Agent 工作流都必须通过用户配置的 API 调用，不会上传到默认服务器。

## 当前限制

- 必须配置用户自己的 API Provider；当前不提供离线分析模式、Prompt-only 模式或独立本地模型 adapter。
- 不支持完整 OCR；扫描版 PDF 会提示使用带文本层的 PDF 或外部 OCR 后重新导入。
- 不做账号系统。
- 不做云同步。
- 不提供默认服务器。
- 不内置免费大模型额度。
- API 调用费用由用户自己的服务商账户承担。
- API Key 当前保存于本地 SQLite，适合个人本地使用；请勿在公共电脑中保存密钥。
- Provider 兼容性需要真实 API Key、Base URL 和模型环境验证。
- Word 导出是基础格式，不是复杂论文模板。

## 本地运行

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format
npm.cmd run build
```

```powershell
$env:Path = 'C:\Users\49958\.cargo\bin;' + $env:Path
cargo check
```

```powershell
$env:Path = 'C:\Users\49958\.cargo\bin;' + $env:Path
npm.cmd run tauri dev
```

## 打包

```powershell
$env:Path = 'C:\Users\49958\.cargo\bin;' + $env:Path
npm.cmd run tauri build
```

Windows 安装包构建可能需要下载 WiX / NSIS 工具链。如果当前环境无法访问 GitHub release，可能只能生成 release exe，安装包需要在网络可访问的环境下重新构建。
