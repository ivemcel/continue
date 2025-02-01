import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../../index.js";
import { BaseContextProvider } from "../index.js";
import { retrieveContextItemsFromEmbeddings } from "../retrieval/retrieval.js";

class CodebaseContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "codebase",
    displayTitle: "Codebase",
    description: "Automatically find relevant files",
    type: "normal",
    renderInlineAs: "",
  };

  // 异步方法 getContextItems 用于根据查询和附加信息获取上下文项
  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    // 调用 retrieveContextItemsFromEmbeddings 函数来获取上下文项
    return retrieveContextItemsFromEmbeddings(extras, this.options, undefined);
  }
  async load(): Promise<void> {}
}

export default CodebaseContextProvider;
