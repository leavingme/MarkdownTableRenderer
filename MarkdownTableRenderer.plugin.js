/**
 * @name MarkdownTableRenderer
 * @description Render markdown tables in Discord messages (including history)
 * @version 1.2.0
 */

module.exports = class MarkdownTableRenderer {
    start() {
        this.processAll();
        this.observe();
    }

    stop() {
        if (this.observer) this.observer.disconnect();
    }

    // 扫描已有消息
    processAll() {
        document.querySelectorAll('[class*="messageContent"]').forEach(el => {
            this.tryRender(el);
        });
    }

    // 监听新消息 / 滚动加载
    observe() {
        this.observer = new MutationObserver(() => {
            this.processAll();
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 判断一行是否是表格数据行：必须以 | 开头且以 | 结尾
    isTableRowLine(line) {
        const t = line.trim();
        return t.startsWith("|") && t.endsWith("|") && t.length > 2;
    }

    // 判断一行是否是表格分隔行：拆成各格后，每格只由 - 和 : 组成，且至少含一个 -
    isSeparatorLine(line) {
        const t = line.trim();
        if (!t.startsWith("|") || !t.endsWith("|")) return false;
        // 按 | 拆分，去掉首尾空格和空格子
        const cells = t.split("|").map(c => c.trim()).filter(c => c !== "");
        return (
            cells.length > 0 &&
            cells.every(c => /^[\-:]+$/.test(c) && c.includes("-"))
        );
    }

    // 文本中是否含有合法的 Markdown 表格（当前行是表格行 + 下一行是分隔行）
    hasTable(text) {
        const lines = text.split("\n");
        for (let i = 0; i + 1 < lines.length; i++) {
            if (this.isTableRowLine(lines[i]) && this.isSeparatorLine(lines[i + 1])) {
                return true;
            }
        }
        return false;
    }

    /**
     * 将整段文本精确拆分为若干块：
     * - 表格块：以"表格行 + 分隔行"开头的连续表格行
     * - 文本块：其他所有行
     *
     * 关键：只有"当前行满足表格行格式 且 下一行是分隔行"时，才认为表格开始。
     * 这样可以避免普通文字（即便含有 | 字符）被误划入表格。
     */
    splitBlocks(text) {
        const lines = text.split("\n");
        const blocks = [];
        let i = 0;

        while (i < lines.length) {
            // 表格开始条件：当前行是表格行，且下一行是分隔行
            if (
                i + 1 < lines.length &&
                this.isTableRowLine(lines[i]) &&
                this.isSeparatorLine(lines[i + 1])
            ) {
                const tableLines = [];
                // 收集所有连续的表格相关行（数据行 或 分隔行）
                while (
                    i < lines.length &&
                    (this.isTableRowLine(lines[i]) || this.isSeparatorLine(lines[i]))
                ) {
                    tableLines.push(lines[i]);
                    i++;
                }
                blocks.push({ type: "table", content: tableLines.join("\n") });
            } else {
                // 普通文字行：合并到上一个文字块，或新建文字块
                const prev = blocks[blocks.length - 1];
                if (prev && prev.type === "text") {
                    prev.content += "\n" + lines[i];
                } else {
                    blocks.push({ type: "text", content: lines[i] });
                }
                i++;
            }
        }

        return blocks;
    }

    // 解析单个表格文本，返回行二维数组（跳过分隔行）
    parseTable(tableText) {
        const lines = tableText.split("\n").filter(l => l.trim());
        if (lines.length < 2) return null;

        // 过滤掉分隔行
        const dataLines = lines.filter(line => !this.isSeparatorLine(line));
        if (dataLines.length < 1) return null;

        const rows = dataLines.map(line =>
            line
                .split("|")
                .map(cell => cell.trim())
                // 去掉首尾因 | 分割产生的空字符串
                .filter((c, idx, arr) =>
                    !(c === "" && (idx === 0 || idx === arr.length - 1))
                )
        );

        return rows.filter(row => row.length > 0);
    }

    // 渲染 HTML table
    renderTable(rows) {
        const table = document.createElement("table");
        table.style.borderCollapse = "collapse";
        table.style.marginTop = "6px";
        table.style.marginBottom = "6px";

        rows.forEach((row, i) => {
            const tr = document.createElement("tr");

            row.forEach(cell => {
                const td = document.createElement(i === 0 ? "th" : "td");
                td.innerText = cell;
                td.style.border = "1px solid #555";
                td.style.padding = "4px 8px";
                td.style.textAlign = "left";
                tr.appendChild(td);
            });

            table.appendChild(tr);
        });

        return table;
    }

    // 主处理逻辑
    tryRender(el) {
        if (el.dataset.tableRendered) return;

        const text = el.innerText;
        if (!this.hasTable(text)) return;

        const blocks = this.splitBlocks(text);

        el.innerHTML = "";

        for (const block of blocks) {
            if (block.type === "table") {
                const rows = this.parseTable(block.content);
                if (rows) {
                    el.appendChild(this.renderTable(rows));
                } else {
                    // 解析失败，降级显示原始文本
                    const span = document.createElement("span");
                    span.style.display = "block";
                    span.innerText = block.content;
                    el.appendChild(span);
                }
            } else {
                // 普通文字块（首尾可能有空白，只在非空时渲染）
                if (block.content.trim()) {
                    const span = document.createElement("span");
                    span.style.display = "block";
                    span.innerText = block.content;
                    el.appendChild(span);
                }
            }
        }

        el.dataset.tableRendered = "true";
    }
};