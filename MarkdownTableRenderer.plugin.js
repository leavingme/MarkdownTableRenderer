/**
 * @name MarkdownTableRenderer
 * @description Render markdown tables in Discord messages (including history)
 * @version 1.5.0
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
        const cells = t.split("|").map(c => c.trim()).filter(c => c !== "");
        return (
            cells.length > 0 &&
            cells.every(c => /^[\-:]+$/.test(c) && c.includes("-"))
        );
    }

    // 找到从 startIndex 开始，第一个非空行的下标（找不到返回 -1）
    nextNonEmpty(lines, startIndex) {
        for (let j = startIndex; j < lines.length; j++) {
            if (lines[j].trim() !== "") return j;
        }
        return -1;
    }

    // 文本中是否含有合法的 Markdown 表格（跳过空行做 lookahead）
    hasTable(text) {
        const lines = text.split("\n");
        for (let i = 0; i < lines.length; i++) {
            if (!this.isTableRowLine(lines[i])) continue;
            const j = this.nextNonEmpty(lines, i + 1);
            if (j !== -1 && this.isSeparatorLine(lines[j])) return true;
        }
        return false;
    }

    /**
     * 判断当前消息是否是跨消息表格的"续行段"：
     * 所有非空行都是表格行，且没有分隔行（无表头+分隔行的完整结构）。
     * 这意味着它是被 Discord 拆分出来的下半部分数据行。
     */
    isTableContinuation(text) {
        const lines = text.split("\n").filter(l => l.trim());
        if (lines.length === 0) return false;
        const allTableRows = lines.every(l => this.isTableRowLine(l));
        const hasSeparator = lines.some(l => this.isSeparatorLine(l));
        return allTableRows && !hasSeparator;
    }

    /**
     * 从当前消息所在 <li> 向前搜索，找到最近一张本插件渲染的 <table>。
     * 最多向前搜索 MAX_STEPS 条消息（不因中间有文字而中止，避免跨过文字消息漏找）。
     * 用列数匹配来判断是否是同一张表格的续行，避免误连接到无关表格。
     */
    findPreviousTable(el, continuationText) {
        // 解析续行文本的列数
        const contCols = this.detectColumnCount(continuationText);

        // 找到最近的 li 祖先
        let li = el;
        while (li && li.tagName !== "LI") {
            li = li.parentElement;
        }
        if (!li) return null;

        // 向前最多搜索 5 条消息
        let prev = li.previousElementSibling;
        let steps = 0;
        while (prev && steps < 5) {
            const tables = prev.querySelectorAll("table[data-mtr]");
            if (tables.length > 0) {
                // 找列数匹配的表格（从最后一张开始往前找）
                for (let t = tables.length - 1; t >= 0; t--) {
                    const tableCols = this.getTableColCount(tables[t]);
                    if (contCols === 0 || tableCols === 0 || contCols === tableCols) {
                        return tables[t];
                    }
                }
            }
            prev = prev.previousElementSibling;
            steps++;
        }
        return null;
    }

    // 统计续行文本中各行的最大列数
    detectColumnCount(text) {
        const lines = text.split("\n").filter(l => this.isTableRowLine(l));
        if (lines.length === 0) return 0;
        return Math.max(...lines.map(line =>
            line.split("|").map(c => c.trim()).filter((c, i, a) =>
                !(c === "" && (i === 0 || i === a.length - 1))
            ).length
        ));
    }

    // 获取已渲染表格的列数（取第一行）
    getTableColCount(table) {
        const firstRow = table.querySelector("tr");
        if (!firstRow) return 0;
        return firstRow.querySelectorAll("th, td").length;
    }

    /**
     * 将续行文本中的表格行追加到已有 <table> 末尾
     */
    appendRowsToTable(text, table) {
        const lines = text.split("\n").filter(l => this.isTableRowLine(l));
        lines.forEach(line => {
            const cells = line
                .split("|")
                .map(c => c.trim())
                .filter((c, idx, arr) =>
                    !(c === "" && (idx === 0 || idx === arr.length - 1))
                );
            if (cells.length === 0) return;

            const tr = document.createElement("tr");
            cells.forEach(cell => {
                const td = document.createElement("td");
                td.innerText = cell;
                td.style.border = "1px solid #555";
                td.style.padding = "4px 8px";
                td.style.textAlign = "left";
                tr.appendChild(td);
            });
            table.appendChild(tr);
        });
    }

    /**
     * 将整段文本精确拆分为若干块（跳过行间空行）：
     * - 表格块：以"表格行 + 分隔行"开头的连续表格行
     * - 文本块：其他所有行
     */
    splitBlocks(text) {
        const lines = text.split("\n");
        const blocks = [];
        let i = 0;

        while (i < lines.length) {
            if (this.isTableRowLine(lines[i])) {
                const j = this.nextNonEmpty(lines, i + 1);
                if (j !== -1 && this.isSeparatorLine(lines[j])) {
                    const tableLines = [];
                    while (i < lines.length) {
                        const trimmed = lines[i].trim();
                        if (trimmed === "") {
                            const next = this.nextNonEmpty(lines, i + 1);
                            if (next !== -1 && (this.isTableRowLine(lines[next]) || this.isSeparatorLine(lines[next]))) {
                                i++;
                                continue;
                            } else {
                                break;
                            }
                        }
                        if (this.isTableRowLine(lines[i]) || this.isSeparatorLine(lines[i])) {
                            tableLines.push(lines[i]);
                            i++;
                        } else {
                            break;
                        }
                    }
                    blocks.push({ type: "table", content: tableLines.join("\n") });
                    continue;
                }
            }

            const prev = blocks[blocks.length - 1];
            if (prev && prev.type === "text") {
                prev.content += "\n" + lines[i];
            } else {
                blocks.push({ type: "text", content: lines[i] });
            }
            i++;
        }

        return blocks;
    }

    // 解析单个表格文本，返回行二维数组（跳过分隔行）
    parseTable(tableText) {
        const lines = tableText.split("\n").filter(l => l.trim());
        if (lines.length < 2) return null;

        const dataLines = lines.filter(line => !this.isSeparatorLine(line));
        if (dataLines.length < 1) return null;

        const rows = dataLines.map(line =>
            line
                .split("|")
                .map(cell => cell.trim())
                .filter((c, idx, arr) =>
                    !(c === "" && (idx === 0 || idx === arr.length - 1))
                )
        );

        return rows.filter(row => row.length > 0);
    }

    // 渲染 HTML table，并标记 data-mtr 以便跨消息续行时找到它
    renderTable(rows) {
        const table = document.createElement("table");
        table.dataset.mtr = "true";         // 标记为本插件渲染的表格
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

        // 情况 1：当前消息包含完整表格（表头 + 分隔行）
        if (this.hasTable(text)) {
            const blocks = this.splitBlocks(text);
            el.innerHTML = "";

            for (const block of blocks) {
                if (block.type === "table") {
                    const rows = this.parseTable(block.content);
                    if (rows) {
                        el.appendChild(this.renderTable(rows));
                    } else {
                        const span = document.createElement("span");
                        span.style.display = "block";
                        span.innerText = block.content;
                        el.appendChild(span);
                    }
                } else {
                    if (block.content.trim()) {
                        const span = document.createElement("span");
                        span.style.display = "block";
                        span.innerText = block.content;
                        el.appendChild(span);
                    }
                }
            }

            el.dataset.tableRendered = "true";
            return;
        }

        // 情况 2：跨消息表格续行——当前消息全是无表头的数据行
        if (this.isTableContinuation(text)) {
            const prevTable = this.findPreviousTable(el, text);
            if (prevTable) {
                this.appendRowsToTable(text, prevTable);
                el.innerHTML = "";          // 清空，内容已合并到前一条消息的表格
                el.dataset.tableRendered = "true";
            }
        }
    }
};