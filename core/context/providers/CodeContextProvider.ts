// 从 "../../index.js" 导入必要的类型和接口
import {
  ContextItem, // 上下文项类型
  ContextProviderDescription, // 上下文提供者描述类型
  ContextProviderExtras, // 上下文提供者附加信息类型
  ContextSubmenuItem, // 上下文子菜单项类型
  LoadSubmenuItemsArgs, // 加载子菜单项时的参数类型
} from "../../index.js";

// 从 "../../indexing/CodeSnippetsIndex.js" 导入 CodeSnippetsCodebaseIndex 类，用于获取代码片段数据
import { CodeSnippetsCodebaseIndex } from "../../indexing/CodeSnippetsIndex.js";

// 从 "../index.js" 导入 BaseContextProvider 基类
import { BaseContextProvider } from "../index.js";

// 定义常量 MAX_SUBMENU_ITEMS，用于限制最大子菜单项数目
const MAX_SUBMENU_ITEMS = 10_000;

class CodeContextProvider extends BaseContextProvider {
  // 静态属性 description 提供了当前上下文提供者的描述信息
  static description: ContextProviderDescription = {
    title: "code", // 上下文提供者的标题
    displayTitle: "Code", // 显示用标题
    description: "Type to search", // 提供者的描述，表示输入查询来进行搜索
    type: "submenu", // 上下文类型，表示是一个子菜单类型
  };

  // 异步方法 getContextItems 用于根据查询和附加信息获取上下文项
  async getContextItems(
    query: string, // 查询字符串，假设是由 loadSubmenuItems 返回的 id
    extras: ContextProviderExtras, // 上下文提供者附加信息
  ): Promise<ContextItem[]> { // 返回一个 Promise，解析为 ContextItem 数组
    // 假设查询（query）是由 loadSubmenuItems 返回的 id，调用 CodeSnippetsCodebaseIndex 获取对应的上下文项
    return [
      await CodeSnippetsCodebaseIndex.getForId(Number.parseInt(query, 10)),
    ];
  }

  // 异步方法 loadSubmenuItems 用于加载子菜单项
  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs, // 加载子菜单项的参数
  ): Promise<ContextSubmenuItem[]> { 
    // TODO: 动态加载子菜单项，而不是一次性加载所有内容到内存
    // 获取 "codeSnippets" 标签的所有标签
    const tags = await args.ide.getTags("codeSnippets");

    // 根据每个标签加载对应的代码片段列表
    const snippets = await Promise.all(
      tags.map((tag) => CodeSnippetsCodebaseIndex.getAll(tag)),
    );

    // 创建一个空数组用于存储子菜单项
    const submenuItems: ContextSubmenuItem[] = [];

    // 将每个标签对应的代码片段列表加入到子菜单项中，但最多不超过 MAX_SUBMENU_ITEMS 个项
    for (const snippetList of snippets.slice(-MAX_SUBMENU_ITEMS)) {
      submenuItems.push(...snippetList);
    }

    // 返回加载的子菜单项
    return submenuItems;
  }
}

// 导出 CodeContextProvider 类供其他模块使用
export default CodeContextProvider;
