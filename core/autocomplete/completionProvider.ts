/**
这段代码是一个自动补全（autocomplete）提供者的实现，主要用于通过集成不同的模型来为用户输入的代码生成智能补全建议。代码涉及到多个服务和功能，例如缓存管理、模板渲染、错误处理、模型选择等。下面我将分步骤介绍这段代码的主要功能：

主要功能和结构
核心服务：这个类 CompletionProvider 提供了自动补全功能，并依赖了多个服务和工具，例如 BracketMatchingService（括号匹配），GeneratorReuseManager（生成器重用管理），以及 ImportDefinitionsService（导入定义服务）等。
自动补全输入（AutocompleteInput）：这个接口定义了自动补全请求的输入参数，包括文件路径、光标位置、最近编辑过的文件内容等。它将用于生成补全建议。
自动补全输出（AutocompleteOutcome）：这个接口定义了自动补全的返回结果，包含了生成的补全内容、提示词、模型名称、缓存命中状态等信息。
补全缓存：通过 AutocompleteLruCache 类，代码实现了一个缓存机制，存储常见的补全内容，以便在后续请求中直接使用，减少计算时间和提升性能。
模板和提示构建：在生成补全时，代码会使用 Handlebars 模板引擎来构建模型请求的提示。模板包含了代码片段、注释、文件路径等信息，以帮助模型理解当前代码上下文。
模型管理：根据配置，代码会选择合适的语言模型（如 OpenAI、Starcoder 等）来进行补全，且支持根据不同的文件类型（如 Python 文件）设置特定的参数。
错误处理：通过 onError 方法，代码会捕获和处理运行时错误，并通过 Telemetry 记录异常情况，确保在出现错误时不会影响用户体验。
回调与状态管理：accept 和 cancelRejectionTimeout 方法用于管理补全请求的接受和取消，避免用户不再需要的补全请求继续占用资源。

补全请求的处理流程
输入处理：
收到一个 AutocompleteInput 请求后，代码首先会检查该请求是否有效。比如，某些文件可能被禁用自动补全，或者请求可能在设置的延迟时间内被忽略（防止过多的重复请求）。
生成补全提示：
根据当前文件的内容、光标位置、最近编辑的代码等，代码生成一个完整的补全提示（prompt）。这包括文件的前缀（prefix）和后缀（suffix）。

请求语言模型：
使用选择的语言模型来生成补全内容。在请求模型时，会根据模型类型（例如 OpenAI 或本地部署的 LLM）设置相关的参数，如温度、停止符号等。

流式生成与后处理：
补全的生成是流式的，即逐步输出生成的文本。流生成器会按行生成补全内容，并进行必要的处理，比如去除多余的空格或换行。
在生成过程中，代码会检查生成的内容，确保它符合预期的格式和样式。

缓存与返回结果：
如果补全结果是通过缓存命中的，直接返回缓存的结果。否则，生成的补全结果会被缓存起来，供下次相同请求使用。

错误处理和警告
在某些情况下，如果模型不适合当前的自动补全任务（例如 GPT 或 Claude 模型的质量较差），代码会抛出警告，提醒用户使用更合适的模型。
错误信息也会被记录，以便开发者调试和优化补全服务。
 */
import ignore from "ignore";
import OpenAI from "openai";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { RangeInFileWithContents } from "../commands/util.js";
import { ConfigHandler } from "../config/ConfigHandler.js";
import { TRIAL_FIM_MODEL } from "../config/onboarding.js";
import { streamLines } from "../diff/util.js";
import {
  IDE,
  ILLM,
  ModelProvider,
  Position,
  Range,
  TabAutocompleteOptions,
} from "../index.js";
import { logDevData } from "../util/devdata.js";
import { getBasename, getLastNPathParts } from "../util/index.js";
import {
  COUNT_COMPLETION_REJECTED_AFTER,
  DEFAULT_AUTOCOMPLETE_OPTS,
} from "../util/parameters.js";
import { Telemetry } from "../util/posthog.js";
import { getRangeInString } from "../util/ranges.js";
import { ImportDefinitionsService } from "./ImportDefinitionsService.js";
import { BracketMatchingService } from "./brackets.js";
import AutocompleteLruCache from "./cache.js";
import {
  noFirstCharNewline,
  onlyWhitespaceAfterEndOfLine,
  stopAtStopTokens,
} from "./charStream.js";
import {
  constructAutocompletePrompt,
  languageForFilepath,
} from "./constructPrompt.js";
import { isOnlyPunctuationAndWhitespace } from "./filter.js";
import { AutocompleteLanguageInfo } from "./languages.js";
import {
  avoidPathLine,
  noTopLevelKeywordsMidline,
  skipPrefixes,
  stopAtLines,
  stopAtRepeatingLines,
  stopAtSimilarLine,
  streamWithNewLines,
} from "./lineStream.js";
import { postprocessCompletion } from "./postprocessing.js";
import { AutocompleteSnippet } from "./ranking.js";
import { RecentlyEditedRange } from "./recentlyEdited.js";
import { getTemplateForModel } from "./templates.js";
import { GeneratorReuseManager } from "./util.js";
// @prettier-ignore
import Handlebars from "handlebars";
import { getConfigJsonPath } from "../util/paths.js";

