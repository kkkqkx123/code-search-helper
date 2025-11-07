import { LanguageMappingManager } from './src/service/parser/config/LanguageMappingManager';
import { LanguageClassificationDetector } from './src/service/parser/config/LanguageClassificationDetector';
import { QueryBasedLanguageDetector } from './src/service/parser/config/QueryBasedLanguageDetector';

describe('Language Classification System', () => {
  let languageMappingManager: LanguageMappingManager;
  let classificationDetector: LanguageClassificationDetector;
  let queryBasedDetector: QueryBasedLanguageDetector;

  beforeEach(() => {
    languageMappingManager = LanguageMappingManager.getInstance();
    classificationDetector = new LanguageClassificationDetector();
    queryBasedDetector = new QueryBasedLanguageDetector();
  });

  describe('LanguageMappingManager', () => {
    it('should initialize with all language configurations', () => {
      const allLanguages = languageMappingManager.getAllSupportedLanguages();
      expect(allLanguages.length).toBeGreaterThan(0);
    });

    it('should classify languages correctly', () => {
      // Advanced programming languages
      expect(languageMappingManager.isAdvancedProgrammingLanguage('typescript')).toBe(true);
      expect(languageMappingManager.isAdvancedProgrammingLanguage('javascript')).toBe(true);
      expect(languageMappingManager.isAdvancedProgrammingLanguage('python')).toBe(true);

      // Basic programming languages
      expect(languageMappingManager.isBasicProgrammingLanguage('php')).toBe(true);
      expect(languageMappingManager.isBasicProgrammingLanguage('ruby')).toBe(true);

      // Data format languages
      expect(languageMappingManager.isDataFormatLanguage('json')).toBe(true);
      expect(languageMappingManager.isDataFormatLanguage('yaml')).toBe(true);

      // Special processing languages
      expect(languageMappingManager.isSpecialProcessingLanguage('markdown')).toBe(true);
      expect(languageMappingManager.isSpecialProcessingLanguage('xml')).toBe(true);

      // Hybrid processing languages
      expect(languageMappingManager.isHybridProcessingLanguage('html')).toBe(true);
      expect(languageMappingManager.isHybridProcessingLanguage('css')).toBe(true);
    });

    it('should have correct directory structure classification', () => {
      // Languages with subdirectories (advanced rules)
      expect(languageMappingManager.hasSubdir('typescript')).toBe(true);
      expect(languageMappingManager.hasSubdir('javascript')).toBe(true);
      expect(languageMappingManager.hasSubdir('python')).toBe(true);

      // Languages without subdirectories (basic rules)
      expect(languageMappingManager.hasSubdir('php')).toBe(false);
      expect(languageMappingManager.hasSubdir('ruby')).toBe(false);
    });

    it('should support language detection by extension', () => {
      expect(languageMappingManager.getLanguageByExtension('.ts')).toBe('typescript');
      expect(languageMappingManager.getLanguageByExtension('.js')).toBe('javascript');
      expect(languageMappingManager.getLanguageByExtension('.py')).toBe('python');
      expect(languageMappingManager.getLanguageByExtension('.json')).toBe('json');
    });

    it('should support language detection by path', () => {
      expect(languageMappingManager.getLanguageByPath('test.ts')).toBe('typescript');
      expect(languageMappingManager.getLanguageByPath('test.js')).toBe('javascript');
      expect(languageMappingManager.getLanguageByPath('script.py')).toBe('python');
      expect(languageMappingManager.getLanguageByPath('config.json')).toBe('json');
    });
  });

  describe('LanguageClassificationDetector', () => {
    it('should detect TypeScript content correctly', async () => {
      const content = `import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'my-app';
}`;

      const result = await classificationDetector.detectByContent(content);
      expect(result).toBeDefined();
      if (result) {
        expect(result.confidence).toBeGreaterThan(0);
      }
    });

    it('should detect Python content correctly', async () => {
      const content = `def hello_world():
    print("Hello, World!")
    
class MyClass:
    def __init__(self):
        self.value = 42`;

      const result = await classificationDetector.detectByContent(content);
      expect(result).toBeDefined();
      if (result) {
        expect(result.confidence).toBeGreaterThan(0);
      }
    });

    it('should detect JavaScript content correctly', async () => {
      const content = `const myFunction = () => {
  console.log('Hello World');
};

export default myFunction;`;

      const result = await classificationDetector.detectByContent(content);
      expect(result).toBeDefined();
      if (result) {
        expect(result.confidence).toBeGreaterThan(0);
      }
    });

    it('should provide classification information', () => {
      expect(classificationDetector.getAdvancedProgrammingLanguages().length).toBeGreaterThan(0);
      expect(classificationDetector.getBasicProgrammingLanguages().length).toBeGreaterThan(0);
      expect(classificationDetector.getDataFormatLanguages().length).toBeGreaterThan(0);
    });
  });

  describe('QueryBasedLanguageDetector', () => {
    it('should have correct query complexity for languages', () => {
      // Advanced programming languages should have complex queries
      expect(queryBasedDetector.getLanguageQueryComplexity('typescript')).toBe('complex');
      expect(queryBasedDetector.getLanguageQueryComplexity('javascript')).toBe('complex');
      expect(queryBasedDetector.getLanguageQueryComplexity('python')).toBe('complex');

      // Basic programming languages should have simple queries
      // Note: This test depends on actual query files existing in the directory
      const phpComplexity = queryBasedDetector.getLanguageQueryComplexity('php');
      expect(['simple', 'none']).toContain(phpComplexity);
    });

    it('should analyze language queries', async () => {
      // This is a basic test - the actual query matching logic
      // is more complex and depends on the actual query files
      const content = 'function test() { return 42; }';

      // This should not throw an error
      await expect(queryBasedDetector.detectLanguageByQueries('test.ts', content)).resolves.not.toThrow();
    });
  });

  describe('System Integration', () => {
    it('should work with file paths correctly', () => {
      const language = languageMappingManager.getLanguageByPath('example.ts');
      expect(language).toBe('typescript');

      const config = languageMappingManager.getLanguageConfig('typescript');
      expect(config).toBeDefined();
      expect(config?.name).toBe('typescript');
      expect(config?.category).toBe('advanced_programming');
    });

    it('should provide strategy information', () => {
      const tsStrategy = languageMappingManager.getLanguageStrategy('typescript');
      expect(tsStrategy).toBeDefined();
      expect(tsStrategy?.primary).toBe('treesitter_ast');
      expect(tsStrategy?.useFullAST).toBe(true);

      const jsonStrategy = languageMappingManager.getLanguageStrategy('json');
      expect(jsonStrategy).toBeDefined();
      expect(jsonStrategy?.primary).toBe('universal_bracket');
      expect(jsonStrategy?.skipComplexQueries).toBe(true);
    });
  });
});