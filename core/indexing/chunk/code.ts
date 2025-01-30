/**
 * 这段 TypeScript 代码定义了一个用于智能分块代码的 codeChunker 函数，主要用于将源代码按一定规则分成若干个块（chunks），
 * 每个块的大小不会超过指定的 maxChunkSize。代码中使用了 web-tree-sitter 库来解析源代码并构建语法树，
 * 然后通过递归和语法树的节点类型决定是否对节点进行折叠，以便将源代码切割成较小的片段。
 * 主要功能：
 * 代码折叠（Code Collapsing）：通过折叠某些语法节点（如函数体、类体等）来减少每个代码块的大小。
 * 智能分块（Smart Chunking）：根据代码的语法结构，判断是否需要将代码折叠为更小的块。此过程通过 countTokensAsync 函数来计算每个代码块的 token 数量，并根据 maxChunkSize 进行处理。
 * 递归处理子节点：如果折叠后的代码块仍然太大，代码会递归处理语法树的子节点，直到满足 maxChunkSize 限制。
 */
import { SyntaxNode } from "web-tree-sitter";
import { ChunkWithoutID } from "../../index.js";
import { countTokensAsync } from "../../llm/countTokens.js";
import { getParserForFile } from "../../util/treeSitter.js";

//该函数为每种类型的语法节点返回一个折叠后的字符串。比如，statement_block 类型会被替换为 { ... }，其余节点统一替换为 ...。
function collapsedReplacement(node: SyntaxNode): string {
  if (node.type === "statement_block") {
    return "{ ... }";
  }
  return "...";
}

//用于获取节点的第一个子节点，支持传入单个类型名称或类型名称数组。如果该节点有对应类型的子节点，返回第一个匹配的子节点。
function firstChild(
  node: SyntaxNode,
  grammarName: string | string[],
): SyntaxNode | null {
  if (Array.isArray(grammarName)) {
    return (
      node.children.find((child) => grammarName.includes(child.type)) || null
    );
  }
  return node.children.find((child) => child.type === grammarName) || null;
}

//该函数会处理语法树节点的子节点，尝试折叠指定类型的子节点（如函数体、类体等），并根据 maxChunkSize 限制调整代码块的大小。折叠操作后，代码会移除不必要的空行。
async function collapseChildren(
  node: SyntaxNode,
  code: string,
  blockTypes: string[],
  collapseTypes: string[],
  collapseBlockTypes: string[],
  maxChunkSize: number,
): Promise<string> {
  code = code.slice(0, node.endIndex);
  const block = firstChild(node, blockTypes);
  const collapsedChildren = [];

  if (block) {
    const childrenToCollapse = block.children.filter((child) =>
      collapseTypes.includes(child.type),
    );
    for (const child of childrenToCollapse.reverse()) {
      const grandChild = firstChild(child, collapseBlockTypes);
      if (grandChild) {
        const start = grandChild.startIndex;
        const end = grandChild.endIndex;
        const collapsedChild =
          code.slice(child.startIndex, start) +
          collapsedReplacement(grandChild);
        code =
          code.slice(0, start) +
          collapsedReplacement(grandChild) +
          code.slice(end);

        collapsedChildren.unshift(collapsedChild);
      }
    }
  }
  code = code.slice(node.startIndex);
  let removedChild = false;
  while (
    (await countTokensAsync(code.trim())) > maxChunkSize &&
    collapsedChildren.length > 0
  ) {
    removedChild = true;
    // Remove children starting at the end - TODO: Add multiple chunks so no children are missing
    const childCode = collapsedChildren.pop()!;
    const index = code.lastIndexOf(childCode);
    if (index > 0) {
      code = code.slice(0, index) + code.slice(index + childCode.length);
    }
  }

  if (removedChild) {
    // Remove the extra blank lines
    let lines = code.split("\n");
    let firstWhiteSpaceInGroup = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim() === "") {
        if (firstWhiteSpaceInGroup < 0) {
          firstWhiteSpaceInGroup = i;
        }
      } else {
        if (firstWhiteSpaceInGroup - i > 1) {
          // Remove the lines
          lines = [
            ...lines.slice(0, i + 1),
            ...lines.slice(firstWhiteSpaceInGroup + 1),
          ];
        }
        firstWhiteSpaceInGroup = -1;
      }
    }

    code = lines.join("\n");
  }

  return code;
}

