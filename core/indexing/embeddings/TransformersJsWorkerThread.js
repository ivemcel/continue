/**
 * 这段代码在 Node.js 环境中使用了 worker_threads 来处理异步嵌入计算任务。它主要包括以下几个部分：
 * 环境设置和模型加载：使用 @xenova/transformers 库来处理 Transformer 模型的嵌入生成。
 * Worker 线程通信：通过 worker_threads 的 parentPort 实现父进程和子进程之间的消息传递。
 */

import path from "node:path";
import {
  env,
  pipeline,
} from "../../vendor/node_modules/@xenova/transformers/types/transformers";
import TransformersJsEmbeddingsProvider from "./TransformersJsEmbeddingsProvider";
const { parentPort } = require("node:worker_threads");

env.allowLocalModels = true;
env.allowRemoteModels = false;
if (typeof window === "undefined") {
  // The embeddings provider should just never be called in the browser
  env.localModelPath = path.join(__dirname, "..", "models");
}

class EmbeddingsPipeline {
  static task = "feature-extraction";
  static model = TransformersJsEmbeddingsProvider.ModelName;
  static instance = null;

  static async getInstance() {
    if (EmbeddingsPipeline.instance === null) {
      EmbeddingsPipeline.instance = await pipeline(
        EmbeddingsPipeline.task,
        EmbeddingsPipeline.model,
      );
    }

    return EmbeddingsPipeline.instance;
  }
}

parentPort.on("message", async (chunks) => {
  try {
    const extractor = await EmbeddingsPipeline.getInstance();

    if (!extractor) {
      throw new Error("TransformerJS embeddings pipeline is not initialized");
    }

    const outputs = [];
    for (
      let i = 0;
      i < chunks.length;
      i += TransformersJsEmbeddingsProvider.maxGroupSize
    ) {
      const chunkGroup = chunks.slice(
        i,
        i + TransformersJsEmbeddingsProvider.maxGroupSize,
      );
      const output = await extractor(chunkGroup, {
        pooling: "mean",
        normalize: true,
      });
      outputs.push(...output.tolist());
    }

    parentPort.postMessage(outputs);
  } catch (error) {
    parentPort.postMessage({ error: error.message });
  }
});
