import { FunctionStrategyProvider, ClassStrategyProvider, ModuleStrategyProvider } from '../index';

describe('AST Strategy Providers - Simple Validation', () => {
  // 创建简单的模拟服务
  const mockTreeSitterService = {} as any;
  const mockLoggerService = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  } as any;

  describe('FunctionStrategyProvider', () => {
    it('should create function strategy provider with correct properties', () => {
      const provider = new FunctionStrategyProvider(mockTreeSitterService, mockLoggerService);
      
      expect(provider.getName()).toBe('function_provider');
      expect(provider.getDescription()).toBe('Provides function-based code splitting using TreeSitter');
      expect(provider.getPriority()).toBe(1);
      expect(provider.getDependencies()).toEqual(['TreeSitterService']);
    });

    it('should support TypeScript language', () => {
      const provider = new FunctionStrategyProvider(mockTreeSitterService, mockLoggerService);
      expect(provider.supportsLanguage('typescript')).toBe(true);
    });

    it('should not support unsupported language', () => {
      const provider = new FunctionStrategyProvider(mockTreeSitterService, mockLoggerService);
      expect(provider.supportsLanguage('unsupported')).toBe(false);
    });
  });

  describe('ClassStrategyProvider', () => {
    it('should create class strategy provider with correct properties', () => {
      const provider = new ClassStrategyProvider(mockTreeSitterService, mockLoggerService);
      
      expect(provider.getName()).toBe('class_provider');
      expect(provider.getDescription()).toBe('Provides class-based code splitting using TreeSitter');
      expect(provider.getPriority()).toBe(2);
      expect(provider.getDependencies()).toEqual(['TreeSitterService']);
    });

    it('should support TypeScript language', () => {
      const provider = new ClassStrategyProvider(mockTreeSitterService, mockLoggerService);
      expect(provider.supportsLanguage('typescript')).toBe(true);
    });
  });

  describe('ModuleStrategyProvider', () => {
    it('should create module strategy provider with correct properties', () => {
      const provider = new ModuleStrategyProvider(mockTreeSitterService, mockLoggerService);
      
      expect(provider.getName()).toBe('module_provider');
      expect(provider.getDescription()).toBe('Provides module-based code splitting using TreeSitter');
      
      expect(provider.getDependencies()).toEqual(['TreeSitterService']);
    });

    it('should support TypeScript language', () => {
      const provider = new ModuleStrategyProvider(mockTreeSitterService, mockLoggerService);
      expect(provider.supportsLanguage('typescript')).toBe(true);
    });
  });

  describe('HierarchicalStrategyProvider', () => {
    it('should create hierarchical strategy provider with correct properties', () => {
      const provider = new HierarchicalStrategyProvider(mockTreeSitterService, mockLoggerService);
      
      expect(provider.getName()).toBe('hierarchical_provider');
      expect(provider.getDescription()).toBe('Provides hierarchical code splitting using TreeSitter');
      
      expect(provider.getDependencies()).toEqual(['TreeSitterService']);
    });

    it('should support TypeScript language', () => {
      const provider = new HierarchicalStrategyProvider(mockTreeSitterService, mockLoggerService);
      expect(provider.supportsLanguage('typescript')).toBe(true);
    });
  });

  describe('Strategy Creation', () => {
    it('should create strategy instances from providers', () => {
      const functionProvider = new FunctionStrategyProvider(mockTreeSitterService, mockLoggerService);
      const classProvider = new ClassStrategyProvider(mockTreeSitterService, mockLoggerService);
      const moduleProvider = new ModuleStrategyProvider(mockTreeSitterService, mockLoggerService);
      const hierarchicalProvider = new HierarchicalStrategyProvider(mockTreeSitterService, mockLoggerService);

      const functionStrategy = functionProvider.createStrategy();
      const classStrategy = classProvider.createStrategy();
      const moduleStrategy = moduleProvider.createStrategy();
      const hierarchicalStrategy = hierarchicalProvider.createStrategy();

      expect(functionStrategy.getName()).toBe('function_split_strategy');
      

      expect(classStrategy.getName()).toBe('class_split_strategy');
      

      expect(moduleStrategy.getName()).toBe('module_split_strategy');
      

      expect(hierarchicalStrategy.getName()).toBe('hierarchical_split_strategy');
      
    });
  });

  describe('Language Support', () => {
    it('should support common programming languages', () => {
      const providers = [
        new FunctionStrategyProvider(mockTreeSitterService, mockLoggerService),
        new ClassStrategyProvider(mockTreeSitterService, mockLoggerService),
        new ModuleStrategyProvider(mockTreeSitterService, mockLoggerService),
        new HierarchicalStrategyProvider(mockTreeSitterService, mockLoggerService)
      ];

      const supportedLanguages = ['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'c', 'cpp'];
      
      providers.forEach(provider => {
        supportedLanguages.forEach(language => {
          expect(provider.supportsLanguage(language)).toBe(true);
        });
      });
    });

    it('should not support unsupported languages', () => {
      const providers = [
        new FunctionStrategyProvider(mockTreeSitterService, mockLoggerService),
        new ClassStrategyProvider(mockTreeSitterService, mockLoggerService),
        new ModuleStrategyProvider(mockTreeSitterService, mockLoggerService),
        new HierarchicalStrategyProvider(mockTreeSitterService, mockLoggerService)
      ];

      providers.forEach(provider => {
        expect(provider.supportsLanguage('unsupported')).toBe(false);
      });
    });
  });
});