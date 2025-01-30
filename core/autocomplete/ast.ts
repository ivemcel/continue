import Parser from "web-tree-sitter";
import { RangeInFileWithContents } from "../commands/util.js";
import { getParserForFile } from "../util/treeSitter.js";

/**
getAst：给定文件路径和文件内容，返回文件的 AST（抽象语法树），如果出错则返回 undefined。
getTreePathAtCursor：给定 AST 和光标位置，返回从根节点到包含光标位置的节点路径。
getScopeAroundRange：给定一个范围，返回包含该范围的最小 AST 节点。
关键点：
这些函数依赖于 web-tree-sitter 库，这是一个 JavaScript 绑定的 Tree-sitter 解析器，可以快速地分析和增量解析源代码。
getScopeAroundRange 函数通过计算文件中的字符位置，找到完全包含给定范围的 AST 节点。
这些函数都提供了合理的错误处理机制，如果发生错误（例如，无法找到解析器或 AST 解析失败），会返回 undefined。
 */


export async function getAst(
  filepath: string,
  fileContents: string,
): Promise<Parser.Tree | undefined> {
  const parser = await getParserForFile(filepath);

  if (!parser) {
    return undefined;
  }

  try {
    const ast = parser.parse(fileContents);
    return ast;
  } catch (e) {
    return undefined;
  }
}

export async function getTreePathAtCursor(
  ast: Parser.Tree,
  cursorIndex: number,
): Promise<Parser.SyntaxNode[] | undefined> {
  const path = [ast.rootNode];
  while (path[path.length - 1].childCount > 0) {
    let foundChild = false;
    for (const child of path[path.length - 1].children) {
      if (child.startIndex <= cursorIndex && child.endIndex >= cursorIndex) {
        path.push(child);
        foundChild = true;
        break;
      }
    }

    if (!foundChild) {
      break;
    }
  }

  return path;
}

export async function getScopeAroundRange(
  range: RangeInFileWithContents,
): Promise<RangeInFileWithContents | undefined> {
  const ast = await getAst(range.filepath, range.contents);
  if (!ast) {
    return undefined;
  }

  const { start: s, end: e } = range.range;
  const lines = range.contents.split("\n");
  const startIndex =
    lines.slice(0, s.line).join("\n").length +
    (lines[s.line]?.slice(s.character).length ?? 0);
  const endIndex =
    lines.slice(0, e.line).join("\n").length +
    (lines[e.line]?.slice(0, e.character).length ?? 0);

  let node = ast.rootNode;
  while (node.childCount > 0) {
    let foundChild = false;
    for (const child of node.children) {
      if (child.startIndex < startIndex && child.endIndex > endIndex) {
        node = child;
        foundChild = true;
        break;
      }
    }

    if (!foundChild) {
      break;
    }
  }

  return {
    contents: node.text,
    filepath: range.filepath,
    range: {
      start: {
        line: node.startPosition.row,
        character: node.startPosition.column,
      },
      end: {
        line: node.endPosition.row,
        character: node.endPosition.column,
      },
    },
  };
}
