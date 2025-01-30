// 导入 ChunkWithoutID 类型和 countTokensAsync 函数
import { ChunkWithoutID } from "../../index.js";
import { countTokensAsync } from "../../llm/countTokens.js";

/**
 * 功能是将一个长文本按最大 chunk size 分割成多个块，并为每个块记录起始行和结束行信息。
 * 
 * 基本的文本分块器，将输入的内容分割成多个小块，每个块的大小不超过 `maxChunkSize`，并且记录每个块的起始行和结束行。
 * 
 * @param contents - 需要分割的文本内容，通常是一个长字符串。
 * @param maxChunkSize - 每个块的最大大小，单位为 token 数。
 * @returns 一个异步生成器 (AsyncGenerator)，每次生成一个 ChunkWithoutID 对象，包含分块后的内容和相关的行信息。
 */
export async function* basicChunker(
  contents: string,    // 输入的文本内容
  maxChunkSize: number,  // 最大分块大小
): AsyncGenerator<ChunkWithoutID> {  // 异步生成器，生成 ChunkWithoutID 类型的对象
  // 如果输入内容为空或只包含空格，则直接返回
  if (contents.trim().length === 0) {
    return;
  }

  // 初始化分块内容、当前分块的 token 数、当前起始行和当前行的变量
  let chunkContent = "";  
  let chunkTokens = 0;  
  let startLine = 0;   
  let currLine = 0;    

  // 计算每一行的 token 数，使用 `countTokensAsync` 函数异步获取每一行的 token 数
  const lineTokens = await Promise.all(contents.split("\n").map(async l => {
    return {
      line: l,  // 当前行的文本
      tokenCount: await countTokensAsync(l),  // 当前行的 token 数
    };
  }));

  // 遍历每一行的 token 信息
  for (const lt of lineTokens) {
    // 如果当前块的 token 数加上当前行的 token 数超过了最大块大小，则分割并生成一个新块
    if (chunkTokens + lt.tokenCount > maxChunkSize - 5) {  // 留出 5 个 token 作为分隔符
      yield { 
        content: chunkContent,       // 当前块的内容
        startLine,                   // 当前块的起始行
        endLine: currLine - 1,       // 当前块的结束行
      };

      // 重置分块内容和 token 数，为下一块做准备
      chunkContent = "";
      chunkTokens = 0;
      startLine = currLine;  // 更新新的起始行
    }

    // 如果当前行的 token 数小于最大块大小，则将其加入当前块
    if (lt.tokenCount < maxChunkSize) {
      chunkContent += `${lt.line}\n`;  // 将当前行加入块内容
      chunkTokens += lt.tokenCount + 1;  // 更新当前块的 token 数（+1 是为了考虑换行符的 token）
    }

    currLine++;  // 增加当前行号
  }

  // 最后，返回剩余的内容作为一个块，包含起始行和结束行信息
  yield {
    content: chunkContent,
    startLine,  // 该块的起始行
    endLine: currLine - 1,  // 该块的结束行（当前行号减 1）
  };
}
