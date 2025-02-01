// 从 "../../index.js" 导入必要的类型和接口
import {
  ContextItem, // 上下文项类型
  ContextProviderDescription, // 上下文提供者描述类型
  ContextProviderExtras, // 上下文提供者附加信息类型
  ContextSubmenuItem, // 上下文子菜单项类型
  LoadSubmenuItemsArgs, // 加载子菜单项时的参数类型
} from "../../index.js";

// 从 "../index.js" 导入 BaseContextProvider 基类
import { BaseContextProvider } from "../index.js";

// 从 dbinfoz 模块获取 getDatabaseAdapter 函数，用于获取数据库适配器
import getDatabaseAdapter from "dbinfoz";

// 定义一个 DatabaseContextProvider 类，继承自 BaseContextProvider
class DatabaseContextProvider extends BaseContextProvider {
  // 静态属性 description 描述了当前上下文提供者的信息
  static description: ContextProviderDescription = {
    title: "database", // 上下文提供者的标题
    displayTitle: "Database", // 显示标题
    description: "Table schemas", // 描述，表示提供表的架构信息
    type: "submenu", // 上下文类型，表示这是一个子菜单类型
    renderInlineAs: "", // 用于呈现时的内联方式，这里为空
  };

  // 异步方法 getContextItems，根据查询和附加信息获取数据库表架构上下文项
  async getContextItems(
    query: string, // 查询字符串，格式为 "connectionName.tableName"
    extras: ContextProviderExtras, // 上下文提供者附加信息
  ): Promise<ContextItem[]> { // 返回一个 Promise，解析为 ContextItem 数组
    const contextItems: ContextItem[] = [];

    // 获取连接信息
    const connections = this.options?.connections;

    // 如果没有连接配置，则返回空数组
    if (connections === null) {
      return contextItems;
    }

    // 解析查询字符串，获取连接名和表名
    const [connectionName, table] = query.split(".");

    // 遍历所有连接
    for (const connection of connections) {
      if (connection.name === connectionName) {
        // 获取对应连接类型的数据库适配器
        // @ts-ignore (模块的类型声明文件可能存在问题)
        const adapter = getDatabaseAdapter(
          connection.connection_type,
          connection.connection,
        );
        // 获取所有表和其架构信息
        const tablesAndSchemas = await adapter.getAllTablesAndSchemas(
          connection.connection.database,
        );

        // 如果查询的是所有表架构
        if (table === "all") {
          let prompt = `Schema for all tables on ${connection.connection_type} is `;
          prompt += JSON.stringify(tablesAndSchemas);

          const contextItem = {
            name: `${connectionName}-all-tables-schemas`, // 上下文项名称
            description: "Schema for all tables.", // 描述
            content: prompt, // 内容，包含所有表的架构信息
          };

          contextItems.push(contextItem);
        } else {
          // 如果查询的是特定表的架构，遍历所有表并匹配
          const tables = Object.keys(tablesAndSchemas);

          tables.forEach((tableName) => {
            if (table === tableName) {
              let prompt = `Schema for ${tableName} on ${connection.connection_type} is `;
              prompt += JSON.stringify(tablesAndSchemas[tableName]);

              const contextItem = {
                name: `${connectionName}-${tableName}-schema`, // 上下文项名称
                description: `${tableName} Schema`, // 描述
                content: prompt, // 内容，包含该表的架构信息
              };

              contextItems.push(contextItem);
            }
          });
        }
      }
    }

    return contextItems;
  }

  // 异步方法 loadSubmenuItems，用于加载子菜单项
  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs, // 加载子菜单项的参数
  ): Promise<ContextSubmenuItem[]> { 
    const contextItems: ContextSubmenuItem[] = [];
    const connections = this.options?.connections;

    // 如果没有连接配置，则返回空数组
    if (connections === null) {
      return contextItems;
    }

    // 遍历所有连接，加载对应的表架构信息
    for (const connection of connections) {
      // 获取对应连接类型的数据库适配器
      // @ts-ignore (模块的类型声明文件可能存在问题)
      const adapter = getDatabaseAdapter(
        connection.connection_type,
        connection.connection,
      );
      // 获取所有表和其架构信息
      const tablesAndSchemas = await adapter.getAllTablesAndSchemas(
        connection.connection.database,
      );
      // 获取所有表名
      const tables = Object.keys(tablesAndSchemas);

      // 为每个连接添加一个“所有表架构”项
      const contextItem = {
        id: `${connection.name}.all`, // 子菜单项 ID
        title: `${connection.name} all table schemas`, // 子菜单项标题
        description: "", // 描述
      };

      contextItems.push(contextItem);

      // 为每个表添加一个子菜单项
      tables.forEach((tableName) => {
        const contextItem = {
          id: `${connection.name}.${tableName}`, // 子菜单项 ID
          title: `${connection.name}.${tableName} schema`, // 子菜单项标题
          description: "", // 描述
        };

        contextItems.push(contextItem);
      });
    }

    return contextItems;
  }
}

// 导出 DatabaseContextProvider 类供其他模块使用
export default DatabaseContextProvider;
