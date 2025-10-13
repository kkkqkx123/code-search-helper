import { languageExtensionMap, fileUtils, languageFeatureDetector, languageWeightsProvider } from '../language';
import { syntaxPatternMatcher, structureDetector } from '../syntax';

describe('Parser Utils - Language Detection', () => {
  describe('LanguageExtensionMap', () => {
    it('should detect language by extension', () => {
      expect(languageExtensionMap.getLanguageByExtension('.js')).toBe('javascript');
      expect(languageExtensionMap.getLanguageByExtension('.ts')).toBe('typescript');
      expect(languageExtensionMap.getLanguageByExtension('.py')).toBe('python');
      expect(languageExtensionMap.getLanguageByExtension('.unknown')).toBeUndefined();
    });

    it('should get extensions by language', () => {
      const jsExtensions = languageExtensionMap.getExtensionsByLanguage('javascript');
      expect(jsExtensions).toContain('.js');
      expect(jsExtensions).toContain('.jsx');
    });

    it('should check if language is supported', () => {
      expect(languageExtensionMap.isLanguageSupported('javascript')).toBe(true);
      expect(languageExtensionMap.isLanguageSupported('unknown')).toBe(false);
    });

    it('should get language from file path', () => {
      expect(languageExtensionMap.getLanguageFromPath('test.js')).toBe('javascript');
      expect(languageExtensionMap.getLanguageFromPath('/path/to/file.ts')).toBe('typescript');
    });
  });

  describe('FileUtils', () => {
    it('should extract file extension', () => {
      expect(fileUtils.extractFileExtension('test.js')).toBe('.js');
      expect(fileUtils.extractFileExtension('/path/to/file.ts')).toBe('.ts');
      expect(fileUtils.extractFileExtension('filename')).toBe('');
    });

    it('should normalize extension', () => {
      expect(fileUtils.normalizeExtension('JS')).toBe('.js');
      expect(fileUtils.normalizeExtension('.ts')).toBe('.ts');
      expect(fileUtils.normalizeExtension('')).toBe('');
    });

    it('should validate extension', () => {
      expect(fileUtils.isValidExtension('.js')).toBe(true);
      expect(fileUtils.isValidExtension('js')).toBe(true);
      expect(fileUtils.isValidExtension('.invalid!')).toBe(false);
    });

    it('should get file name and base name', () => {
      expect(fileUtils.getFileName('/path/to/test.js')).toBe('test.js');
      expect(fileUtils.getBaseName('/path/to/test.js')).toBe('test.js');
    });
  });

  describe('LanguageFeatureDetector', () => {
    it('should detect language by content', () => {
      const jsCode = 'function test() { console.log("Hello"); }';
      const result = languageFeatureDetector.detectLanguageByContent(jsCode);
      expect(result.language).toBe('javascript');
      expect(result.method).toBe('content');
    });

    it('should detect language by extension', () => {
      expect(languageFeatureDetector.detectLanguageByExtension('test.js')).toBe('javascript');
      expect(languageFeatureDetector.detectLanguageByExtension('test.py')).toBe('python');
    });

    it('should detect language combined', async () => {
      const result = await languageFeatureDetector.detectLanguage('test.js', 'function test() {}');
      expect(result.language).toBe('javascript');
      expect(result.method).toBe('extension');
    });

    it('should validate language detection', () => {
      const jsCode = 'function test() { console.log("Hello"); }';
      expect(languageFeatureDetector.validateLanguageDetection(jsCode, 'javascript')).toBe(true);
      expect(languageFeatureDetector.validateLanguageDetection(jsCode, 'python')).toBe(false);
    });
  });

  describe('LanguageWeightsProvider', () => {
    it('should get weights for language', () => {
      const weights = languageWeightsProvider.getWeights('typescript');
      expect(weights).toHaveProperty('syntactic');
      expect(weights).toHaveProperty('function');
      expect(weights).toHaveProperty('class');
    });

    it('should set custom weights', () => {
      const customWeights = {
        syntactic: 0.9,
        function: 0.8,
        class: 0.7,
        method: 0.6,
        import: 0.5,
        logical: 0.4,
        comment: 0.3
      };
      
      languageWeightsProvider.setCustomWeights('custom', customWeights);
      const retrieved = languageWeightsProvider.getWeights('custom');
      expect(retrieved.syntactic).toBe(0.9);
    });

    it('should clear custom weights', () => {
      languageWeightsProvider.setCustomWeights('temp', { syntactic: 0.5, function: 0.5, class: 0.5, method: 0.5, import: 0.5, logical: 0.5, comment: 0.5 });
      languageWeightsProvider.clearCustomWeights('temp');
      const defaultWeights = languageWeightsProvider.getWeights('temp');
      expect(defaultWeights.syntactic).toBe(0.7); // Default value
    });
  });

  describe('SyntaxPatternMatcher', () => {
    it('should detect TypeScript features', () => {
      const tsCode = 'interface Test { method(): void; }';
      const features = syntaxPatternMatcher.detectTypeScriptFeatures(tsCode);
      expect(features).toBeGreaterThan(0);
    });

    it('should detect Python features', () => {
      const pyCode = 'def test():\n    print("Hello")';
      const features = syntaxPatternMatcher.detectPythonFeatures(pyCode);
      expect(features).toBeGreaterThan(0);
    });

    it('should detect language by content', () => {
      const jsCode = 'function test() { return true; }';
      const result = syntaxPatternMatcher.detectLanguageByContent(jsCode);
      expect(result.language).toBe('javascript');
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('StructureDetector', () => {
    it('should detect function start', () => {
      expect(structureDetector.isFunctionStart('function test() {}')).toBe(true);
      expect(structureDetector.isFunctionStart('const test = () => {}')).toBe(true);
      expect(structureDetector.isFunctionStart('def test():')).toBe(true);
    });

    it('should detect class start', () => {
      expect(structureDetector.isClassStart('class Test {}')).toBe(true);
      expect(structureDetector.isClassStart('export default class Test {}')).toBe(true);
    });

    it('should detect function end', () => {
      expect(structureDetector.isFunctionEnd('}')).toBe(true);
      expect(structureDetector.isFunctionEnd('} // end')).toBe(true);
    });

    it('should detect structure type', () => {
      expect(structureDetector.detectStructureType('function test() {}')).toBe('function');
      expect(structureDetector.detectStructureType('class Test {}')).toBe('class');
    });

    it('should detect variable declaration', () => {
      expect(structureDetector.isVariableDeclaration('const test = 1')).toBe(true);
      expect(structureDetector.isVariableDeclaration('let test = 1')).toBe(true);
      expect(structureDetector.isVariableDeclaration('var test = 1')).toBe(true);
    });

    it('should detect control flow statement', () => {
      expect(structureDetector.isControlFlowStatement('if (condition) {}')).toBe(true);
      expect(structureDetector.isControlFlowStatement('for (let i = 0; i < 10; i++) {}')).toBe(true);
    });

    it('should detect empty line', () => {
      expect(structureDetector.isEmptyLine('')).toBe(true);
      expect(structureDetector.isEmptyLine('   ')).toBe(true);
      expect(structureDetector.isEmptyLine('not empty')).toBe(false);
    });

    it('should detect error markers', () => {
      expect(structureDetector.hasErrorMarkers('// TODO: fix this')).toBe(true);
      expect(structureDetector.hasErrorMarkers('// FIXME: broken')).toBe(true);
      expect(structureDetector.hasErrorMarkers('normal code')).toBe(false);
    });
  });
});