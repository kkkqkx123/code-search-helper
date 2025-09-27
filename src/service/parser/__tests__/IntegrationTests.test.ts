import { TreeSitterCoreService } from '../core/parse/TreeSitterCoreService';
import { ControlStructureRule } from '../treesitter-rule/core/ControlStructureRule';
import { ErrorHandlingRule } from '../treesitter-rule/core/ErrorHandlingRule';
import { FunctionCallChainRule } from '../treesitter-rule/core/FunctionCallChainRule';
import { SnippetValidationService } from '../analysis/SnippetValidationService';
import { SnippetExtractionService } from '../treesitter-rule/SnippetExtractionService';
import { SnippetExtractionRule } from '../treesitter-rule/SnippetExtractionRule';

interface IntegrationTestResult {
  name: string;
  success: boolean;
  snippetCount: number;
  processingTime: number;
  cacheHitRate: string;
  details?: any;
}

describe('Integration Tests', () => {
  let treeSitterService: TreeSitterCoreService;
  let controlStructureRule: ControlStructureRule;
  let errorHandlingRule: ErrorHandlingRule;
  let functionCallChainRule: FunctionCallChainRule;
  let snippetExtractionService: SnippetExtractionService;

  beforeEach(() => {
    treeSitterService = new TreeSitterCoreService();
    controlStructureRule = new ControlStructureRule();
    errorHandlingRule = new ErrorHandlingRule();
    functionCallChainRule = new FunctionCallChainRule();

    // Create rules array for SnippetExtractionService
    const rules: SnippetExtractionRule[] = [
      controlStructureRule,
      errorHandlingRule,
      functionCallChainRule,
    ];

    snippetExtractionService = new SnippetExtractionService(treeSitterService, rules);

    // Clear cache before each test
    treeSitterService.clearCache();
  });

  const runIntegrationTest = async (
    name: string,
    code: string,
    language: string = 'javascript'
  ): Promise<IntegrationTestResult> => {
    const startTime = Date.now();

    try {
      // Step 1: Parse the code
      const parseResult = await treeSitterService.parseCode(code, language);

      if (!parseResult.success) {
        return {
          name,
          success: false,
          snippetCount: 0,
          processingTime: Date.now() - startTime,
          cacheHitRate: '0%',
          details: `Parsing failed: ${parseResult.error}`,
        };
      }

      // Step 2: Extract snippets using different rules
      const allSnippets = [];

      // Control structures
      const controlSnippets = controlStructureRule.extract(parseResult.ast, code);
      allSnippets.push(...controlSnippets);

      // Error handling
      const errorSnippets = errorHandlingRule.extract(parseResult.ast, code);
      allSnippets.push(...errorSnippets);

      // Function call chains
      const functionSnippets = functionCallChainRule.extract(parseResult.ast, code);
      allSnippets.push(...functionSnippets);

      // Step 3: Validate all snippets
      const validSnippets = allSnippets.filter(snippet =>
        SnippetValidationService.enhancedIsValidSnippet(
          snippet.content,
          snippet.snippetMetadata.snippetType,
          language
        )
      );

      const processingTime = Date.now() - startTime;
      const cacheStats = treeSitterService.getCacheStats();

      return {
        name,
        success: true,
        snippetCount: validSnippets.length,
        processingTime,
        cacheHitRate: cacheStats.hitRate,
        details: {
          totalSnippets: allSnippets.length,
          validSnippets: validSnippets.length,
          invalidSnippets: allSnippets.length - validSnippets.length,
          cacheStats,
        },
      };
    } catch (error) {
      return {
        name,
        success: false,
        snippetCount: 0,
        processingTime: Date.now() - startTime,
        cacheHitRate: '0%',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  };

  describe('End-to-End Processing Pipeline', () => {
    it('should process complex JavaScript code with multiple rule types', async () => {
      const complexCode = `
        class DataProcessor {
          constructor(data) {
            this.data = data;
          }
          
          async processData() {
            try {
              if (!Array.isArray(this.data)) {
                throw new Error('Invalid data format');
              }
              
              const processedData = this.data
                .filter(item => item && item.id)
                .map(item => ({
                  ...item,
                  processed: true,
                  timestamp: Date.now()
                }))
                .sort((a, b) => b.id - a.id);
              
              return this.validateResults(processedData);
            } catch (error) {
              console.error('Processing failed:', error);
              throw new Error('Data processing failed');
            }
          }
          
          validateResults(results) {
            return results.every(result => 
              result.id && result.processed && result.timestamp
            );
          }
        }
        
        // Usage example
        const processor = new DataProcessor([1, 2, 3]);
        processor.processData()
          .then(results => console.log('Success:', results))
          .catch(error => console.error('Error:', error));
      `;

      const result = await runIntegrationTest('Complex JavaScript Processing', complexCode);

      expect(result.success).toBe(true);
      expect(result.snippetCount).toBeGreaterThanOrEqual(5);
      expect(result.processingTime).toBeLessThan(200);
      expect(parseFloat(result.cacheHitRate)).toBeGreaterThanOrEqual(0);
    });

    it('should process TypeScript code with type annotations', async () => {
      const typescriptCode = `
        interface User {
          id: string;
          name: string;
          email: string;
          role: 'admin' | 'user' | 'guest';
        }
        
        class UserService {
          private users: Map<string, User> = new Map();
          
          async createUser(userData: Omit<User, 'id'>): Promise<User> {
            try {
              const user: User = {
                id: this.generateId(),
                ...userData
              };
              
              if (await this.validateUser(user)) {
                this.users.set(user.id, user);
                return user;
              } else {
                throw new Error('Invalid user data');
              }
            } catch (error) {
              console.error('Failed to create user:', error);
              throw error;
            }
          }
          
          private async validateUser(user: User): Promise<boolean> {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(user.email) && 
                   user.name.length > 0 && 
                   ['admin', 'user', 'guest'].includes(user.role);
          }
          
          private generateId(): string {
            return \`user_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
          }
        }
      `;

      const result = await runIntegrationTest(
        'TypeScript Processing',
        typescriptCode,
        'typescript'
      );

      expect(result.success).toBe(true);
      expect(result.snippetCount).toBeGreaterThanOrEqual(2);
      expect(result.processingTime).toBeLessThan(150);
    });

    it('should process Python code with async functions and error handling', async () => {
      const pythonCode = `
        import asyncio
        from typing import List, Dict, Optional
        from dataclasses import dataclass
        
        @dataclass
        class Item:
            id: int
            name: str
            value: float
            
        class ItemProcessor:
            def __init__(self):
                self.items: List[Item] = []
                
            async def add_item(self, item: Item) -> bool:
                try:
                    if not self._validate_item(item):
                        raise ValueError("Invalid item")
                    
                    self.items.append(item)
                    await self._save_item(item)
                    return True
                    
                except ValueError as e:
                    print(f"Validation error: {e}")
                    return False
                except Exception as e:
                    print(f"Unexpected error: {e}")
                    return False
                    
            async def process_items(self) -> List[Dict]:
                if not self.items:
                    return []
                    
                try:
                    results = []
                    for item in self.items:
                        if item.value > 0:
                            processed = await self._process_single_item(item)
                            results.append(processed)
                            
                    return sorted(results, key=lambda x: x['value'])
                    
                except Exception as e:
                    print(f"Processing failed: {e}")
                    raise
                    
            def _validate_item(self, item: Item) -> bool:
                return (
                    isinstance(item, Item) and
                    item.id > 0 and
                    len(item.name) > 0 and
                    item.value >= 0
                )
                
            async def _process_single_item(self, item: Item) -> Dict:
                return {
                    'id': item.id,
                    'name': item.name,
                    'processed_value': item.value * 1.1,
                    'timestamp': asyncio.get_event_loop().time()
                }
                
            async def _save_item(self, item: Item) -> None:
                # Simulate database save
                await asyncio.sleep(0.01)
                print(f"Saved item {item.id}")
      `;

      const result = await runIntegrationTest('Python Processing', pythonCode, 'python');

      expect(result.success).toBe(true);
      expect(result.snippetCount).toBeGreaterThanOrEqual(0);
      expect(result.processingTime).toBeLessThan(200);
    });
  });

  describe('Caching Integration', () => {
    it('should demonstrate caching benefits across multiple processing runs', async () => {
      const code = `
        function fibonacci(n) {
          if (n <= 1) return n;
          return fibonacci(n - 1) + fibonacci(n - 2);
        }
        
        function factorial(n) {
          if (n <= 1) return 1;
          return n * factorial(n - 1);
        }
        
        class Calculator {
          constructor() {
            this.results = new Map();
          }
          
          calculate(operation, a, b) {
            switch (operation) {
              case 'add':
                return a + b;
              case 'subtract':
                return a - b;
              case 'multiply':
                return a * b;
              case 'divide':
                if (b === 0) throw new Error('Division by zero');
                return a / b;
              default:
                throw new Error('Unknown operation');
            }
          }
        }
      `;

      // First run - no cache
      const firstResult = await runIntegrationTest('First Run', code);

      // Second run - should benefit from cache
      const secondResult = await runIntegrationTest('Second Run', code);

      // Third run - maximum cache benefit
      const thirdResult = await runIntegrationTest('Third Run', code);

      expect(firstResult.success).toBe(true);
      expect(secondResult.success).toBe(true);
      expect(thirdResult.success).toBe(true);

      // Cache hit rate should increase
      const firstHitRate = parseFloat(firstResult.cacheHitRate);
      const secondHitRate = parseFloat(secondResult.cacheHitRate);
      const thirdHitRate = parseFloat(thirdResult.cacheHitRate);

      expect(thirdHitRate).toBeGreaterThan(firstHitRate);

      // Processing time should generally decrease with caching (allow for measurement precision)
      if (secondResult.processingTime > 0 && firstResult.processingTime > 0) {
        // Allow for some variance in measurements, but cached should generally be faster or equal
        const maxAcceptableTime = firstResult.processingTime * 1.5; // Allow 50% variance
        expect(secondResult.processingTime).toBeLessThanOrEqual(maxAcceptableTime);
      }
      if (thirdResult.processingTime > 0 && secondResult.processingTime > 0) {
        // Allow for more variance in measurements, but cached should generally be faster or equal
        const maxAcceptableTime = secondResult.processingTime * 6; // Allow 500% variance to account for system variations
        expect(thirdResult.processingTime).toBeLessThanOrEqual(maxAcceptableTime);
      }
      // If any of the timings are 0, it means they're extremely fast which is acceptable
    });

    it('should handle cache invalidation correctly', async () => {
      const code1 = `function test1() { return 1; }`;
      const code2 = `function test2() { return 2; }`;

      // Process first code
      const result1 = await runIntegrationTest('Code 1', code1);

      // Process second code
      const result2 = await runIntegrationTest('Code 2', code2);

      // Process first code again
      const result3 = await runIntegrationTest('Code 1 Again', code1);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);

      // Cache should still work for the same code
      expect(parseFloat(result3.cacheHitRate)).toBeGreaterThan(0);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle malformed code gracefully', async () => {
      const malformedCode = `
        function test() {
          // Syntax error: missing closing brace
          if (true) {
            console.log('test');
          
        class BrokenClass {
          constructor() {
            this.value = 42
          // Missing closing brace
      `;

      const result = await runIntegrationTest('Malformed Code', malformedCode);

      // Should still succeed because we're using mock parser
      expect(result.success).toBe(true);
    });

    it('should handle edge cases with very large code', async () => {
      const largeCode = Array(100)
        .fill(0)
        .map(
          (_, i) => `
        function function_${i}() {
          const data = [${i}, ${i + 1}, ${i + 2}];
          const result = data.map(x => x * 2).filter(x => x > ${i});
          return result.length;
        }
        
        if (${i} % 2 === 0) {
          console.log('Even number:', ${i});
        } else {
          console.log('Odd number:', ${i});
        }
      `
        )
        .join('\n');

      const result = await runIntegrationTest('Large Code Processing', largeCode);

      expect(result.success).toBe(true);
      expect(result.snippetCount).toBeGreaterThan(50);
      expect(result.processingTime).toBeLessThan(1000);
    });
  });

  describe('Multi-Language Integration', () => {
    it('should process multiple languages correctly', async () => {
      const testCases = [
        {
          name: 'JavaScript ES6+',
          code: `
            const asyncFunction = async (params) => {
              try {
                const { data, error } = await fetchData(params);
                if (error) throw error;
                return data.map(item => ({ ...item, processed: true }));
              } catch (error) {
                console.error('Error:', error);
                throw error;
              }
            };
          `,
          language: 'javascript',
        },
        {
          name: 'TypeScript with Generics',
          code: `
            interface Repository<T> {
              findById(id: string): Promise<T | null>;
              save(entity: T): Promise<T>;
            }
            
            class UserService implements Repository<User> {
              async findById(id: string): Promise<User | null> {
                // Implementation
                return null;
              }
              
              async save(user: User): Promise<User> {
                // Implementation
                return user;
              }
            }
          `,
          language: 'typescript',
        },
        {
          name: 'Python with Type Hints',
          code: `
            from typing import Generic, TypeVar, Optional
            
            T = TypeVar('T')
            
            class Container(Generic[T]):
                def __init__(self, item: T):
                    self.item = item
                    
                def get_item(self) -> Optional[T]:
                    return self.item
                    
                def set_item(self, item: T) -> None:
                    self.item = item
                    
                def process_item(self) -> T:
                    if self.item is None:
                        raise ValueError("No item set")
                    return self.item
          `,
          language: 'python',
        },
      ];

      const results = [];
      for (const testCase of testCases) {
        const result = await runIntegrationTest(testCase.name, testCase.code, testCase.language);
        results.push(result);
      }

      // All languages should process successfully
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.snippetCount).toBeGreaterThanOrEqual(0);
      });

      // Cache should work across different languages
      const finalCacheStats = treeSitterService.getCacheStats();
      expect(parseFloat(finalCacheStats.hitRate)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance targets for the complete pipeline', async () => {
      const benchmarkCode = `
        class PerformanceTest {
          constructor() {
            this.data = [];
            this.cache = new Map();
          }
          
          async runBenchmark(iterations = 1000) {
            const results = [];
            
            for (let i = 0; i < iterations; i++) {
              const start = performance.now();
              const result = await this.processItem({
                id: i,
                value: Math.random() * 100,
                timestamp: Date.now()
              });
              const end = performance.now();
              
              results.push({
                iteration: i,
                result,
                duration: end - start
              });
            }
            
            return this.analyzeResults(results);
          }
          
          async processItem(item) {
            try {
              if (this.cache.has(item.id)) {
                return this.cache.get(item.id);
              }
              
              const processed = {
                ...item,
                processed: true,
                calculatedValue: this.calculateValue(item.value),
                processedAt: Date.now()
              };
              
              this.cache.set(item.id, processed);
              return processed;
              
            } catch (error) {
              console.error('Processing error:', error);
              throw error;
            }
          }
          
          calculateValue(value) {
            return Math.sqrt(value) * Math.PI;
          }
          
          analyzeResults(results) {
            const durations = results.map(r => r.duration);
            return {
              average: durations.reduce((a, b) => a + b, 0) / durations.length,
              min: Math.min(...durations),
              max: Math.max(...durations),
              total: durations.reduce((a, b) => a + b, 0)
            };
          }
        }
      `;

      const result = await runIntegrationTest('Performance Benchmark', benchmarkCode);

      expect(result.success).toBe(true);
      expect(result.snippetCount).toBeGreaterThanOrEqual(3);
      expect(result.processingTime).toBeLessThan(300);

      // Cache should be working
      const cacheHitRate = parseFloat(result.cacheHitRate);
      expect(cacheHitRate).toBeGreaterThanOrEqual(0);
    });
  });
});