export interface AutocompleteInput {
  completionId: string;
  filepath: string;
  pos: Position;
  recentlyEditedFiles: RangeInFileWithContents[];
  recentlyEditedRanges: RecentlyEditedRange[];
  clipboardText: string;
  // Used for notebook files
  manuallyPassFileContents?: string;
  // Used for VS Code git commit input box
  manuallyPassPrefix?: string;
  selectedCompletionInfo?: {
    text: string;
    range: Range;
  };
  injectDetails?: string;
}

export interface AutocompleteOutcome extends TabAutocompleteOptions {
  accepted?: boolean;
  time: number;
  prefix: string;
  suffix: string;
  prompt: string;
  completion: string;
  modelProvider: string;
  modelName: string;
  completionOptions: any;
  cacheHit: boolean;
  filepath: string;
  gitRepo?: string;
  completionId: string;
  uniqueId: string;
}

const autocompleteCache = AutocompleteLruCache.get();

const DOUBLE_NEWLINE = "\n\n";
const WINDOWS_DOUBLE_NEWLINE = "\r\n\r\n";
const SRC_DIRECTORY = "/src/";
// Starcoder2 tends to output artifacts starting with the letter "t"
const STARCODER2_T_ARTIFACTS = ["t.", "\nt", "<file_sep>"];
const PYTHON_ENCODING = "#- coding: utf-8";
const CODE_BLOCK_END = "```";

const multilineStops: string[] = [DOUBLE_NEWLINE, WINDOWS_DOUBLE_NEWLINE];
const commonStops = [SRC_DIRECTORY, PYTHON_ENCODING, CODE_BLOCK_END];

// Errors that can be expected on occasion even during normal functioning should not be shown.
// Not worth disrupting the user to tell them that a single autocomplete request didn't go through
const ERRORS_TO_IGNORE = [
  // From Ollama
  "unexpected server status",
];

function formatExternalSnippet(
  filepath: string,
  snippet: string,
  language: AutocompleteLanguageInfo,
) {
  const comment = language.singleLineComment;
  const lines = [
    `${comment} Path: ${getBasename(filepath)}`,
    ...snippet
      .trim()
      .split("\n")
      .map((line) => `${comment} ${line}`),
    comment,
  ];
  return lines.join("\n");
}

let shownGptClaudeWarning = false;
const nonAutocompleteModels = [
  // "gpt",
  // "claude",
  "mistral",
  "instruct",
];

export type GetLspDefinitionsFunction = (
  filepath: string,
  contents: string,
  cursorIndex: number,
  ide: IDE,
  lang: AutocompleteLanguageInfo,
) => Promise<AutocompleteSnippet[]>;

export class CompletionProvider {
  private static debounceTimeout: NodeJS.Timeout | undefined = undefined;
  private static debouncing = false;
  private static lastUUID: string | undefined = undefined;

  constructor(
    private readonly configHandler: ConfigHandler,
    private readonly ide: IDE,
    private readonly getLlm: () => Promise<ILLM | undefined>,
    private readonly _onError: (e: any) => void,
    private readonly getDefinitionsFromLsp: GetLspDefinitionsFunction,
  ) {
    this.generatorReuseManager = new GeneratorReuseManager(
      this.onError.bind(this),
    );
    this.importDefinitionsService = new ImportDefinitionsService(this.ide);
  }

