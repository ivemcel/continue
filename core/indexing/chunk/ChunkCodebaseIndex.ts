/**
 * 这段 TypeScript 代码定义了一个 ChunkCodebaseIndex 类，用于将代码库中的文件内容分块，并将分块的结果保存到 SQLite 数据库中。
 * 同时，代码也处理了不同的操作，如标记、删除和更新标签等。
 */

// 导入需要的模块和类型
import { RunResult } from "sqlite3";  // sqlite3 的 RunResult 类型，用于数据库操作
import { IContinueServerClient } from "../../continueServer/interface.js";  // 与 ContinueServer 交互的客户端接口
import { Chunk, IndexTag, IndexingProgressUpdate } from "../../index.js";  // Chunk 类型（分块），IndexTag 和 IndexingProgressUpdate 类型
import { getBasename } from "../../util/index.js";  // 获取文件基本名的函数
import { getLanguageForFile } from "../../util/treeSitter.js";  // 获取文件语言类型的函数
import { DatabaseConnection, SqliteDb, tagToString } from "../refreshIndex.js";  // 数据库连接和工具函数
import {
  IndexResultType,
  MarkCompleteCallback,
  PathAndCacheKey,
  RefreshIndexResults,
  type CodebaseIndex,
} from "../types.js";  // 定义了一些索引结果相关的类型
import { chunkDocument } from "./chunk.js";  // 文档分块的工具函数

// 定义 ChunkCodebaseIndex 类，实现了 CodebaseIndex 接口
export class ChunkCodebaseIndex implements CodebaseIndex {
  relativeExpectedTime: number = 1;  // 预期时间的初始值，可能与某种进度或性能指标相关
  static artifactId = "chunks";  // 固定的 artifactId
  artifactId: string = ChunkCodebaseIndex.artifactId;  // 实例化时的 artifactId

  // 构造函数，初始化时传入 readFile（读取文件的函数）、continueServerClient（与服务器交互的客户端）、maxChunkSize（最大分块大小）
  constructor(
    private readonly readFile: (filepath: string) => Promise<string>,  // 读取文件内容的函数
    private readonly continueServerClient: IContinueServerClient,  // ContinueServer 客户端，用于访问远程缓存
    private readonly maxChunkSize: number,  // 最大分块大小
  ) {
    this.readFile = readFile;  // 赋值
  }

  // 异步生成器函数，负责处理文件分块的更新逻辑
  async *update(
    tag: IndexTag,  // 索引标签
    results: RefreshIndexResults,  // 索引结果
    markComplete: MarkCompleteCallback,  // 完成标记的回调
    repoName: string | undefined,  // 可选的仓库名
  ): AsyncGenerator<IndexingProgressUpdate, any, unknown> {  
    const db = await SqliteDb.get();  // 获取 SQLite 数据库连接
    await this.createTables(db);  // 确保表已经创建

    const tagString = tagToString(tag);  // 将 tag 转换为字符串

    // 检查远程缓存
    if (this.continueServerClient.connected) {
      try {
        const keys = results.compute.map(({ cacheKey }) => cacheKey);  // 获取需要计算的文件的 cacheKey
        const resp = await this.continueServerClient.getFromIndexCache(
          keys,
          "chunks",  // 指定获取的类型是 "chunks"
          repoName,  // 仓库名
        );

        // 从缓存中获取文件的 chunks 并插入数据库
        for (const [cacheKey, chunks] of Object.entries(resp.files)) {
          await this.insertChunks(db, tagString, chunks);  // 插入 chunks
        }

        // 过滤掉已经从缓存中获取的文件
        results.compute = results.compute.filter(
          (item) => !resp.files[item.cacheKey],
        );
      } catch (e) {
        console.error("Failed to fetch from remote cache: ", e);  // 如果获取缓存失败，输出错误
      }
    }

    let accumulatedProgress = 0;  // 累计的进度

    // 更新进度描述
    yield {
      desc: `Chunking ${results.compute.length} ${this.formatListPlurality("file", results.compute.length)}`,
      status: "indexing",
      progress: accumulatedProgress,
    };

    // 计算文件的 chunks 并插入数据库
    const chunks = await this.computeChunks(results.compute);
    await this.insertChunks(db, tagString, chunks);

    // 对每个操作（添加标签、移除标签、删除）进行处理
    for (const item of results.addTag) {
      await db.run(
        `
        INSERT INTO chunk_tags (chunkId, tag)
        SELECT id, ? FROM chunks
        WHERE cacheKey = ? AND path = ?
      `,
        [tagString, item.cacheKey, item.path],
      );
      markComplete([item], IndexResultType.AddTag);  // 标记完成
      accumulatedProgress += 1 / results.addTag.length / 4;  // 更新进度
      yield {
        progress: accumulatedProgress,
        desc: `Adding ${getBasename(item.path)}`,
        status: "indexing",
      };
    }

    // 移除标签
    for (const item of results.removeTag) {
      await db.run(
        `
        DELETE FROM chunk_tags
        WHERE tag = ?
          AND chunkId IN (
            SELECT id FROM chunks
            WHERE cacheKey = ? AND path = ?
          )
      `,
        [tagString, item.cacheKey, item.path],
      );
      markComplete([item], IndexResultType.RemoveTag);
      accumulatedProgress += 1 / results.removeTag.length / 4;
      yield {
        progress: accumulatedProgress,
        desc: `Removing ${getBasename(item.path)}`,
        status: "indexing",
      };
    }

    // 删除操作
    for (const item of results.del) {
      const deleted = await db.run("DELETE FROM chunks WHERE cacheKey = ?", [
        item.cacheKey,
      ]);
      await db.run("DELETE FROM chunk_tags WHERE chunkId = ?", [
        deleted.lastID,
      ]);
      markComplete([item], IndexResultType.Delete);
      accumulatedProgress += 1 / results.del.length / 4;
      yield {
        progress: accumulatedProgress,
        desc: `Removing ${getBasename(item.path)}`,
        status: "indexing",
      };
    }
  }

