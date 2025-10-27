import { MarkdownSegmentationStrategy } from '../MarkdownSegmentationStrategy';
import { LoggerService } from '../../../../../../utils/LoggerService';
import { DetectionResult } from '../../../detection/UnifiedDetectionCenter';

// Mock LoggerService
jest.mock('../../../../../../utils/LoggerService');
const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

describe('MarkdownSegmentationStrategy', () => {
  let strategy: MarkdownSegmentationStrategy;
  let mockLogger: jest.Mocked<LoggerService>;

  const createMockDetectionResult = (language: string = 'markdown'): DetectionResult => ({
    language,
    confidence: 0.9,
    fileType: 'normal'
  });

  beforeEach(() => {
    mockLogger = new MockLoggerService() as jest.Mocked<LoggerService>;
    mockLogger.debug = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.info = jest.fn();

    strategy = new MarkdownSegmentationStrategy(mockLogger);
  });

  describe('getName', () => {
    it('should return the strategy name', () => {
      expect(strategy.getName()).toBe('MarkdownSegmentationStrategy');
    });
  });

  describe('getDescription', () => {
    it('should return the strategy description', () => {
      expect(strategy.getDescription()).toBe('Uses Markdown-specific segmentation to preserve document structure');
    });
  });

  describe('execute', () => {
    const filePath = 'test.md';

    it('should segment markdown with headers', async () => {
      const content = `# Introduction

This is the introduction.

## Section 1

Content for section 1.

## Section 2

Content for section 2.
`;
      const detection = createMockDetectionResult('markdown');

      const result = await strategy.execute(filePath, content, detection);

      expect(result.chunks.length).toBeGreaterThan(1);
      expect(result.chunks[0].metadata.type).toBe('heading');
      expect(result.chunks[0].metadata.section).toBe('Introduction');
      expect(result.metadata.strategy).toBe('MarkdownSegmentationStrategy');
    });

    it('should handle code blocks', async () => {
      const content = `# Code Example

\`\`\`javascript
function test() {
  return 'hello';
}
\`\`\`

Some text after.
`;
      const detection = createMockDetectionResult('markdown');

      const result = await strategy.execute(filePath, content, detection);

      expect(result.chunks.length).toBeGreaterThan(0);
      const codeChunk = result.chunks.find(chunk => chunk.metadata.type === 'code_block');
      expect(codeChunk).toBeDefined();
      expect(codeChunk?.metadata.codeLanguage).toBe('javascript');
    });

    it('should handle empty content', async () => {
      const content = '';
      const detection = createMockDetectionResult('markdown');

      const result = await strategy.execute(filePath, content, detection);

      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].content).toBe('');
      expect(result.chunks[0].metadata.startLine).toBe(1);
      expect(result.chunks[0].metadata.endLine).toBe(0);
      expect(result.chunks[0].metadata.type).toBe('paragraph');
    });

    it('should validate context', async () => {
      const content = '# Valid Markdown';
      const detection = createMockDetectionResult('markdown');

      const result = await strategy.execute(filePath, content, detection);

      expect(mockLogger.debug).toHaveBeenCalledWith('Context validation passed for markdown strategy');
    });

    it('should handle invalid context', async () => {
      const content = '';
      const detection = createMockDetectionResult('unknown');

      const result = await strategy.execute(filePath, content, detection);

      expect(mockLogger.warn).toHaveBeenCalledWith('Context validation failed for markdown strategy, proceeding anyway');
    });

    it('should merge related chunks', async () => {
      const content = `# Title

Paragraph 1.

Paragraph 2.
`;
      const detection = createMockDetectionResult('markdown');

      const result = await strategy.execute(filePath, content, detection);

      // Should merge related paragraphs
      expect(result.chunks.length).toBeGreaterThan(0);
    });
  });

  describe('validateContext', () => {
    it('should validate markdown content', () => {
      expect((strategy as any).validateContext('# Header', 'markdown')).toBe(true);
      expect((strategy as any).validateContext('', 'markdown')).toBe(false);
      expect((strategy as any).validateContext('plain text', 'unknown')).toBe(false);
    });
  });

  describe('hasMarkdownStructure', () => {
    it('should detect markdown features', () => {
      expect((strategy as any).hasMarkdownStructure('# Header')).toBe(true);
      expect((strategy as any).hasMarkdownStructure('- List item')).toBe(true);
      expect((strategy as any).hasMarkdownStructure('```code```')).toBe(true);
      expect((strategy as any).hasMarkdownStructure('| table |')).toBe(true);
      expect((strategy as any).hasMarkdownStructure('---')).toBe(true);
      expect((strategy as any).hasMarkdownStructure('plain text')).toBe(false);
    });
  });

  describe('isSectionHeader', () => {
    it('should identify section headers', () => {
      expect((strategy as any).isSectionHeader('# Header')).toBe(true);
      expect((strategy as any).isSectionHeader('## Subheader')).toBe(true);
      expect((strategy as any).isSectionHeader('### Level 3')).toBe(true);
      expect((strategy as any).isSectionHeader('Not a header')).toBe(false);
    });
  });

  describe('extractSectionTitle', () => {
    it('should extract section titles', () => {
      expect((strategy as any).extractSectionTitle('# Introduction')).toBe('Introduction');
      expect((strategy as any).extractSectionTitle('## Getting Started')).toBe('Getting Started');
      expect((strategy as any).extractSectionTitle('#')).toBe('');
    });
  });

  describe('isHorizontalRule', () => {
    it('should identify horizontal rules', () => {
      expect((strategy as any).isHorizontalRule('---')).toBe(true);
      expect((strategy as any).isHorizontalRule('___')).toBe(true);
      expect((strategy as any).isHorizontalRule('***')).toBe(true);
      expect((strategy as any).isHorizontalRule('--')).toBe(false);
    });
  });

  describe('hasListItems', () => {
    it('should detect list items', () => {
      expect((strategy as any).hasListItems(['- Item 1', '- Item 2'])).toBe(true);
      expect((strategy as any).hasListItems(['1. First', '2. Second'])).toBe(true);
      expect((strategy as any).hasListItems(['Plain text'])).toBe(false);
    });
  });

  describe('isTableRow', () => {
    it('should identify table rows', () => {
      expect((strategy as any).isTableRow('| col1 | col2 |')).toBe(true);
      expect((strategy as any).isTableRow('not a table')).toBe(false);
    });
  });

  describe('isTableEnd', () => {
    it('should detect table end', () => {
      expect((strategy as any).isTableEnd(['| data |', '| --- |', '| more |'])).toBe(true);
      expect((strategy as any).isTableEnd(['not a table'])).toBe(false);
    });
  });

  describe('getChunkType', () => {
    it('should return correct chunk types', () => {
      expect((strategy as any).getChunkType('', false)).toBe('paragraph');
      expect((strategy as any).getChunkType('Section', false)).toBe('heading');
      expect((strategy as any).getChunkType('', true)).toBe('code_block');
    });
  });

  describe('calculateComplexity', () => {
    it('should calculate markdown complexity', () => {
      const content = '# Header\n\n- List item\n\n```code```\n\n| table |';
      const complexity = (strategy as any).calculateComplexity(content);
      expect(typeof complexity).toBe('number');
      expect(complexity).toBeGreaterThan(0);
    });
  });
});
