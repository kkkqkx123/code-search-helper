import { SegmentationContextFactory } from '../SegmentationContext';
import { SegmentationContext, UniversalChunkingOptions } from '../../types/SegmentationTypes';

describe('SegmentationContextFactory', () => {
  describe('create', () => {
    it('should create a basic segmentation context', () => {
      const content = 'Test content';
      const filePath = 'test.js';
      const language = 'javascript';
      
      const context = SegmentationContextFactory.create(content, filePath, language);
      
      expect(context.content).toBe(content);
      expect(context.filePath).toBe(filePath);
      expect(context.language).toBe(language);
      expect(context.options).toBeDefined();
      expect(context.metadata).toBeDefined();
    });

    it('should create context with default options when none provided', () => {
      const content = 'Test content';
      
      const context = SegmentationContextFactory.create(content);
      
      expect(context.options).toBeDefined();
      expect(context.options.maxChunkSize).toBe(2000);
      expect(context.options.overlapSize).toBe(200);
      expect(context.options.maxLinesPerChunk).toBe(100);
    });

    it('should create context with custom options', () => {
      const content = 'Test content';
      const customOptions: UniversalChunkingOptions = {
        maxChunkSize: 3000,
        overlapSize: 300,
        maxLinesPerChunk: 150,
        enableBracketBalance: true,
        enableSemanticDetection: true,
        enableCodeOverlap: false,
        enableStandardization: true,
        standardizationFallback: true,
        maxOverlapRatio: 0.3,
        errorThreshold: 5,
        memoryLimitMB: 500,
        strategyPriorities: {
          'markdown': 1,
          'standardization': 2,
          'semantic': 3,
          'bracket': 4,
          'line': 5
        },
        filterConfig: {
          enableSmallChunkFilter: true,
          enableChunkRebalancing: true,
          minChunkSize: 50,
          maxChunkSize: 1000
        },
        protectionConfig: {
          enableProtection: true,
          protectionLevel: 'medium'
        }
      };
      
      const context = SegmentationContextFactory.create(content, undefined, undefined, customOptions);
      
      expect(context.options.maxChunkSize).toBe(3000);
      expect(context.options.overlapSize).toBe(300);
      expect(context.options.maxLinesPerChunk).toBe(150);
    });

    it('should calculate metadata correctly', () => {
      const content = 'Line 1\nLine 2\nLine 3';
      
      const context = SegmentationContextFactory.create(content);
      
      expect(context.metadata.contentLength).toBe(content.length);
      expect(context.metadata.lineCount).toBe(3);
    });

    it('should identify small files correctly', () => {
      const smallContent = 'Small content';
      
      const context = SegmentationContextFactory.create(smallContent);
      
      expect(context.metadata.isSmallFile).toBe(true);
    });

    it('should identify large files correctly', () => {
      const largeContent = 'x'.repeat(400); // Larger than SMALL_FILE_THRESHOLD.CHARS
      
      const context = SegmentationContextFactory.create(largeContent);
      
      expect(context.metadata.isSmallFile).toBe(false);
    });

    it('should identify code files correctly', () => {
      const content = 'const x = 1;';
      
      // Test with language
      let context = SegmentationContextFactory.create(content, 'test.js', 'javascript');
      expect(context.metadata.isCodeFile).toBe(true);
      
      // Test with file extension
      context = SegmentationContextFactory.create(content, 'test.py');
      expect(context.metadata.isCodeFile).toBe(true);
      
      // Test with non-code file
      context = SegmentationContextFactory.create(content, 'test.txt');
      expect(context.metadata.isCodeFile).toBe(false);
    });

    it('should identify markdown files correctly', () => {
      const content = '# Title\n\nSome content';
      
      // Test with language
      let context = SegmentationContextFactory.create(content, 'test.md', 'markdown');
      expect(context.metadata.isMarkdownFile).toBe(true);
      
      // Test with file extension
      context = SegmentationContextFactory.create(content, 'test.md');
      expect(context.metadata.isMarkdownFile).toBe(true);
      
      // Test with .markdown extension
      context = SegmentationContextFactory.create(content, 'test.markdown');
      expect(context.metadata.isMarkdownFile).toBe(true);
      
      // Test with non-markdown file
      context = SegmentationContextFactory.create(content, 'test.txt');
      expect(context.metadata.isMarkdownFile).toBe(false);
    });

    it('should handle edge cases in file type detection', () => {
      const content = 'Test content';
      
      // Markdown files should not be considered code files
      let context = SegmentationContextFactory.create(content, 'test.md', 'markdown');
      expect(context.metadata.isCodeFile).toBe(false);
      expect(context.metadata.isMarkdownFile).toBe(true);
      
      // Unknown language should not be considered code file
      context = SegmentationContextFactory.create(content, 'test.xyz', 'unknown');
      expect(context.metadata.isCodeFile).toBe(false);
      expect(context.metadata.isMarkdownFile).toBe(false);
    });
  });

  describe('fromExisting', () => {
    it('should create new context from existing with modifications', () => {
      const originalContent = 'Original content';
      const originalContext = SegmentationContextFactory.create(originalContent, 'test.js', 'javascript');
      
      const modifications: Partial<SegmentationContext> = {
        content: 'Modified content',
        language: 'typescript'
      };
      
      const newContext = SegmentationContextFactory.fromExisting(originalContext, modifications);
      
      expect(newContext.content).toBe('Modified content');
      expect(newContext.language).toBe('typescript');
      expect(newContext.filePath).toBe('test.js'); // Should remain unchanged
      expect(newContext.options).toEqual(originalContext.options); // Should remain unchanged
    });

    it('should merge metadata correctly', () => {
      const originalContent = 'Original content';
      const originalContext = SegmentationContextFactory.create(originalContent);
      
      const modifications: Partial<SegmentationContext> = {
        content: 'Modified content\nLine 2',
        metadata: {
          contentLength: 19,
          lineCount: 2,
          isSmallFile: false,
          isCodeFile: true,
          isMarkdownFile: false
        }
      };
      
      const newContext = SegmentationContextFactory.fromExisting(originalContext, modifications);
      
      expect(newContext.metadata.isSmallFile).toBe(false);
      expect(newContext.metadata.lineCount).toBe(2); // Should be recalculated
      expect(newContext.metadata.contentLength).toBe(modifications.content!.length); // Should be recalculated
      expect(newContext.metadata.isCodeFile).toBe(originalContext.metadata.isCodeFile); // Should remain unchanged
    });

    it('should handle empty modifications', () => {
      const originalContent = 'Original content';
      const originalContext = SegmentationContextFactory.create(originalContent);
      
      const newContext = SegmentationContextFactory.fromExisting(originalContext, {});
      
      expect(newContext).toEqual(originalContext);
    });
  });

  describe('validate', () => {
    it('should validate a correct context', () => {
      const content = 'Test content';
      const context = SegmentationContextFactory.create(content, 'test.js', 'javascript');
      
      const validation = SegmentationContextFactory.validate(context);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should detect empty content', () => {
      const context = SegmentationContextFactory.create('');
      
      const validation = SegmentationContextFactory.validate(context);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Content cannot be empty');
    });

    it('should detect whitespace-only content', () => {
      const context = SegmentationContextFactory.create('   \n  \t  \n   ');
      
      const validation = SegmentationContextFactory.validate(context);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Content cannot be empty');
    });

    it('should detect content length mismatch', () => {
      const content = 'Test content';
      const context = SegmentationContextFactory.create(content);
      
      // Manually corrupt the metadata
      context.metadata.contentLength = 999;
      
      const validation = SegmentationContextFactory.validate(context);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Content length mismatch in metadata');
    });

    it('should detect line count mismatch', () => {
      const content = 'Line 1\nLine 2\nLine 3';
      const context = SegmentationContextFactory.create(content);
      
      // Manually corrupt the metadata
      context.metadata.lineCount = 999;
      
      const validation = SegmentationContextFactory.validate(context);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Line count mismatch in metadata');
    });

    it('should detect missing options', () => {
      const content = 'Test content';
      const context = SegmentationContextFactory.create(content);
      
      // Manually remove options
      delete (context as any).options;
      
      const validation = SegmentationContextFactory.validate(context);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Options are required');
    });

    it('should detect invalid max chunk size', () => {
      const content = 'Test content';
      const context = SegmentationContextFactory.create(content);
      
      // Manually set invalid option
      context.options.maxChunkSize = 0;
      
      const validation = SegmentationContextFactory.validate(context);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Max chunk size must be positive');
    });

    it('should detect negative overlap size', () => {
      const content = 'Test content';
      const context = SegmentationContextFactory.create(content);
      
      // Manually set invalid option
      context.options.overlapSize = -1;
      
      const validation = SegmentationContextFactory.validate(context);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Overlap size cannot be negative');
    });

    it('should detect invalid max lines per chunk', () => {
      const content = 'Test content';
      const context = SegmentationContextFactory.create(content);
      
      // Manually set invalid option
      context.options.maxLinesPerChunk = 0;
      
      const validation = SegmentationContextFactory.validate(context);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Max lines per chunk must be positive');
    });

    it('should detect multiple validation errors', () => {
      const content = '';
      const context = SegmentationContextFactory.create(content);
      
      // Manually corrupt multiple fields
      context.metadata.contentLength = 999;
      context.options.maxChunkSize = 0;
      context.options.overlapSize = -1;
      
      const validation = SegmentationContextFactory.validate(context);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(2);
      expect(validation.errors).toContain('Content cannot be empty');
      expect(validation.errors).toContain('Content length mismatch in metadata');
      expect(validation.errors).toContain('Max chunk size must be positive');
      expect(validation.errors).toContain('Overlap size cannot be negative');
    });
  });

  describe('createProtectionContext', () => {
    it('should create protection context from segmentation context', () => {
      const content = 'Test content';
      const segmentationContext = SegmentationContextFactory.create(content, 'test.js', 'javascript');
      
      const protectionContext = SegmentationContextFactory.createProtectionContext(
        'test_operation',
        segmentationContext
      );
      
      expect(protectionContext.operation).toBe('test_operation');
      expect(protectionContext.filePath).toBe('test.js');
      expect(protectionContext.content).toBe(content);
      expect(protectionContext.language).toBe('javascript');
      expect(protectionContext.metadata).toBeDefined();
      expect(protectionContext.metadata.contentLength).toBe(content.length);
      expect(protectionContext.metadata.lineCount).toBe(1);
      expect(protectionContext.metadata.isSmallFile).toBe(true);
      expect(protectionContext.metadata.isCodeFile).toBe(true);
    });

    it('should merge additional metadata', () => {
      const content = 'Test content';
      const segmentationContext = SegmentationContextFactory.create(content);
      
      const additionalMetadata = {
        customField: 'custom_value',
        anotherField: 123
      };
      
      const protectionContext = SegmentationContextFactory.createProtectionContext(
        'test_operation',
        segmentationContext,
        additionalMetadata
      );
      
      expect(protectionContext.metadata.customField).toBe('custom_value');
      expect(protectionContext.metadata.anotherField).toBe(123);
      expect(protectionContext.metadata.contentLength).toBe(content.length); // Original metadata should be preserved
    });

    it('should handle undefined additional metadata', () => {
      const content = 'Test content';
      const segmentationContext = SegmentationContextFactory.create(content);
      
      const protectionContext = SegmentationContextFactory.createProtectionContext(
        'test_operation',
        segmentationContext,
        undefined
      );
      
      expect(protectionContext.metadata).toBeDefined();
      expect(protectionContext.metadata.contentLength).toBe(content.length);
    });
  });

  describe('Integration Tests', () => {
    it('should work with complex scenarios', () => {
      const complexContent = `
function complexFunction(param1, param2) {
  if (param1 > 0) {
    for (let i = 0; i < param2; i++) {
      console.log(i);
    }
  } else {
    while (param2 > 0) {
      param2--;
    }
  }
  
  return param1 + param2;
}
      `.trim();
      
      const context = SegmentationContextFactory.create(complexContent, 'complex.js', 'javascript');
      
      // Verify basic properties
      expect(context.content).toBe(complexContent);
      expect(context.filePath).toBe('complex.js');
      expect(context.language).toBe('javascript');
      
      // Verify metadata
      expect(context.metadata.contentLength).toBe(complexContent.length);
      expect(context.metadata.lineCount).toBeGreaterThan(5);
      expect(context.metadata.isSmallFile).toBe(false);
      expect(context.metadata.isCodeFile).toBe(true);
      expect(context.metadata.isMarkdownFile).toBe(false);
      
      // Validate context
      const validation = SegmentationContextFactory.validate(context);
      expect(validation.isValid).toBe(true);
      
      // Create protection context
      const protectionContext = SegmentationContextFactory.createProtectionContext(
        'complex_operation',
        context,
        { complexity: 'high' }
      );
      
      expect(protectionContext.metadata.complexity).toBe('high');
      expect(protectionContext.metadata.isCodeFile).toBe(true);
    });

    it('should handle different file types correctly', () => {
      const testCases = [
        {
          content: '# Title\n\nSome **bold** text',
          filePath: 'test.md',
          language: 'markdown',
          expectedIsCodeFile: false,
          expectedIsMarkdownFile: true
        },
        {
          content: 'const x = 1;',
          filePath: 'test.js',
          language: 'javascript',
          expectedIsCodeFile: true,
          expectedIsMarkdownFile: false
        },
        {
          content: 'Just plain text',
          filePath: 'test.txt',
          language: undefined,
          expectedIsCodeFile: false,
          expectedIsMarkdownFile: false
        },
        {
          content: 'print("Hello, World!")',
          filePath: 'test.py',
          language: 'python',
          expectedIsCodeFile: true,
          expectedIsMarkdownFile: false
        }
      ];
      
      testCases.forEach(testCase => {
        const context = SegmentationContextFactory.create(
          testCase.content,
          testCase.filePath,
          testCase.language
        );
        
        expect(context.metadata.isCodeFile).toBe(testCase.expectedIsCodeFile);
        expect(context.metadata.isMarkdownFile).toBe(testCase.expectedIsMarkdownFile);
        
        const validation = SegmentationContextFactory.validate(context);
        expect(validation.isValid).toBe(true);
      });
    });
  });
});