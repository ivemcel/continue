---
title: Codebase Retrieval
description: Talk to your codebase
keywords: [talk, embeddings, reranker, codebase, experimental]
---

# Codebase retrieval

Continue indexes your codebase so that it can later automatically pull in the most relevant context from throughout your workspace. This is done via a combination of embeddings-based retrieval and keyword search. By default, all embeddings are calculated locally with `all-MiniLM-L6-v2` and stored locally in `~/.continue/index`.

Currently, the codebase retrieval feature is available as the "codebase" and "folder" context providers. You can use them by typing `@codebase` or `@folder` in the input box, and then asking a question. The contents of the input box will be compared with the embeddings from the rest of the codebase (or folder) to determine relevant files.

Here are some common use cases where it can be useful:

- Asking high-level questions about your codebase
  - "How do I add a new endpoint to the server?"
  - "Do we use VS Code's CodeLens feature anywhere?"
  - "Is there any code written already to convert HTML to markdown?"
- Generate code using existing samples as reference
  - "Generate a new React component with a date picker, using the same patterns as existing components"
  - "Write a draft of a CLI application for this project using Python's argparse"
  - "Implement the `foo` method in the `bar` class, following the patterns seen in other subclasses of `baz`.
- Use `@folder` to ask questions about a specific folder, increasing the likelihood of relevant results
  - "What is the main purpose of this folder?"
  - "How do we use VS Code's CodeLens API?"
  - Or any of the above examples, but with `@folder` instead of `@codebase`

Here are use cases where it is not useful:

- When you need the LLM to see _literally every_ file in your codebase
  - "Find everywhere where the `foo` function is called"
  - "Review our codebase and find any spelling mistakes"
- Refactoring
  - "Add a new parameter to the `bar` function and update usages"

## Configuration

There are a few options that let you configure the behavior of the codebase context provider. These can be set in `config.json`, and are the same for the codebase and folder context providers:

```json title="~/.continue/config.json"
{
  "contextProviders": [
    {
      "name": "codebase",
      "params": {
        "nRetrieve": 25,
        "nFinal": 5,
        "useReranking": true
      }
    }
  ]
}
```

### `nRetrieve`

Number of results to initially retrieve from vector database (default: 25)

### `nFinal`

Final number of results to use after re-ranking (default: 5)

### `useReranking`

Whether to use re-ranking, which will allow initial selection of `nRetrieve` results, then will use an LLM to select the top `nFinal` results (default: true)

## Embeddings providers

We also support other methods of generating embeddings, which can be configured with the `"embeddingsProvider"` property in `config.json`. We currently have built-in support for the following providers:

### Transformers.js (currently VS Code only)

[Transformers.js](https://huggingface.co/docs/transformers.js/index) is a JavaScript port of the popular [Transformers](https://huggingface.co/transformers/) library. It allows embeddings to be calculated locally in the browser (or in this case inside of the sidebar of your IDE). The model used is `all-MiniLM-L6-v2`, which is shipped alongside the Continue extension and generates embeddings of size 384.

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "transformers.js"
  }
}
```

### Ollama

[Ollama](https://ollama.ai) is the easiest way to get up and running with open-source language models. It provides an entirely local REST API for working with LLMs, including generating embeddings. We recommend using an embeddings model like `nomic-embed-text`:

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "ollama",
    "model": "nomic-embed-text",
    "apiBase": "http://localhost:11434" // optional, defaults to http://localhost:11434
  }
}
```

### Text Embeddings Inference

[Hugging Face Text Embeddings Inference](https://huggingface.co/docs/text-embeddings-inference/en/index) enables you to host your own embeddings endpoint. You can configure embeddings to use your endpoint as follows:

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "huggingface-tei",
    "apiBase": "http://localhost:8080"
  }
}
```

### Voyage AI

Voyage AI offers the best embeddings for code with their voyage-code-2 model. After obtaining an API key from [here](https://www.voyageai.com/), you can configure like this:

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "openai",
    "model": "voyage-code-2",
    "apiBase": "https://api.voyageai.com/v1/",
    "apiKey": "<VOYAGE_API_KEY>"
  }
}
```

