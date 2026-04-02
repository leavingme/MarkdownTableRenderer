/**
 * @name MarkdownTableRenderer
 * @description Render markdown tables in Discord messages (including history)
 * @version 1.3.0
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

    // 找到从 startIndex 开始，第一个非空行的下标（找不到返回 -1）
    nextNonEmpty(lines, startIndex) {
        for (let j = startIndex; j < lines.length; j++) {
            if (lines[j].trim() !== "") return j;
        }
        return -1;
    }

    // 文本中是否含有合法的 Markdown 表格
    // 判断时跳过空行，兼容 Discord 消息分段导致行间插入空行的情况
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
     * 将整段文本精确拆分为若干块：
     * - 表格块：以"表格行 + 分隔行"开头的连续表格行（行间空行被跳过）
     * - 文本块：其他所有行
     *
     * 修复：Discord 消息分段时，行与行之间可能被插入空行（\n\n），
     * 原来的逐行 lookahead 会在空行处中断，导致表格只渲染一半。
     * 现在 lookahead 和行收集都会跳过空行。
     */
    splitBlocks(text) {
        const lines = text.split("\n");
        const blocks = [];
        let i = 0;

        while (i < lines.length) {
            if (this.isTableRowLine(lines[i])) {
                // 向前看：跳过空行，检查是否接着是分隔行
                const j = this.nextNonEmpty(lines, i + 1);
                if (j !== -1 && this.isSeparatorLine(lines[j])) {
                    // 确认是表格，收集所有表格相关行，跳过中间的空行
                    const tableLines = [];
                    while (i < lines.length) {
                        const trimmed = lines[i].trim();
                        if (trimmed === "") {
                            // 空行：向前看看下一个非空行是不是还是表格行，是则跳过，否则结束
                            const next = this.nextNonEmpty(lines, i + 1);
                            if (next !== -1 && (this.isTableRowLine(lines[next]) || this.isSeparatorLine(lines[next]))) {
                                i++; // 跳过空行，继续收集
                                continue;
                            } else {
                                break; // 空行之后不是表格行，表格结束
                            }
                        }
                        if (this.isTableRowLine(lines[i]) || this.isSeparatorLine(lines[i])) {
                            tableLines.push(lines[i]);
                            i++;
                        } else {
                            break; // 非空、非表格行，表格结束
                        }
                    }
                    blocks.push({ type: "table", content: tableLines.join("\n") });
                    continue;
                }
            }

            // 普通文字行：合并到上一个文字块，或新建文字块
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