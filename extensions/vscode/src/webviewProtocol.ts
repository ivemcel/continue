import { FromWebviewProtocol, ToWebviewProtocol } from "core/protocol";
import { Message } from "core/util/messenger";
import { Telemetry } from "core/util/posthog";
import fs from "node:fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import * as vscode from "vscode";
import { IMessenger } from "../../../core/util/messenger";
import { getExtensionUri } from "./util/vscode";

/**
  这个函数打开一个教程文件 continue_tutorial.py，并根据操作系统（非 macOS 时）修改文件中的快捷键符号（⌘ 更换为 Ctrl）。
  然后它会在 VS Code 中打开并显示该文件。
 */
export async function showTutorial() {
  const tutorialPath = path.join(
    getExtensionUri().fsPath,
    "continue_tutorial.py",
  );
  // Ensure keyboard shortcuts match OS
  if (process.platform !== "darwin") {
    let tutorialContent = fs.readFileSync(tutorialPath, "utf8");
    tutorialContent = tutorialContent.replace("⌘", "^").replace("Cmd", "Ctrl");
    fs.writeFileSync(tutorialPath, tutorialContent);
  }

  const doc = await vscode.workspace.openTextDocument(
    vscode.Uri.file(tutorialPath),
  );
  await vscode.window.showTextDocument(doc, { preview: false });
}

/**
  该类实现了 IMessenger 接口，用于处理 Webview 与 VS Code 之间的消息传递。
  send 方法：发送消息到 Webview，支持可选的 messageId。
  on 方法：注册消息处理函数，处理来自 Webview 的消息。
  webview：处理 Webview 的初始化与消息接收，监听 Webview 发来的消息并调用相应的处理函数。
  错误处理：如果发生错误，会发送错误信息，并提供用户可能的解决方案，如重新登录、添加 API 密钥等。
  request 方法：发送请求到 Webview 并等待响应。如果 Webview 未准备好，会进行重试。
 */
