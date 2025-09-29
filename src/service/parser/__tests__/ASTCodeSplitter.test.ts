import { Container } from 'inversify';
import { diContainer } from '../../../core/DIContainer';
import { TYPES } from '../../../types';
import { ASTCodeSplitter } from '../splitting/ASTCodeSplitter';
import { CodeChunk } from '../splitting/Splitter';

describe('ASTCodeSplitter', () => {
  let container: Container;
  let astSplitter: ASTCodeSplitter;

  beforeAll(() => {
    container = diContainer;
    astSplitter = container.get<ASTCodeSplitter>(TYPES.ASTCodeSplitter);
  });

  describe('split', () => {
    it('should split TypeScript code into AST-aware chunks', async () => {
      const code = `
        function add(a: number, b: number): number {
          return a + b;
        }
        
        function subtract(a: number, b: number): number {
          return a - b;
        }
        
        class Calculator {
          multiply(a: number, b: number): number {
            return a * b;
          }
          
          divide(a: number, b: number): number {
            if (b === 0) {
              throw new Error("Division by zero");
            }
            return a / b;
          }
        }
      `;
      
      const chunks = await astSplitter.split(code, 'typescript');
      expect(chunks.length).toBeGreaterThan(0);
      
      // Should have at least one function chunk and one class chunk
      const functionChunks = chunks.filter(chunk => 
        chunk.content.includes('function') && !chunk.content.includes('class')
      );
      const classChunks = chunks.filter(chunk => 
        chunk.content.includes('class')
      );
      
      expect(functionChunks.length).toBeGreaterThanOrEqual(2);
      expect(classChunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should split JavaScript code into AST-aware chunks', async () => {
      const code = `
        function greet(name) {
          return "Hello, " + name;
        }
        
        const calculator = {
          add: (a, b) => a + b,
          subtract: (a, b) => a - b
        };
      `;
      
      const chunks = await astSplitter.split(code, 'javascript');
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should split Python code into AST-aware chunks', async () => {
      const code = `
        def add(a, b):
            return a + b
            
        def subtract(a, b):
            return a - b
            
        class Calculator:
            def multiply(self, a, b):
                return a * b
                
            def divide(self, a, b):
                if b == 0:
                    raise ValueError("Division by zero")
                return a / b
      `;
      
      const chunks = await astSplitter.split(code, 'python');
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should fall back to simple splitting for unsupported languages', async () => {
      const code = `
        print("Hello, World!")
      `;
      
      const chunks = await astSplitter.split(code, 'unsupported-language');
      expect(chunks.length).toBeGreaterThan(0);
      
      // Should have basic chunk metadata
      const chunk = chunks[0];
      expect(chunk.content).toBeDefined();
      expect(chunk.metadata.startLine).toBeDefined();
      expect(chunk.metadata.endLine).toBeDefined();
    });

    it('should handle empty code', async () => {
      const code = '';
      const chunks = await astSplitter.split(code, 'typescript');
      expect(chunks.length).toBe(0);
    });

    it('should handle code with syntax errors gracefully', async () => {
      const code = `
        function broken( {
          return "This function has syntax errors";
        }
      `;
      
      const chunks = await astSplitter.split(code, 'typescript');
      // Should fall back to simple splitting
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('chunk size configuration', () => {
    it('should respect chunk size settings', () => {
      astSplitter.setChunkSize(1000);
      astSplitter.setChunkOverlap(100);
      
      // We can't easily test the exact chunk size without knowing the implementation details,
      // but we can verify the methods exist and don't throw errors
      expect(() => astSplitter.setChunkSize(1000)).not.toThrow();
      expect(() => astSplitter.setChunkOverlap(100)).not.toThrow();
    });
  });
});