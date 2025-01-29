# Continue PyPI Package

This package contains the [Continue](https://github.com/continuedev/continue) server and core classes needed to build your own recipes.

Continue is a Python library for automating repetitive sequences of software development tasks using language models. Using our VS Code extension, you can build, run, and refine these recipes as they natively interact with your codebase. Read the docs [here](https://continue.dev/docs) or download the VS Code extension [here](https://marketplace.visualstudio.com/items?itemName=Continue.continue).

## Continue Server

The Continue server acts as a bridge between the Continue React app and your IDE, running your recipes and acting on the codebase.

Start it by running the following commands:

1. `cd server`
2. Make sure packages are installed with `poetry install`
   - If poetry is not installed, you can install with
   ```bash
   curl -sSL https://install.python-poetry.org | python3 -
   ```
   (official instructions [here](https://python-poetry.org/docs/#installing-with-the-official-installer))
3. `poetry shell` to activate the virtual environment
4. `python3 -m continuedev.server.main` to start the server

Once you've validated that this works, you'll often want to use a debugger, in which case we've provided a launch configuration for VS Code in `.vscode/launch.json`. To start the debugger in VS Code, ensure that the workspace directory is the root of the `continue` repo, then press F5.

> [!NOTE]
> To start the debugger, you'll have to select the poetry Python interpreter
> (`/path-to-poetry-venv/bin/python3`) in the bottom right of the VS Code window. If you
> don't see this, you may have to install the [Python
> extension](https://marketplace.visualstudio.com/items?itemName=ms-python.python).

## Scripts

`poetry run typegen` to generate JSONSchema .json files from the Pydantic types defined in the `models` directory.

`poetry build` will output wheel and tarball files in `./dist`.

## Writing Steps

See the `continuedev/libs/steps` folder for examples of writing a Continue step. See our documentation for tutorials.

## How to contribute

Open a [new GitHub Issue](https://github.com/continuedev/continue/issues/new) or comment on [an existing one](https://github.com/continuedev/continue/issues). Let us know what you would like to contribute, and we will help you make it happen!

For more a more detailed contributing guide, see [CONTRIBUTING.md](../CONTRIBUTING.md).

## Install from source

#### 1. Clone this repo

Recommended: Run this command to use SSH

```bash
git clone git@github.com:continuedev/continue.git
```

Alternative: Run this command to use HTTPS

```bash
git clone https://github.com/continuedev/continue
```

#### 2. Install Continue

Run this command to use the install script

```bash
cd continue/extensions/vscode/scripts && python3 install_from_source.py
```

> [!IMPORTANT]
> Ensure you have a Java Runtime Environment (JRE) installed. Verify this by typing `java
-version` in your command prompt or terminal. If a version number appears, you're set.
> If not, download and install a JRE from Oracle's website or through a package manager,
> for example Homebrew.
>
> ```sh
> brew install openjdk@11
> ```

# Understanding the codebase

- [Continue Server README](./README.md): learn about the core of Continue, which can be downloaded as a [PyPI package](https://pypi.org/project/continuedev/)
- [VS Code Extension README](../extensions/vscode/README.md): learn about the capabilities of our extension—the first implementation of Continue's IDE Protocol—which makes it possible to use use Continue in VS Code and GitHub Codespaces
- [Continue GUI README](../gui/): learn about the React app that lets users interact with the server and is placed adjacent to the text editor in any supported IDE
- [Schema README](../schema/README.md): learn about the JSON Schema types generated from Pydantic models, which we use across the `server/` and `extensions/vscode/` directories
- [Continue Docs README](../docs/README.md): learn how our [docs](https://continue.dev/docs) are written and built
- [How to debug the VS Code Extension README](../extensions/vscode/src/README.md): learn how to set up the VS Code extension, so you can debug it


Continue PyPI 包
===============

此包包含用于构建您自己的配方所需的 [Continue](https://github.com/continuedev/continue) 服务器和核心类。

Continue 是一个用于自动化重复的软件开发任务序列的 Python 库，利用语言模型来实现。通过我们的 VS Code 扩展，您可以构建、运行并完善这些配方，它们能够与您的代码库原生交互。可以在 [此处](https://continue.dev/docs) 阅读文档，或者在 [此处](https://marketplace.visualstudio.com/items?itemName=Continue.continue) 下载 VS Code 扩展。

Continue 服务器
------------

Continue 服务器充当 Continue React 应用与您的 IDE 之间的桥梁，运行您的配方并操作代码库。

启动它，请按照以下步骤操作：

1. `cd server`

2. 确保已安装所需的包，通过 `poetry install`

    *   如果未安装 poetry，您可以通过以下命令安装：

    ```bash
    curl -sSL https://install.python-poetry.org | python3 -
    ```

    （官方安装说明请参见 [此处](https://python-poetry.org/docs/#installing-with-the-official-installer)）

3. 执行 `poetry shell` 激活虚拟环境

4. 执行 `python3 -m continuedev.server.main` 启动服务器

验证运行成功后，您可能会想使用调试器，在这种情况下，我们为 VS Code 提供了一个启动配置，位于 `.vscode/launch.json` 文件中。要在 VS Code 中启动调试器，请确保工作区目录是 `continue` 仓库的根目录，然后按 F5。

> \[!NOTE\] 要启动调试器，您需要选择 poetry 的 Python 解释器 (`/path-to-poetry-venv/bin/python3`)，这个选项位于 VS Code 窗口的右下角。如果 您没有看到它，可能需要安装 [Python 扩展](https://marketplace.visualstudio.com/items?itemName=ms-python.python)。

脚本
--

`poetry run typegen` 用于根据 `models` 目录中定义的 Pydantic 类型生成 JSONSchema .json 文件。

`poetry build` 会在 `./dist` 目录中输出 wheel 和 tarball 文件。

编写步骤
----

请参见 `continuedev/libs/steps` 文件夹，查看编写 Continue 步骤的示例。更多教程请参阅我们的文档。

如何贡献
----

请打开一个 [新的 GitHub Issue](https://github.com/continuedev/continue/issues/new) 或在 [现有 Issue](https://github.com/continuedev/continue/issues) 上发表评论。告诉我们您希望贡献的内容，我们将帮助您实现！

有关更详细的贡献指南，请参见 [CONTRIBUTING.md](../CONTRIBUTING.md)。

从源代码安装
------

#### 1\. 克隆此仓库

推荐：运行以下命令使用 SSH

```bash
git clone git@github.com:continuedev/continue.git
```

备选：运行以下命令使用 HTTPS

```bash
git clone https://github.com/continuedev/continue
```

#### 2\. 安装 Continue

运行以下命令使用安装脚本

```bash
cd continue/extensions/vscode/scripts && python3 install_from_source.py
```

> \[!IMPORTANT\] 请确保您已安装 Java 运行时环境（JRE）。通过在命令提示符或终端中输入 `java -version` 来验证。如果显示版本号，则说明安装成功。 如果没有，您可以从 Oracle 网站下载并安装 JRE，或者通过包管理器安装，例如使用 Homebrew：
>
> ```sh
> brew install openjdk@11
> ```

理解代码库
=====

*   [Continue 服务器 README](./README.md)：了解 Continue 的核心，可以作为 [PyPI 包](https://pypi.org/project/continuedev/) 下载
*   [VS Code 扩展 README](../extensions/vscode/README.md)：了解我们扩展的功能——Continue IDE 协议的首次实现——使您能够在 VS Code 和 GitHub Codespaces 中使用 Continue
*   [Continue GUI README](../gui/): 了解让用户与服务器交互的 React 应用，它可以放置在任何支持的 IDE 中的文本编辑器旁边
*   [Schema README](../schema/README.md)：了解通过 Pydantic 模型生成的 JSON Schema 类型，我们在 `server/` 和 `extensions/vscode/` 目录中使用这些类型
*   [Continue 文档 README](../docs/README.md)：了解我们的 [文档](https://continue.dev/docs) 是如何编写和构建的
*   [如何调试 VS Code 扩展 README](../extensions/vscode/src/README.md)：了解如何设置 VS Code 扩展，以便您可以进行调试
