import { SegmentationContextFactory } from '../SegmentationContextFactory';
import { SegmentationContext, UniversalChunkingOptions } from '../../strategies/types/SegmentationTypes';

// Mock language extension map
jest.mock('../../../utils/language/LanguageExtensionMap', () => ({
  LanguageExtensionMap: jest.fn().mockImplementation(() => ({
    getLanguageFromPath: jest.fn()
  })),
  languageExtensionMap: {
    getLanguageFromPath: jest.fn()
  }
}));

describe('SegmentationContextFactory', () => {
  const mockLanguageExtensionMap = require('../../../utils/language/LanguageExtensionMap').languageExtensionMap;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguageExtensionMap.getLanguageFromPath.mockReturnValue('javascript');
  });

  describe('create', () => {
    it('should create context with minimal parameters', () => {
      const content = 'console.log("Hello, World!");';
      const context = SegmentationContextFactory.create(content);

      expect(context.content).toBe(content);
      expect(context.filePath).toBeUndefined();
      expect(context.language).toBeUndefined();
      expect(context.options).toBeDefined();
      expect(context.metadata).toEqual({
        contentLength: content.length,
        lineCount: 1,
        isSmallFile: true,
        isCodeFile: false,
        isMarkdownFile: false
      });
    });

    it('should create context with file path and language', () => {
      const content = 'console.log("Hello, World!");';
      const filePath = '/path/to/file.js';
      const language = 'javascript';

      const context = SegmentationContextFactory.create(content, filePath, language);

      expect(context.filePath).toBe(filePath);
      expect(context.language).toBe(language);
      expect(context.metadata.isCodeFile).toBe(true);
    });

    it('should create context with custom options', () => {
      const content = 'console.log("Hello, World!");';
      const customOptions: UniversalChunkingOptions = {
        maxChunkSize: 3000,
        overlapSize: 300,
        maxLinesPerChunk: 150,
        enableBracketBalance: false,
        enableSemanticDetection: false,
        enableCodeOverlap: true,
        enableStandardization: false,
        standardizationFallback: false,
        maxOverlapRatio: 0.5,
        errorThreshold: 20,
        memoryLimitMB: 1024,
        filterConfig: {
          enableSmallChunkFilter: false,
          enableChunkRebalancing: false,
          minChunkSize: 50,
          maxChunkSize: 5000
        },
        protectionConfig: {
          enableProtection: false,
          protectionLevel: 'low'
        }
      };

      const context = SegmentationContextFactory.create(content, undefined, undefined, customOptions);

      expect(context.options).toEqual(customOptions);
    });

    it('should detect code file from language', () => {
      const content = 'def hello():\n    print("Hello")';
      const context = SegmentationContextFactory.create(content, undefined, 'python');

      expect(context.metadata.isCodeFile).toBe(true);
      expect(context.metadata.isMarkdownFile).toBe(false);
    });

    it('should detect markdown file from language', () => {
      const content = '# Title\n\nSome content';
      const context = SegmentationContextFactory.create(content, undefined, 'markdown');

      expect(context.metadata.isCodeFile).toBe(false);
      expect(context.metadata.isMarkdownFile).toBe(true);
    });

    it('should detect code file from file extension', () => {
      const content = 'console.log("test");';
      mockLanguageExtensionMap.getLanguageFromPath.mockReturnValue('typescript');

      const context = SegmentationContextFactory.create(content, '/path/to/file.ts');

      expect(context.metadata.isCodeFile).toBe(true);
      expect(mockLanguageExtensionMap.getLanguageFromPath).toHaveBeenCalledWith('/path/to/file.ts');
    });

    it('should detect markdown file from file extension', () => {
      const content = '# Title';
      const context = SegmentationContextFactory.create(content, '/path/to/file.md');

      expect(context.metadata.isMarkdownFile).toBe(true);
      expect(context.metadata.isCodeFile).toBe(false);
    });

    it('should correctly identify small files', () => {
      const smallContent = 'a'.repeat(1000); // 1000 characters
      const largeContent = 'a'.repeat(10001); // 10001 characters

      const smallContext = SegmentationContextFactory.create(smallContent);
      const largeContext = SegmentationContextFactory.create(largeContent);

      expect(smallContext.metadata.isSmallFile).toBe(true);
      expect(largeContext.metadata.isSmallFile).toBe(false);
    });
  });

  describe('fromExisting', () => {
    it('should create new context from existing with modifications', () => {
      const originalContext: SegmentationContext = {
        content: 'original content',
        filePath: '/path/original.js',
        language: 'javascript',
        options: {
          maxChunkSize: 2000,
          overlapSize: 200,
          maxLinesPerChunk: 100,
          enableBracketBalance: true,
          enableSemanticDetection: true,
          enableCodeOverlap: false,
          enableStandardization: true,
          standardizationFallback: true,
          maxOverlapRatio: 0.3,
          errorThreshold: 10,
          memoryLimitMB: 512,
          filterConfig: {
            enableSmallChunkFilter: true,
            enableChunkRebalancing: true,
            minChunkSize: 100,
            maxChunkSize: 4000
          },
          protectionConfig: {
            enableProtection: true,
            protectionLevel: 'medium'
          }
        },
        metadata: {
          contentLength: 16,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: true,
          isMarkdownFile: false
        }
      };

      const modifications = {
        content: 'modified content',
        filePath: '/path/modified.js',
        language: 'typescript',
        metadata: {
          customField: 'custom value'
        }
      };

      const newContext = SegmentationContextFactory.fromExisting(originalContext, modifications);

      expect(newContext.content).toBe('modified content');
      expect(newContext.filePath).toBe('/path/modified.js');
      expect(newContext.language).toBe('typescript');
      expect(newContext.options).toBe(originalContext.options); // Should be the same reference
      expect(newContext.metadata).toEqual({
        contentLength: 17, // Updated based on new content
        lineCount: 1,
        isSmallFile: true,
        isCodeFile: true,
        isMarkdownFile: false,
        customField: 'custom value'
      });
    });

    it('should preserve original metadata when content is not modified', () => {
      const originalContext: SegmentationContext = {
        content: 'original content',
        filePath: '/path/original.js',
        language: 'javascript',
        options: {} as UniversalChunkingOptions,
        metadata: {
          contentLength: 16,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: true,
          isMarkdownFile: false
        }
      };

      const modifications = {
        filePath: '/path/new.js'
      };

      const newContext = SegmentationContextFactory.fromExisting(originalContext, modifications);

      expect(newContext.metadata.contentLength).toBe(16); // Should remain unchanged
      expect(newContext.metadata.lineCount).toBe(1); // Should remain unchanged
      expect(newContext.filePath).toBe('/path/new.js');
    });

    it('should handle deep merging of metadata', () => {
      const originalContext: SegmentationContext = {
        content: 'content',
        filePath: undefined,
        language: undefined,
        options: {} as UniversalChunkingOptions,
        metadata: {
          contentLength: 7,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: false,
          isMarkdownFile: false,
          nested: { field1: 'value1' }
        }
      };

      const modifications = {
        metadata: {
          nested: { field2: 'value2' },
          newField: 'new value'
        }
      };

      const newContext = SegmentationContextFactory.fromExisting(originalContext, modifications);

      expect(newContext.metadata.nested).toEqual({ field1: 'value1', field2: 'value2' });
      expect(newContext.metadata.newField).toBe('new value');
    });
  });

  describe('validate', () => {
    it('should validate valid context', () => {
      const validContext: SegmentationContext = {
        content: 'valid content',
        filePath: '/path/file.js',
        language: 'javascript',
        options: {
          maxChunkSize: 2000,
          overlapSize: 200,
          maxLinesPerChunk: 100,
          enableBracketBalance: true,
          enableSemanticDetection: true,
          enableCodeOverlap: false,
          enableStandardization: true,
          standardizationFallback: true,
          maxOverlapRatio: 0.3,
          errorThreshold: 10,
          memoryLimitMB: 512,
          filterConfig: {
            enableSmallChunkFilter: true,
            enableChunkRebalancing: true,
            minChunkSize: 100,
            maxChunkSize: 4000
          },
          protectionConfig: {
            enableProtection: true,
            protectionLevel: 'medium'
          }
        },
        metadata: {
          contentLength: 12,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: true,
          isMarkdownFile: false
        }
      };

      const result = SegmentationContextFactory.validate(validContext);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty content', () => {
      const invalidContext: SegmentationContext = {
        content: '',
        filePath: undefined,
        language: undefined,
        options: {} as UniversalChunkingOptions,
        metadata: {
          contentLength: 0,
          lineCount: 0,
          isSmallFile: true,
          isCodeFile: false,
          isMarkdownFile: false
        }
      };

      const result = SegmentationContextFactory.validate(invalidContext);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Content cannot be empty');
    });

    it('should reject context with content length mismatch', () => {
      const invalidContext: SegmentationContext = {
        content: 'test content',
        filePath: undefined,
        language: undefined,
        options: {} as UniversalChunkingOptions,
        metadata: {
          contentLength: 5, // Should be 12
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: false,
          isMarkdownFile: false
        }
      };

      const result = SegmentationContextFactory.validate(invalidContext);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Content length mismatch in metadata');
    });

    it('should reject context with line count mismatch', () => {
      const invalidContext: SegmentationContext = {
        content: 'line1\nline2\nline3',
        filePath: undefined,
        language: undefined,
        options: {} as UniversalChunkingOptions,
        metadata: {
          contentLength: 15,
          lineCount: 1, // Should be 3
          isSmallFile: true,
          isCodeFile: false,
          isMarkdownFile: false
        }
      };

      const result = SegmentationContextFactory.validate(invalidContext);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Line count mismatch in metadata');
    });

    it('should reject context without options', () => {
      const invalidContext: SegmentationContext = {
        content: 'test content',
        filePath: undefined,
        language: undefined,
        options: undefined as any,
        metadata: {
          contentLength: 12,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: false,
          isMarkdownFile: false
        }
      };

      const result = SegmentationContextFactory.validate(invalidContext);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Options are required');
    });

    it('should reject context with invalid options', () => {
      const invalidContext: SegmentationContext = {
        content: 'test content',
        filePath: undefined,
        language: undefined,
        options: {
          maxChunkSize: 0, // Invalid
          overlapSize: 200,
          maxLinesPerChunk: 100,
          enableBracketBalance: true,
          enableSemanticDetection: true,
          enableCodeOverlap: false,
          enableStandardization: true,
          standardizationFallback: true,
          maxOverlapRatio: 0.3,
          errorThreshold: 10,
          memoryLimitMB: 512,
          filterConfig: {
            enableSmallChunkFilter: true,
            enableChunkRebalancing: true,
            minChunkSize: 100,
            maxChunkSize: 4000
          },
          protectionConfig: {
            enableProtection: true,
            protectionLevel: 'medium'
          }
        },
        metadata: {
          contentLength: 12,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: false,
          isMarkdownFile: false
        }
      };

      const result = SegmentationContextFactory.validate(invalidContext);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Max chunk size must be positive');
    });

    it('should reject context with negative overlap size', () => {
      const invalidContext: SegmentationContext = {
        content: 'test content',
        filePath: undefined,
        language: undefined,
        options: {
          maxChunkSize: 2000,
          overlapSize: -1, // Invalid
          maxLinesPerChunk: 100,
          enableBracketBalance: true,
          enableSemanticDetection: true,
          enableCodeOverlap: false,
          enableStandardization: true,
          standardizationFallback: true,
          maxOverlapRatio: 0.3,
          errorThreshold: 10,
          memoryLimitMB: 512,
          filterConfig: {
            enableSmallChunkFilter: true,
            enableChunkRebalancing: true,
            minChunkSize: 100,
            maxChunkSize: 4000
          },
          protectionConfig: {
            enableProtection: true,
            protectionLevel: 'medium'
          }
        },
        metadata: {
          contentLength: 12,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: false,
          isMarkdownFile: false
        }
      };

      const result = SegmentationContextFactory.validate(invalidContext);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Overlap size cannot be negative');
    });

    it('should reject context with invalid max lines per chunk', () => {
      const invalidContext: SegmentationContext = {
        content: 'test content',
        filePath: undefined,
        language: undefined,
        options: {
          maxChunkSize: 2000,
          overlapSize: 200,
          maxLinesPerChunk: 0, // Invalid
          enableBracketBalance: true,
          enableSemanticDetection: true,
          enableCodeOverlap: false,
          enableStandardization: true,
          standardizationFallback: true,
          maxOverlapRatio: 0.3,
          errorThreshold: 10,
          memoryLimitMB: 512,
          filterConfig: {
            enableSmallChunkFilter: true,
            enableChunkRebalancing: true,
            minChunkSize: 100,
            maxChunkSize: 4000
          },
          protectionConfig: {
            enableProtection: true,
            protectionLevel: 'medium'
          }
        },
        metadata: {
          contentLength: 12,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: false,
          isMarkdownFile: false
        }
      };

      const result = SegmentationContextFactory.validate(invalidContext);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Max lines per chunk must be positive');
    });
  });

  describe('createProtectionContext', () => {
    it('should create protection context', () => {
      const segmentationContext: SegmentationContext = {
        content: 'test content',
        filePath: '/path/file.js',
        language: 'javascript',
        options: {} as UniversalChunkingOptions,
        metadata: {
          contentLength: 12,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: true,
          isMarkdownFile: false
        }
      };

      const protectionContext = SegmentationContextFactory.createProtectionContext(
        'testOperation',
        segmentationContext,
        { additional: 'data' }
      );

      expect(protectionContext).toEqual({
        operation: 'testOperation',
        filePath: '/path/file.js',
        content: 'test content',
        language: 'javascript',
        metadata: {
          contentLength: 12,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: true,
          additional: 'data'
        }
      });
    });

    it('should create protection context with minimal segmentation context', () => {
      const segmentationContext: SegmentationContext = {
        content: 'test',
        filePath: undefined,
        language: undefined,
        options: {} as UniversalChunkingOptions,
        metadata: {
          contentLength: 4,
          lineCount: 1,
          isSmallFile: true,
          isCodeFile: false,
          isMarkdownFile: false
        }
      };

      const protectionContext = SegmentationContextFactory.createProtectionContext(
        'operation',
        segmentationContext
      );

      expect(protectionContext.operation).toBe('operation');
      expect(protectionContext.filePath).toBeUndefined();
      expect(protectionContext.language).toBeUndefined();
    });
  });

  describe('Integration Tests', () => {
    it('should handle complex context creation scenarios', () => {
      // Create initial context
      const content = `
        function hello() {
          console.log("Hello, World!");
          return true;
        }
      `.trim();

      const context1 = SegmentationContextFactory.create(
        content,
        '/path/to/script.js',
        'javascript'
      );

      expect(context1.metadata.isCodeFile).toBe(true);
      expect(context1.metadata.lineCount).toBe(4);

      // Modify context
      const context2 = SegmentationContextFactory.fromExisting(context1, {
        language: 'typescript',
        metadata: { complexity: 'medium' }
      });

      expect(context2.language).toBe('typescript');
      expect(context2.metadata.complexity).toBe('medium');
      expect(context2.metadata.lineCount).toBe(4); // Should remain unchanged

      // Validate modified context
      const validation = SegmentationContextFactory.validate(context2);
      expect(validation.isValid).toBe(true);

      // Create protection context
      const protectionContext = SegmentationContextFactory.createProtectionContext(
        'complexOperation',
        context2,
        { timestamp: Date.now() }
      );

      expect(protectionContext.operation).toBe('complexOperation');
      expect(protectionContext.metadata.timestamp).toBeDefined();
    });

    it('should handle edge cases for file detection', () => {
      // Test with various file extensions
      const testCases = [
        { path: '/path/file.py', expectedCode: true },
        { path: '/path/file.md', expectedCode: false },
        { path: '/path/file.txt', expectedCode: false },
        { path: '/path/file', expectedCode: false }
      ];

      testCases.forEach(({ path, expectedCode }) => {
        mockLanguageExtensionMap.getLanguageFromPath.mockReturnValue(
          path.endsWith('.py') ? 'python' : 
          path.endsWith('.md') ? 'markdown' : 'text'
        );

        const context = SegmentationContextFactory.create('content', path);
        expect(context.metadata.isCodeFile).toBe(expectedCode);
      });
    });
  });
});