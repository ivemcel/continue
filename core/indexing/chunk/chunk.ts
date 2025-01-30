// 导入所需的模块和类型
import { Chunk, ChunkWithoutID } from "../../index.js";  // Chunk 和 ChunkWithoutID 类型
import { countTokens, countTokensAsync } from "../../llm/countTokens.js";  // 计算 token 数的函数
import { supportedLanguages } from "../../util/treeSitter.js";  // 支持的编程语言列表
import { basicChunker } from "./basic.js";  // 基本的文本分块器
import { codeChunker } from "./code.js";  // 代码文本分块器

/**
 * 该文件代码包含了处理文档内容的多个函数和生成器。其核心功能是将一个文档内容分割成多个块，并且为每个块添加一些附加信息（例如索引、文件路径、摘要）。
 */

// 定义用于 chunk 文档的参数类型
export type ChunkDocumentParam = {
  filepath: string;  // 文件路径
  contents: string;  // 文件内容
  maxChunkSize: number;  // 每个块的最大大小
  digest: string;  // 摘要信息
};

// 这个生成器函数处理文档内容的分块，不带 ID
async function* chunkDocumentWithoutId(
  filepath: string,    // 文件路径
  contents: string,    // 文件内容
  maxChunkSize: number, // 最大块大小
): AsyncGenerator<ChunkWithoutID> {  // 返回异步生成器，每次生成一个 ChunkWithoutID
  // 如果内容为空或仅包含空格，则直接返回
  if (contents.trim() === "") {
    return;
  }

  // 获取文件扩展名（假设文件以 . 结尾）
  const segs = filepath.split(".");
  const ext = segs[segs.length - 1];

  // 如果扩展名是支持的编程语言类型，则尝试使用 `codeChunker` 进行分块
  if (ext in supportedLanguages) {
    try {
      // 使用 `codeChunker` 处理代码文件，分块
      for await (const chunk of codeChunker(filepath, contents, maxChunkSize)) {
        yield chunk;  // 按顺序生成每个分块
      }
      return;  // 如果分块成功，直接返回
    } catch (e) {
      // 如果 `codeChunker` 失败，则回退到 `basicChunker`
      // console.error(`Failed to parse ${filepath}: `, e); // 可以启用调试日志
      // 处理错误后，继续执行
    }
  }

  // 如果文件不是支持的编程语言或 `codeChunker` 失败，使用 `basicChunker` 进行分块
  yield* basicChunker(contents, maxChunkSize);  // 使用基本的文本分块器
}

// 这是主函数 `chunkDocument`，处理文档并生成包含 ID 的块
export async function* chunkDocument({
  filepath,    // 文件路径
  contents,    // 文件内容
  maxChunkSize, // 最大块大小
  digest,      // 摘要信息
}: ChunkDocumentParam): AsyncGenerator<Chunk> {  // 返回异步生成器，每次生成一个 Chunk
  let index = 0;  // 分块的索引
  const chunkPromises: Promise<Chunk | undefined>[] = [];  // 存储每个分块的 Promise

  // 遍历 `chunkDocumentWithoutId` 生成的每个块
  for await (const chunkWithoutId of chunkDocumentWithoutId(
    filepath,
    contents,
    maxChunkSize,
  )) {
    // 对每个分块进行处理，验证其 token 数，并创建 Chunk 对象
    chunkPromises.push(new Promise(async (resolve) => {
      // 如果块的 token 数超过最大块大小，则警告并返回 undefined
      if (await countTokensAsync(chunkWithoutId.content) > maxChunkSize) {
        console.warn(
          `Chunk with more than ${maxChunkSize} tokens constructed: `,
          filepath,
          countTokens(chunkWithoutId.content),
        );
        return resolve(undefined);  // 如果分块过大，跳过该分块
      }
      // 如果 token 数合适，创建一个包含 ID 的 Chunk 对象
      resolve({
        ...chunkWithoutId,  // 保留原块内容和行信息
        digest,  // 附加的摘要信息
        index,   // 分块的索引
        filepath, // 文件路径
      });
    }));
    index++;  // 增加索引，处理下一个分块
  }

  // 等待所有 Promise 完成并生成相应的 Chunk
  for await (const chunk of chunkPromises) {
    if (!chunk) {
      continue;  // 跳过 undefined 的块（即 token 数超大的块）
    }
    yield chunk;  // 生成符合要求的 Chunk
  }
}
