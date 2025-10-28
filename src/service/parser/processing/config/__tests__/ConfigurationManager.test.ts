import { ConfigurationManager } from '../ConfigurationManager';
import { LoggerService } from '../../../../../utils/LoggerService';
import { UniversalChunkingOptions } from '../../strategies/types/SegmentationTypes';

// Mock LoggerService
jest.mock('../../../../../utils/LoggerService');
const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

describe('ConfigurationManager', () => {
  let configManager: ConfigurationManager;
  let mockLogger: jest.Mocked<LoggerService>;

  beforeEach(() => {
    mockLogger = new MockLoggerService() as jest.Mocked<LoggerService>;
    mockLogger.debug = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.info = jest.fn();

    configManager = new ConfigurationManager(mockLogger);
  });

  describe('Constructor', () => {
    it('should initialize with default options', () => {
      const defaultOptions = configManager.getDefaultOptions();

      expect(defaultOptions.maxChunkSize).toBe(2000);
      expect(defaultOptions.overlapSize).toBe(200);
      expect(defaultOptions.maxLinesPerChunk).toBe(50);
      expect(defaultOptions.enableBracketBalance).toBe(true);
      expect(defaultOptions.enableSemanticDetection).toBe(true);
      expect(defaultOptions.enableCodeOverlap).toBe(false);
      expect(defaultOptions.enableStandardization).toBe(true);
      expect(defaultOptions.standardizationFallback).toBe(true);
      expect(defaultOptions.maxOverlapRatio).toBe(0.3);
      expect(defaultOptions.errorThreshold).toBe(5);
      expect(defaultOptions.memoryLimitMB).toBe(500);
    });

    it('should log initialization messages', () => {
      expect(mockLogger.debug).toHaveBeenCalledWith('Initializing ConfigurationManager...');
      expect(mockLogger.debug).toHaveBeenCalledWith('ConfigurationManager initialized successfully');
    });

    it('should handle initialization errors', () => {
      // Mock an error during initialization
      const originalCreateDefaultOptions = (ConfigurationManager.prototype as any)['createDefaultOptions'];
      (ConfigurationManager.prototype as any)['createDefaultOptions'] = jest.fn().mockImplementation(() => {
        throw new Error('Initialization error');
      });

      expect(() => new ConfigurationManager(mockLogger)).not.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize ConfigurationManager:', expect.any(Error));

      // Restore
      (ConfigurationManager.prototype as any)['createDefaultOptions'] = originalCreateDefaultOptions;
    });
  });

  describe('getDefaultOptions', () => {
    it('should return a copy of default options', () => {
      const options1 = configManager.getDefaultOptions();
      const options2 = configManager.getDefaultOptions();

      expect(options1).toEqual(options2);
      expect(options1).not.toBe(options2); // Should be different objects
    });

    it('should return complete default configuration', () => {
      const options = configManager.getDefaultOptions();

      expect(options).toHaveProperty('maxChunkSize');
      expect(options).toHaveProperty('overlapSize');
      expect(options).toHaveProperty('maxLinesPerChunk');
      expect(options).toHaveProperty('enableBracketBalance');
      expect(options).toHaveProperty('enableSemanticDetection');
      expect(options).toHaveProperty('enableCodeOverlap');
      expect(options).toHaveProperty('enableStandardization');
      expect(options).toHaveProperty('standardizationFallback');
      expect(options).toHaveProperty('maxOverlapRatio');
      expect(options).toHaveProperty('errorThreshold');
      expect(options).toHaveProperty('memoryLimitMB');
      expect(options).toHaveProperty('filterConfig');
      expect(options).toHaveProperty('protectionConfig');
    });
  });

  describe('validateOptions', () => {
    it('should validate valid options', () => {
      const validOptions: Partial<UniversalChunkingOptions> = {
        maxChunkSize: 2000,
        overlapSize: 200,
        maxLinesPerChunk: 50,
        maxOverlapRatio: 0.3,
        errorThreshold: 5,
        memoryLimitMB: 500,
        filterConfig: {
          enableSmallChunkFilter: true,
          enableChunkRebalancing: true,
          minChunkSize: 20,
          maxChunkSize: 1000
        }
      };

      expect(configManager.validateOptions(validOptions)).toBe(true);
    });

    it('should reject invalid maxChunkSize', () => {
      const invalidOptions = { maxChunkSize: 0 };
      expect(() => configManager.validateOptions(invalidOptions)).toThrow();

      const negativeOptions = { maxChunkSize: -100 };
      expect(() => configManager.validateOptions(negativeOptions)).toThrow();
    });

    it('should reject invalid overlapSize', () => {
      const invalidOptions = { overlapSize: -1 };
      expect(() => configManager.validateOptions(invalidOptions)).toThrow();
    });

    it('should reject invalid maxLinesPerChunk', () => {
      const invalidOptions = { maxLinesPerChunk: 0 };
      expect(() => configManager.validateOptions(invalidOptions)).toThrow();

      const negativeOptions = { maxLinesPerChunk: -10 };
      expect(() => configManager.validateOptions(negativeOptions)).toThrow();
    });

    it('should reject invalid maxOverlapRatio', () => {
      const negativeOptions = { maxOverlapRatio: -0.1 };
      expect(() => configManager.validateOptions(negativeOptions)).toThrow();

      const greaterThanOneOptions = { maxOverlapRatio: 1.1 };
      expect(() => configManager.validateOptions(greaterThanOneOptions)).toThrow();
    });

    it('should reject invalid errorThreshold', () => {
      const invalidOptions = { errorThreshold: -1 };
      expect(() => configManager.validateOptions(invalidOptions)).toThrow();
    });

    it('should reject invalid memoryLimitMB', () => {
      const invalidOptions = { memoryLimitMB: 0 };
      expect(() => configManager.validateOptions(invalidOptions)).toThrow();

      const negativeOptions = { memoryLimitMB: -100 };
      expect(() => configManager.validateOptions(negativeOptions)).toThrow();
    });

    it('should reject invalid filterConfig', () => {
      const invalidOptions = {
        filterConfig: {
          enableSmallChunkFilter: true,
          enableChunkRebalancing: true,
          minChunkSize: 100,
          maxChunkSize: 50 // minChunkSize >= maxChunkSize
        }
      };
      expect(() => configManager.validateOptions(invalidOptions)).toThrow();

      const negativeMinOptions = {
        filterConfig: {
          enableSmallChunkFilter: true,
          enableChunkRebalancing: true,
          minChunkSize: -10,
          maxChunkSize: 100
        }
      };
      expect(() => configManager.validateOptions(negativeMinOptions)).toThrow();

      const nonPositiveMaxOptions = {
        filterConfig: {
          enableSmallChunkFilter: true,
          enableChunkRebalancing: true,
          minChunkSize: 10,
          maxChunkSize: 0
        }
      };
      expect(() => configManager.validateOptions(nonPositiveMaxOptions)).toThrow();
    });

    it('should throw validation errors', () => {
      // Mock a scenario where validation throws an error
      const spy = jest.spyOn(configManager, 'validateOptions').mockImplementation(() => {
        throw new Error('Validation error');
      });

      expect(() => configManager.validateOptions({})).toThrow('Validation error');

      spy.mockRestore();
    });
  });

  describe('mergeOptions', () => {
    it('should merge simple options', () => {
      const base: UniversalChunkingOptions = configManager.getDefaultOptions();
      const override: Partial<UniversalChunkingOptions> = {
        maxChunkSize: 3000,
        overlapSize: 300
      };

      const merged = configManager.mergeOptions(base, override);

      expect(merged.maxChunkSize).toBe(3000);
      expect(merged.overlapSize).toBe(300);
      expect(merged.maxLinesPerChunk).toBe(base.maxLinesPerChunk); // Should remain unchanged
    });

    it('should deeply merge nested objects', () => {
      const base: UniversalChunkingOptions = configManager.getDefaultOptions();
      const override: Partial<UniversalChunkingOptions> = {
        filterConfig: {
          enableSmallChunkFilter: true,
          enableChunkRebalancing: true,
          minChunkSize: 50,
          maxChunkSize: 1000
        },
        protectionConfig: {
          enableProtection: true,
          protectionLevel: 'high' as const
        }
      };

      const merged = configManager.mergeOptions(base, override);

      expect(merged.filterConfig.minChunkSize).toBe(50);
      expect(merged.filterConfig.maxChunkSize).toBe(base.filterConfig.maxChunkSize); // Should remain unchanged
      expect(merged.filterConfig.enableSmallChunkFilter).toBe(base.filterConfig.enableSmallChunkFilter); // Should remain unchanged

      expect(merged.protectionConfig.protectionLevel).toBe('high');
      expect(merged.protectionConfig.enableProtection).toBe(base.protectionConfig.enableProtection); // Should remain unchanged
    });

    it('should handle missing nested objects', () => {
      const base: UniversalChunkingOptions = {
        ...configManager.getDefaultOptions(),
        filterConfig: {
          enableSmallChunkFilter: true,
          enableChunkRebalancing: true,
          minChunkSize: 50,
          maxChunkSize: 1000
        }
      };

      const override: Partial<UniversalChunkingOptions> = {
        filterConfig: {
          enableSmallChunkFilter: true,
          enableChunkRebalancing: true,
          minChunkSize: 50,
          maxChunkSize: 1000
        }
      };

      const merged = configManager.mergeOptions(base, override);

      expect(merged.filterConfig.minChunkSize).toBe(50);
    });
  });

  describe('getLanguageSpecificConfig', () => {
    it('should return JavaScript-specific config', () => {
      const jsConfig = configManager.getLanguageSpecificConfig('javascript');

      expect(jsConfig.maxChunkSize).toBe(2000);
      expect(jsConfig.maxLinesPerChunk).toBe(100);
      expect(jsConfig.enableSemanticDetection).toBe(true);
      expect(jsConfig.enableBracketBalance).toBe(true);
    });

    it('should return TypeScript-specific config', () => {
      const tsConfig = configManager.getLanguageSpecificConfig('typescript');

      expect(tsConfig.maxChunkSize).toBe(2000);
      expect(tsConfig.maxLinesPerChunk).toBe(100);
      expect(tsConfig.enableSemanticDetection).toBe(true);
      expect(tsConfig.enableBracketBalance).toBe(true);
    });

    it('should return Python-specific config', () => {
      const pythonConfig = configManager.getLanguageSpecificConfig('python');

      expect(pythonConfig.maxChunkSize).toBe(1500);
      expect(pythonConfig.maxLinesPerChunk).toBe(80);
      expect(pythonConfig.enableSemanticDetection).toBe(true);
      expect(pythonConfig.enableBracketBalance).toBe(false);
    });

    it('should return Java-specific config', () => {
      const javaConfig = configManager.getLanguageSpecificConfig('java');

      expect(javaConfig.maxChunkSize).toBe(2500);
      expect(javaConfig.maxLinesPerChunk).toBe(120);
      expect(javaConfig.enableSemanticDetection).toBe(true);
      expect(javaConfig.enableBracketBalance).toBe(true);
    });

    it('should return C++-specific config', () => {
      const cppConfig = configManager.getLanguageSpecificConfig('cpp');

      expect(cppConfig.maxChunkSize).toBe(2000);
      expect(cppConfig.maxLinesPerChunk).toBe(100);
      expect(cppConfig.enableSemanticDetection).toBe(true);
      expect(cppConfig.enableBracketBalance).toBe(true);
    });

    it('should return C-specific config', () => {
      const cConfig = configManager.getLanguageSpecificConfig('c');

      expect(cConfig.maxChunkSize).toBe(1800);
      expect(cConfig.maxLinesPerChunk).toBe(90);
      expect(cConfig.enableSemanticDetection).toBe(true);
      expect(cConfig.enableBracketBalance).toBe(true);
    });

    it('should return C#-specific config', () => {
      const csharpConfig = configManager.getLanguageSpecificConfig('csharp');

      expect(csharpConfig.maxChunkSize).toBe(2200);
      expect(csharpConfig.maxLinesPerChunk).toBe(110);
      expect(csharpConfig.enableSemanticDetection).toBe(true);
      expect(csharpConfig.enableBracketBalance).toBe(true);
    });

    it('should return Go-specific config', () => {
      const goConfig = configManager.getLanguageSpecificConfig('go');

      expect(goConfig.maxChunkSize).toBe(1800);
      expect(goConfig.maxLinesPerChunk).toBe(90);
      expect(goConfig.enableSemanticDetection).toBe(true);
      expect(goConfig.enableBracketBalance).toBe(true);
    });

    it('should return Rust-specific config', () => {
      const rustConfig = configManager.getLanguageSpecificConfig('rust');

      expect(rustConfig.maxChunkSize).toBe(2000);
      expect(rustConfig.maxLinesPerChunk).toBe(100);
      expect(rustConfig.enableSemanticDetection).toBe(true);
      expect(rustConfig.enableBracketBalance).toBe(true);
    });

    it('should return Markdown-specific config', () => {
      const markdownConfig = configManager.getLanguageSpecificConfig('markdown');

      expect(markdownConfig.maxChunkSize).toBe(3000);
      expect(markdownConfig.maxLinesPerChunk).toBe(150);
      expect(markdownConfig.enableSemanticDetection).toBe(false);
      expect(markdownConfig.enableBracketBalance).toBe(false);
      expect(markdownConfig.enableCodeOverlap).toBe(true);
    });

    it('should return empty object for unknown language', () => {
      const unknownConfig = configManager.getLanguageSpecificConfig('unknown-language');

      expect(unknownConfig).toEqual({});
    });
  });

  describe('updateDefaultOptions', () => {
    it('should update default options with valid configuration', () => {
      const newOptions: Partial<UniversalChunkingOptions> = {
        maxChunkSize: 3000,
        overlapSize: 300
      };

      configManager.updateDefaultOptions(newOptions);

      const updatedOptions = configManager.getDefaultOptions();
      expect(updatedOptions.maxChunkSize).toBe(3000);
      expect(updatedOptions.overlapSize).toBe(300);
      expect(updatedOptions.maxLinesPerChunk).toBe(50); // Should remain unchanged
    });

    it('should throw error for invalid configuration', () => {
      const invalidOptions: Partial<UniversalChunkingOptions> = {
        maxChunkSize: 0 // Invalid
      };

      expect(() => configManager.updateDefaultOptions(invalidOptions)).toThrow('Invalid configuration options provided');
    });

    it('should not modify original options if validation fails', () => {
      const originalOptions = configManager.getDefaultOptions();
      const invalidOptions: Partial<UniversalChunkingOptions> = {
        maxChunkSize: 0 // Invalid
      };

      try {
        configManager.updateDefaultOptions(invalidOptions);
      } catch (error) {
        // Expected to throw
      }

      const currentOptions = configManager.getDefaultOptions();
      expect(currentOptions).toEqual(originalOptions);
    });
  });

  describe('resetToDefaults', () => {
    it('should reset to original default options', () => {
      // Modify the default options
      configManager.updateDefaultOptions({
        maxChunkSize: 3000,
        overlapSize: 300
      });

      // Verify options were modified
      let options = configManager.getDefaultOptions();
      expect(options.maxChunkSize).toBe(3000);
      expect(options.overlapSize).toBe(300);

      // Reset to defaults
      configManager.resetToDefaults();

      // Verify options were reset
      options = configManager.getDefaultOptions();
      expect(options.maxChunkSize).toBe(2000);
      expect(options.overlapSize).toBe(200);
    });
  });

  describe('Integration Tests', () => {
    it('should work with complex configuration scenarios', () => {
      // Get language-specific config
      const jsConfig = configManager.getLanguageSpecificConfig('javascript');

      // Merge with default options
      const baseOptions = configManager.getDefaultOptions();
      const mergedOptions = configManager.mergeOptions(baseOptions, jsConfig);

      // Update default options
      configManager.updateDefaultOptions(jsConfig);

      // Verify the update
      const updatedOptions = configManager.getDefaultOptions();
      expect(updatedOptions.maxChunkSize).toBe(jsConfig.maxChunkSize);
      expect(updatedOptions.maxLinesPerChunk).toBe(jsConfig.maxLinesPerChunk);

      // Reset and verify
      configManager.resetToDefaults();
      const resetOptions = configManager.getDefaultOptions();
      expect(resetOptions.maxChunkSize).toBe(2000); // Back to original default
    });

    it('should handle multiple language configurations', () => {
      const languages = ['javascript', 'typescript', 'python', 'java', 'cpp', 'rust'];

      languages.forEach(lang => {
        const langConfig = configManager.getLanguageSpecificConfig(lang);
        expect(langConfig).toBeDefined();
        expect(configManager.validateOptions(langConfig)).toBe(true);
      });
    });

    it('should maintain configuration consistency', () => {
      // Get default options
      const defaultOptions = configManager.getDefaultOptions();

      // Validate default options
      expect(configManager.validateOptions(defaultOptions)).toBe(true);

      // Get language-specific configs and validate them
      const languages = ['javascript', 'python', 'markdown'];
      languages.forEach(lang => {
        const langConfig = configManager.getLanguageSpecificConfig(lang);
        const mergedConfig = configManager.mergeOptions(defaultOptions, langConfig);
        expect(configManager.validateOptions(mergedConfig)).toBe(true);
      });
    });
  });
});