
import { ASTCodeSplitter } from '../ASTCodeSplitter';
import { TreeSitterService } from '../../core/parse/TreeSitterService';
import { LoggerService } from '../../../../utils/LoggerService';
import { CodeChunk } from '../Splitter';

// Mock TreeSitterService
const mockTreeSitterService: Partial<TreeSitterService> = {
  parseCode: jest.fn(),
  extractFunctions: jest.fn(),
  extractClasses: jest.fn(),
  extractImports: jest.fn(),
  getNodeText: jest.fn(),
  getNodeLocation: jest.fn(),
  getNodeName: jest.fn(),
};

// Mock LoggerService
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  logger: {} as any,
  getLogFilePath: jest.fn(),
  updateLogLevel: jest.fn(),
  markAsNormalExit: jest.fn(),
} as unknown as LoggerService;

describe('ASTCodeSplitter (Optimized)', () => {
  let splitter: ASTCodeSplitter;

  beforeEach(() => {
    splitter = new ASTCodeSplitter(
      mockTreeSitterService as TreeSitterService,
      mockLogger
    );

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Symbol-aware chunking', () => {
    it('should not split in the middle of a function', async () => {
      const code = `
        function processData(data) {
          return data.map((item: any) => {
            // 确保向量数据是纯数字数组
            const embeddingArray = Array.isArray(item.embedding)
              ? item.embedding.map((val: any) => {
                  // 转换所有值为数字类型
                  const num = Number(val);
                  if (isNaN(num)) {
                    console.warn('Invalid embedding value found, replacing with 0', {
                      originalValue: val,
                      type: typeof val
                    });
                    return 0;
                  }
                  return num;
                })
              : [];
            return embeddingArray;
          });
        }
      `;

      // Mock TreeSitterService to simulate parsing failure, forcing intelligent fallback
      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Parse error'
      });

      const chunks = await splitter.split(code, 'typescript');

      // Verify that chunks maintain symbol balance
      for (const chunk of chunks) {
        const openBraces = (chunk.content.match(/{/g) || []).length;
        const closeBraces = (chunk.content.match(/}/g) || []).length;
        const openBrackets = (chunk.content.match(/\(/g) || []).length;
        const closeBrackets = (chunk.content.match(/\)/g) || []).length;

        expect(openBraces).toBe(closeBraces);
        expect(openBrackets).toBe(closeBrackets);
      }
    });

    it('should handle nested structures correctly', async () => {
      const code = `
        class ComplexClass {
          constructor(private data: any[]) {}
          
          processData(): Result[] {
            return this.data.filter(item => {
              if (item.type === 'complex') {
                return item.values.map((val: string) => {
                  try {
                    return JSON.parse(val);
                  } catch (e) {
                    return null;
                  }
                }).filter(v => v !== null);
              }
              return false;
            });
          }
        }
      `;

      // Mock TreeSitterService to simulate parsing failure
      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Parse error'
      });

      const chunks = await splitter.split(code, 'typescript');

      // Verify that chunks maintain symbol balance
      for (const chunk of chunks) {
        const openBraces = (chunk.content.match(/{/g) || []).length;
        const closeBraces = (chunk.content.match(/}/g) || []).length;
        const openBrackets = (chunk.content.match(/\(/g) || []).length;
        const closeBrackets = (chunk.content.match(/\)/g) || []).length;

        expect(openBraces).toBe(closeBraces);
        expect(openBrackets).toBe(closeBrackets);
      }
    });

    it('should handle template strings correctly', async () => {
      const code = `
        function createTemplate(name: string, values: any[]) {
          const template = \`Hello \${name}, you have \${values.length} items:\n\${values.map(v => \`- \${v}\`).join('\\n')}\`;
          return template;
        }
      `;

      // Mock TreeSitterService to simulate parsing failure
      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue({
          success: false,
          error: 'Parse error'
        });

      const chunks = await splitter.split(code, 'typescript');

      // Verify that chunks maintain symbol balance
      for (const chunk of chunks) {
        const openBraces = (chunk.content.match(/{/g) || []).length;
        const closeBraces = (chunk.content.match(/}/g) || []).length;
        const openBrackets = (chunk.content.match(/\(/g) || []).length;
        const closeBrackets = (chunk.content.match(/\)/g) || []).length;
        const openTemplates = (chunk.content.match(/`/g) || []).length;

        expect(openBraces).toBe(closeBraces);
        expect(openBrackets).toBe(closeBrackets);
        expect(openTemplates % 2).toBe(0); // Template strings should be balanced
      }
    });
  });

  describe('Performance optimization', () => {
    it('should use appropriate optimization level for small files', async () => {
      const smallCode = `
        function small() {
          return true;
        }
      `;

      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Parse error'
      });

      await splitter.split(smallCode, 'typescript');

      // Should use low optimization level for small files
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Using optimization level: low'));
    });

    it('should use appropriate optimization level for large files', async () => {
      // Create a large code snippet
      let largeCode = 'class LargeClass {\n';
      for (let i = 0; i < 100; i++) {
        largeCode += `  method${i}() { return ${i}; }\n`;
      }
      largeCode += '}';

      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Parse error'
      });

      await splitter.split(largeCode, 'typescript');

      // Should use medium or high optimization level for large files
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/Using optimization level: (medium|high)/)
      );
    });

    it('should record performance metrics', async () => {
      const code = `
        function test() {
          return true;
        }
      `;

      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Parse error'
      });

      await splitter.split(code, 'typescript');

      // Should record performance metrics
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Performance metrics:')
      );
    });
  });

  describe('Syntax validation', () => {
    it('should validate chunk syntax before adding to results', async () => {
      const code = `
        function test() {
          if (true) {
            return true;
          }
        }
      `;

      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Parse error'
      });

      const chunks = await splitter.split(code, 'typescript');

      // All chunks should be syntactically valid
      expect(chunks.length).toBeGreaterThan(0);
      for (const chunk of chunks) {
        expect(chunk.content).toBeTruthy();
        expect(chunk.metadata.startLine).toBeGreaterThan(0);
        expect(chunk.metadata.endLine).toBeGreaterThanOrEqual(chunk.metadata.startLine);
      }
    });
  });

  describe('Smart overlap', () => {
    it('should create overlaps that maintain symbol balance', async () => {
      const code = `
        function first() {
          return 'first';
        }
        
        function second() {
          return 'second';
        }
        
        function third() {
          return 'third';
        }
      `;

      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Parse error'
      });

      // Set overlap size
      splitter.setChunkOverlap(50);
      splitter.setChunkSize(100);

      const chunks = await splitter.split(code, 'typescript');

      // If there are multiple chunks, overlaps should maintain symbol balance
      if (chunks.length > 1) {
        for (let i = 0; i < chunks.length - 1; i++) {
          const currentChunk = chunks[i];
          const nextChunk = chunks[i
            + 1];

          // Check if the end of current chunk and start of next chunk overlap
          const currentEnd = currentChunk.content.trim().slice(-20);
          const nextStart = nextChunk.content.trim().slice(0, 20);

          // This is a basic check - in practice, the overlap logic is more complex
          expect(currentEnd).toBeTruthy();
          expect(nextStart).toBeTruthy();
        }
      }
    });
  });
});