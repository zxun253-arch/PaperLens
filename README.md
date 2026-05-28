# 文献透镜 / PaperLens

**副标题：论文辅助工作台**

文献透镜是一款本地优先的 Windows 桌面端论文辅助工作台，用于帮助用户导入 PDF 论文、解析文本、生成论文分块、进行本地规则分析、生成 Prompt、保存阅读笔记，并导出 Markdown 阅读记录。

不接入 API 时，App 仍可完成本地论文辅助流程。接入用户自定义大模型 API 后，App 可以在本地调用用户配置的服务商接口，完成论文信息提取、中文精读笔记生成和论文问答等增强功能。

## 核心功能

- 本地 PDF 导入与文件信息保存
- PDF 文本解析与论文分块
- SQLite 本地数据存储
- 本地分析：论文基础统计、章节结构概览、关键词提取、关键句提取
- 论文内容搜索
- Prompt 工作流与一键复制
- 外部 AI 结果回填
- 阅读笔记管理：手动笔记、外部 AI 回填、AI 生成笔记
- Markdown 导出，包含论文信息、本地分析、分块内容和阅读笔记
- 用户自定义大模型 API 配置
- 多 Provider 架构

## 技术栈

- Tauri
- React
- TypeScript
- Vite
- Tailwind CSS
- SQLite
- Rust
- pdf-extract

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

- 不支持扫描版 PDF OCR，仅支持带文本层的 PDF。
- 不做云同步。
- 不做账号系统。
- 不提供默认服务器。
- 不内置免费大模型额度。
- API 调用需要用户自行配置 API Key、Base URL 和模型名称。
- API Key 当前保存于本地 SQLite，适合个人本地使用；公共电脑或分发场景需要更安全的密钥方案。
- 双栏论文、复杂排版论文的解析效果依赖 PDF 文本层质量。
- 本地算法不能替代大模型理解能力，只提供规则和文本统计层面的辅助。
- Provider 兼容性需要真实 API Key 和服务商环境进一步验证。

## 本地运行

安装依赖：

```powershell
npm.cmd install
```

前端构建检查：

```powershell
npm.cmd run build
```

Rust 检查：

```powershell
$env:Path = 'C:\Users\49958\.cargo\bin;' + $env:Path
cargo check
```

启动桌面端开发环境：

```powershell
$env:Path = 'C:\Users\49958\.cargo\bin;' + $env:Path
npm.cmd run tauri dev
```

## 打包

当前项目通过 Tauri CLI 打包，命令为：

```powershell
$env:Path = 'C:\Users\49958\.cargo\bin;' + $env:Path
npm.cmd run tauri build
```

打包产物通常位于：

```text
src-tauri/target/release/bundle/
```

实际输出格式取决于本机 Tauri 打包依赖和 Windows 打包工具链。

## v0.1.0 便携版说明

当前 v0.1.0 已生成 release 可执行文件：

```text
src-tauri/target/release/paper-lens.exe
```

已整理便携版预览目录：

```text
release/PaperLens-v0.1.0-portable/
```

可双击 `paper-lens.exe` 启动。用户数据默认保存在系统 AppData 对应的应用数据目录中。

MSI / NSIS 安装包当前尚未生成。原因是 Tauri 在 Windows 安装包阶段需要下载 WiX 或 NSIS 工具链，而当前环境访问 GitHub release 受网络 / 权限限制。这不是代码构建失败；前端构建、Rust 检查和 release exe 构建均已通过。

如需生成正式安装包，请在网络可访问 GitHub release 的环境下重新执行：

```powershell
$env:Path = 'C:\Users\49958\.cargo\bin;' + $env:Path
npm.cmd run tauri build
```

## 安全提醒

- 不要把真实 API Key 写入代码或文档。
- 导出的 Markdown 不包含 API Key 或 API 配置信息。
- 自定义 API 模式下的调用费用由用户自己的服务商账户承担。
- 外部 AI 回填和 AI 生成内容仅作为阅读辅助，正式写作前应结合论文原文核对。
