import { Container } from 'inversify';
import { diContainer } from '../../../core/DIContainer';
import { TYPES } from '../../../types';
import { TreeSitterCoreService } from '../core/parse/TreeSitterCoreService';

describe('TreeSitterCoreService', () => {
  let container: Container;
  let treeSitterService: TreeSitterCoreService;

  beforeAll(() => {
    container = diContainer;
    treeSitterService = container.get<TreeSitterCoreService>(TYPES.TreeSitterCoreService);
  });

  describe('initialization', () => {
    it('should initialize successfully', () => {
      expect(treeSitterService.isInitialized()).toBe(true);
    });

    it('should support multiple languages', () => {
      const supportedLanguages = treeSitterService.getSupportedLanguages();
      expect(supportedLanguages.length).toBeGreaterThan(0);
      
      // Check that common languages are supported
      const languageNames = supportedLanguages.map(lang => lang.name);
      expect(languageNames).toContain('TypeScript');
      expect(languageNames).toContain('JavaScript');
      expect(languageNames).toContain('Python');
    });
  });

  describe('parseCode', () => {
    it('should parse TypeScript code successfully', async () => {
      const code = `
        function hello(name: string): string {
          return "Hello, " + name;
        }
      `;
      
      const result = await treeSitterService.parseCode(code, 'typescript');
      expect(result.success).toBe(true);
      expect(result.ast).toBeDefined();
      expect(result.language.name).toBe('TypeScript');
    });

    it('should parse JavaScript code successfully', async () => {
      const code = `
        function hello(name) {
          return "Hello, " + name;
        }
      `;
      
      const result = await treeSitterService.parseCode(code, 'javascript');
      expect(result.success).toBe(true);
      expect(result.ast).toBeDefined();
      expect(result.language.name).toBe('JavaScript');
    });

    it('should parse Python code successfully', async () => {
      const code = `
        def hello(name):
            return "Hello, " + name
      `;
      
      const result = await treeSitterService.parseCode(code, 'python');
      expect(result.success).toBe(true);
      expect(result.ast).toBeDefined();
      expect(result.language.name).toBe('Python');
    });

    it('should handle unsupported languages gracefully', async () => {
      const code = 'print("hello")';
      const result = await treeSitterService.parseCode(code, 'unsupported-language');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('extractFunctions', () => {
    it('should extract functions from TypeScript code', async () => {
      const code = `
        function add(a: number, b: number): number {
          return a + b;
        }
        
        const multiply = (a: number, b: number): number => {
          return a * b;
        };
      `;
      
      const result = await treeSitterService.parseCode(code, 'typescript');
      expect(result.success).toBe(true);
      
      const functions = treeSitterService.extractFunctions(result.ast);
      expect(functions.length).toBe(2);
    });
  });

  describe('extractClasses', () => {
    it('should extract classes from TypeScript code', async () => {
      const code = `
        class Person {
          constructor(private name: string) {}
          
          greet() {
            return "Hello, " + this.name;
          }
        }
      `;
      
      const result = await treeSitterService.parseCode(code, 'typescript');
      expect(result.success).toBe(true);
      
      const classes = treeSitterService.extractClasses(result.ast);
      expect(classes.length).toBe(1);
    });
  });

  describe('performance and caching', () => {
    it('should provide performance stats', () => {
      const stats = treeSitterService.getPerformanceStats();
      expect(stats).toBeDefined();
      expect(stats.totalParseCount).toBeGreaterThanOrEqual(0);
    });

    it('should provide cache stats', () => {
      const stats = treeSitterService.getCacheStats();
      expect(stats).toBeDefined();
      expect(stats.totalRequests).toBeGreaterThanOrEqual(0);
    });
  });
});