### OpenAI

OpenAI's [embeddings](https://platform.openai.com/docs/guides/embeddings) are high dimensional embeddings that give great performance on both text and code.

#### Configuration for the `text-embedding-3-small` model

This is default. The `text-embedding-3-small` model offers an outstanding balance between performance and efficiency, suitable for a versatile range of applications.

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "openai",
    "model": "text-embedding-3-small",
    "apiBase": "<your custom OpenAI-compatible endpoint>", // optional, defaults to OpenAI's API
    "apiKey": "<OPENAI_API_KEY>"
  }
}
```

#### Configuration for the `text-embedding-3-large` model

For those requiring the highest level of embedding detail and precision, the `text-embedding-3-large` model is the better choice.

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "openai",
    "model": "text-embedding-3-large",
    "apiBase": "<your custom OpenAI-compatible endpoint>", // optional, defaults to OpenAI's API
    "apiKey": "<OPENAI_API_KEY>"
  }
}
```

#### Legacy Model Configuration

For certain scenarios, you may still find the `text-embedding-ada-002` model relevant. Below is the configuration example:

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "openai",
    "model": "text-embedding-ada-002",
    "apiBase": "<your custom OpenAI-compatible endpoint>", // optional, defaults to OpenAI's API
    "apiKey": "<OPENAI_API_KEY>"
  }
}
```

### Cohere

Configuration for the `embed-english-v3.0` model. This is the default.

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "cohere",
    "model": "embed-english-v3.0",
    "apiKey": "<COHERE_API_KEY>"
  }
}
```

See Cohere's [embeddings](https://docs.cohere.com/docs/embed-2) for available models. Only embedding models v3 and higher are supported.

### Gemini

Gemini's _Text Embedding_ model is optimized for creating embeddings with 768 dimensions for text of up to 2,048 tokens.

