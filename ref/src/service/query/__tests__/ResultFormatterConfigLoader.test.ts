import { ResultFormatterConfigLoader } from '../ResultFormatterConfigLoader';

describe('ResultFormatterConfigLoader', () => {
  let configLoader: ResultFormatterConfigLoader;

  beforeEach(() => {
    configLoader = new ResultFormatterConfigLoader();
  });

  describe('loadConfig', () => {
    it('should load default configuration', () => {
      const config = configLoader.loadConfig();

      expect(config).toBeDefined();
      expect(config.profiles).toBeDefined();
      expect(config.defaults).toBeDefined();
      expect(config.formatting).toBeDefined();
      expect(config.performance).toBeDefined();

      // Check profiles
      expect(config.profiles.openai).toBeDefined();
      expect(config.profiles.claude).toBeDefined();
      expect(config.profiles.anthropic).toBeDefined();
      expect(config.profiles.custom).toBeDefined();

      // Check defaults
      expect(config.defaults.provider).toBe('openai');
      expect(config.defaults.format).toBe('json');

      // Check formatting settings
      expect(config.formatting.entityExtraction.confidenceThreshold).toBe(0.7);
      expect(config.formatting.summaryGeneration.maxLength).toBe(500);
      expect(config.formatting.suggestionGeneration.maxSuggestions).toBe(5);

      // Check performance settings
      expect(config.performance.caching.enabled).toBe(true);
      expect(config.performance.caching.ttl).toBe(300);
      expect(config.performance.caching.maxCacheSize).toBe(1000);
    });

    it('should return the same config on subsequent calls', () => {
      const config1 = configLoader.loadConfig();
      const config2 = configLoader.loadConfig();

      expect(config1).toBe(config2);
    });
  });
});
