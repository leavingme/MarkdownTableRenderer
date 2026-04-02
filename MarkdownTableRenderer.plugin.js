/**
 * @name MarkdownTableRenderer
 * @author leavingme & antigravity
 * @description Render markdown tables in Discord messages (including history)
 * @version 3.0.0
 */

const DEBUG = false;

module.exports = class MarkdownTableRenderer {
    log(...args) {
        if (DEBUG) console.log("[MTR]", ...args);
    }

    start() {
        this.injectCSS();
        this.processAll();
        this.observe();
    }

    stop() {
        this.removeCSS();
        if (this.observer) this.observer.disconnect();
    }

    injectCSS() {
        if (document.getElementById("mtr-styles")) return;
        const style = document.createElement("style");
        style.id = "mtr-styles";
        style.textContent = `
            table[data-mtr="true"] {
                border-collapse: collapse;
                margin: 8px 0;
                color: var(--text-normal, #dbdee1);
                /* 限制最大宽度以防止超出聊天泡泡 */
                max-width: 100%;
                display: block;
                overflow-x: auto;
            }
            table[data-mtr="true"] th, table[data-mtr="true"] td {
                /* 使用 Discord 自带的一些辅助层级颜色让表格边框自然融入主题（亮暗皆可） */
                border: 1px solid var(--background-modifier-accent, #4f545c);
                padding: 8px 12px;
                text-align: left;
            }
            table[data-mtr="true"] th {
                /* 表头加上深一点的背景色强化区分度 */
                background-color: var(--background-secondary, #2b2d31);
                font-weight: bold;
                border-bottom: 2px solid var(--background-modifier-accent, #4f545c);
            }
            table[data-mtr="true"] tr:nth-child(2n) {
                /* 斑马线：偶数行轻微高亮增强数据可读性 */
                background-color: var(--background-modifier-hover, rgba(255, 255, 255, 0.02));
            }
        `;
        document.head.appendChild(style);
    }

    removeCSS() {
        const style = document.getElementById("mtr-styles");
        if (style) style.remove();
    }

    observe() {
        this.observer = new MutationObserver(() => {
            this.processAll();
        });
        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // ───────── 行识别 ─────────

    isTableRowLine(line) {
        const t = line.trim();
        return t.startsWith("|") && t.endsWith("|") && t.length > 2;
    }

    isSeparatorLine(line) {
        const t = line.trim();
        if (!t.startsWith("|") || !t.endsWith("|")) return false;
        const cells = t.split("|").map(c => c.trim()).filter(c => c !== "");
        return cells.length > 0 && cells.every(c => /^[\-:]+$/.test(c) && c.includes("-"));
    }

    nextNonEmpty(lines, startIndex) {
        for (let j = startIndex; j < lines.length; j++) {
            if (lines[j].trim() !== "") return j;
        }
        return -1;
    }

    // ───────── 分块与解析 ─────────

    /**
     * 将一段文本拆分为：
     * - table (含表头+分隔行的完整表格)
     * - table_continuation (纯数据行，是被截断的表格剩余部分)
     * - text (普通文本)
     */
    splitBlocks(text) {
        const lines = text.split("\n");
        const blocks = [];
        let i = 0;

        while (i < lines.length) {
            if (this.isTableRowLine(lines[i])) {
                const j = this.nextNonEmpty(lines, i + 1);
                
                // Case 1: 含表头的完整表格 => "table"
                if (j !== -1 && this.isSeparatorLine(lines[j])) {
                    const tableLines = [];
                    while (i < lines.length) {
                        const trimmed = lines[i].trim();
                        if (trimmed === "") {
                            const next = this.nextNonEmpty(lines, i + 1);
                            if (next !== -1 && (this.isTableRowLine(lines[next]) || this.isSeparatorLine(lines[next]))) {
                                i++; continue;
                            } else break;
                        }
                        if (this.isTableRowLine(lines[i]) || this.isSeparatorLine(lines[i])) {
                            tableLines.push(lines[i]);
                            i++;
                        } else break;
                    }
                    blocks.push({ type: "table", content: tableLines.join("\n") });
                    continue;
                } 
                // Case 2: 无表头，纯数据续行 => "table_continuation"
                else {
                    const contLines = [];
                    while (i < lines.length) {
                        const trimmed = lines[i].trim();
                        if (trimmed === "") {
                            const next = this.nextNonEmpty(lines, i + 1);
                            if (next !== -1 && this.isTableRowLine(lines[next]) && !this.isSeparatorLine(lines[next])) {
                                i++; continue;
                            } else break;
                        }
                        if (this.isTableRowLine(lines[i])) {
                            contLines.push(lines[i]);
                            i++;
                        } else break;
                    }
                    blocks.push({ type: "table_continuation", content: contLines.join("\n") });
                    continue;
                }
            }

            // Case 3: 普通文本 => "text"
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

    parseTable(tableText) {
        const lines = tableText.split("\n").filter(l => l.trim());
        if (lines.length < 2) return null;
        const dataLines = lines.filter(line => !this.isSeparatorLine(line));
        if (dataLines.length < 1) return null;
        const rows = dataLines.map(line =>
            line.split("|").map(cell => cell.trim())
                .filter((c, idx, arr) => !(c === "" && (idx === 0 || idx === arr.length - 1)))
        );
        return rows.filter(row => row.length > 0);
    }

    renderTable(rows) {
        const table = document.createElement("table");
        table.dataset.mtr = "true";

        rows.forEach((row, i) => {
            const tr = document.createElement("tr");
            row.forEach(cell => {
                const td = document.createElement(i === 0 ? "th" : "td");
                td.innerText = cell;
                tr.appendChild(td);
            });
            table.appendChild(tr);
        });

        return table;
    }

    // ───────── 跨消息追加寻找逻辑 ─────────

    detectColumnCount(text) {
        const lines = text.split("\n").filter(l => this.isTableRowLine(l) && !this.isSeparatorLine(l));
        if (lines.length === 0) return 0;
        return Math.max(...lines.map(line =>
            line.split("|").map(c => c.trim())
                .filter((c, i, a) => !(c === "" && (i === 0 || i === a.length - 1)))
                .length
        ));
    }

    getTableColCount(table) {
        const firstRow = table.querySelector("tr");
        if (!firstRow) return 0;
        return firstRow.querySelectorAll("th, td").length;
    }

    findRecentTableBefore(el, contCols) {
        const allTables = Array.from(document.querySelectorAll("table[data-mtr]"));
        const tablesBeforeEl = allTables.filter(t => 
            (t.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
        );

        for (let i = tablesBeforeEl.length - 1; i >= Math.max(0, tablesBeforeEl.length - 10); i--) {
            const t = tablesBeforeEl[i];
            const tableCols = this.getTableColCount(t);
            if (contCols === 0 || tableCols === 0 || contCols === tableCols) {
                return t;
            }
        }
        return null;
    }

    appendRowsToTable(text, table) {
        const lines = text.split("\n").filter(l => this.isTableRowLine(l) && !this.isSeparatorLine(l));
        this.log(`→ 成功追加续行: ${lines.length} 行`);
        lines.forEach(line => {
            const cells = line.split("|").map(c => c.trim())
                .filter((c, idx, arr) => !(c === "" && (idx === 0 || idx === arr.length - 1)));
            if (cells.length === 0) return;
            const tr = document.createElement("tr");
            cells.forEach(cell => {
                const td = document.createElement("td");
                td.innerText = cell;
                tr.appendChild(td);
            });
            table.appendChild(tr);
        });
    }

    // ───────── 核心调度 ─────────

    processAll() {
        const allNodes = Array.from(document.querySelectorAll('[class*="messageContent"]'));
        
        for (const el of allNodes) {
            if (el.dataset.tableRendered) continue;

            const text = el.innerText;
            const blocks = this.splitBlocks(text);

            const hasAnyTableComponent = blocks.some(b => b.type === "table" || b.type === "table_continuation");
            if (!hasAnyTableComponent) {
                el.dataset.tableRendered = "true";
                continue;
            }

            el.innerHTML = "";
            let currentLocalTable = null;

            for (const block of blocks) {
                if (block.type === "table") {
                    const rows = this.parseTable(block.content);
                    if (rows) {
                        const table = this.renderTable(rows);
                        el.appendChild(table);
                        currentLocalTable = table;
                    } else {
                        const span = document.createElement("span");
                        span.style.display = "block";
                        span.innerText = block.content;
                        el.appendChild(span);
                    }
                } 
                else if (block.type === "table_continuation") {
                    const contCols = this.detectColumnCount(block.content);
                    
                    let targetTable = null;
                    if (currentLocalTable && (contCols === 0 || this.getTableColCount(currentLocalTable) === contCols)) {
                        targetTable = currentLocalTable;
                    } else {
                        targetTable = this.findRecentTableBefore(el, contCols);
                    }

                    if (targetTable) {
                        this.appendRowsToTable(block.content, targetTable);
                    } else {
                        const span = document.createElement("span");
                        span.style.display = "block";
                        span.innerText = block.content;
                        el.appendChild(span);
                    }
                } 
                else {
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
    }
};