import { FunctionStrategyProvider, ClassStrategyProvider, ModuleStrategyProvider } from '../index';

describe('AST Strategy Providers', () => {
  let treeSitterService: any;
  let loggerService: any;

  beforeEach(() => {
    // 创建模拟服务
    treeSitterService = {
      detectLanguage: jest.fn().mockResolvedValue({ name: 'typescript' }),
      parseCode: jest.fn().mockResolvedValue({
        success: true,
        ast: {
          rootNode: {
            type: 'program',
            startPosition: { row: 0, column: 0 },
            endPosition: { row: 10, column: 0 }
          }
        }
      }),
      extractFunctions: jest.fn().mockResolvedValue([]),
      extractClasses: jest.fn().mockResolvedValue([])
    };

    loggerService = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };
  });

  describe('FunctionStrategyProvider', () => {
    it('should create function strategy provider', () => {
      const provider = new FunctionStrategyProvider(treeSitterService, loggerService);
      expect(provider.getName()).toBe('function_provider');
      expect(provider.getDescription()).toBe('Provides function-based code splitting using TreeSitter');
      expect(provider.getPriority()).toBe(1);
    });

    it('should support TypeScript language', () => {
      const provider = new FunctionStrategyProvider(treeSitterService, loggerService);
      expect(provider.supportsLanguage('typescript')).toBe(true);
    });

    it('should not support unsupported language', () => {
      const provider = new FunctionStrategyProvider(treeSitterService, loggerService);
      expect(provider.supportsLanguage('unsupported')).toBe(false);
    });

    it('should create strategy instance', () => {
      const provider = new FunctionStrategyProvider(treeSitterService, loggerService);
      const strategy = provider.createStrategy();
      expect(strategy.getName()).toBe('function_split_strategy');
      
    });
  });

  describe('ClassStrategyProvider', () => {
    it('should create class strategy provider', () => {
      const provider = new ClassStrategyProvider(treeSitterService, loggerService);
      expect(provider.getName()).toBe('class_provider');
      expect(provider.getDescription()).toBe('Provides class-based code splitting using TreeSitter');
      expect(provider.getPriority()).toBe(2);
    });

    it('should support TypeScript language', () => {
      const provider = new ClassStrategyProvider(treeSitterService, loggerService);
      expect(provider.supportsLanguage('typescript')).toBe(true);
    });

    it('should create strategy instance', () => {
      const provider = new ClassStrategyProvider(treeSitterService, loggerService);
      const strategy = provider.createStrategy();
      expect(strategy.getName()).toBe('class_split_strategy');
      
    });
  });

  describe('ModuleStrategyProvider', () => {
    it('should create module strategy provider', () => {
      const provider = new ModuleStrategyProvider(treeSitterService, loggerService);
      expect(provider.getName()).toBe('module_provider');
      expect(provider.getDescription()).toBe('Provides module-based code splitting using TreeSitter');
      
    });

    it('should support TypeScript language', () => {
      const provider = new ModuleStrategyProvider(treeSitterService, loggerService);
      expect(provider.supportsLanguage('typescript')).toBe(true);
    });

    it('should create strategy instance', () => {
      const provider = new ModuleStrategyProvider(treeSitterService, loggerService);
      const strategy = provider.createStrategy();
      expect(strategy.getName()).toBe('module_split_strategy');
      
    });
  });



  describe('Strategy Dependencies', () => {
    it('should have correct dependencies', () => {
      const functionProvider = new FunctionStrategyProvider(treeSitterService, loggerService);
      const classProvider = new ClassStrategyProvider(treeSitterService, loggerService);
      const moduleProvider = new ModuleStrategyProvider(treeSitterService, loggerService);


      expect(functionProvider.getDependencies()).toEqual(['TreeSitterService']);
      expect(classProvider.getDependencies()).toEqual(['TreeSitterService']);
      expect(moduleProvider.getDependencies()).toEqual(['TreeSitterService']);

    });
  });
});