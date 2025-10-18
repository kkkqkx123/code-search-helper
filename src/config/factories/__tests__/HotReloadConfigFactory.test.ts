import { HotReloadConfigFactory } from '../HotReloadConfigFactory';
import { IgnoreConfigFactory } from '../IgnoreConfigFactory';

describe('HotReloadConfigFactory', () => {
  beforeEach(() => {
    // 清除环境变量
    delete process.env.HOT_RELOAD_ENABLED;
    delete process.env.HOT_RELOAD_DEBOUNCE_INTERVAL;
    delete process.env.HOT_RELOAD_MAX_FILE_SIZE;
    delete process.env.HOT_RELOAD_MAX_CONCURRENT_PROJECTS;
    delete process.env.HOT_RELOAD_ENABLE_DETAILED_LOGGING;
    delete process.env.HOT_RELOAD_ERROR_MAX_RETRIES;
    delete process.env.HOT_RELOAD_ERROR_ALERT_THRESHOLD;
    delete process.env.HOT_RELOAD_ERROR_AUTO_RECOVERY;
    delete process.env.HOT_RELOAD_WATCH_PATTERNS;
    delete process.env.HOT_RELOAD_IGNORE_PATTERNS;
  });

  describe('createDefaultGlobalConfig', () => {
    it('should return default configuration when no environment variables are set', () => {
      const config = HotReloadConfigFactory.createDefaultGlobalConfig();
      
      expect(config).toEqual({
        enabled: true,
        defaultDebounceInterval: 500,
        defaultWatchPatterns: ['**/*.{js,ts,jsx,tsx,json,md,py,go,java,css,html,scss}'],
        defaultIgnorePatterns: IgnoreConfigFactory.createHotReloadIgnorePatterns(),
        defaultMaxFileSize: 10 * 1024 * 1024,
        defaultErrorHandling: {
          maxRetries: 3,
          alertThreshold: 5,
          autoRecovery: true
        },
        enableDetailedLogging: false,
        maxConcurrentProjects: 5
      });
    });

    it('should use environment variables when they are set', () => {
      process.env.HOT_RELOAD_ENABLED = 'false';
      process.env.HOT_RELOAD_DEBOUNCE_INTERVAL = '1000';
      process.env.HOT_RELOAD_MAX_FILE_SIZE = '5242880'; // 5MB
      process.env.HOT_RELOAD_MAX_CONCURRENT_PROJECTS = '10';
      process.env.HOT_RELOAD_ENABLE_DETAILED_LOGGING = 'true';
      process.env.HOT_RELOAD_ERROR_MAX_RETRIES = '5';
      process.env.HOT_RELOAD_ERROR_ALERT_THRESHOLD = '10';
      process.env.HOT_RELOAD_ERROR_AUTO_RECOVERY = 'false';
      
      const config = HotReloadConfigFactory.createDefaultGlobalConfig();
      
      expect(config.enabled).toBe(false);
      expect(config.defaultDebounceInterval).toBe(1000);
      expect(config.defaultMaxFileSize).toBe(5242880);
      expect(config.maxConcurrentProjects).toBe(10);
      expect(config.enableDetailedLogging).toBe(true);
      expect(config.defaultErrorHandling.maxRetries).toBe(5);
      expect(config.defaultErrorHandling.alertThreshold).toBe(10);
      expect(config.defaultErrorHandling.autoRecovery).toBe(false);
    });

    it('should parse array patterns from environment variables', () => {
      process.env.HOT_RELOAD_WATCH_PATTERNS = '**/*.js,**/*.ts,**/*.json';
      process.env.HOT_RELOAD_IGNORE_PATTERNS = '**/node_modules/**,**/dist/**';
      
      const config = HotReloadConfigFactory.createDefaultGlobalConfig();
      
      expect(config.defaultWatchPatterns).toEqual(['**/*.js', '**/*.ts', '**/*.json']);
      expect(config.defaultIgnorePatterns).toEqual(['**/node_modules/**', '**/dist/**']);
    });

    it('should parse JSON array patterns from environment variables', () => {
      process.env.HOT_RELOAD_WATCH_PATTERNS = '["**/*.js", "**/*.ts", "**/*.json"]';
      process.env.HOT_RELOAD_IGNORE_PATTERNS = '["**/node_modules/**", "**/dist/**"]';
      
      const config = HotReloadConfigFactory.createDefaultGlobalConfig();
      
      expect(config.defaultWatchPatterns).toEqual(['**/*.js', '**/*.ts', '**/*.json']);
      expect(config.defaultIgnorePatterns).toEqual(['**/node_modules/**', '**/dist/**']);
    });
  });

  describe('createDefaultProjectConfig', () => {
    it('should create project config from global config', () => {
      const globalConfig = HotReloadConfigFactory.createDefaultGlobalConfig();
      const projectConfig = HotReloadConfigFactory.createDefaultProjectConfig(globalConfig);
      
      expect(projectConfig).toEqual({
        enabled: globalConfig.enabled,
        debounceInterval: globalConfig.defaultDebounceInterval,
        watchPatterns: globalConfig.defaultWatchPatterns,
        ignorePatterns: globalConfig.defaultIgnorePatterns,
        maxFileSize: globalConfig.defaultMaxFileSize,
        errorHandling: globalConfig.defaultErrorHandling
      });
    });

    it('should use default global config when none is provided', () => {
      const projectConfig = HotReloadConfigFactory.createDefaultProjectConfig();
      const globalConfig = HotReloadConfigFactory.createDefaultGlobalConfig();
      
      expect(projectConfig).toEqual({
        enabled: globalConfig.enabled,
        debounceInterval: globalConfig.defaultDebounceInterval,
        watchPatterns: globalConfig.defaultWatchPatterns,
        ignorePatterns: globalConfig.defaultIgnorePatterns,
        maxFileSize: globalConfig.defaultMaxFileSize,
        errorHandling: globalConfig.defaultErrorHandling
      });
    });
  });
});