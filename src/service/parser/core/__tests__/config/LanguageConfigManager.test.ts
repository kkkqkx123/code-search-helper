import { LanguageConfigManager, ConfigManagerFactory } from '../../config/LanguageConfigManager';
import { StrategyConfiguration } from '../../../interfaces/ISplitStrategy';

describe('LanguageConfigManager', () => {
 let configManager: LanguageConfigManager;

  beforeEach(() => {
    configManager = new LanguageConfigManager();
  });

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      expect(configManager).toBeInstanceOf(LanguageConfigManager);
    });

    it('should initialize with supported languages', () => {
      const supportedLanguages = configManager.getSupportedLanguages();
      expect(supportedLanguages).toContain('typescript');
      expect(supportedLanguages).toContain('javascript');
      expect(supportedLanguages).toContain('python');
      expect(supportedLanguages).toContain('java');
      expect(supportedLanguages).toContain('go');
    });
  });

  describe('getLanguageConfig', () => {
    it('should return correct configuration for supported language', () => {
      const config = configManager.getLanguageConfig('typescript');
      expect(config.language).toBe('typescript');
      expect(config.fileExtensions).toContain('.ts');
      expect(config.fileExtensions).toContain('.tsx');
      expect(config.chunkTypes).toContain('import_statement');
      expect(config.chunkTypes).toContain('class_declaration');
    });

    it('should return default configuration for unsupported language', () => {
      const config = configManager.getLanguageConfig('unsupported');
      expect(config.language).toBe('default');
      expect(config.fileExtensions).toEqual([]);
    });

    it('should return TypeScript configuration with specific settings', () => {
      const config = configManager.getLanguageConfig('typescript');
      expect(config.defaultChunkConfig.maxChunkSize).toBe(2000);
      expect(config.defaultChunkConfig.minChunkSize).toBe(200);
      expect(config.defaultChunkConfig.preserveComments).toBe(true);
      expect(config.performanceConfig.maxFileSize).toBe(2 * 1024 * 1024);
    });

    it('should return JavaScript configuration with specific settings', () => {
      const config = configManager.getLanguageConfig('javascript');
      expect(config.language).toBe('javascript');
      expect(config.fileExtensions).toContain('.js');
      expect(config.fileExtensions).toContain('.jsx');
    });

    it('should return Python configuration with specific settings', () => {
      const config = configManager.getLanguageConfig('python');
      expect(config.language).toBe('python');
      expect(config.fileExtensions).toContain('.py');
      expect(config.defaultChunkConfig.maxChunkSize).toBe(1500);
    });

    it('should return Java configuration with specific settings', () => {
      const config = configManager.getLanguageConfig('java');
      expect(config.language).toBe('java');
      expect(config.fileExtensions).toContain('.java');
      expect(config.defaultChunkConfig.maxChunkSize).toBe(2500);
    });

    it('should return Go configuration with specific settings', () => {
      const config = configManager.getLanguageConfig('go');
      expect(config.language).toBe('go');
      expect(config.fileExtensions).toContain('.go');
      expect(config.defaultChunkConfig.maxChunkSize).toBe(1800);
    });
  });

  describe('getLanguageConfigByExtension', () => {
    it('should return TypeScript configuration for .ts extension', () => {
      const config = configManager.getLanguageConfigByExtension('.ts');
      expect(config.language).toBe('typescript');
    });

    it('should return TypeScript configuration for .tsx extension', () => {
      const config = configManager.getLanguageConfigByExtension('.tsx');
      expect(config.language).toBe('typescript');
    });

    it('should return JavaScript configuration for .js extension', () => {
      const config = configManager.getLanguageConfigByExtension('.js');
      expect(config.language).toBe('javascript');
    });

    it('should return Python configuration for .py extension', () => {
      const config = configManager.getLanguageConfigByExtension('.py');
      expect(config.language).toBe('python');
    });

    it('should return default configuration for unknown extension', () => {
      const config = configManager.getLanguageConfigByExtension('.unknown');
      expect(config.language).toBe('default');
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return array of supported languages', () => {
      const languages = configManager.getSupportedLanguages();
      expect(Array.isArray(languages)).toBe(true);
      expect(languages.length).toBeGreaterThan(0);
      expect(languages).toContain('typescript');
      expect(languages).toContain('javascript');
      expect(languages).toContain('python');
      expect(languages).toContain('java');
      expect(languages).toContain('go');
    });
  });

  describe('getChunkTypes', () => {
    it('should return chunk types for TypeScript', () => {
      const chunkTypes = configManager.getChunkTypes('typescript');
      expect(chunkTypes).toContain('import_statement');
      expect(chunkTypes).toContain('export_statement');
      expect(chunkTypes).toContain('interface_declaration');
      expect(chunkTypes).toContain('class_declaration');
    });

    it('should return chunk types for JavaScript', () => {
      const chunkTypes = configManager.getChunkTypes('javascript');
      expect(chunkTypes).toContain('import_statement');
      expect(chunkTypes).toContain('export_statement');
      expect(chunkTypes).toContain('class_declaration');
    });

    it('should return chunk types for Python', () => {
      const chunkTypes = configManager.getChunkTypes('python');
      expect(chunkTypes).toContain('import_statement');
      expect(chunkTypes).toContain('class_definition');
      expect(chunkTypes).toContain('function_definition');
    });

    it('should return default chunk types for unsupported language', () => {
      const chunkTypes = configManager.getChunkTypes('unsupported');
      expect(chunkTypes).toContain('function');
      expect(chunkTypes).toContain('class');
      expect(chunkTypes).toContain('module');
    });
  });

  describe('getDefaultConfiguration', () => {
    it('should return strategy configuration for language', () => {
      const config = configManager.getDefaultConfiguration('typescript');
      expect(config.maxChunkSize).toBe(2000);
      expect(config.minChunkSize).toBe(200);
      expect(config.preserveComments).toBe(true);
      expect(config.preserveEmptyLines).toBe(false);
      expect(config.maxNestingLevel).toBe(15);
    });

    it('should return default strategy configuration for unsupported language', () => {
      const config = configManager.getDefaultConfiguration('unsupported');
      expect(config.maxChunkSize).toBe(2000);
      expect(config.minChunkSize).toBe(100);
      expect(config.preserveComments).toBe(true);
      expect(config.preserveEmptyLines).toBe(false);
      expect(config.maxNestingLevel).toBe(10);
    });
 });

  describe('getPerformanceConfig', () => {
    it('should return performance configuration for language', () => {
      const config = configManager.getPerformanceConfig('typescript');
      expect(config.maxFileSize).toBe(2 * 1024 * 1024);
      expect(config.maxParseTime).toBe(8000);
      expect(config.cacheSize).toBe(1500);
      expect(config.enableParallel).toBe(true);
      expect(config.parallelThreads).toBe(4);
    });

    it('should return default performance configuration for unsupported language', () => {
      const config = configManager.getPerformanceConfig('unsupported');
      expect(config.maxFileSize).toBe(1024 * 1024);
      expect(config.maxParseTime).toBe(5000);
      expect(config.cacheSize).toBe(1000);
      expect(config.enableParallel).toBe(true);
      expect(config.parallelThreads).toBe(4);
    });
  });

  describe('getSyntaxRules', () => {
    it('should return syntax rules for TypeScript', () => {
      const rules = configManager.getSyntaxRules('typescript');
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.some(rule => rule.name === 'typescript_interface')).toBe(true);
      expect(rules.some(rule => rule.name === 'typescript_type_alias')).toBe(true);
      expect(rules.some(rule => rule.name === 'typescript_decorator')).toBe(true);
    });

    it('should return syntax rules for JavaScript', () => {
      const rules = configManager.getSyntaxRules('javascript');
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.some(rule => rule.name === 'javascript_class')).toBe(true);
      expect(rules.some(rule => rule.name === 'javascript_arrow_function')).toBe(true);
    });

    it('should return empty array for unsupported language', () => {
      const rules = configManager.getSyntaxRules('unsupported');
      expect(rules).toEqual([]);
    });
  });

  describe('getSpecialRules', () => {
    it('should return special rules for TypeScript', () => {
      const rules = configManager.getSpecialRules('typescript');
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.some(rule => rule.name === 'typescript_generic')).toBe(true);
    });

    it('should return special rules for JavaScript', () => {
      const rules = configManager.getSpecialRules('javascript');
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.some(rule => rule.name === 'javascript_template_literal')).toBe(true);
    });

    it('should return empty array for unsupported language', () => {
      const rules = configManager.getSpecialRules('unsupported');
      expect(rules).toEqual([]);
    });
  });

  describe('isLanguageSupported', () => {
    it('should return true for supported languages', () => {
      expect(configManager.isLanguageSupported('typescript')).toBe(true);
      expect(configManager.isLanguageSupported('javascript')).toBe(true);
      expect(configManager.isLanguageSupported('python')).toBe(true);
      expect(configManager.isLanguageSupported('java')).toBe(true);
      expect(configManager.isLanguageSupported('go')).toBe(true);
    });

    it('should return false for unsupported languages', () => {
      expect(configManager.isLanguageSupported('unsupported')).toBe(false);
      expect(configManager.isLanguageSupported('ruby')).toBe(false);
      expect(configManager.isLanguageSupported('php')).toBe(false);
    });
  });

  describe('addLanguageConfig', () => {
    it('should add new language configuration', () => {
      const newConfig = {
        language: 'ruby',
        fileExtensions: ['.rb'],
        chunkTypes: ['class_definition', 'method_definition'],
        defaultChunkConfig: {
          maxChunkSize: 1500,
          minChunkSize: 100,
          preserveComments: true,
          preserveEmptyLines: false,
          maxNestingLevel: 8
        },
        syntaxRules: [],
        specialRules: [],
        performanceConfig: {
          maxFileSize: 1024 * 1024,
          maxParseTime: 5000,
          cacheSize: 1000,
          enableParallel: true,
          parallelThreads: 2
        }
      };

      configManager.addLanguageConfig(newConfig);
      expect(configManager.isLanguageSupported('ruby')).toBe(true);
      
      const retrievedConfig = configManager.getLanguageConfig('ruby');
      expect(retrievedConfig.language).toBe('ruby');
      expect(retrievedConfig.fileExtensions).toEqual(['.rb']);
    });
  });

  describe('updateLanguageConfig', () => {
    it('should update existing language configuration', () => {
      const updates = {
        defaultChunkConfig: {
          maxChunkSize: 3000,
          minChunkSize: 300
        } as StrategyConfiguration
      };

      configManager.updateLanguageConfig('typescript', updates);
      
      const config = configManager.getLanguageConfig('typescript');
      expect(config.defaultChunkConfig.maxChunkSize).toBe(3000);
      expect(config.defaultChunkConfig.minChunkSize).toBe(300);
      // Other properties should remain unchanged
      expect(config.language).toBe('typescript');
      expect(config.fileExtensions).toContain('.ts');
    });

    it('should update configuration for unsupported language by creating it', () => {
      const updates = {
        language: 'php',
        fileExtensions: ['.php']
      };

      configManager.updateLanguageConfig('php', updates);
      
      const config = configManager.getLanguageConfig('php');
      expect(config.language).toBe('php');
      expect(config.fileExtensions).toEqual(['.php']);
    });
  });

  describe('removeLanguageConfig', () => {
    it('should remove language configuration', () => {
      // Add a language first
      configManager.addLanguageConfig({
        language: 'php',
        fileExtensions: ['.php'],
        chunkTypes: [],
        defaultChunkConfig: {
          maxChunkSize: 2000,
          minChunkSize: 100,
          preserveComments: true,
          preserveEmptyLines: false,
          maxNestingLevel: 10
        },
        syntaxRules: [],
        specialRules: [],
        performanceConfig: {
          maxFileSize: 1024 * 1024,
          maxParseTime: 5000,
          cacheSize: 1000,
          enableParallel: true,
          parallelThreads: 4
        }
      });

      expect(configManager.isLanguageSupported('php')).toBe(true);
      
      configManager.removeLanguageConfig('php');
      expect(configManager.isLanguageSupported('php')).toBe(false);
    });
  });

  describe('getAllConfigs', () => {
    it('should return all configurations as a map', () => {
      const allConfigs = configManager.getAllConfigs();
      expect(allConfigs).toBeInstanceOf(Map);
      expect(allConfigs.size).toBeGreaterThan(0);
      expect(allConfigs.has('typescript')).toBe(true);
      expect(allConfigs.has('javascript')).toBe(true);
      expect(allConfigs.has('python')).toBe(true);
      expect(allConfigs.has('java')).toBe(true);
      expect(allConfigs.has('go')).toBe(true);
    });
  });
});

describe('ConfigManagerFactory', () => {
  it('should return singleton instance', () => {
    const instance1 = ConfigManagerFactory.getInstance();
    const instance2 = ConfigManagerFactory.getInstance();
    
    expect(instance1).toBe(instance2);
  });

  it('should return LanguageConfigManager instance', () => {
    const instance = ConfigManagerFactory.getInstance();
    expect(instance).toBeInstanceOf(LanguageConfigManager);
  });
});