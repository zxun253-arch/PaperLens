# 文献透镜 / PaperLens

**副标题：论文辅助工作台**

文献透镜是一款本地优先的 Windows 桌面端论文辅助工具。它用于帮助用户导入 PDF 论文、解析文本、生成论文分块、进行本地规则分析、生成 Prompt、保存阅读笔记，并导出 Markdown / Word 阅读记录。

不接入 API 时，App 仍可完成本地论文辅助流程。接入用户自定义大模型 API 后，App 可以在本地调用用户配置的服务商接口，完成论文信息提取、中文精读笔记生成、论文问答、多论文对比和文献综述辅助等增强功能。

## 核心功能

- PDF 导入、文本解析和论文分块
- SQLite 本地数据存储
- 本地分析：基础统计、章节结构、关键词、关键句、论文内容搜索
- Prompt 工作流和外部 AI 结果回填
- 阅读笔记管理：手动笔记、外部 AI 回填、AI 生成笔记
- Markdown / Word 导出
- 自定义大模型 API 与多 Provider 架构
- Provider 调用诊断日志
- AI 结果历史结构化保存
- 论文问答 evidence chunk 定位
- 打开原 PDF
- 文献标签、阅读状态、重点收藏、筛选和排序
- 全局检索论文信息、标签、chunks、笔记和问答
- 多论文对比和文献综述辅助工作流
- 综述草稿 Markdown / Word 导出
- OCR 能力预留与扫描版 PDF 提示优化
- 本地模型模式说明增强

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

## 功能流程图

```text
导入 PDF
  -> 解析 PDF 文本
  -> 保存 paper_chunks
  -> 本地分析 / 搜索 / Prompt
  -> 外部 AI 回填或用户自定义 API 调用
  -> 保存笔记、问答和 AI 结果历史
  -> Markdown / Word 导出

多论文工作流：
选择 2-5 篇论文
  -> 多论文对比
  -> 生成对比 Prompt / 综述 Prompt
  -> 可选调用用户自定义 API
  -> 保存综述草稿
  -> 导出 Markdown / Word
```

## 快速上手

1. 启动应用。
2. 在论文库点击“导入 PDF”。
3. 进入论文详情页，点击“解析 PDF”。
4. 查看分块内容、本地分析和关键词。
5. 在设置页选择本地基础模式、Prompt 辅助模式或自定义大模型 API 模式。
6. 生成 Prompt，复制到外部 AI，或在 custom_api 模式下直接调用模型。
7. 保存阅读笔记、AI 结果和论文问答。
8. 导出 Markdown 或 Word。
9. 在论文库添加标签、阅读状态、重点收藏，并使用全局搜索。
10. 选择多篇论文进入对比页面，生成文献综述辅助内容。

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

占位：

- Ollama / 本地模型

部分 Provider 仍需使用者根据实际 API Key、Base URL 和模型名称进行手动验证。文献透镜不提供默认服务器，也不内置免费大模型额度。

## 当前限制

- 不支持完整 OCR；v0.3 仅优化扫描版 PDF 提示并预留 OCR 模块。
- 不做账号系统。
- 不做云同步。
- 不提供默认服务器。
- 不内置免费大模型额度。
- API 调用需要用户自行配置 Key，并承担服务商额度和费用。
- API Key 当前保存于本地 SQLite，适合个人本地使用；请勿在公共电脑中保存密钥。
- 双栏论文解析效果依赖 PDF 文本层质量。
- 本地算法不能替代大模型理解能力。
- 多论文对比依赖论文元信息、chunks 和笔记质量。
- Provider 兼容性需要真实 API Key 和服务商环境进一步验证。
- PDF 原文查看当前优先使用系统默认阅读器打开，未实现复杂内嵌 PDF 预览。
- 问答证据定位基于 chunk，不等于精确 PDF 页码。
- Word 导出是基础格式，不是复杂论文模板。
- 本地模型真实效果取决于用户本机模型、显存、服务地址和模型能力。

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

Windows 安装包构建可能需要下载 WiX / NSIS 工具链。如果当前环境无法访问 GitHub release，可能只能生成 release exe，安装包需在网络可访问的环境下重新构建。

## v0.3.0 说明

v0.3.0 是研究工作流增强版，重点新增文献库管理、全局检索、多论文对比、文献综述辅助、OCR 预留、本地模型模式说明增强，以及导出内容增强。

## v0.4.0 产品化优化说明

v0.4.0 不新增大功能，重点优化产品可试用性：统一关键文案和错误提示，增强导出过程反馈，将 Word 导出的 `docx` 依赖改为动态加载以降低首屏体积，补充 `.gitignore` 隐私规则，并完善发布前检查文档。

v0.5 将进入最终测试、真实 Provider 验收、缺陷修复和产品导出阶段。

## v0.5.0 测试验收与产品导出说明

v0.5.0 是测试验收与产品导出版，不新增业务功能。该版本聚焦自动质量检查、敏感信息检查、真实 Provider 验收准备、便携版整理、安装包构建尝试和 GitHub Release 文案准备。
