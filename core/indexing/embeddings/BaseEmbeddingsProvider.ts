/**
 * 这段代码定义了一个抽象类 BaseEmbeddingsProvider，并提供了一个接口 IBaseEmbeddingsProvider，
 * 两者都用于构建和管理一个 "Embeddings Provider"（嵌入模型提供者）。
 * 嵌入模型通常用于将文本或其他数据转换成数字化的向量表示（embeddings），以便进行进一步的处理，例如在机器学习模型中进行训练或检索。
 */
import {
  EmbedOptions,
  EmbeddingsProvider,
  EmbeddingsProviderName,
  FetchFunction,
} from "../../index.js";

import { MAX_CHUNK_SIZE } from "../../llm/constants.js";

export interface IBaseEmbeddingsProvider extends EmbeddingsProvider {
  options: EmbedOptions;
  fetch: FetchFunction;
  defaultOptions?: EmbedOptions;
  maxBatchSize?: number;
}

abstract class BaseEmbeddingsProvider implements IBaseEmbeddingsProvider {
  static maxBatchSize: IBaseEmbeddingsProvider["maxBatchSize"];
  static defaultOptions: IBaseEmbeddingsProvider["defaultOptions"];

  static providerName: EmbeddingsProviderName;
  get providerName(): EmbeddingsProviderName {
    return (this.constructor as typeof BaseEmbeddingsProvider).providerName;
  }

  options: IBaseEmbeddingsProvider["options"];
  fetch: IBaseEmbeddingsProvider["fetch"];
  id: IBaseEmbeddingsProvider["id"];

  constructor(
    options: IBaseEmbeddingsProvider["options"],
    fetch: IBaseEmbeddingsProvider["fetch"],
  ) {
    // Overwrite default options with any runtime options
    this.options = {
      ...(this.constructor as typeof BaseEmbeddingsProvider).defaultOptions,
      ...options,
    };
    this.fetch = fetch;
    // Include the `max_chunk_size` if it is not the default, since we need to create other indices for different chunk_sizes
    if (this.maxChunkSize !== MAX_CHUNK_SIZE) {
      this.id = `${this.constructor.name}::${this.options.model}::${this.maxChunkSize}`;
    } else {
      this.id = `${this.constructor.name}::${this.options.model}`;
    }
  }
  defaultOptions?: EmbedOptions | undefined;
  maxBatchSize?: number | undefined;

  abstract embed(chunks: string[]): Promise<number[][]>;

  get maxChunkSize(): number {
    return this.options.maxChunkSize ?? MAX_CHUNK_SIZE;
  }

  static getBatchedChunks(chunks: string[]): string[][] {
    if (!this.maxBatchSize) {
      console.warn(
        `${this.getBatchedChunks.name} should only be called if 'maxBatchSize' is defined`,
      );

      return [chunks];
    }

    if (chunks.length > this.maxBatchSize) {
      return [chunks];
    }

    const batchedChunks = [];

    for (let i = 0; i < chunks.length; i += this.maxBatchSize) {
      const batchSizedChunk = chunks.slice(i, i + this.maxBatchSize);
      batchedChunks.push(batchSizedChunk);
    }

    return batchedChunks;
  }
}

export default BaseEmbeddingsProvider;
