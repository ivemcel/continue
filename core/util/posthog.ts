import os from "node:os";
import { TeamAnalytics } from "../control-plane/TeamAnalytics.js";

export class Telemetry {
  // Set to undefined whenever telemetry is disabled
  // static client 用于存储遥测数据发送客户端，未启用时默认为 undefined
  static client: any = undefined;
  // static uniqueId 是一个唯一标识符，用于区分不同用户或设备的遥测数据，默认值为 "NOT_UNIQUE"
  static uniqueId = "NOT_UNIQUE";
  // static os 存储操作系统信息（如 Windows、Linux、Mac 等），默认为 undefined
  static os: string | undefined = undefined;
  // static extensionVersion 存储扩展的版本号，默认为 undefined
  static extensionVersion: string | undefined = undefined;

  /**
   * 捕获遥测事件并发送到遥测客户端和团队分析系统
   * 
   * @param event 事件名称，表示发生的遥测事件
   * @param properties 事件的属性，用于附加更多的事件细节（如发生事件时的环境或参数）
   * @param sendToTeam 是否同时将事件数据发送到团队分析系统，默认为 false
   */
  static async capture(
    event: string,
    properties: { [key: string]: any },
    sendToTeam: boolean = false,
  ) {
    // 如果遥测客户端已启用，则捕获事件并发送数据
    Telemetry.client?.capture({
      distinctId: Telemetry.uniqueId,
      event,
      properties: {
        ...properties,
        os: Telemetry.os,
        extensionVersion: Telemetry.extensionVersion,
      },
    });
    // 如果 sendToTeam 为 true，说明需要将数据发送到团队分析系统
    if (sendToTeam) {
      TeamAnalytics.capture(event, properties);
    }
  }

  /**
   * 关闭遥测客户端，停止发送遥测数据
   */
  static shutdownPosthogClient() {
    Telemetry.client?.shutdown();
  }

  /**
   * 设置遥测客户端，初始化唯一标识符、操作系统信息、扩展版本号等配置
   * 
   * @param allow 是否允许启用遥测功能
   * @param uniqueId 用户的唯一标识符
   * @param extensionVersion 扩展的版本号
   */
  static async setup(
    allow: boolean,
    uniqueId: string,
    extensionVersion: string,
  ) {
    // 设置唯一标识符、操作系统信息、扩展版本号
    Telemetry.uniqueId = uniqueId;
    Telemetry.os = os.platform();
    Telemetry.extensionVersion = extensionVersion;

    // 如果不允许启用遥测，client 设置为 undefined，停止遥测功能
    if (!allow) {
      Telemetry.client = undefined;
    } else {
      try {
        // 如果允许启用遥测，尝试初始化遥测客户端
        if (!Telemetry.client) {
          // 异步导入 "posthog-node" 库，并创建一个新的 PostHog 客户端实例
          const { PostHog } = await import("posthog-node");
          Telemetry.client = new PostHog(
            "phc_JS6XFROuNbhJtVCEdTSYk6gl5ArRrTNMpCcguAXlSPs",
            {
              host: "https://app.posthog.com",
            },
          );
        }
      } catch (e) {
        console.error(`Failed to setup telemetry: ${e}`);
      }
    }
  }
}