  private importDefinitionsService: ImportDefinitionsService;
  private generatorReuseManager: GeneratorReuseManager;
  private autocompleteCache = AutocompleteLruCache.get();
  public errorsShown: Set<string> = new Set();
  private bracketMatchingService = new BracketMatchingService();
  // private nearbyDefinitionsService = new NearbyDefinitionsService();

  private onError(e: any) {
    console.warn("Error generating autocompletion: ", e);
    if (
      ERRORS_TO_IGNORE.some((err) =>
        typeof e === "string" ? e.includes(err) : e?.message?.includes(err),
      )
    ) {
      return;
    }
    if (!this.errorsShown.has(e.message)) {
      this.errorsShown.add(e.message);
      this._onError(e);
    }
  }

  public cancel() {
    this._abortControllers.forEach((abortController, id) => {
      abortController.abort();
    });
    this._abortControllers.clear();
  }

  // Key is completionId
  private _abortControllers = new Map<string, AbortController>();
  private _logRejectionTimeouts = new Map<string, NodeJS.Timeout>();
  private _outcomes = new Map<string, AutocompleteOutcome>();

  public accept(completionId: string) {
    if (this._logRejectionTimeouts.has(completionId)) {
      clearTimeout(this._logRejectionTimeouts.get(completionId));
      this._logRejectionTimeouts.delete(completionId);
    }

    if (this._outcomes.has(completionId)) {
      const outcome = this._outcomes.get(completionId)!;
      outcome.accepted = true;
      logDevData("autocomplete", outcome);
      Telemetry.capture(
        "autocomplete",
        {
          accepted: outcome.accepted,
          modelName: outcome.modelName,
          modelProvider: outcome.modelProvider,
          time: outcome.time,
          cacheHit: outcome.cacheHit,
        },
        true,
      );
      this._outcomes.delete(completionId);

      this.bracketMatchingService.handleAcceptedCompletion(
        outcome.completion,
        outcome.filepath,
      );
    }
  }

  public cancelRejectionTimeout(completionId: string) {
    if (this._logRejectionTimeouts.has(completionId)) {
      clearTimeout(this._logRejectionTimeouts.get(completionId)!);
      this._logRejectionTimeouts.delete(completionId);
    }

    if (this._outcomes.has(completionId)) {
      this._outcomes.delete(completionId);
    }
  }

  public async provideInlineCompletionItems(
    input: AutocompleteInput,
    token: AbortSignal | undefined,
  ): Promise<AutocompleteOutcome | undefined> {
    try {
      // Debounce
      const uuid = uuidv4();
      CompletionProvider.lastUUID = uuid;

      const config = await this.configHandler.loadConfig();
      const options = {
        ...DEFAULT_AUTOCOMPLETE_OPTS,
        ...config.tabAutocompleteOptions,
      };

      // Check whether we're in the continue config.json file
      if (input.filepath === getConfigJsonPath()) {
        return undefined;
      }

      // Check whether autocomplete is disabled for this file
      if (options.disableInFiles) {
        // Relative path needed for `ignore`
        const workspaceDirs = await this.ide.getWorkspaceDirs();
        let filepath = input.filepath;
        for (const workspaceDir of workspaceDirs) {
          if (filepath.startsWith(workspaceDir)) {
            filepath = path.relative(workspaceDir, filepath);
            break;
          }
        }

        // Worst case we can check filetype glob patterns
        if (filepath === input.filepath) {
          filepath = getBasename(filepath);
        }

        // @ts-ignore
        const pattern = ignore.default().add(options.disableInFiles);
        if (pattern.ignores(filepath)) {
          return undefined;
        }
      }

      // Create abort signal if not given
      if (!token) {
        const controller = new AbortController();
        token = controller.signal;
        this._abortControllers.set(input.completionId, controller);
      }

      // Allow disabling autocomplete from config.json
      if (options.disable) {
        return undefined;
      }

      // Debounce
      if (CompletionProvider.debouncing) {
        CompletionProvider.debounceTimeout?.refresh();
        const lastUUID = await new Promise((resolve) =>
          setTimeout(() => {
            resolve(CompletionProvider.lastUUID);
          }, options.debounceDelay),
        );
        if (uuid !== lastUUID) {
          return undefined;
        }
      } else {
        CompletionProvider.debouncing = true;
        CompletionProvider.debounceTimeout = setTimeout(async () => {
          CompletionProvider.debouncing = false;
        }, options.debounceDelay);
      }

      // Get completion
      const llm = await this.getLlm();
      if (!llm) {
        return undefined;
      }

      // Set temperature (but don't overrride)
      if (llm.completionOptions.temperature === undefined) {
        llm.completionOptions.temperature = 0.01;
      }

      // Set model-specific options
      const LOCAL_PROVIDERS: ModelProvider[] = [
        "ollama",
        "lmstudio",
        "llama.cpp",
        "llamafile",
        "text-gen-webui",
      ];
      if (
        !config.tabAutocompleteOptions?.maxPromptTokens &&
        LOCAL_PROVIDERS.includes(llm.providerName)
      ) {
        options.maxPromptTokens = 500;
      }

      const outcome = await this.getTabCompletion(token, options, llm, input);

      if (!outcome?.completion) {
        return undefined;
      }

      // Filter out unwanted results
      if (isOnlyPunctuationAndWhitespace(outcome.completion)) {
        return undefined;
      }

      // Do some stuff later so as not to block return. Latency matters
      const completionToCache = outcome.completion;
      setTimeout(async () => {
        if (!outcome.cacheHit) {
          (await this.autocompleteCache).put(outcome.prefix, completionToCache);
        }
      }, 100);

      return outcome;
    } catch (e: any) {
      this.onError(e);
    } finally {
      this._abortControllers.delete(input.completionId);
    }
  }

