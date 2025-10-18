import { EnvironmentUtils } from '../utils/EnvironmentUtils';
import { HotReloadGlobalConfig } from '../../service/filesystem/HotReloadConfigService';
import { IgnoreConfigFactory } from './IgnoreConfigFactory';

/**
 * 热重载配置工厂
 * 负责生成默认的热重载配置，避免硬编码和循环依赖
 */
export class HotReloadConfigFactory {
  /**
   * 创建默认的全局热重载配置
   * 使用环境变量和默认值，避免硬编码
   */
  static createDefaultGlobalConfig(): HotReloadGlobalConfig {
    return {
      enabled: EnvironmentUtils.parseBoolean('HOT_RELOAD_ENABLED', true),
      defaultDebounceInterval: EnvironmentUtils.parseNumber('HOT_RELOAD_DEBOUNCE_INTERVAL', 500),
      defaultWatchPatterns: EnvironmentUtils.parseArray(
        'HOT_RELOAD_WATCH_PATTERNS',
        ['**/*.{js,ts,jsx,tsx,json,md,py,go,java,css,html,scss}']
      ),
      defaultIgnorePatterns: EnvironmentUtils.parseArray(
        'HOT_RELOAD_IGNORE_PATTERNS',
        IgnoreConfigFactory.createHotReloadIgnorePatterns()
      ),
      defaultMaxFileSize: EnvironmentUtils.parseNumber('HOT_RELOAD_MAX_FILE_SIZE', 10 * 1024 * 1024), // 10MB
      defaultErrorHandling: {
        maxRetries: EnvironmentUtils.parseNumber('HOT_RELOAD_ERROR_MAX_RETRIES', 3),
        alertThreshold: EnvironmentUtils.parseNumber('HOT_RELOAD_ERROR_ALERT_THRESHOLD', 5),
        autoRecovery: EnvironmentUtils.parseBoolean('HOT_RELOAD_ERROR_AUTO_RECOVERY', true)
      },
      enableDetailedLogging: EnvironmentUtils.parseBoolean('HOT_RELOAD_ENABLE_DETAILED_LOGGING', false),
      maxConcurrentProjects: EnvironmentUtils.parseNumber('HOT_RELOAD_MAX_CONCURRENT_PROJECTS', 5)
    };
  }

  /**
   * 创建默认的项目热重载配置
   * 基于全局配置创建项目特定的配置
   */
  static createDefaultProjectConfig(globalConfig?: HotReloadGlobalConfig) {
    const config = globalConfig || this.createDefaultGlobalConfig();
    
    return {
      enabled: config.enabled,
      debounceInterval: config.defaultDebounceInterval,
      watchPatterns: config.defaultWatchPatterns,
      ignorePatterns: config.defaultIgnorePatterns,
      maxFileSize: config.defaultMaxFileSize,
      errorHandling: config.defaultErrorHandling
    };
  }
}