export const FUNCTION_BLOCK_NODE_TYPES = ["block", "statement_block"];
export const FUNCTION_DECLARATION_NODE_TYPEs = [
  "method_definition",
  "function_definition",
  "function_item",
  "function_declaration",
  "method_declaration",
];

//这两个函数分别用于处理类定义和函数定义的节点，并返回相应的折叠后代码。它们调用 collapseChildren 来折叠子节点。
async function constructClassDefinitionChunk(
  node: SyntaxNode,
  code: string,
  maxChunkSize: number,
): Promise<string> {
  return collapseChildren(
    node,
    code,
    ["block", "class_body", "declaration_list"],
    FUNCTION_DECLARATION_NODE_TYPEs,
    FUNCTION_BLOCK_NODE_TYPES,
    maxChunkSize,
  );
}

async function constructFunctionDefinitionChunk(
  node: SyntaxNode,
  code: string,
  maxChunkSize: number,
): Promise<string> {
  const bodyNode = node.children[node.children.length - 1];
  const funcText =
    code.slice(node.startIndex, bodyNode.startIndex) +
    collapsedReplacement(bodyNode);

  if (
    node.parent &&
    ["block", "declaration_list"].includes(node.parent.type) &&
    node.parent.parent &&
    ["class_definition", "impl_item"].includes(node.parent.parent.type)
  ) {
    // If inside a class, include the class header
    const classNode = node.parent.parent;
    const classBlock = node.parent;
    return `${code.slice(
      classNode.startIndex,
      classBlock.startIndex,
    )}...\n\n${" ".repeat(node.startPosition.column)}${funcText}`;
  }
  return funcText;
}

const collapsedNodeConstructors: {
  [key: string]: (
    node: SyntaxNode,
    code: string,
    maxChunkSize: number,
  ) => Promise<string>;
} = {
  // Classes, structs, etc
  class_definition: constructClassDefinitionChunk,
  class_declaration: constructClassDefinitionChunk,
  impl_item: constructClassDefinitionChunk,
  // Functions
  function_definition: constructFunctionDefinitionChunk,
  function_declaration: constructFunctionDefinitionChunk,
  function_item: constructFunctionDefinitionChunk,
  // Methods
  method_declaration: constructFunctionDefinitionChunk,
  // Properties
};

//这个函数检查某个节点的文本是否符合 maxChunkSize 限制，如果符合则直接返回该代码块。否则，它会通过递归方式折叠子节点。
async function maybeYieldChunk(
  node: SyntaxNode,
  code: string,
  maxChunkSize: number,
  root = true,
): Promise<ChunkWithoutID | undefined> {
  // Keep entire text if not over size
  if (root || node.type in collapsedNodeConstructors) {
    const tokenCount = await countTokensAsync(node.text);
    if (tokenCount < maxChunkSize) {
      return {
        content: node.text,
        startLine: node.startPosition.row,
        endLine: node.endPosition.row,
      };
    }
  }
  return undefined;
}

//该函数会遍历语法树节点，如果当前节点不满足大小限制，它会尝试使用折叠后的代码返回，并递归处理所有子节点。
async function* getSmartCollapsedChunks(
  node: SyntaxNode,
  code: string,
  maxChunkSize: number,
  root = true,
): AsyncGenerator<ChunkWithoutID> {
  const chunk = await maybeYieldChunk(node, code, maxChunkSize, root);
  if (chunk) {
    yield chunk;
    return;
  }
  // If a collapsed form is defined, use that
  if (node.type in collapsedNodeConstructors) {
    yield {
      content: await collapsedNodeConstructors[node.type](
        node,
        code,
        maxChunkSize,
      ),
      startLine: node.startPosition.row,
      endLine: node.endPosition.row,
    };
  }

  // Recurse (because even if collapsed version was shown, want to show the children in full somewhere)
  const generators = node.children.map((child) =>
    getSmartCollapsedChunks(child, code, maxChunkSize, false),
  );
  for (const generator of generators) {
    yield* generator;
  }
}

export async function* codeChunker(
  filepath: string,
  contents: string,
  maxChunkSize: number,
): AsyncGenerator<ChunkWithoutID> {
  if (contents.trim().length === 0) {
    return;
  }

  const parser = await getParserForFile(filepath);
  if (parser === undefined) {
    console.warn(`Failed to load parser for file ${filepath}: `);
    return;
  }

  const tree = parser.parse(contents);

  yield* getSmartCollapsedChunks(tree.rootNode, contents, maxChunkSize);
}
