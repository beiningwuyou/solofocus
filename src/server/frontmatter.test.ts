import { describe, expect, it } from "vitest";
import { parseMarkdown, rewriteMarkdown } from "./frontmatter.js";

describe("frontmatter preservation", () => {
  it("updates selected fields and preserves body and unknown fields", () => {
    const source = "---\nid: abc\nkind: task\ncustom: keep-me\n# note\nstatus: todo\n---\n# 正文\n[[项目]]\n";
    const next = rewriteMarkdown(source, { status: "done", updated: "2026-08-02" });
    const parsed = parseMarkdown(next);
    expect(parsed.properties.custom).toBe("keep-me");
    expect(parsed.properties.status).toBe("done");
    expect(parsed.body).toBe("# 正文\n[[项目]]\n");
  });

  it("promotes a plain Markdown file without losing content", () => {
    const next = rewriteMarkdown("# 原始内容\n", { id: "stable", kind: "document" });
    const parsed = parseMarkdown(next);
    expect(parsed.properties.id).toBe("stable");
    expect(parsed.body).toBe("# 原始内容\n");
  });
});
