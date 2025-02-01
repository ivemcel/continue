/**
 * This is the entry point for the extension.
 */

import { setupCa } from "core/util/ca";
import { Telemetry } from "core/util/posthog";
import * as vscode from "vscode";
import { getExtensionVersion } from "./util/util";

/**
 * 动态导入并激活扩展
 * 
 * 该函数在激活扩展时动态导入 `./activation/activate` 模块，并调用 `activateExtension` 函数。
 * 如果发生错误，则会捕获异常并显示信息提示，提供查看日志或重试的选项。
 * 
 * @param context - VS Code 扩展的上下文
 * @returns 激活扩展的返回值
 */
async function dynamicImportAndActivate(context: vscode.ExtensionContext) {
  const { activateExtension } = await import("./activation/activate");
  try {
    // 调用动态导入的 `activateExtension` 函数以激活扩展
    return activateExtension(context);
  } catch (e) {
    // 如果激活过程中发生错误，捕获异常并打印错误信息
    console.log("Error activating extension: ", e);
    // 弹出信息框，提示用户激活扩展失败，提供查看日志或重试的选项
    vscode.window
      .showInformationMessage(
        "Error activating the Continue extension.",
        "View Logs",
        "Retry",
      )
      .then((selection) => {
        if (selection === "View Logs") {
          vscode.commands.executeCommand("continue.viewLogs");
        } else if (selection === "Retry") {
          // Reload VS Code window
          vscode.commands.executeCommand("workbench.action.reloadWindow");
        }
      });
  }
}

/**
 * 激活扩展
 * 
 * 该函数是扩展的激活入口，首先调用 `setupCa` 来进行必要的初始化，
 * 然后调用 `dynamicImportAndActivate` 来动态导入并激活扩展。
 * 
 * @param context - VS Code 扩展的上下文
 */
export function activate(context: vscode.ExtensionContext) {
  setupCa();
  return dynamicImportAndActivate(context);
}

/**
 * 停用扩展
 * 
 * 该函数在扩展停用时调用，主要用于发送停用的遥测数据并关闭遥测客户端。
 */
export function deactivate() {
  Telemetry.capture(
    "deactivate",
    {
      extensionVersion: getExtensionVersion(),
    },
    true,
  );

  Telemetry.shutdownPosthogClient();
}
