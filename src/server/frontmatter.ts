import { Document, parseDocument } from "yaml";
import type { EntityProperties, PropertyValue } from "../shared/domain.js";

export interface ParsedMarkdown {
  document: Document;
  properties: EntityProperties;
  body: string;
  lineEnding: "\n" | "\r\n";
  hadFrontmatter: boolean;
}

export function parseMarkdown(raw: string): ParsedMarkdown {
  const lineEnding = raw.includes("\r\n") ? "\r\n" : "\n";
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    return {
      document: new Document({}),
      properties: {},
      body: raw,
      lineEnding,
      hadFrontmatter: false
    };
  }
  const document = parseDocument(match[1], { keepSourceTokens: true });
  if (document.errors.length) {
    throw new Error(`YAML 解析失败：${document.errors[0]?.message ?? "未知错误"}`);
  }
  return {
    document,
    properties: (document.toJS() ?? {}) as EntityProperties,
    body: raw.slice(match[0].length),
    lineEnding,
    hadFrontmatter: true
  };
}

export function rewriteMarkdown(
  raw: string,
  changes: EntityProperties,
  nextBody?: string
): string {
  const parsed = parseMarkdown(raw);
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) parsed.document.delete(key);
    else parsed.document.set(key, value as PropertyValue);
  }
  const yaml = String(parsed.document).trimEnd().replaceAll("\n", parsed.lineEnding);
  const body = nextBody === undefined ? parsed.body : nextBody;
  return `---${parsed.lineEnding}${yaml}${parsed.lineEnding}---${parsed.lineEnding}${body}`;
}

export function createMarkdown(properties: EntityProperties, body = ""): string {
  const document = new Document(properties);
  return `---\n${String(document).trimEnd()}\n---\n${body}`;
}