  _lastDisplayedCompletion: { id: string; displayedAt: number } | undefined =
    undefined;

  markDisplayed(completionId: string, outcome: AutocompleteOutcome) {
    const logRejectionTimeout = setTimeout(() => {
      // Wait 10 seconds, then assume it wasn't accepted
      outcome.accepted = false;
      logDevData("autocomplete", outcome);
      const { prompt, completion, ...restOfOutcome } = outcome;
      Telemetry.capture(
        "autocomplete",
        {
          ...restOfOutcome,
        },
        true,
      );
      this._logRejectionTimeouts.delete(completionId);
    }, COUNT_COMPLETION_REJECTED_AFTER);
    this._outcomes.set(completionId, outcome);
    this._logRejectionTimeouts.set(completionId, logRejectionTimeout);

    // If the previously displayed completion is still waiting for rejection,
    // and this one is a continuation of that (the outcome.completion is the same modulo prefix)
    // then we should cancel the rejection timeout
    const previous = this._lastDisplayedCompletion;
    const now = Date.now();
    if (previous && this._logRejectionTimeouts.has(previous.id)) {
      const previousOutcome = this._outcomes.get(previous.id);
      const c1 = previousOutcome?.completion.split("\n")[0] ?? "";
      const c2 = outcome.completion.split("\n")[0];
      if (
        previousOutcome &&
        (c1.endsWith(c2) ||
          c2.endsWith(c1) ||
          c1.startsWith(c2) ||
          c2.startsWith(c1))
      ) {
        this.cancelRejectionTimeout(previous.id);
      } else if (now - previous.displayedAt < 500) {
        // If a completion isn't shown for more than
        this.cancelRejectionTimeout(previous.id);
      }
    }

    this._lastDisplayedCompletion = {
      id: completionId,
      displayedAt: now,
    };
  }

