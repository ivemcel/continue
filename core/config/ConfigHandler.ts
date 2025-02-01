import {
  ControlPlaneClient,
  ControlPlaneSessionInfo,
} from "../control-plane/client.js";
import {
  BrowserSerializedContinueConfig,
  ContinueConfig,
  IContextProvider,
  IDE,
  IdeSettings,
  ILLM,
} from "../index.js";
import { GlobalContext } from "../util/GlobalContext.js";
import { finalToBrowserConfig } from "./load.js";
import ControlPlaneProfileLoader from "./profile/ControlPlaneProfileLoader.js";
import { IProfileLoader } from "./profile/IProfileLoader.js";
import LocalProfileLoader from "./profile/LocalProfileLoader.js";

export interface ProfileDescription {
  title: string;
  id: string;
}

// Separately manages saving/reloading each profile
class ProfileLifecycleManager {
  private savedConfig: ContinueConfig | undefined;
  private savedBrowserConfig?: BrowserSerializedContinueConfig;
  private pendingConfigPromise?: Promise<ContinueConfig>;

  constructor(private readonly profileLoader: IProfileLoader) {}

  get profileId() {
    return this.profileLoader.profileId;
  }

  get profileTitle() {
    return this.profileLoader.profileTitle;
  }

  get profileDescription(): ProfileDescription {
    return {
      title: this.profileTitle,
      id: this.profileId,
    };
  }

  clearConfig() {
    this.savedConfig = undefined;
    this.savedBrowserConfig = undefined;
    this.pendingConfigPromise = undefined;
  }

  // Clear saved config and reload
  reloadConfig(): Promise<ContinueConfig> {
    this.savedConfig = undefined;
    this.savedBrowserConfig = undefined;
    this.pendingConfigPromise = undefined;

    return this.profileLoader.doLoadConfig();
  }

  /**
   * 该方法负责加载配置并返回一个 ContinueConfig 对象。async意味着这个方法是一个异步方法，返回的是一个 Promise 对象。
   * @param additionalContextProviders 接受一个 IContextProvider 类型的数组，表示额外的上下文提供者。
   * @returns 该方法返回一个 Promise，它解析为 ContinueConfig 对象。
   */
  async loadConfig(
    additionalContextProviders: IContextProvider[],
  ): Promise<ContinueConfig> {
    // If we already have a config, return it
    // 检查已有配置。如果 this.savedConfig 存在（表示配置已经加载过），则直接返回 this.savedConfig。
    if (this.savedConfig) {
      return this.savedConfig;
    // 检查是否有正在加载的配置：如果配置正在加载（this.pendingConfigPromise 存在），则直接返回这个 Promise，防止多次并发加载配置。
    } else if (this.pendingConfigPromise) {
      return this.pendingConfigPromise;
    }

    // Set pending config promise
    // 创建并启动配置加载
    this.pendingConfigPromise = new Promise(async (resolve, reject) => {
      const newConfig = await this.profileLoader.doLoadConfig();

      // Add registered context providers
      newConfig.contextProviders = (newConfig.contextProviders ?? []).concat(
        additionalContextProviders,
      );

      this.savedConfig = newConfig;
      resolve(newConfig);
    });

    // Wait for the config promise to resolve
    this.savedConfig = await this.pendingConfigPromise;
    this.pendingConfigPromise = undefined;
    return this.savedConfig;
  }

  async getSerializedConfig(
    additionalContextProviders: IContextProvider[],
  ): Promise<BrowserSerializedContinueConfig> {
    if (!this.savedBrowserConfig) {
      const continueConfig = await this.loadConfig(additionalContextProviders);
      this.savedBrowserConfig = finalToBrowserConfig(continueConfig);
    }
    return this.savedBrowserConfig;
  }
}

/**
 * 配置管理核心类，负责管理不同的配置文件，并提供方法进行配置加载、切换等操作。
 */
export class ConfigHandler {
  //用于保存全局状态信息。
  private readonly globalContext = new GlobalContext();
  //用于存储额外的上下文提供者。
  private additionalContextProviders: IContextProvider[] = [];
  //存储配置文件的生命周期管理器实例。
  private profiles: ProfileLifecycleManager[];
  // 当前选择的配置文件ID。
  private selectedProfileId: string;

  constructor(
    //private 表示这个属性只能在类内部访问，readonly 表示该属性一旦初始化后不能被修改。
    private readonly ide: IDE,
    private ideSettingsPromise: Promise<IdeSettings>,
    private readonly writeLog: (text: string) => Promise<void>,
    private controlPlaneClient: ControlPlaneClient,
  ) {
    this.ide = ide;
    this.ideSettingsPromise = ideSettingsPromise;
    this.writeLog = writeLog;

    // Set local profile as default
    const localProfileLoader = new LocalProfileLoader(
      ide,
      ideSettingsPromise,
      controlPlaneClient,
      writeLog,
    );
    this.profiles = [new ProfileLifecycleManager(localProfileLoader)];
    this.selectedProfileId = localProfileLoader.profileId;

    // Always load local profile immediately in case control plane doesn't load
    try {
      this.loadConfig();
    } catch (e) {
      console.error("Failed to load config: ", e);
    }

    // Load control plane profiles
    this.fetchControlPlaneProfiles();
  }

  // This will be the local profile
  private get fallbackProfile() {
    return this.profiles[0];
  }

