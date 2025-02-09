# Welcome to your VS Code Extension

## What's in the folder

* This folder contains all of the files necessary for your extension.
* `package.json` - this is the manifest file in which you declare your extension and command.
  * The sample plugin registers a command and defines its title and command name. With this information VS Code can show the command in the command palette. It doesn’t yet need to load the plugin.
* `src/extension.ts` - this is the main file where you will provide the implementation of your command.
  * The file exports one function, `activate`, which is called the very first time your extension is activated (in this case by executing the command). Inside the `activate` function we call `registerCommand`.
  * We pass the function containing the implementation of the command as the second parameter to `registerCommand`.

## Get up and running straight away

* Press `F5` to open a new window with your extension loaded.
* Run your command from the command palette by pressing (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac) and typing `Hello World`.
* Set breakpoints in your code inside `src/extension.ts` to debug your extension.
* Find output from your extension in the debug console.

## Make changes

* You can relaunch the extension from the debug toolbar after changing code in `src/extension.ts`.
* You can also reload (`Ctrl+R` or `Cmd+R` on Mac) the VS Code window with your extension to load your changes.

## Explore the API

* You can open the full set of our API when you open the file `node_modules/@types/vscode/index.d.ts`.

## Run tests

* Open the debug viewlet (`Ctrl+Shift+D` or `Cmd+Shift+D` on Mac) and from the launch configuration dropdown pick `Extension Tests`.
* Press `F5` to run the tests in a new window with your extension loaded.
* See the output of the test result in the debug console.
* Make changes to `src/test/suite/extension.test.ts` or create new test files inside the `test/suite` folder.
  * The provided test runner will only consider files matching the name pattern `**.test.ts`.
  * You can create folders inside the `test` folder to structure your tests any way you want.

## Go further

* [Follow UX guidelines](https://code.visualstudio.com/api/ux-guidelines/overview) to create extensions that seamlessly integrate with VS Code's native interface and patterns.
 * Reduce the extension size and improve the startup time by [bundling your extension](https://code.visualstudio.com/api/working-with-extensions/bundling-extension).
 * [Publish your extension](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) on the VS Code extension marketplace.
 * Automate builds by setting up [Continuous Integration](https://code.visualstudio.com/api/working-with-extensions/continuous-integration).

欢迎使用你的 VS Code 扩展
=================

文件夹内容
-----

*   该文件夹包含了你的扩展所需的所有文件。
*   `package.json` - 这是声明扩展和命令的清单文件。
    *   示例插件注册了一个命令，并定义了其标题和命令名称。通过这些信息，VS Code 可以在命令面板中显示该命令。此时插件尚未加载。
*   `src/extension.ts` - 这是主要文件，你将在其中实现命令的功能。
    *   该文件导出了一个函数 `activate`，该函数在第一次激活扩展时被调用（此处是通过执行命令来激活）。在 `activate` 函数内，我们调用了 `registerCommand`。
    *   我们将包含命令实现的函数作为第二个参数传递给 `registerCommand`。

立即开始使用
------

*   按 `F5` 打开一个新窗口并加载你的扩展。
*   在命令面板中运行你的命令，按 (`Ctrl+Shift+P` 或在 Mac 上按 `Cmd+Shift+P`)，然后输入 `Hello World`。
*   在 `src/extension.ts` 中设置断点来调试你的扩展。
*   在调试控制台查看扩展的输出。

修改和更新
-----

*   修改 `src/extension.ts` 中的代码后，你可以通过调试工具栏重新启动扩展。
*   你还可以通过重新加载 VS Code 窗口 (`Ctrl+R` 或在 Mac 上按 `Cmd+R`) 来加载扩展的更改。

探索 API
------

*   你可以打开 `node_modules/@types/vscode/index.d.ts` 文件，查看我们完整的 API。

运行测试
----

*   打开调试视图 (`Ctrl+Shift+D` 或在 Mac 上按 `Cmd+Shift+D`)，从启动配置下拉菜单中选择 `Extension Tests`。
*   按 `F5` 在新窗口中运行测试，并加载你的扩展。
*   在调试控制台查看测试结果输出。
*   修改 `src/test/suite/extension.test.ts` 或在 `test/suite` 文件夹中创建新的测试文件。
    *   提供的测试运行器只会考虑符合名称模式 `**.test.ts` 的文件。
    *   你可以在 `test` 文件夹内创建子文件夹，以任何你喜欢的方式组织测试。

更进一步
----

*   [遵循 UX 指南](https://code.visualstudio.com/api/ux-guidelines/overview)，创建与 VS Code 原生界面和模式无缝集成的扩展。
*   通过[打包你的扩展](https://code.visualstudio.com/api/working-with-extensions/bundling-extension)，减少扩展大小并提升启动时间。
*   [在 VS Code 扩展市场发布你的扩展](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)。
*   通过设置[持续集成](https://code.visualstudio.com/api/working-with-extensions/continuous-integration)，实现自动化构建。