  async getTabCompletion(
    token: AbortSignal,
    options: TabAutocompleteOptions,
    llm: ILLM,
    input: AutocompleteInput,
  ): Promise<AutocompleteOutcome | undefined> {
    const startTime = Date.now();

    const {
      filepath,
      pos,
      recentlyEditedFiles,
      recentlyEditedRanges,
      clipboardText,
      manuallyPassFileContents,
      manuallyPassPrefix,
    } = input;
    const fileContents =
      manuallyPassFileContents ?? (await this.ide.readFile(filepath));
    const fileLines = fileContents.split("\n");

    // Filter
    const lang = languageForFilepath(filepath);
    const line = fileLines[pos.line] ?? "";
    for (const endOfLine of lang.endOfLine) {
      if (line.endsWith(endOfLine) && pos.character >= line.length) {
        return undefined;
      }
    }

    // Model
    if (!llm) {
      return;
    }
    if (llm instanceof OpenAI) {
      llm.useLegacyCompletionsEndpoint = true;
    } else if (
      llm.providerName === "free-trial" &&
      llm.model !== TRIAL_FIM_MODEL
    ) {
      llm.model = TRIAL_FIM_MODEL;
    }

    if (
      !shownGptClaudeWarning &&
      nonAutocompleteModels.some((model) => llm.model.includes(model)) &&
      !llm.model.toLowerCase().includes("deepseek") &&
      !llm.model.toLowerCase().includes("codestral")
    ) {
      shownGptClaudeWarning = true;
      throw new Error(
        `Warning: ${llm.model} is not trained for tab-autocomplete, and will result in low-quality suggestions. See the docs to learn more about why: https://docs.continue.dev/features/tab-autocomplete#i-want-better-completions-should-i-use-gpt-4`,
      );
    }

    // Prompt
    let fullPrefix =
      getRangeInString(fileContents, {
        start: { line: 0, character: 0 },
        end: input.selectedCompletionInfo?.range.start ?? pos,
      }) + (input.selectedCompletionInfo?.text ?? "");

    if (input.injectDetails) {
      const lines = fullPrefix.split("\n");
      fullPrefix = `${lines.slice(0, -1).join("\n")}\n${
        lang.singleLineComment
      } ${input.injectDetails.split("\n").join(`\n${lang.singleLineComment} `)}\n${
        lines[lines.length - 1]
      }`;
    }

    const fullSuffix = getRangeInString(fileContents, {
      start: pos,
      end: { line: fileLines.length - 1, character: Number.MAX_SAFE_INTEGER },
    });

    // First non-whitespace line below the cursor
    let lineBelowCursor = "";
    let i = 1;
    while (
      lineBelowCursor.trim() === "" &&
      pos.line + i <= fileLines.length - 1
    ) {
      lineBelowCursor = fileLines[Math.min(pos.line + i, fileLines.length - 1)];
      i++;
    }

    let extrasSnippets = options.useOtherFiles
      ? ((await Promise.race([
          this.getDefinitionsFromLsp(
            filepath,
            fullPrefix + fullSuffix,
            fullPrefix.length,
            this.ide,
            lang,
          ),
          new Promise((resolve) => {
            setTimeout(() => resolve([]), 100);
          }),
        ])) as AutocompleteSnippet[])
      : [];

    const workspaceDirs = await this.ide.getWorkspaceDirs();
    if (options.onlyMyCode) {
      extrasSnippets = extrasSnippets.filter((snippet) => {
        return workspaceDirs.some((dir) => snippet.filepath.startsWith(dir));
      });
    }

    let { prefix, suffix, completeMultiline, snippets } =
      await constructAutocompletePrompt(
        filepath,
        pos.line,
        fullPrefix,
        fullSuffix,
        clipboardText,
        lang,
        options,
        recentlyEditedRanges,
        recentlyEditedFiles,
        llm.model,
        extrasSnippets,
        this.importDefinitionsService,
      );

    // If prefix is manually passed
    if (manuallyPassPrefix) {
      prefix = manuallyPassPrefix;
      suffix = "";
    }

    // Template prompt
    const {
      template,
      completionOptions,
      compilePrefixSuffix = undefined,
    } = options.template
      ? { template: options.template, completionOptions: {} }
      : getTemplateForModel(llm.model);

    let prompt: string;
    const filename = getBasename(filepath);
    const reponame = getBasename(workspaceDirs[0] ?? "myproject");

    // Some models have prompts that need two passes. This lets us pass the compiled prefix/suffix
    // into either the 2nd template to generate a raw string, or to pass prefix, suffix to a FIM endpoint
    if (compilePrefixSuffix) {
      [prefix, suffix] = compilePrefixSuffix(
        prefix,
        suffix,
        filepath,
        reponame,
        snippets,
      );
    }

    if (typeof template === "string") {
      const compiledTemplate = Handlebars.compile(template);

      // Format snippets as comments and prepend to prefix
      const formattedSnippets = snippets
        .map((snippet) =>
          formatExternalSnippet(snippet.filepath, snippet.contents, lang),
        )
        .join("\n");
      if (formattedSnippets.length > 0) {
        prefix = `${formattedSnippets}\n\n${prefix}`;
      } else if (prefix.trim().length === 0 && suffix.trim().length === 0) {
        // If it's an empty file, include the file name as a comment
        prefix = `${lang.singleLineComment} ${getLastNPathParts(filepath, 2)}\n${prefix}`;
      }

      prompt = compiledTemplate({
        prefix,
        suffix,
        filename,
        reponame,
        language: lang.name,
      });
    } else {
      // Let the template function format snippets
      prompt = template(
        prefix,
        suffix,
        filepath,
        reponame,
        lang.name,
        snippets,
      );
    }

    // Completion
    let completion = "";

    const cache = await autocompleteCache;
    const cachedCompletion = options.useCache
      ? await cache.get(prefix)
      : undefined;
    let cacheHit = false;
    if (cachedCompletion) {
      // Cache
      cacheHit = true;
      completion = cachedCompletion;
    } else {
      const stop = [
        ...(completionOptions?.stop || []),
        ...multilineStops,
        ...commonStops,
        ...(llm.model.toLowerCase().includes("starcoder2")
          ? STARCODER2_T_ARTIFACTS
          : []),
        ...(lang.stopWords ?? []),
        ...lang.topLevelKeywords.map((word) => `\n${word}`),
      ];

      let langMultilineDecision = lang.useMultiline?.({ prefix, suffix });
      let multiline: boolean = false;
      if (langMultilineDecision) {
        multiline = langMultilineDecision;
      } else {
        multiline =
          !input.selectedCompletionInfo && // Only ever single-line if using intellisense selected value
          options.multilineCompletions !== "never" &&
          (options.multilineCompletions === "always" || completeMultiline);
      }

      // Try to reuse pending requests if what the user typed matches start of completion
      const generator = this.generatorReuseManager.getGenerator(
        prefix,
        () =>
          llm.supportsFim()
            ? llm.streamFim(prefix, suffix, {
                ...completionOptions,
                stop,
              })
            : llm.streamComplete(prompt, {
                ...completionOptions,
                raw: true,
                stop,
              }),
        multiline,
      );

      // Full stop means to stop the LLM's generation, instead of just truncating the displayed completion
      const fullStop = () =>
        this.generatorReuseManager.currentGenerator?.cancel();

      // LLM
      let cancelled = false;
      const generatorWithCancellation = async function* () {
        for await (const update of generator) {
          if (token.aborted) {
            cancelled = true;
            return;
          }
          yield update;
        }
      };
      let charGenerator = generatorWithCancellation();
      charGenerator = noFirstCharNewline(charGenerator);
      charGenerator = onlyWhitespaceAfterEndOfLine(
        charGenerator,
        lang.endOfLine,
        fullStop,
      );
      charGenerator = stopAtStopTokens(charGenerator, stop);
      charGenerator = this.bracketMatchingService.stopOnUnmatchedClosingBracket(
        charGenerator,
        prefix,
        suffix,
        filepath,
        multiline,
      );

      let lineGenerator = streamLines(charGenerator);
      lineGenerator = stopAtLines(lineGenerator, fullStop);
      lineGenerator = stopAtRepeatingLines(lineGenerator, fullStop);
      lineGenerator = avoidPathLine(lineGenerator, lang.singleLineComment);
      lineGenerator = skipPrefixes(lineGenerator);
      lineGenerator = noTopLevelKeywordsMidline(
        lineGenerator,
        lang.topLevelKeywords,
        fullStop,
      );

      for (const lineFilter of lang.lineFilters ?? []) {
        lineGenerator = lineFilter({ lines: lineGenerator, fullStop });
      }

      lineGenerator = streamWithNewLines(lineGenerator);

      const finalGenerator = stopAtSimilarLine(
        lineGenerator,
        lineBelowCursor,
        fullStop,
      );

      try {
        for await (const update of finalGenerator) {
          completion += update;
        }
      } catch (e: any) {
        if (ERRORS_TO_IGNORE.some((err) => e.includes(err))) {
          return undefined;
        }
        throw e;
      }

      if (cancelled) {
        return undefined;
      }

      const processedCompletion = postprocessCompletion({
        completion,
        prefix,
        suffix,
        llm,
      });

      if (!processedCompletion) {
        return undefined;
      }
      completion = processedCompletion;
    }

    const time = Date.now() - startTime;
    return {
      time,
      completion,
      prefix,
      suffix,
      prompt,
      modelProvider: llm.providerName,
      modelName: llm.model,
      completionOptions,
      cacheHit,
      filepath: input.filepath,
      completionId: input.completionId,
      gitRepo: await this.ide.getRepoName(input.filepath),
      uniqueId: await this.ide.getUniqueId(),
      ...options,
    };
  }
}
