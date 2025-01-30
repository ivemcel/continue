/**
工作过程：
按标题分块：markdownChunker 函数根据标题（例如 h1、h2、h3 等）将内容分割成多个块。每个块对应一个章节或子章节。
递归分割：对于每个标题下的内容，函数会递归分割子标题下的内容（如 h1 下的 h2、h2 下的 h3），直到所有内容都被分割成符合 maxChunkSize 限制的块。
元数据处理：每个块会附带 fragment 和 title 等元数据，这些元数据是从标题中提取并清洗后的。
 */
import { ChunkWithoutID } from "../../index.js";
import { countTokens } from "../../llm/countTokens.js";
import { basicChunker } from "./basic.js";

/**
 * 这个函数用于清理标题或章节的片段（通常用于索引或生成 URL）。
 * 去除首尾空白字符。
 * 如果有 Markdown 链接（]( )），则截断链接部分。
 * 移除特殊字符（只保留字母、数字、连字符、空格和下划线）。
 * 转换为小写，并将空格替换为连字符。
 */
export function cleanFragment(
  fragment: string | undefined,
): string | undefined {
  if (!fragment) {
    return undefined;
  }

  // Remove leading and trailing whitespaces
  fragment = fragment.trim();

  // If there's a ](, which would mean a link, remove everything after it
  const parenIndex = fragment.indexOf("](");
  if (parenIndex !== -1) {
    fragment = fragment.slice(0, parenIndex);
  }

  // Remove all special characters except alphanumeric, hyphen, space, and underscore
  fragment = fragment.replace(/[^\w-\s]/g, "").trim();

  // Convert to lowercase
  fragment = fragment.toLowerCase();

  // Replace spaces with hyphens
  fragment = fragment.replace(/\s+/g, "-");

  return fragment;
}

/**
 *  cleanHeader： 这个函数用于清理标题，去掉不必要的部分。
 * 去除首尾空白字符，并去掉括号后的内容。
 * 移除特殊字符（只保留字母、数字、连字符和下划线）。
 */
export function cleanHeader(header: string | undefined): string | undefined {
  if (!header) {
    return undefined;
  }

  // Remove leading and trailing whitespaces
  header = header.trim();

  // If there's a (, remove everything after it
  const parenIndex = header.indexOf("(");
  if (parenIndex !== -1) {
    header = header.slice(0, parenIndex);
  }

  // Remove all special characters except alphanumeric, hyphen, space, and underscore
  header = header
    .replace(/[^\w-\s]/g, "")
    .replace("¶", "")
    .trim();

  return header;
}

/**
 * 查找文本中的第一个标题（即以 # 开头的行），并返回标题的正文部分。
 */
function findHeader(lines: string[]): string | undefined {
  return lines.find((line) => line.startsWith("#"))?.split("# ")[1];
}

/**
 * markdownChunker是进行 Markdown 内容分块的主函数。
 * 它会根据标题层级（如 h1、h2、h3 等）递归地分割内容，同时确保每个块不超过 maxChunkSize。
 * 基本情况：如果内容的 token 数量小于 maxChunkSize，则将内容作为一个块直接输出。
 * 递归情况：如果标题层级大于 4，使用基本的分块器 basicChunker。否则，它会根据标题将内容分割为不同的部分，然后递归处理每个部分。
 * 每个块会附带元数据（如 fragment 和 title），这些元数据是从标题中清洗和格式化出来的。
 */
export async function* markdownChunker(
  content: string,
  maxChunkSize: number,
  hLevel: number,
): AsyncGenerator<ChunkWithoutID> {
  if (countTokens(content) <= maxChunkSize) {
    const header = findHeader(content.split("\n"));
    yield {
      content,
      startLine: 0,
      endLine: content.split("\n").length,
      otherMetadata: {
        fragment: cleanFragment(header),
        title: cleanHeader(header),
      },
    };
    return;
  }
  if (hLevel > 4) {
    const header = findHeader(content.split("\n"));

    for await (const chunk of basicChunker(content, maxChunkSize)) {
      yield {
        ...chunk,
        otherMetadata: {
          fragment: cleanFragment(header),
          title: cleanHeader(header),
        },
      };
    }
    return;
  }

  const h = `${"#".repeat(hLevel + 1)} `;
  const lines = content.split("\n");
  const sections = [];

  let currentSectionStartLine = 0;
  let currentSection: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(h) || i === 0) {
      if (currentSection.length) {
        const isHeader = currentSection[0].startsWith(h);
        sections.push({
          header: isHeader ? currentSection[0] : findHeader(currentSection),
          content: currentSection.slice(isHeader ? 1 : 0).join("\n"),
          startLine: currentSectionStartLine,
          endLine: currentSectionStartLine + currentSection.length,
        });
      }
      currentSection = [lines[i]];
      currentSectionStartLine = i;
    } else {
      currentSection.push(lines[i]);
    }
  }

  if (currentSection.length) {
    const isHeader = currentSection[0].startsWith(h);
    sections.push({
      header: isHeader ? currentSection[0] : findHeader(currentSection),
      content: currentSection.slice(isHeader ? 1 : 0).join("\n"),
      startLine: currentSectionStartLine,
      endLine: currentSectionStartLine + currentSection.length,
    });
  }

  for (const section of sections) {
    for await (const chunk of markdownChunker(
      section.content,
      maxChunkSize - (section.header ? countTokens(section.header) : 0),
      hLevel + 1,
    )) {
      yield {
        content: `${section.header}\n${chunk.content}`,
        startLine: section.startLine + chunk.startLine,
        endLine: section.startLine + chunk.endLine,
        otherMetadata: {
          fragment:
            chunk.otherMetadata?.fragment || cleanFragment(section.header),
          title: chunk.otherMetadata?.title || cleanHeader(section.header),
        },
      };
    }
  }
}

/**
 * Recursively chunks by header level (h1-h6)
 * The final chunk will always include all parent headers
 * TODO: Merge together neighboring chunks if their sum doesn't exceed maxChunkSize
 */