  get currentProfile() {
    return (
      this.profiles.find((p) => p.profileId === this.selectedProfileId) ??
      this.fallbackProfile
    );
  }

  get inactiveProfiles() {
    return this.profiles.filter((p) => p.profileId !== this.selectedProfileId);
  }

  private async fetchControlPlaneProfiles() {
    // Get the profiles and create their lifecycle managers
    this.controlPlaneClient.listWorkspaces().then(async (workspaces) => {
      this.profiles = this.profiles.filter(
        (profile) => profile.profileId === "local",
      );
      workspaces.forEach((workspace) => {
        const profileLoader = new ControlPlaneProfileLoader(
          workspace.id,
          workspace.name,
          this.controlPlaneClient,
          this.ide,
          this.ideSettingsPromise,
          this.writeLog,
          this.reloadConfig.bind(this),
        );
        this.profiles.push(new ProfileLifecycleManager(profileLoader));
      });

      this.notifyProfileListeners(
        this.profiles.map((profile) => profile.profileDescription),
      );

      // Check the last selected workspace, and reload if it isn't local
      const workspaceId = await this.getWorkspaceId();
      const lastSelectedWorkspaceIds =
        this.globalContext.get("lastSelectedProfileForWorkspace") ?? {};
      const selectedWorkspaceId = lastSelectedWorkspaceIds[workspaceId];
      if (selectedWorkspaceId) {
        this.selectedProfileId = selectedWorkspaceId;
        this.loadConfig();
      } else {
        // Otherwise we stick with local profile, and record choice
        lastSelectedWorkspaceIds[workspaceId] = this.selectedProfileId;
        this.globalContext.update(
          "lastSelectedProfileForWorkspace",
          lastSelectedWorkspaceIds,
        );
      }
    });
  }

  async setSelectedProfile(profileId: string) {
    this.selectedProfileId = profileId;
    const newConfig = await this.loadConfig();
    this.notifyConfigListeners(newConfig);
    const selectedProfiles =
      this.globalContext.get("lastSelectedProfileForWorkspace") ?? {};
    selectedProfiles[await this.getWorkspaceId()] = profileId;
    this.globalContext.update(
      "lastSelectedProfileForWorkspace",
      selectedProfiles,
    );
  }

  // A unique ID for the current workspace, built from folder names
  private async getWorkspaceId(): Promise<string> {
    const dirs = await this.ide.getWorkspaceDirs();
    return dirs.join("&");
  }

  // Automatically refresh config when Continue-related IDE (e.g. VS Code) settings are changed
  updateIdeSettings(ideSettings: IdeSettings) {
    this.ideSettingsPromise = Promise.resolve(ideSettings);
    this.reloadConfig();
  }

  updateControlPlaneSessionInfo(
    sessionInfo: ControlPlaneSessionInfo | undefined,
  ) {
    this.controlPlaneClient = new ControlPlaneClient(
      Promise.resolve(sessionInfo),
    );
    this.fetchControlPlaneProfiles();
  }

  private profilesListeners: ((profiles: ProfileDescription[]) => void)[] = [];
  onDidChangeAvailableProfiles(
    listener: (profiles: ProfileDescription[]) => void,
  ) {
    this.profilesListeners.push(listener);
  }

  private notifyProfileListeners(profiles: ProfileDescription[]) {
    for (const listener of this.profilesListeners) {
      listener(profiles);
    }
  }

  private notifyConfigListeners(newConfig: ContinueConfig) {
    // Notify listeners that config changed
    for (const listener of this.updateListeners) {
      listener(newConfig);
    }
  }

  private updateListeners: ((newConfig: ContinueConfig) => void)[] = [];
  onConfigUpdate(listener: (newConfig: ContinueConfig) => void) {
    this.updateListeners.push(listener);
  }

  async reloadConfig() {
    // TODO: this isn't right, there are two different senses in which you want to "reload"
    const newConfig = await this.currentProfile.reloadConfig();
    this.inactiveProfiles.forEach((profile) => profile.clearConfig());
    this.notifyConfigListeners(newConfig);
  }

  getSerializedConfig(): Promise<BrowserSerializedContinueConfig> {
    return this.currentProfile.getSerializedConfig(
      this.additionalContextProviders,
    );
  }

  listProfiles(): ProfileDescription[] {
    return this.profiles.map((p) => p.profileDescription);
  }

  /**
   * async 关键字表示这是一个异步函数，它会自动返回一个 Promise 对象，表示函数的执行结果在未来某个时刻会得到返回。
   * 由于函数返回一个 Promise<ContinueConfig>，我们可以通过 await 等待它解析出一个 ContinueConfig 对象。
   * @returns loadConfig 会返回一个 Promise，它会解析为 ContinueConfig 类型的配置对象。
   */
  async loadConfig(): Promise<ContinueConfig> {
    return this.currentProfile.loadConfig(this.additionalContextProviders);
  }

  async llmFromTitle(title?: string): Promise<ILLM> {
    const config = await this.loadConfig();
    const model =
      config.models.find((m) => m.title === title) || config.models[0];
    if (!model) {
      throw new Error("No model found");
    }

    return model;
  }

  registerCustomContextProvider(contextProvider: IContextProvider) {
    this.additionalContextProviders.push(contextProvider);
    this.reloadConfig();
  }
}