export class VsCodeWebviewProtocol
  implements IMessenger<FromWebviewProtocol, ToWebviewProtocol>
{
  // 存储不同消息类型的监听器
  listeners = new Map<
    keyof FromWebviewProtocol,
    ((message: Message) => any)[]
  >();

  // 发送消息的方法
  send(messageType: string, data: any, messageId?: string): string {
    const id = messageId ?? uuidv4();
    this.webview?.postMessage({
      messageType,
      data,
      messageId: id,
    });
    return id;
  }

  // 监听消息的方法
  on<T extends keyof FromWebviewProtocol>(
    messageType: T,
    handler: (
      message: Message<FromWebviewProtocol[T][0]>,
    ) => Promise<FromWebviewProtocol[T][1]> | FromWebviewProtocol[T][1],
  ): void {
    if (!this.listeners.has(messageType)) {
      this.listeners.set(messageType, []);
    }
    this.listeners.get(messageType)?.push(handler);
  }

  // 内部变量：webview 和事件监听器
  _webview?: vscode.Webview;
  _webviewListener?: vscode.Disposable;

  // 获取 webview
  get webview(): vscode.Webview | undefined {
    return this._webview;
  }

  // 设置 webview，初始化消息监听器
  set webview(webView: vscode.Webview) {
    this._webview = webView;  // 设置 webview
    this._webviewListener?.dispose();  // 清除旧的监听器

    // 为 webview 设置新的消息接收事件监听器
    this._webviewListener = this._webview.onDidReceiveMessage(async (msg) => {
      if (!msg.messageType || !msg.messageId) {
        throw new Error(`Invalid webview protocol msg: ${JSON.stringify(msg)}`);
      }

      const respond = (message: any) =>
        this.send(msg.messageType, message, msg.messageId);

      // 获取当前消息类型的处理函数列表
      const handlers = this.listeners.get(msg.messageType) || [];
      for (const handler of handlers) {
        try {
          // 调用处理函数并获取响应
          const response = await handler(msg);
          if (
            response &&
            typeof response[Symbol.asyncIterator] === "function"
          ) {
            let next = await response.next();
            // 如果响应是一个异步迭代器，循环获取并发送每一项
            while (!next.done) {
              respond(next.value);
              next = await response.next();
            }
            respond({ done: true, content: next.value?.content });
          } else {
            respond(response || {});
          }
        } catch (e: any) {
          respond({ done: true, error: e });

          console.error(
            `Error handling webview message: ${JSON.stringify(
              { msg },
              null,
              2,
            )}\n\n${e}`,
          );

          let message = e.message;
          if (e.cause) {
            if (e.cause.name === "ConnectTimeoutError") {
              message = `Connection timed out. If you expect it to take a long time to connect, you can increase the timeout in config.json by setting "requestOptions": { "timeout": 10000 }. You can find the full config reference here: https://docs.continue.dev/reference/config`;
            } else if (e.cause.code === "ECONNREFUSED") {
              message = `Connection was refused. This likely means that there is no server running at the specified URL. If you are running your own server you may need to set the "apiBase" parameter in config.json. For example, you can set up an OpenAI-compatible server like here: https://docs.continue.dev/reference/Model%20Providers/openai#openai-compatible-servers--apis`;
            } else {
              message = `The request failed with "${e.cause.name}": ${e.cause.message}. If you're having trouble setting up Continue, please see the troubleshooting guide for help.`;
            }
          }

          if (message.includes("https://proxy-server")) {
            message = message.split("\n").filter((l: string) => l !== "")[1];
            try {
              message = JSON.parse(message).message;
            } catch {}
            if (message.includes("exceeded")) {
              message +=
                " To keep using Continue, you can set up a local model or use your own API key.";
            }

            vscode.window
              .showInformationMessage(message, "Add API Key", "Use Local Model")
              .then((selection) => {
                if (selection === "Add API Key") {
                  this.request("addApiKey", undefined);
                } else if (selection === "Use Local Model") {
                  this.request("setupLocalModel", undefined);
                }
              });
          } else if (message.includes("Please sign in with GitHub")) {
            vscode.window
              .showInformationMessage(
                message,
                "Sign In",
                "Use API key / local model",
              )
              .then((selection) => {
                if (selection === "Sign In") {
                  vscode.authentication
                    .getSession("github", [], {
                      createIfNone: true,
                    })
                    .then(() => {
                      this.reloadConfig();
                    });
                } else if (selection === "Use API key / local model") {
                  this.request("openOnboarding", undefined);
                }
              });
          } else {
            Telemetry.capture(
              "webview_protocol_error",
              {
                messageType: msg.messageType,
                errorMsg: message.split("\n\n")[0],
              },
              false,
            );
            vscode.window
              .showErrorMessage(
                message.split("\n\n")[0],
                "Show Logs",
                "Troubleshooting",
              )
              .then((selection) => {
                if (selection === "Show Logs") {
                  vscode.commands.executeCommand(
                    "workbench.action.toggleDevTools",
                  );
                } else if (selection === "Troubleshooting") {
                  vscode.env.openExternal(
                    vscode.Uri.parse(
                      "https://docs.continue.dev/troubleshooting",
                    ),
                  );
                }
              });
          }
        }
      }
    });
  }

  // 构造函数，接受一个用于重新加载配置的回调函数
  constructor(private readonly reloadConfig: () => void) {}
  invoke<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
    messageId?: string,
  ): FromWebviewProtocol[T][1] {
    throw new Error("Method not implemented.");
  }

  onError(handler: (error: Error) => void): void {
    throw new Error("Method not implemented.");
  }

  public request<T extends keyof ToWebviewProtocol>(
    messageType: T,
    data: ToWebviewProtocol[T][0],
    retry: boolean = true,
  ): Promise<ToWebviewProtocol[T][1]> {
    const messageId = uuidv4();
    return new Promise(async (resolve) => {
      if (retry) {
        let i = 0;
        while (!this.webview) {
          if (i >= 10) {
            resolve(undefined);
            return;
          } else {
            await new Promise((res) => setTimeout(res, i >= 5 ? 1000 : 500));
            i++;
          }
        }
      }

      this.send(messageType, data, messageId);

      if (this.webview) {
        const disposable = this.webview.onDidReceiveMessage(
          (msg: Message<ToWebviewProtocol[T][1]>) => {
            if (msg.messageId === messageId) {
              resolve(msg.data);
              disposable?.dispose();
            }
          },
        );
      } else if (!retry) {
        resolve(undefined);
      }
    });
  }
}
