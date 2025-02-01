import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../../index.js";
import { getBasename } from "../../util/index.js";
import { BaseContextProvider } from "../index.js";

class CurrentFileContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "currentFile",
    displayTitle: "Current File",
    description: "Reference the currently open file",
    type: "normal",
    renderInlineAs: "",
  };

  /**
   * 如果当前没有打开的文件，则返回空数组。如果有当前文件，则返回一个包含该文件信息的上下文项对象。
   * 返回的内容是当前文件的名称和文件内容，文件内容被格式化为代码块（通过 ``` 包裹）。
   * @param query 
   * @param extras 
   * @returns 
   */
  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const ide = extras.ide;
    const currentFile = await ide.getCurrentFile();
    if (!currentFile) {
      return [];
    }
    const contents = await ide.readFile(currentFile);
    return [
      {
        description: currentFile,
        content: `This is the currently open file:\n\n\`\`\`${getBasename(
          currentFile,
        )}\n${contents}\n\`\`\``,
        name: getBasename(currentFile),
      },
    ];
  }
}

export default CurrentFileContextProvider;
