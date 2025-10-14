import { injectable, inject } from 'inversify';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { TYPES } from '../../types';
import { ProjectHotReloadConfig } from './ProjectHotReloadService';

export interface HotReloadGlobalConfig {
  enabled: boolean;
  defaultDebounceInterval: number;
  defaultWatchPatterns: string[];
  defaultIgnorePatterns: string[];
  defaultMaxFileSize: number;
  defaultErrorHandling: {
    maxRetries: number;
    alertThreshold: number;
    autoRecovery: boolean;
  };
  enableDetailedLogging: boolean;
  maxConcurrentProjects: number;
}

@injectable()
export class HotReloadConfigService {
  private globalConfig: HotReloadGlobalConfig;
  private projectConfigs: Map<string, Partial<ProjectHotReloadConfig>> = new Map();
  private readonly configFilePath: string;
  
  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService
  ) {
    this.configFilePath = './hotreload.config.json';
    this.globalConfig = this.getDefaultGlobalConfig();
  }
  
  private getDefaultGlobalConfig(): HotReloadGlobalConfig {
    return {
      enabled: true,
      defaultDebounceInterval: 500,
      defaultWatchPatterns: ['**/*.{js,ts,jsx,tsx,json,md,py,go,java,css,html,scss}'],
      defaultIgnorePatterns: [
        '**/node_modules/**',
        '**/.git/**', 
        '**/dist/**',
        '**/build/**', 
        '**/target/**',
        '**/venv/**',
        '**/.vscode/**',
        '**/.idea/**',
        '**/logs/**',
        '**/*.log',
        '**/coverage/**',
        '**/tmp/**',
        '**/temp/**'
      ],
      defaultMaxFileSize: 10 * 1024 * 1024, // 10MB
      defaultErrorHandling: {
        maxRetries: 3,
        alertThreshold: 5,
        autoRecovery: true
      },
      enableDetailedLogging: false,
      maxConcurrentProjects: 5
    };
  }
  
  /**
   * 获取全局热更新配置
   */
  getGlobalConfig(): HotReloadGlobalConfig {
    return { ...this.globalConfig };
  }
  
  /**
   * 更新全局热更新配置
   */
  updateGlobalConfig(config: Partial<HotReloadGlobalConfig>): void {
    this.globalConfig = {
      ...this.globalConfig,
      ...config,
      defaultErrorHandling: {
        ...this.globalConfig.defaultErrorHandling,
        ...(config.defaultErrorHandling || {})
      }
    };
    
    this.logger.info('Global hot reload configuration updated', { config: this.globalConfig });
  }
  
  /**
   * 获取项目特定的热更新配置
   */
 getProjectConfig(projectPath: string): ProjectHotReloadConfig {
    const projectSpecificConfig = this.projectConfigs.get(projectPath) || {};
    
    // 合并全局默认配置和项目特定配置
    return {
      enabled: projectSpecificConfig.enabled ?? this.globalConfig.enabled,
      debounceInterval: projectSpecificConfig.debounceInterval ?? this.globalConfig.defaultDebounceInterval,
      watchPatterns: projectSpecificConfig.watchPatterns ?? this.globalConfig.defaultWatchPatterns,
      ignorePatterns: projectSpecificConfig.ignorePatterns ?? this.globalConfig.defaultIgnorePatterns,
      maxFileSize: projectSpecificConfig.maxFileSize ?? this.globalConfig.defaultMaxFileSize,
      errorHandling: {
        ...this.globalConfig.defaultErrorHandling,
        ...(projectSpecificConfig.errorHandling || {})
      }
    };
  }
  
  /**
   * 设置项目特定的热更新配置
   */
  setProjectConfig(projectPath: string, config: Partial<ProjectHotReloadConfig>): void {
    const existingConfig = this.projectConfigs.get(projectPath) || {};
    const newConfig = { ...existingConfig, ...config };
    
    this.projectConfigs.set(projectPath, newConfig);
    
    this.logger.info(`Project hot reload configuration updated for ${projectPath}`, { config: newConfig });
  }
  
  /**
   * 删除项目配置（恢复为全局默认值）
   */
  removeProjectConfig(projectPath: string): void {
    this.projectConfigs.delete(projectPath);
    this.logger.info(`Project hot reload configuration removed for ${projectPath}`);
  }
  
  /**
   * 获取所有项目的配置
   */
  getAllProjectConfigs(): Map<string, Partial<ProjectHotReloadConfig>> {
    return new Map(this.projectConfigs);
  }
  
  /**
   * 检查热更新是否全局启用
   */
  isGloballyEnabled(): boolean {
    return this.globalConfig.enabled;
  }
  
  /**
   * 检查项目是否启用了热更新
   */
  isProjectEnabled(projectPath: string): boolean {
    return this.getProjectConfig(projectPath).enabled;
  }
  
  /**
   * 验证配置是否有效
   */
  validateConfig(config: Partial<ProjectHotReloadConfig>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (config.debounceInterval !== undefined && config.debounceInterval < 50) {
      errors.push('Debounce interval must be at least 50ms');
    }
    
    if (config.maxFileSize !== undefined && (config.maxFileSize <= 0 || config.maxFileSize > 100 * 1024 * 1024)) {
      errors.push('Max file size must be between 1 byte and 100MB');
    }
    
    if (config.errorHandling?.maxRetries !== undefined && config.errorHandling.maxRetries < 0) {
      errors.push('Max retries must be non-negative');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * 重置为默认配置
   */
  resetToDefaults(): void {
    this.globalConfig = this.getDefaultGlobalConfig();
    this.projectConfigs.clear();
    this.logger.info('Hot reload configuration reset to defaults');
  }
  
  /**
   * 从JSON文件加载配置
   */
  async loadFromFile(filePath?: string): Promise<void> {
    const path = filePath || this.configFilePath;
    try {
      const fs = await import('fs/promises');
      const configContent = await fs.readFile(path, 'utf-8');
      const config = JSON.parse(configContent);
      
      if (config.global) {
        this.updateGlobalConfig(config.global);
      }
      
      if (config.projects) {
        for (const [projectPath, projectConfig] of Object.entries(config.projects)) {
          this.setProjectConfig(projectPath, projectConfig as Partial<ProjectHotReloadConfig>);
        }
      }
      
      this.logger.info(`Hot reload configuration loaded from ${path}`);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        this.logger.info(`Configuration file not found at ${path}, using defaults`);
      } else {
        this.errorHandler.handleError(
          new Error(`Failed to load hot reload configuration: ${error instanceof Error ? error.message : String(error)}`),
          { component: 'HotReloadConfigService', operation: 'loadFromFile', filePath: path }
        );
      }
    }
  }
  
  /**
   * 保存配置到JSON文件
   */
  async saveToFile(filePath?: string): Promise<void> {
    const path = filePath || this.configFilePath;
    try {
      const fs = await import('fs/promises');
      const configToSave = {
        global: this.globalConfig,
        projects: Object.fromEntries(this.projectConfigs)
      };
      
      await fs.writeFile(path, JSON.stringify(configToSave, null, 2), 'utf-8');
      this.logger.info(`Hot reload configuration saved to ${path}`);
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to save hot reload configuration: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'HotReloadConfigService', operation: 'saveToFile', filePath: path }
      );
    }
  }
}