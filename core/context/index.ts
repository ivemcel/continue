import type {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  IContextProvider,
  LoadSubmenuItemsArgs,
} from "../index.js";

// 定义一个抽象类 BaseContextProvider，实现了 IContextProvider 接口
export abstract class BaseContextProvider implements IContextProvider {
  // options 属性用于存储上下文提供者的配置选项，类型为键值对
  options: { [key: string]: any };

  // 构造函数，接收一个配置对象并将其赋值给 options
  constructor(options: { [key: string]: any }) {
    this.options = options;
  }

  // 静态属性 description，描述当前上下文提供者的相关信息
  static description: ContextProviderDescription;

  // getter 方法 description，用于获取当前类的 description 信息
  get description(): ContextProviderDescription {
    return (this.constructor as any).description;
  }

  // 抽象方法 getContextItems，子类必须实现该方法以获取上下文项
  // Maybe just include the chat message in here. Should never have to go back to the context provider once you have the information.
  abstract getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]>;

  // 异步方法 loadSubmenuItems，加载子菜单项，默认为返回空数组
  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    return [];
  }
}
