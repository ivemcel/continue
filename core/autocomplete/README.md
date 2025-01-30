# Tab Autocomplete (beta)

Continue now provides support for tab autocomplete in [VS Code](https://marketplace.visualstudio.com/items?itemName=Continue.continue) and [JetBrains IDEs](https://plugins.jetbrains.com/plugin/22707-continue/edit). We will be greatly improving the experience over the next few releases, and it is always helpful to hear feedback. If you have any problems or suggestions, please let us know in our [Discord](https://discord.gg/vapESyrFmJ).

## Setting up with Ollama (default)

We recommend setting up tab-autocomplete with a local Ollama instance. To do this, first download the latest version of Ollama from [here](https://ollama.ai). Then, run the following command to download our recommended model:

```bash
ollama run starcoder:3b
```

Once it has been downloaded, you should begin to see completions in VS Code.

## Setting up with LM Studio

You can also set up tab-autocomplete with a local LM Studio instance by following these steps:

1. Download the latest version of LM Studio from [here](https://lmstudio.ai/)
2. Download a model (e.g. search for `second-state/StarCoder2-3B-GGUF` and choose one of the options there)
3. Go to the server section (button is on the left), select your model from the dropdown at the top, and click "Start Server"
4. Go to the "My Models" section (button is on the left), find your selected model, and copy the name the path (example: `second-state/StarCoder2-3B-GGUF/starcoder2-3b-Q8_0.gguf`); this will be used as the "model" attribute in Continue
5. Go to Continue and modify the configurations for a [custom model](#setting-up-a-custom-model)
6. Set the "provider" to `lmstudio` and the "model" to the path copied earlier

Example:

```json title=~/.continue/config.json
{
  "tabAutocompleteModel": {
      "title": "Starcoder2 3b",
      "model": "second-state/StarCoder2-3B-GGUF/starcoder2-3b-Q8_0.gguf",
      "provider": "lmstudio",
  },
  ...
}
```

## Setting up a custom model

All of the configuration options available for chat models are available to use for tab-autocomplete. For example, if you wanted to use a remote vLLM instance you would edit your `config.json` like this (note that it is not inside the models array), filling in the correct model name and vLLM endpoint:

```json title=~/.continue/config.json
{
    "tabAutocompleteModel": {
        "title": "Tab Autocomplete Model",
        "provider": "openai",
        "model": "<MODEL_NAME>",
        "apiBase": "<VLLM_ENDPOINT_URL>"
    },
    ...
}
```

As another example, say you want to use a different model, `deepseek-coder:6.7b-base`, with Ollama:

```json title=~/.continue/config.json
{
    "tabAutocompleteModel": {
        "title": "Tab Autocomplete Model",
        "provider": "ollama",
        "model": "deepseek-coder:6.7b-base"
    },
    ...
}
```

If you aren't yet familiar with the available options, you can learn more in our [overview](../setup/overview.md).

### What model should I use?

If you are running the model locally, we recommend `starcoder:3b`.

If you find it to be too slow, you should try `deepseek-coder:1.3b-base`.

If you have a bit more compute, or are running a model in the cloud, you can upgrade to `deepseek-coder:6.7b-base`.

Regardless of what you are willing to spend, we do not recommend using GPT or Claude for autocomplete. Learn why [below](#i-want-better-completions-should-i-use-gpt-4).

## Configuration Options

The following can be configured in `config.json`:

### `tabAutocompleteModel`

This is just another object like the ones in the `"models"` array of `config.json`. You can choose and configure any model you would like, but we strongly suggest using a small model made for tab-autocomplete, such as `deepseek-1b`, `starcoder-1b`, or `starcoder-3b`.

### `tabAutocompleteOptions`

This object allows you to customize the behavior of tab-autocomplete. The available options are:

- `useCopyBuffer`: Determines whether the copy buffer will be considered when constructing the prompt. (Boolean)
- `useFileSuffix`: Determines whether to use the file suffix in the prompt. (Boolean)
- `maxPromptTokens`: The maximum number of prompt tokens to use. A smaller number will yield faster completions, but less context. (Number)
- `debounceDelay`: The delay in milliseconds before triggering autocomplete after a keystroke. (Number)
- `maxSuffixPercentage`: The maximum percentage of the prompt that can be dedicated to the suffix. (Number)
- `prefixPercentage`: The percentage of the input that should be dedicated to the prefix. (Number)
- `template`: An optional template string to be used for autocomplete. It will be rendered with the Mustache templating language, and is passed the 'prefix' and 'suffix' variables. (String)
- `multilineCompletions`: Whether to enable multiline completions ("always", "never", or "auto"). Defaults to "auto".

### Full example

```json title=~/.continue/config.json
{
  "tabAutocompleteModel": {
    "title": "Tab Autocomplete Model",
    "provider": "ollama",
    "model": "starcoder:3b",
    "apiBase": "https://<my endpoint>"
  },
  "tabAutocompleteOptions": {
    "useCopyBuffer": false,
    "maxPromptTokens": 400,
    "prefixPercentage": 0.5
  }
}
```

## Troubleshooting

### I want better completions, should I use GPT-4?

Perhaps surprisingly, the answer is no. The models that we suggest for autocomplete are trained with a highly specific prompt format, which allows them to respond to requests for completing code (see examples of these prompts [here](https://github.com/continuedev/continue/blob/d2bc6359e8ebf647892ec953e418042dc7f8a685/core/autocomplete/templates.ts)). Some of the best commercial models like GPT-4 or Claude are not trained with this prompt format, which means that they won't generate useful completions. Luckily, a huge model is not required for great autocomplete. Most of the state-of-the-art autocomplete models are no more than 10b parameters, and increasing beyond this does not significantly improve performance.

### I'm not seeing any completions

Follow these steps to ensure that everything is set up correctly:

1. Make sure you have the "Enable Tab Autocomplete" setting checked (in VS Code, you can toggle by clicking the "Continue" button in the status bar).
2. Make sure you have downloaded Ollama.
3. Run `ollama run starcoder:3b` to verify that the model is downloaded.
4. Make sure that any other completion providers are disabled (e.g. Copilot), as they may interfere.
5. Make sure that you aren't also using another Ollama model for chat. This will cause Ollama to constantly load and unload the models from memory, resulting in slow responses (or none at all) for both.
6. Check the output of the logs to find any potential errors (cmd/ctrl+shift+p -> "Toggle Developer Tools" -> "Console" tab in VS Code, ~/.continue/core.log in JetBrains).
7. If you are still having issues, please let us know in our [Discord](https://discord.gg/vapESyrFmJ) and we'll help as soon as possible.

### Completions are slow

Depending on your hardware, you may want to try a smaller, faster model. If 3b isn't working for you we recommend trying `deepseek-coder:1.3b-base`.

### Completions don't know about my code

We are working on this! Right now Continue uses the Language Server Protocol to add definitions to the prompt, as well as using similarity search over recently edited files. We will be improving the accuracy of this system greatly over the next few weeks.

### Completions contain formatting errors

If you're seeing a common pattern of mistake that might be helpful to report, please share in Discord. We will do our best to fix it as soon as possible.

## How to turn off autocomplete

### VS Code

Click the "Continue" button in the status panel at the bottom right of the screen. The checkmark will become a "cancel" symbol and you will no longer see completions. You can click again to turn it back on.

Alternatively, open VS Code settings, search for "Continue" and uncheck the box for "Enable Tab Autocomplete".

### JetBrains

Open Settings -> Tools -> Continue and uncheck the box for "Enable Tab Autocomplete".

### Feedback

If you're turning off autocomplete, we'd love to hear how we can improve! Please let us know in our [Discord](https://discord.gg/vapESyrFmJ) or file an issue on GitHub.

Tab 自动补全（Beta）
==============

现在，**Continue** 在 [VS Code](https://marketplace.visualstudio.com/items?itemName=Continue.continue) 和 [JetBrains IDEs](https://plugins.jetbrains.com/plugin/22707-continue/edit) 中提供对 Tab 自动补全的支持。我们将在接下来的版本中大大改进体验，任何反馈都非常宝贵。如果您有任何问题或建议，请通过我们的 [Discord](https://discord.gg/vapESyrFmJ) 告诉我们。

使用 Ollama 设置（默认）
----------------

我们推荐通过本地的 Ollama 实例来设置 Tab 自动补全。首先，从 [这里](https://ollama.ai) 下载 Ollama 的最新版本。然后，运行以下命令下载我们推荐的模型：

```bash
ollama run starcoder:3b
```

下载完成后，您应该能够在 VS Code 中看到自动补全的提示。

使用 LM Studio 设置
---------------

您也可以通过 LM Studio 设置本地的 Tab 自动补全，按以下步骤操作：

1.  从 [这里](https://lmstudio.ai/) 下载 LM Studio 的最新版本。
2.  下载一个模型（例如，搜索 `second-state/StarCoder2-3B-GGUF` 并选择其中一个选项）。
3.  转到服务器部分（按钮位于左侧），从顶部的下拉菜单中选择您的模型，然后点击“启动服务器”。
4.  转到“我的模型”部分（按钮位于左侧），找到您选择的模型，并复制模型路径（示例：`second-state/StarCoder2-3B-GGUF/starcoder2-3b-Q8_0.gguf`）；此路径将作为 Continue 中的“model”属性。
5.  在 Continue 中修改配置以使用 [自定义模型](#setting-up-a-custom-model)。
6.  将“provider”设置为 `lmstudio`，并将“model”设置为刚才复制的路径。

示例：

```json
{
  "tabAutocompleteModel": {
      "title": "Starcoder2 3b",
      "model": "second-state/StarCoder2-3B-GGUF/starcoder2-3b-Q8_0.gguf",
      "provider": "lmstudio",
  },
  ...
}
```

设置自定义模型
-------

所有聊天模型的配置选项同样适用于 Tab 自动补全。例如，如果您想使用远程的 vLLM 实例，您可以像下面这样编辑 `config.json`（请注意，它不在 `models` 数组中），填写正确的模型名称和 vLLM 端点：

```json
{
    "tabAutocompleteModel": {
        "title": "Tab Autocomplete Model",
        "provider": "openai",
        "model": "<MODEL_NAME>",
        "apiBase": "<VLLM_ENDPOINT_URL>"
    },
    ...
}
```

另一个示例，如果您想使用不同的模型 `deepseek-coder:6.7b-base`，并通过 Ollama 使用：

```json
{
    "tabAutocompleteModel": {
        "title": "Tab Autocomplete Model",
        "provider": "ollama",
        "model": "deepseek-coder:6.7b-base"
    },
    ...
}
```

如果您还不熟悉可用选项，可以在我们的 [概述](../setup/overview.md) 中了解更多信息。

### 我应该使用什么模型？

如果您在本地运行模型，建议使用 `starcoder:3b`。

如果您觉得它太慢，可以尝试 `deepseek-coder:1.3b-base`。

如果您有更强的计算能力，或者正在运行云端模型，可以升级到 `deepseek-coder:6.7b-base`。

无论您愿意花多少，我们都不推荐使用 GPT 或 Claude 来进行自动补全。了解更多 [原因](#i-want-better-completions-should-i-use-gpt-4)。

配置选项
----

以下内容可以在 `config.json` 中配置：

### `tabAutocompleteModel`

这只是另一个类似于 `config.json` 中 `"models"` 数组的对象。您可以选择并配置任何您喜欢的模型，但我们强烈建议使用专为 Tab 自动补全设计的小模型，如 `deepseek-1b`、`starcoder-1b` 或 `starcoder-3b`。

### `tabAutocompleteOptions`

此对象允许您自定义 Tab 自动补全的行为。可用的选项包括：

*   `useCopyBuffer`：决定在构建提示时是否考虑复制缓冲区。（布尔值）
*   `useFileSuffix`：决定是否在提示中使用文件后缀。（布尔值）
*   `maxPromptTokens`：最大提示令牌数。较小的数字将产生更快的补全，但上下文较少。（数字）
*   `debounceDelay`：按键后触发自动补全前的延迟时间（毫秒）。 （数字）
*   `maxSuffixPercentage`：最大允许的用于后缀的提示百分比。（数字）
*   `prefixPercentage`：输入中应分配给前缀的百分比。（数字）
*   `template`：一个可选的模板字符串，用于自动补全。它将使用 Mustache 模板语言进行渲染，并传递“prefix”和“suffix”变量。（字符串）
*   `multilineCompletions`：是否启用多行补全（“always”、“never” 或 “auto”）。默认为“auto”。

### 完整示例

```json
{
  "tabAutocompleteModel": {
    "title": "Tab Autocomplete Model",
    "provider": "ollama",
    "model": "starcoder:3b",
    "apiBase": "https://<my endpoint>"
  },
  "tabAutocompleteOptions": {
    "useCopyBuffer": false,
    "maxPromptTokens": 400,
    "prefixPercentage": 0.5
  }
}
```

故障排除
----

### 我想要更好的补全，应该使用 GPT-4 吗？

或许令人惊讶的是，答案是否定的。我们建议用于自动补全的模型使用了一种高度特定的提示格式，这使得它们能够响应代码补全的请求（可以查看这些提示的示例 [这里](https://github.com/continuedev/continue/blob/d2bc6359e8ebf647892ec953e418042dc7f8a685/core/autocomplete/templates.ts)）。一些最好的商业模型，如 GPT-4 或 Claude，并未使用这种提示格式，因此它们无法生成有用的补全。幸运的是，优秀的自动补全并不需要超大的模型。大多数先进的自动补全模型参数不超过 10b，并且超出这个规模不会显著提高性能。

### 我没有看到任何补全

请按照以下步骤确保所有配置正确：

1.  确保已勾选“启用 Tab 自动补全”设置（在 VS Code 中，可以通过点击状态栏中的“Continue”按钮进行切换）。
2.  确保已下载 Ollama。
3.  运行 `ollama run starcoder:3b` 来验证模型是否已下载。
4.  确保禁用了任何其他补全提供者（例如 Copilot），因为它们可能会干扰。
5.  确保没有使用另一个 Ollama 模型进行聊天。这会导致 Ollama 不断加载和卸载模型，从而导致响应变慢（或者完全没有响应）。
6.  检查日志输出，查找潜在错误（在 VS Code 中使用 `cmd/ctrl+shift+p` 打开“切换开发者工具” -> “Console” 标签，JetBrains 中查看 `~/.continue/core.log`）。
7.  如果问题仍然存在，请告诉我们，我们会尽快帮助您解决问题。

### 补全很慢

根据您的硬件配置，您可能需要尝试一个更小、更快的模型。如果 `3b` 不能满足需求，建议尝试 `deepseek-coder:1.3b-base`。

### 补全不识别我的代码

我们正在努力改进！目前，Continue 使用语言服务器协议（LSP）将定义添加到提示中，同时也使用最近编辑文件的相似性搜索。我们将在接下来的几周内大大提升这一系统的准确性。

### 补全包含格式错误

如果您看到常见的错误模式，可能有助于报告，请在 Discord 中与我们分享，我们会尽快修复。

如何关闭自动补全
--------

### VS Code

点击屏幕右下角状态栏中的“Continue”按钮。勾选标记会变成“取消”符号，您将不再看到补全提示。您可以再次点击来重新启用。

或者，打开 VS Code 设置，搜索“Continue”，取消勾选“启用 Tab 自动补全”。

### JetBrains

打开设置 -> 工具 -> Continue，然后取消勾选“启用 Tab 自动补全”。

### 反馈

如果您关闭了自动补全，我们很希望听到您对如何改进的建议！请通过我们的 [Discord](https://discord.gg/vapESyrFmJ) 或在 GitHub 上提交问题。