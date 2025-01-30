/**
这段代码提供了一个基于滑动窗口的匹配算法，旨在根据给定的窗口大小（windowSize）和光标附近的文本（windowAroundCursor）来对一组文件进行相似度比较，从而生成最匹配的代码片段。

slidingWindow 函数：这个生成器函数用于将输入文本按行分割并滑动生成指定大小的窗口。每个窗口包含一定数量的行，并且总字符数不会超过指定的 windowSize。
输入：
  content：输入的代码内容，以字符串形式传入。
  windowSize：滑动窗口的大小（以字符为单位）。
输出：返回一个生成器，每次迭代返回一个窗口内容（字符串形式），它是按行分隔的，并且每个窗口的字符数不超过 windowSize。
这个方法非常适用于在大规模代码库中进行局部匹配，而不是一次性处理整个文件内容。

slidingWindowMatcher 函数：这是核心函数，用于从最近的文件集合（recentFiles）中选择与光标周围文本（windowAroundCursor）最相似的代码片段。它使用滑动窗口逐步滑动文件内容，并根据相似度排序，从中选择最相关的代码片段。
输入：
  recentFiles：最近访问过的文件数组，每个文件包含其路径、内容、范围等信息。
  windowAroundCursor：光标附近的文本窗口，作为基准进行匹配。
  topN：需要返回的最匹配的代码片段数量。
  windowSize：滑动窗口的大小（以字符为单位）。
输出：返回一个按相似度排序的代码片段数组，最多返回 topN 个最相关的代码片段。
主要步骤
滑动窗口：对于每个文件，使用 slidingWindow 函数生成多个滑动窗口。
相似度计算：计算每个滑动窗口与 windowAroundCursor 之间的 Jaccard 相似度。
插入排序：将计算出的代码片段按照相似度进行排序。使用插入排序将每个窗口的匹配按从高到低的顺序插入 topMatches 数组中。
限制结果数：如果超过了 topN 个匹配项，移除最不相关的匹配项。
返回结果：返回最匹配的代码片段。
 */
import { RangeInFileWithContents } from "../commands/util.js";
import { AutocompleteSnippet, jaccardSimilarity } from "./ranking.js";

function* slidingWindow(
  content: string,
  windowSize: number,
): Generator<string> {
  const lines = content.split("\n");

  let charCount = 0;
  let currWindowLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (charCount + lines[i].length >= windowSize) {
      yield currWindowLines.join("\n");
      currWindowLines = [lines[i]];
      charCount = 0;
    } else {
      currWindowLines.push(lines[i]);
    }
    charCount += lines[i].length;
  }

  if (currWindowLines.length > 0) {
    yield currWindowLines.join("\n");
  }
}

/**
 * Match by similarity over sliding windows of recent documents.
 * @param recentFiles
 * @param prefix
 * @param suffix
 */
export async function slidingWindowMatcher(
  recentFiles: RangeInFileWithContents[],
  windowAroundCursor: string,
  topN: number,
  windowSize: number,
): Promise<AutocompleteSnippet[]> {
  // Sorted lowest similarity to highest
  const topMatches: Required<AutocompleteSnippet>[] = [];

  for (const { filepath, contents, range } of recentFiles) {
    for (const window of slidingWindow(contents, windowSize)) {
      const score = jaccardSimilarity(window, windowAroundCursor);

      // Insertion sort
      let i = -1;
      while (++i < topMatches.length && score > topMatches[i].score) {}
      topMatches.splice(i + 1, 0, { filepath, contents, score, range });
      if (topMatches.length > topN) {
        topMatches.shift();
      }
    }
  }

  // TODO: convert the arbitrary window frame to some whole AST node?
  return topMatches;
}
