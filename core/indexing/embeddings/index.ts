/**
 * 这段代码的主要作用是管理多个类型的 embeddings 提供者（嵌入提供者），并将它们集中管理，便于在代码中进行动态选择和使用。
 */
import { EmbeddingsProviderName } from "../../index.js";
import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider.js";
import CohereEmbeddingsProvider from "./CohereEmbeddingsProvider.js";
import ContinueProxyEmbeddingsProvider from "./ContinueProxyEmbeddingsProvider.js";
import DeepInfraEmbeddingsProvider from "./DeepInfraEmbeddingsProvider.js";
import FreeTrialEmbeddingsProvider from "./FreeTrialEmbeddingsProvider.js";
import GeminiEmbeddingsProvider from "./GeminiEmbeddingsProvider.js";
import HuggingFaceTEIEmbeddingsProvider from "./HuggingFaceTEIEmbeddingsProvider.js";
import OllamaEmbeddingsProvider from "./OllamaEmbeddingsProvider.js";
import OpenAIEmbeddingsProvider from "./OpenAIEmbeddingsProvider.js";
import TransformersJsEmbeddingsProvider from "./TransformersJsEmbeddingsProvider.js";

type EmbeddingsProviderConstructor = new (
  ...args: any[]
) => BaseEmbeddingsProvider;

export const allEmbeddingsProviders: Record<
  EmbeddingsProviderName,
  EmbeddingsProviderConstructor
> = {
  ollama: OllamaEmbeddingsProvider,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  "transformers.js": TransformersJsEmbeddingsProvider,
  openai: OpenAIEmbeddingsProvider,
  cohere: CohereEmbeddingsProvider,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  "free-trial": FreeTrialEmbeddingsProvider,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  "huggingface-tei": HuggingFaceTEIEmbeddingsProvider,
  gemini: GeminiEmbeddingsProvider,
  "continue-proxy": ContinueProxyEmbeddingsProvider,
  deepinfra: DeepInfraEmbeddingsProvider,
};
