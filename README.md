# MarkdownTableRenderer

> A [BetterDiscord](https://betterdiscord.app/) plugin that renders Markdown tables in Discord messages.

Discord does not natively display Markdown tables — they appear as raw text with `|` and `---`. This plugin automatically detects and renders them as clean HTML tables, both in chat history and in real time.

[中文介绍](#中文介绍) | [English](#markdowntablerenderer)

---

## Preview

**Before (raw text in Discord):**

```
| Name     | Role    | Status |
|----------|---------|--------|
| Alice    | Admin   | Online |
| Bob      | Member  | Idle   |
```

**After (rendered by this plugin):**

| Name  | Role   | Status |
|-------|--------|--------|
| Alice | Admin  | Online |
| Bob   | Member | Idle   |

---

## Features

- ✅ Renders Markdown tables in any Discord message
- ✅ Supports **multiple tables** in a single message — each rendered independently
- ✅ Preserves surrounding text before and after tables
- ✅ Works on **historical messages** (on scroll/load) and **new messages** in real time
- ✅ Correctly identifies and hides separator rows (`|---|---|`)

---

## Installation

1. Make sure [BetterDiscord](https://betterdiscord.app/) is installed.
2. Download [`MarkdownTableRenderer.plugin.js`](./MarkdownTableRenderer.plugin.js).
3. Move it to your BetterDiscord plugins folder:

   | OS      | Path |
   |---------|------|
   | macOS   | `~/Library/Application Support/BetterDiscord/plugins/` |
   | Windows | `%AppData%\BetterDiscord\plugins\` |
   | Linux   | `~/.config/BetterDiscord/plugins/` |

4. Open Discord → **Settings → Plugins** → enable **MarkdownTableRenderer**.

---

## Supported Syntax

Standard GitHub-flavored Markdown table format:

```markdown
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Cell A   | Cell B   | Cell C   |
| Cell D   | Cell E   | Cell F   |
```

Alignment markers in the separator row are also recognized:

```markdown
| Left | Center | Right |
|:-----|:------:|------:|
| L    |   C    |     R |
```

---

## How It Works

The plugin uses a `MutationObserver` to watch for DOM changes and processes each `messageContent` element:

1. Scans the message text line by line
2. Identifies table blocks by detecting a **table row** (`| ... |`) followed by a **separator row** (`|---|---|`)
3. Splits the message into table blocks and plain text blocks
4. Renders each table block as an HTML `<table>` element in place

---

## License

[MIT](./LICENSE)

---

## 中文介绍

> 一个 [BetterDiscord](https://betterdiscord.app/) 插件，用于在 Discord 消息中渲染 Markdown 表格。

Discord 原生不支持渲染 Markdown 表格——表格会以 `|` 和 `---` 的原始文本形式显示。本插件会自动识别并将其渲染为整洁的 HTML 表格，对历史消息和实时新消息均生效。

### 功能特性

- ✅ 渲染任意消息中的 Markdown 表格
- ✅ 支持**同一条消息中包含多个表格**，每个表格独立渲染
- ✅ 正确保留表格前后的普通文字，不会将其混入表格
- ✅ 支持**历史消息**（滚动加载时）和**实时新消息**
- ✅ 自动识别并隐藏分隔行（`|---|---|`），不将其显示为数据行

### 安装方法

1. 确保已安装 [BetterDiscord](https://betterdiscord.app/)。
2. 下载 [`MarkdownTableRenderer.plugin.js`](./MarkdownTableRenderer.plugin.js)。
3. 将文件移动到 BetterDiscord 插件目录：

   | 系统    | 路径 |
   |---------|------|
   | macOS   | `~/Library/Application Support/BetterDiscord/plugins/` |
   | Windows | `%AppData%\BetterDiscord\plugins\` |
   | Linux   | `~/.config/BetterDiscord/plugins/` |

4. 打开 Discord → **设置 → Plugins** → 启用 **MarkdownTableRenderer**。

### 支持的表格语法

标准 GitHub Markdown 表格格式：

```markdown
| 列1   | 列2   | 列3   |
|-------|-------|-------|
| 数据A | 数据B | 数据C |
| 数据D | 数据E | 数据F |
```

分隔行中的对齐标记也支持：

```markdown
| 左对齐 | 居中 | 右对齐 |
|:-------|:----:|-------:|
| L      |  C   |      R |
```

### 工作原理

插件使用 `MutationObserver` 监听 DOM 变化，对每个 `messageContent` 元素进行处理：

1. 逐行扫描消息文本
2. 通过识别**表格行**（`| ... |`）+ **分隔行**（`|---|---|`）的组合来定位表格起点
3. 将消息拆分为若干表格块和普通文字块
4. 将每个表格块就地渲染为 HTML `<table>` 元素
