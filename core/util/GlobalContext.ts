// 引入 Node.js 文件系统模块（fs）和其他模块
import fs from "node:fs";
// 引入获取全局上下文文件路径的函数
import { getGlobalContextFilePath } from "./paths.js";
// 引入 EmbeddingsProvider 类，提供嵌入提供者的信息
import { EmbeddingsProvider } from "../index.js";

// 定义 GlobalContextType 类型，表示全局上下文数据的结构
export type GlobalContextType = {
  // 控制索引是否暂停的标志
  indexingPaused: boolean;
  // 当前选中的自动完成模型
  selectedTabAutocompleteModel: string;
  // 每个工作区对应的上一个选择的配置文件
  lastSelectedProfileForWorkspace: { [workspaceIdentifier: string]: string };
  /**
   * 该字段用于处理 JetBrains 用户创建文档嵌入时使用的提供者，
   * 然后更新到新的提供者的情况。
   * 对于 VS Code 用户，这是不必要的，因为默认使用 transformers.js。
   */
  curEmbeddingsProviderId: EmbeddingsProvider["id"];
};

/**
 * GlobalContext 类提供了一种方式来持久化全局状态。
 */
export class GlobalContext {
  /**
   * 更新全局上下文中的某个键值对
   * @param key 要更新的键（字段名）
   * @param value 更新后的值
   */
  update<T extends keyof GlobalContextType>(
    key: T,  // 传入要更新的键
    value: GlobalContextType[T],  // 传入新值
  ) {
    // 判断全局上下文文件是否存在，如果不存在则创建
    if (!fs.existsSync(getGlobalContextFilePath())) {
      // 如果文件不存在，创建文件并写入初始数据
      fs.writeFileSync(
        getGlobalContextFilePath(),  // 获取文件路径
        JSON.stringify(
          {
            [key]: value,  // 以对象的形式将键值对写入文件
          },
          null,  // 美化JSON格式，传入null表示没有缩进
          2,     // 设置缩进为2个空格
        ),
      );
    } else {
      // 如果文件存在，读取现有的内容并解析
      const data = fs.readFileSync(getGlobalContextFilePath(), "utf-8");
      const parsed = JSON.parse(data);  // 解析JSON字符串为对象
      parsed[key] = value;  // 更新指定的键值
      // 将更新后的内容重新写入文件
      fs.writeFileSync(
        getGlobalContextFilePath(),
        JSON.stringify(parsed, null, 2),
      );
    }
  }

  /**
   * 获取全局上下文中的某个键对应的值
   * @param key 要查询的键（字段名）
   * @returns 如果键存在，返回相应的值，否则返回 undefined
   */
  get<T extends keyof GlobalContextType>(
    key: T,  // 传入要查询的键
  ): GlobalContextType[T] | undefined {
    // 判断全局上下文文件是否存在，如果不存在则返回 undefined
    if (!fs.existsSync(getGlobalContextFilePath())) {
      return undefined;
    }

    // 如果文件存在，读取并解析文件
    const data = fs.readFileSync(getGlobalContextFilePath(), "utf-8");
    const parsed = JSON.parse(data);  // 解析JSON字符串为对象
    // 返回对应键的值
    return parsed[key];
  }
}
