// 从 "../../index.js" 导入必要的类型和接口
import {
  ContextItem, // 上下文项类型
  ContextProviderDescription, // 上下文提供者描述类型
  ContextProviderExtras, // 上下文提供者附加信息类型
} from "../../index.js";

// 从 "../index.js" 导入 BaseContextProvider 基类
import { BaseContextProvider } from "../index.js";

// DiffContextProvider 类，用于提供当前的 Git diff 上下文项
class DiffContextProvider extends BaseContextProvider {
  // 静态属性 description 描述了当前上下文提供者的基本信息
  static description: ContextProviderDescription = {
    title: "diff", // 上下文提供者的标题
    displayTitle: "Git Diff", // 显示标题
    description: "Reference the current git diff", // 描述，表示引用当前 Git diff
    type: "normal", // 上下文类型，表示这是一个普通的上下文提供者
  };

  // 异步方法 getContextItems，获取当前的 Git diff 并返回上下文项
  async getContextItems(
    query: string, // 查询字符串，当前没有用到
    extras: ContextProviderExtras, // 上下文提供者附加信息
  ): Promise<ContextItem[]> { // 返回一个 Promise，解析为 ContextItem 数组
    // 获取当前 Git diff（假设 extras.ide 是 IDE 环境的接口，提供了 git diff 方法）
    const diff = await extras.ide.getDiff();
    
    // 返回上下文项
    return [
      {
        description: "The current git diff", // 上下文项的描述，表示当前的 Git diff
        content:
          diff.trim() === "" // 如果没有差异，提示没有当前的更改
            ? "Git shows no current changes."
            : `\`\`\`git diff\n${diff}\n\`\`\``, // 如果有差异，返回格式化的 diff 内容
        name: "Git Diff", // 上下文项的名称
      },
    ];
  }
}

// 导出 DiffContextProvider 类供其他模块使用
export default DiffContextProvider;