As of May 2024, the only available embedding model from Gemini is [`text-embedding-004`](https://ai.google.dev/gemini-api/docs/models/gemini#text-embedding-and-embedding).

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "gemini",
    "apiKey": "<GEMINI_API_KEY>"
  }
}
```

### Writing a custom `EmbeddingsProvider`

If you have your own API capable of generating embeddings, Continue makes it easy to write a custom `EmbeddingsProvider`. All you have to do is write a function that converts strings to arrays of numbers, and add this to your config in `config.ts`. Here's an example:

```ts title="~/.continue/config.ts"
export function modifyConfig(config: Config): Config {
  config.embeddingsProvider = {
    embed: (chunks: string[]) => {
      return Promise.all(
        chunks.map(async (chunk) => {
          const response = await fetch("https://example.com/embeddings", {
            method: "POST",
            body: JSON.stringify({ text: chunk }),
          });
          const data = await response.json();
          return data.embedding;
        }),
      );
    },
  };

  return config;
}
```

## Reranking providers

The reranker plays a crucial role in refining the results retrieved from your codebase. It processes the initial set of results obtained through embeddings-based retrieval, improving their relevance and accuracy for your queries.

Continue offers several reranking options: `cohere`, `voyage`, `llm`, `hugginface-tei`, and `free-trial`, which can be configured in `config.json`.

### Voyage AI

Voyage AI offers the best reranking model for code with their rerank-lite-1 model. After obtaining an API key from [here](https://www.voyageai.com/), you can configure like this:

```json title="~/.continue/config.json"
{
  "reranker": {
    "name": "voyage",
    "params": {
      "model": "rerank-lite-1",
      "apiKey": "<VOYAGE_API_KEY>"
    }
  }
}
```

### Cohere

See Cohere's documentation for rerankers [here](https://docs.cohere.com/docs/rerank-2).

```json title="~/.continue/config.json"
{
  "reranker": {
    "name": "cohere",
    "params": {
      "model": "rerank-english-v3.0",
      "apiKey": "<COHERE_API_KEY>"
    }
  }
}
```

### LLM

If you only have access to a single LLM, then you can use it as a reranker. This is discouraged unless truly necessary, because it will be much more expensive and still less accurate than any of the above models trained specifically for the task. Note that this will not work if you are using a local model, for example with Ollama, because too many parallel requests need to be made.

```json title="~/.continue/config.json"
{
  "reranker": {
    "name": "llm",
    "params": {
      "modelTitle": "My Model Title"
    }
  }
}
```

The `"modelTitle"` field must match one of the models in your "models" array in config.json.

### Text Embeddings Inference

[Hugging Face Text Embeddings Inference](https://huggingface.co/docs/text-embeddings-inference/en/index) enables you to host your own [reranker endpoint](https://huggingface.github.io/text-embeddings-inference/#/Text%20Embeddings%20Inference/rerank). You can configure your reranker as follows:

```json title="~/.continue/config.json"
{
  "reranker": {
    "name": "huggingface-tei",
    "params": {
        "apiBase": "http://localhost:8080",
        "truncate": true,
        "truncation_direction": "Right"
    }
  },
}
```

### Free Trial (Voyage AI)

Continue offers a free trial of Voyage AI's reranking model.

```json title="~/.continue/config.json"
{
  "reranker": {
    "name": "free-trial"
  }
}
```

## Ignore files during indexing

Continue respects `.gitignore` files in order to determine which files should not be indexed. If you'd like to exclude additional files, you can add them to a `.continueignore` file, which follows the exact same rules as `.gitignore`.

If you want to see exactly what files Continue has indexed, the metadata is stored in `~/.continue/index/index.sqlite`. You can use a tool like [DB Browser for SQLite](https://sqlitebrowser.org/) to view the `tag_catalog` table within this file.

If you need to force a refresh of the index, reload the VS Code window with `cmd/ctrl + shift + p` + "Reload Window".

## Response:

标题: 代码库检索  
描述: 与代码库对话  
关键词: \[对话, 嵌入, 重新排序, 代码库, 实验性\]

代码库检索
=====

Continue 会索引你的代码库，以便后续自动从你的工作空间中拉取最相关的上下文。这是通过基于嵌入的检索和关键词搜索的结合实现的。默认情况下，所有嵌入都在本地计算，使用 `all-MiniLM-L6-v2` 模型，并存储在 `~/.continue/index` 目录下。

目前，代码库检索功能可作为 “代码库” 和 “文件夹” 上下文提供者使用。你可以通过在输入框中输入 `@codebase` 或 `@folder`，然后提问。输入框中的内容将与代码库（或文件夹）中的嵌入进行比较，以确定相关文件。

以下是一些常见的使用场景：

*   提问关于代码库的高层问题
    *   “如何在服务器中添加一个新端点？”
    *   “我们是否在某处使用了 VS Code 的 CodeLens 特性？”
    *   “有没有现有的代码可以将 HTML 转换为 Markdown？”
*   使用现有的示例生成代码
    *   “生成一个新的 React 组件，带有日期选择器，采用现有组件的相同模式”
    *   “使用 Python 的 argparse 写一个 CLI 应用的草稿”
    *   “在 `bar` 类中实现 `foo` 方法，遵循其他 `baz` 子类中的模式”
*   使用 `@folder` 提问某个特定文件夹，增加获取相关结果的可能性
    *   “这个文件夹的主要用途是什么？”
    *   “我们如何使用 VS Code 的 CodeLens API？”
    *   或者是以上问题，使用 `@folder` 而不是 `@codebase`

以下是一些不适合使用的场景：

*   当你需要 LLM 查看 _代码库中的所有_ 文件时
    *   “查找所有调用了 `foo` 函数的地方”
    *   “检查我们的代码库并找出任何拼写错误”
*   重构
    *   “给 `bar` 函数添加一个新的参数并更新相关用法”

配置
--

有一些选项可以配置代码库上下文提供者的行为。这些选项可以在 `config.json` 中设置，并且对于代码库和文件夹上下文提供者是相同的：

```json
{
  "contextProviders": [
    {
      "name": "codebase",
      "params": {
        "nRetrieve": 25,
        "nFinal": 5,
        "useReranking": true
      }
    }
  ]
}
```

### `nRetrieve`

从向量数据库中初步检索的结果数量（默认：25）

### `nFinal`

重新排序后最终使用的结果数量（默认：5）

### `useReranking`

是否使用重新排序，首先选择 `nRetrieve` 个结果，然后使用 LLM 选择出前 `nFinal` 个最相关的结果（默认：true）

嵌入提供者
-----

我们还支持通过其他方法生成嵌入，你可以在 `config.json` 中通过 `"embeddingsProvider"` 属性进行配置。目前我们内置支持以下提供者：

### Transformers.js（目前仅支持 VS Code）

[Transformers.js](https://huggingface.co/docs/transformers.js/index) 是流行的 [Transformers](https://huggingface.co/transformers/) 库的 JavaScript 移植版。它允许在浏览器中本地计算嵌入（在这种情况下是在 IDE 的侧边栏中）。使用的模型是 `all-MiniLM-L6-v2`，该模型与 Continue 扩展一同提供，生成大小为 384 的嵌入。

```json
{
  "embeddingsProvider": {
    "provider": "transformers.js"
  }
}
```

### Ollama

[Ollama](https://ollama.ai) 是最简单的方式来使用开源语言模型。它提供了一个完全本地的 REST API 来处理 LLM，包括生成嵌入。我们推荐使用像 `nomic-embed-text` 这样的嵌入模型：

```json
{
  "embeddingsProvider": {
    "provider": "ollama",
    "model": "nomic-embed-text",
    "apiBase": "http://localhost:11434" // 可选，默认是 http://localhost:11434
  }
}
```

### 文本嵌入推理

[Hugging Face 文本嵌入推理](https://huggingface.co/docs/text-embeddings-inference/en/index) 使你能够托管自己的嵌入端点。你可以配置嵌入使用你的端点，方法如下：

```json
{
  "embeddingsProvider": {
    "provider": "huggingface-tei",
    "apiBase": "http://localhost:8080"
  }
}
```

### Voyage AI

Voyage AI 提供了最佳的代码嵌入，通过他们的 voyage-code-2 模型。在 [这里](https://www.voyageai.com/) 获取 API 密钥后，你可以进行如下配置：

```json
{
  "embeddingsProvider": {
    "provider": "openai",
    "model": "voyage-code-2",
    "apiBase": "https://api.voyageai.com/v1/",
    "apiKey": "<VOYAGE_API_KEY>"
  }
}
```

### OpenAI

OpenAI 的 [嵌入](https://platform.openai.com/docs/guides/embeddings) 是高维嵌入，适用于文本和代码。

#### `text-embedding-3-small` 模型的配置

这是默认模型。`text-embedding-3-small` 模型在性能和效率之间提供了出色的平衡，适用于各种应用。

```json
{
  "embeddingsProvider": {
    "provider": "openai",
    "model": "text-embedding-3-small",
    "apiBase": "<你的自定义 OpenAI 兼容端点>", // 可选，默认为 OpenAI 的 API
    "apiKey": "<OPENAI_API_KEY>"
  }
}
```

#### `text-embedding-3-large` 模型的配置

如果需要更高精度的嵌入，可以选择 `text-embedding-3-large` 模型。

```json
{
  "embeddingsProvider": {
    "provider": "openai",
    "model": "text-embedding-3-large",
    "apiBase": "<你的自定义 OpenAI 兼容端点>", // 可选，默认为 OpenAI 的 API
    "apiKey": "<OPENAI_API_KEY>"
  }
}
```

#### 旧版模型配置

对于某些情况，可能仍然需要使用 `text-embedding-ada-002` 模型。以下是配置示例：

```json
{
  "embeddingsProvider": {
    "provider": "openai",
    "model": "text-embedding-ada-002",
    "apiBase": "<你的自定义 OpenAI 兼容端点>", // 可选，默认为 OpenAI 的 API
    "apiKey": "<OPENAI_API_KEY>"
  }
}
```

### Cohere

`embed-english-v3.0` 模型的配置，这是默认选项。

```json
{
  "embeddingsProvider": {
    "provider": "cohere",
    "model": "embed-english-v3.0",
    "apiKey": "<COHERE_API_KEY>"
  }
}
```

请参阅 Cohere 的 [嵌入](https://docs.cohere.com/docs/embed-2) 获取更多可用模型。仅支持 v3 及以上的嵌入模型。

### Gemini

Gemini 的 _文本嵌入_ 模型优化了用于生成嵌入的 768 维度，适用于最多 2048 个标记的文本。

截至 2024 年 5 月，Gemini 唯一可用的嵌入模型是 [`text-embedding-004`](https://ai.google.dev/gemini-api/docs/models/gemini#text-embedding-and-embedding)。

```json
{
  "embeddingsProvider": {
    "provider": "gemini",
    "apiKey": "<GEMINI_API_KEY>"
  }
}
```

### 编写自定义 `EmbeddingsProvider`

如果你有自己的 API 可以生成嵌入，Continue 使得编写自定义 `EmbeddingsProvider` 变得简单。你只需要编写一个将字符串转换为数字数组的函数，然后将其添加到 `config.ts` 中。以下是一个示例：

```ts
export function modifyConfig(config: Config): Config {
  config.embeddingsProvider = {
    embed: (chunks: string[]) => {
      return Promise.all(
        chunks.map(async (chunk) => {
          const response = await fetch("https://example.com/embeddings", {
            method: "POST",
            body: JSON.stringify({ text: chunk }),
          });
          const data = await response.json();
          return data.embedding;
        }),
      );
    },
  };

  return config;
}
```

重新排序提供者
-------

重新排序器在优化从代码库检索的结果时起着关键作用。它处理通过嵌入检索得到的初始结果，从而提高查询的相关性和准确性。

Continue 提供了几种重新排序模型：`cohere`、`voyage`、`llm`、`hugginface-tei` 和 `free-trial`，这些可以在 `config.json` 中进行配置。

### Voyage AI

Voyage AI 提供了针对代码的最佳重新排序模型，使用他们的 `rerank-lite-1` 模型。获取 API 密钥后，你可以按如下方式进行配置：

```json
{
  "reranker": {
    "name": "voyage",
    "params": {
      "model": "rerank-lite-1",
      "apiKey": "<VOYAGE_API_KEY>"
    }
  }
}
```

### Cohere

参阅 Cohere 的 [重新排序文档](https://docs.cohere.com/docs/rerank-2)。

```json
{
  "reranker": {
    "name": "cohere",
    "params": {
      "model": "rerank-english-v3.0",
      "apiKey": "<COHERE_API_KEY>"
    }
  }
}
```

### LLM

如果你只有一个 LLM，那么可以将其用作重新排序器。不过，除非确实需要，否则不推荐这样做，因为这会非常昂贵，且比上述专门训练的模型精度低。请注意，如果你使用本地模型（例如 Ollama），此方法将不起作用，因为需要进行过多并行请求。

```json
{
  "reranker": {
    "name": "llm",
    "params": {
      "modelTitle": "My Model Title"
    }
  }
}
```

### 文本嵌入推理

[Hugging Face 文本嵌入推理](https://huggingface.co/docs/text-embeddings-inference/en/index) 使你能够托管自己的 [重新排序端点](https://huggingface.github.io/text-embeddings-inference/#/Text%20Embeddings%20Inference/rerank)。你可以如下配置重新排序器：

```json
{
  "reranker": {
    "name": "huggingface-tei",
    "params": {
        "apiBase": "http://localhost:8080",
        "truncate": true,
        "truncation_direction": "Right"
    }
  },
}
```

### 免费试用（Voyage AI）

Continue 提供 Voyage AI 重新排序模型的免费试用。

```json
{
  "reranker": {
    "name": "free-trial"
  }
}
```

在索引时忽略文件
--------

Continue 会尊重 `.gitignore` 文件，来决定哪些文件不应被索引。如果你想排除更多文件，可以在 `.continueignore` 文件中添加它们，规则与 `.gitignore` 文件相同。

如果你想查看 Continue 已索引的文件，元数据存储在 `~/.continue/index/index.sqlite` 文件中。你可以使用类似 [DB Browser for SQLite](https://sqlitebrowser.org/) 的工具查看该文件中的 `tag_catalog` 表。

如果你需要强制刷新索引，可以通过 `cmd/ctrl + shift + p` + "Reload Window" 来重新加载 VS Code 窗口。
