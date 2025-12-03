import { ContentAnalyzer } from '../ContentAnalyzer';
import { LoggerService } from '../../../../utils/LoggerService';
import { SimilarityOptions } from '../../types/SimilarityTypes';
import { ContentFeature } from '../types/CoordinationTypes';
import { LanguageDetector } from '../../../parser/detection/LanguageDetector';
import { InfrastructureConfigService } from '../../../../infrastructure/config/InfrastructureConfigService';

describe('ContentAnalyzer', () => {
  let analyzer: ContentAnalyzer;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockConfigService: jest.Mocked<InfrastructureConfigService>;
  let mockDetectionService: jest.Mocked<LanguageDetector>;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    mockConfigService = {
      getConfig: jest.fn().mockReturnValue({
        qdrant: {
          performance: {
            monitoringInterval: 30000,
            enableDetailedLogging: true,
            performanceThresholds: {
              queryExecutionTime: 5000,
              memoryUsage: 80,
              responseTime: 2000
            }
          }
        }
      })
    } as any;

    mockDetectionService = {
      detectFile: jest.fn(),
      detectLanguage: jest.fn(),
      detectLanguageSync: jest.fn(),
      getSupportedLanguages: jest.fn(),
      isLanguageSupportedForAST: jest.fn(),
      getFileExtension: jest.fn(),
      detectLanguageByParserConfig: jest.fn()
    } as any;

    analyzer = new ContentAnalyzer(mockLogger, mockConfigService, mockDetectionService);
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

    it('should detect generic content when no language is detected', async () => {
      const content1 = 'This is just plain text without special patterns.';
      const content2 = 'Another plain text content.';
      const options: SimilarityOptions = {};

      // 模拟DetectionService返回低置信度结果
      mockDetectionService.detectFile.mockResolvedValue({
        language: 'unknown',
        detectionMethod: 'extension',
        metadata: {}
      });

      const result = await analyzer.analyzeContent(content1, content2, options);

      expect(result.contentType).toBe('generic');
      expect(result.recommendedStrategies).toContain('levenshtein');
      expect(result.recommendedStrategies).toContain('keyword');
    });

    it('should calculate complexity based on content features', async () => {
      const content1 = 'if (condition) { doSomething(); } else { doOther(); }';
      const content2 = 'function complex(a, b) { return a.map(x => x * b); }';
      const options: SimilarityOptions = {};

      const result = await analyzer.analyzeContent(content1, content2, options);

      expect(result.complexity.score).toBeGreaterThan(0);
      expect(result.complexity.level).toMatch(/^(low|medium|high)$/);
      expect(result.complexity.factors.length).toBeGreaterThanOrEqual(0);
    });

    it('should extract basic features for all content types', async () => {
      const codeContent1 = 'class Test { constructor() {} }';
      const codeContent2 = 'function test() { return new Test(); }';
      const options: SimilarityOptions = { language: 'typescript' };

      const result = await analyzer.analyzeContent(codeContent1, codeContent2, options);

      expect(result.features).toBeInstanceOf(Array);
      expect(result.features.length).toBeGreaterThan(0);

      // Check for basic features
      const hasLengthFeature = result.features.some(f => f.name === 'length');
      const hasLineCountFeature = result.features.some(f => f.name === 'line_count');
      const hasWordCountFeature = result.features.some(f => f.name === 'word_count');
      
      expect(hasLengthFeature).toBe(true);
      expect(hasLineCountFeature).toBe(true);
      expect(hasWordCountFeature).toBe(true);
    });
  });

  describe('detectContentType', () => {
    it('should detect code content for programming languages', async () => {
      const codeContent = 'function test() { return true; }';
      const result = await analyzer.detectContentType(codeContent, 'javascript');
      expect(result).toBe('code');
    });

    it('should use DetectionService for content type detection', async () => {
      const codeContent = 'function test() { return true; }';
      
      // 模拟DetectionService返回JavaScript检测结果
      mockDetectionService.detectFile.mockResolvedValue({
        language: 'javascript',
        detectionMethod: 'extension',
        metadata: {}
      });

      const result = await analyzer.detectContentType(codeContent);
      expect(result).toBe('code');
      expect(mockDetectionService.detectFile).toHaveBeenCalledWith('temp_file', codeContent);
    });

    it('should return generic when DetectionService fails', async () => {
      const plainContent = 'This is just plain text without special patterns.';
      
      // 模拟DetectionService抛出异常
      mockDetectionService.detectFile.mockRejectedValue(new Error('Detection failed'));

      const result = await analyzer.detectContentType(plainContent);
      expect(result).toBe('generic');
    });

    it('should default to generic for plain text when language detection returns low confidence', async () => {
      const plainContent = 'This is just plain text without special patterns.';
      
      // 模拟DetectionService返回低置信度结果
      mockDetectionService.detectFile.mockResolvedValue({
        language: 'unknown',
        detectionMethod: 'extension',
        metadata: {}
      });

      const result = await analyzer.detectContentType(plainContent);
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

    it('should calculate higher complexity for longer content', () => {
      const longContent = 'a'.repeat(2000);
      const result = analyzer.calculateComplexity(longContent);

      expect(result.score).toBeGreaterThan(0);
      expect(result.factors).toContain('long_content');
    });

    it('should consider character diversity in complexity', () => {
      // 使用更多样化的字符来确保触发高多样性检查
      const diverseContent = 'abcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
      const result = analyzer.calculateComplexity(diverseContent);

      expect(result.score).toBeGreaterThan(0);
    });

    it('should consider repetition in complexity', () => {
      const repetitiveContent = 'same same same same same same same';
      const result = analyzer.calculateComplexity(repetitiveContent);

      expect(result.score).toBeGreaterThan(0);
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

    it('should extract the same basic features regardless of content type', () => {
      const codeContent = 'function test() { return true; } class Test {}';
      const docContent = '# Title\n\n- Item 1\n- Item 2\n\n[Link](http://example.com)';
      const genericContent = 'This is a sentence. This is another sentence!';

      const codeFeatures = analyzer.extractFeatures(codeContent, 'code');
      const docFeatures = analyzer.extractFeatures(docContent, 'document');
      const genericFeatures = analyzer.extractFeatures(genericContent, 'generic');

      // All should have the same basic features
      const basicFeatureNames = ['length', 'line_count', 'word_count'];
      
      basicFeatureNames.forEach(featureName => {
        expect(codeFeatures.some(f => f.name === featureName)).toBe(true);
        expect(docFeatures.some(f => f.name === featureName)).toBe(true);
        expect(genericFeatures.some(f => f.name === featureName)).toBe(true);
      });
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