  // 创建数据库表
  private async createTables(db: DatabaseConnection) {
    await db.exec("PRAGMA journal_mode=WAL;");  // 设置 WAL 模式以提高性能

    // 创建 chunks 表
    await db.exec(`CREATE TABLE IF NOT EXISTS chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cacheKey TEXT NOT NULL,
      path TEXT NOT NULL,
      idx INTEGER NOT NULL,
      startLine INTEGER NOT NULL,
      endLine INTEGER NOT NULL,
      content TEXT NOT NULL
    )`);

    // 创建 chunk_tags 表
    await db.exec(`CREATE TABLE IF NOT EXISTS chunk_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tag TEXT NOT NULL,
        chunkId INTEGER NOT NULL,
        FOREIGN KEY (chunkId) REFERENCES chunks (id)
    )`);
  }

  // 将路径和缓存键映射到文件块
  private async packToChunks(pack: PathAndCacheKey): Promise<Chunk[]> {
    const contents = await this.readFile(pack.path);  // 读取文件内容
    if (!contents.length) {
      return [];  // 如果文件为空，则返回空块
    }
    const chunks: Chunk[] = [];
    const chunkParams = {
      filepath: pack.path,
      contents,
      maxChunkSize: this.maxChunkSize,
      digest: pack.cacheKey,
    };

    // 生成文件块
    for await (const c of chunkDocument(chunkParams)) {
      chunks.push(c);
    }
    return chunks;
  }

  // 计算多个文件的块
  private async computeChunks(paths: PathAndCacheKey[]): Promise<Chunk[]> {
    const chunkLists = await Promise.all(paths.map(p => this.packToChunks(p)));  // 并行处理每个文件
    return chunkLists.flat();  // 合并所有块
  }

  // 插入文件块到数据库
  private async insertChunks(db: DatabaseConnection, tagString: string, chunks: Chunk[]) {
    await new Promise<void>((resolve, reject) => {
      db.db.serialize(() => {
        db.db.exec("BEGIN", (err: Error | null) => {
          if (err) {
            reject(new Error("error creating transaction", { cause: err }));
          }
        });
        const chunksSQL = "INSERT INTO chunks (cacheKey, path, idx, startLine, endLine, content) VALUES (?, ?, ?, ?, ?, ?)";
        chunks.map(c => {
          db.db.run(chunksSQL, [c.digest, c.filepath, c.index, c.startLine, c.endLine, c.content], (result: RunResult, err: Error) => {
            if (err) {
              reject(new Error("error inserting into chunks table", { cause: err }));
            }
          });

          const chunkTagsSQL = "INSERT INTO chunk_tags (chunkId, tag) VALUES (last_insert_rowid(), ?)";
          db.db.run(chunkTagsSQL, [ tagString ], (result: RunResult, err: Error) => {
            if (err) {
              reject(new Error("error inserting into chunk_tags table", { cause: err }));
            }
          });
        });
        db.db.exec("COMMIT", (err: Error | null) => {
          if (err) {
            reject(new Error("error while committing insert chunks transaction", { cause: err }));
          }
        });
        resolve();
      });
    });
  }

  // 格式化词语的复数形式
  private formatListPlurality(word: string, length: number): string {
    return length <= 1 ? word : `${word}s`;
  }
}
