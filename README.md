# MarkdownTableRenderer

> A [BetterDiscord](https://betterdiscord.app/) plugin that renders Markdown tables in Discord messages.

Discord does not natively display Markdown tables — they appear as raw text with `|` and `---`. This plugin automatically detects and renders them as clean HTML tables, both in chat history and in real time.

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
