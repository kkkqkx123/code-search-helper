import { ContentAnalyzer } from '../ContentAnalyzer';
import { LoggerService } from '../../../../utils/LoggerService';
import { SimilarityOptions } from '../../types/SimilarityTypes';
import { ContentFeature } from '../types/CoordinationTypes';

describe('ContentAnalyzer', () => {
  let analyzer: ContentAnalyzer;
  let mockLogger: jest.Mocked<LoggerService>;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    analyzer = new ContentAnalyzer(mockLogger);
  });

  describe('analyzeContent', () => {
    it('should analyze generic text content', async () => {
      const content1 = 'This is a simple text content';
      const content2 = 'This is another text content';
      const options: SimilarityOptions = {};

      const result = await analyzer.analyzeContent(content1, content2, options);

      expect(result.contentType).toBe('generic');
      expect(result.contentLength).toBe(Math.round((content1.length + content2.length) / 2));
      expect(result.complexity).toHaveProperty('score');
      expect(result.complexity).toHaveProperty('level');
      expect(result.complexity).toHaveProperty('factors');
      expect(result.features).toBeInstanceOf(Array);
      expect(result.recommendedStrategies).toContain('levenshtein');
      expect(result.recommendedStrategies).toContain('keyword');
    });

    it('should detect code content based on language', async () => {
      const content1 = 'function test() { return true; }';
      const content2 = 'function another() { return false; }';
      const options: SimilarityOptions = { language: 'javascript' };

      const result = await analyzer.analyzeContent(content1, content2, options);

      expect(result.contentType).toBe('code');
      expect(result.recommendedStrategies).toContain('keyword');
      expect(result.recommendedStrategies).toContain('levenshtein');
    });

    it('should detect document content with markdown features', async () => {
      const content1 = '# Title\n\nThis is a **document** with [links](http://example.com).';
      const content2 = '## Section\n\nAnother document with *emphasis*.';
      const options: SimilarityOptions = {};

      const result = await analyzer.analyzeContent(content1, content2, options);

      expect(result.contentType).toBe('document');
      expect(result.recommendedStrategies).toContain('semantic');
      expect(result.recommendedStrategies).toContain('keyword');
    });

    it('should calculate complexity based on content features', async () => {
      const content1 = 'if (condition) { doSomething(); } else { doOther(); }';
      const content2 = 'function complex(a, b) { return a.map(x => x * b); }';
      const options: SimilarityOptions = {};

      const result = await analyzer.analyzeContent(content1, content2, options);

      expect(result.complexity.score).toBeGreaterThan(0);
      expect(result.complexity.level).toMatch(/^(low|medium|high)$/);
      expect(result.complexity.factors.length).toBeGreaterThan(0);
    });

    it('should extract relevant features based on content type', async () => {
      const codeContent1 = 'class Test { constructor() {} }';
      const codeContent2 = 'function test() { return new Test(); }';
      const options: SimilarityOptions = { language: 'typescript' };

      const result = await analyzer.analyzeContent(codeContent1, codeContent2, options);

      expect(result.features).toBeInstanceOf(Array);
      expect(result.features.length).toBeGreaterThan(0);

      // Check for code-specific features
      const hasCodeFeatures = result.features.some(f =>
        f.name === 'function_count' || f.name === 'class_count'
      );
      expect(hasCodeFeatures).toBe(true);
    });
  });

  describe('detectContentType', () => {
    it('should detect code content for programming languages', () => {
      const codeContent = 'function test() { return true; }';
      const result = analyzer.detectContentType(codeContent, 'javascript');
      expect(result).toBe('code');
    });

    it('should detect document content with markdown', () => {
      const docContent = '# Title\n\nThis is a document with **bold** text.';
      const result = analyzer.detectContentType(docContent);
      expect(result).toBe('document');
    });

    it('should detect code content based on patterns', () => {
      const codeContent = 'if (condition) { doSomething(); }';
      const result = analyzer.detectContentType(codeContent);
      expect(result).toBe('code');
    });

    it('should default to generic for plain text', () => {
      const plainContent = 'This is just plain text without special patterns.';
      const result = analyzer.detectContentType(plainContent);
      expect(result).toBe('generic');
    });
  });

  describe('calculateComplexity', () => {
    it('should calculate low complexity for simple content', () => {
      const simpleContent = 'Simple text';
      const result = analyzer.calculateComplexity(simpleContent);

      expect(result.score).toBeLessThan(0.3);
      expect(result.level).toBe('low');
    });

    it('should calculate higher complexity for nested structures', () => {
      const complexContent = 'if (a) { if (b) { if (c) { doSomething(); } } }';
      const result = analyzer.calculateComplexity(complexContent);

      expect(result.score).toBeGreaterThan(0.3);
      expect(result.factors).toContain('nested_structure');
    });

    it('should consider character diversity in complexity', () => {
      const diverseContent = 'abc123!@#abc123!@#';
      const result = analyzer.calculateComplexity(diverseContent);

      expect(result.factors).toContain('high_diversity');
    });

    it('should consider repetition in complexity', () => {
      const repetitiveContent = 'same same same same same same same';
      const result = analyzer.calculateComplexity(repetitiveContent);

      expect(result.factors).toContain('high_repetition');
    });

    it('should consider content length in complexity', () => {
      const longContent = 'a'.repeat(2000);
      const result = analyzer.calculateComplexity(longContent);

      expect(result.factors).toContain('long_content');
    });
  });

  describe('extractFeatures', () => {
    it('should extract basic features for all content types', () => {
      const content = 'Test content with multiple words';
      const result = analyzer.extractFeatures(content, 'generic');

      expect(result).toBeInstanceOf(Array);

      const lengthFeature = result.find(f => f.name === 'length');
      expect(lengthFeature).toBeDefined();
      expect(lengthFeature?.value).toBe(content.length);

      const lineCountFeature = result.find(f => f.name === 'line_count');
      expect(lineCountFeature).toBeDefined();
      expect(lineCountFeature?.value).toBe(1);

      const wordCountFeature = result.find(f => f.name === 'word_count');
      expect(wordCountFeature).toBeDefined();
      expect(wordCountFeature?.value).toBeGreaterThan(0);
    });

    it('should extract code-specific features', () => {
      const codeContent = 'function test() { return true; } class Test {}';
      const result = analyzer.extractFeatures(codeContent, 'code');

      const functionCount = result.find(f => f.name === 'function_count');
      expect(functionCount?.value).toBe(1);

      const classCount = result.find(f => f.name === 'class_count');
      expect(classCount?.value).toBe(1);
    });

    it('should extract document-specific features', () => {
      const docContent = '# Title\n\n- Item 1\n- Item 2\n\n[Link](http://example.com)';
      const result = analyzer.extractFeatures(docContent, 'document');

      const headingCount = result.find(f => f.name === 'heading_count');
      expect(headingCount?.value).toBe(1);

      const listItemCount = result.find(f => f.name === 'list_item_count');
      expect(listItemCount?.value).toBe(2);

      const linkCount = result.find(f => f.name === 'link_count');
      expect(linkCount?.value).toBe(1);
    });

    it('should extract generic text features', () => {
      const textContent = 'This is a sentence. This is another sentence!';
      const result = analyzer.extractFeatures(textContent, 'generic');

      const sentenceCount = result.find(f => f.name === 'sentence_count');
      expect(sentenceCount?.value).toBe(2);

      const paragraphCount = result.find(f => f.name === 'paragraph_count');
      expect(paragraphCount?.value).toBe(1);
    });
  });

  describe('recommendStrategies', () => {
    it('should recommend strategies for code content', () => {
      const complexity = { score: 0.5, level: 'medium' as const, factors: [] };
      const features: ContentFeature[] = [];
      const result = analyzer['recommendStrategies']('code', complexity, features);

      expect(result).toContain('keyword');
      expect(result).toContain('levenshtein');
      expect(result).toContain('hybrid');
    });

    it('should recommend strategies for document content', () => {
      const complexity = { score: 0.5, level: 'medium' as const, factors: [] };
      const features: ContentFeature[] = [];
      const result = analyzer['recommendStrategies']('document', complexity, features);

      expect(result).toContain('semantic');
      expect(result).toContain('keyword');
      expect(result).toContain('hybrid');
    });

    it('should recommend strategies for generic content', () => {
      const complexity = { score: 0.5, level: 'medium' as const, factors: [] };
      const features: ContentFeature[] = [];
      const result = analyzer['recommendStrategies']('generic', complexity, features);

      expect(result).toContain('levenshtein');
      expect(result).toContain('keyword');
      expect(result).toContain('hybrid');
    });

    it('should include semantic strategy for high complexity', () => {
      const complexity = { score: 0.8, level: 'high' as const, factors: [] };
      const features: ContentFeature[] = [];
      const result = analyzer['recommendStrategies']('code', complexity, features);

      expect(result).toContain('semantic');
    });
  });
});