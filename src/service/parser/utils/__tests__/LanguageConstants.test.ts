import { 
  getStandardLanguageName, 
  isConfigLanguage, 
  isFrontendLanguage, 
  isEmbeddedTemplateLanguage,
  getLanguageCategory,
  TREE_SITTER_LANGUAGE_MAP,
  LANGUAGE_ALIASES
} from '../../config/LanguageConstants';

describe('LanguageConstants', () => {
  describe('getStandardLanguageName', () => {
    test('应该返回标准化的语言名称', () => {
      expect(getStandardLanguageName('typescript')).toBe('typescript');
      expect(getStandardLanguageName('javascript')).toBe('javascript');
      expect(getStandardLanguageName('c_sharp')).toBe('csharp');
      expect(getStandardLanguageName('js')).toBe('javascript');
      expect(getStandardLanguageName('ts')).toBe('typescript');
      expect(getStandardLanguageName('py')).toBe('python');
    });

    test('应该处理未知语言名称', () => {
      expect(getStandardLanguageName('unknown_language')).toBe('unknown_language');
      expect(getStandardLanguageName('UNKNOWN')).toBe('unknown');
    });
  });

  describe('isConfigLanguage', () => {
    test('应该正确识别配置文件语言', () => {
      expect(isConfigLanguage('json')).toBe(true);
      expect(isConfigLanguage('yaml')).toBe(true);
      expect(isConfigLanguage('toml')).toBe(true);
      expect(isConfigLanguage('xml')).toBe(true);
    });

    test('应该正确识别非配置文件语言', () => {
      expect(isConfigLanguage('javascript')).toBe(false);
      expect(isConfigLanguage('python')).toBe(false);
      expect(isConfigLanguage('java')).toBe(false);
    });
  });

  describe('isFrontendLanguage', () => {
    test('应该正确识别前端语言', () => {
      expect(isFrontendLanguage('vue')).toBe(true);
      expect(isFrontendLanguage('jsx')).toBe(true);
      expect(isFrontendLanguage('tsx')).toBe(true);
      expect(isFrontendLanguage('html')).toBe(true);
    });

    test('应该正确识别非前端语言', () => {
      expect(isFrontendLanguage('python')).toBe(false);
      expect(isFrontendLanguage('java')).toBe(false);
      expect(isFrontendLanguage('json')).toBe(false);
    });
  });

  describe('isEmbeddedTemplateLanguage', () => {
    test('应该正确识别嵌入式模板语言', () => {
      expect(isEmbeddedTemplateLanguage('embedded_template')).toBe(true);
      expect(isEmbeddedTemplateLanguage('vue')).toBe(true);
      expect(isEmbeddedTemplateLanguage('jsx')).toBe(true);
      expect(isEmbeddedTemplateLanguage('tsx')).toBe(true);
    });

    test('应该正确识别非嵌入式模板语言', () => {
      expect(isEmbeddedTemplateLanguage('python')).toBe(false);
      expect(isEmbeddedTemplateLanguage('java')).toBe(false);
      expect(isEmbeddedTemplateLanguage('json')).toBe(false);
    });
  });

  describe('getLanguageCategory', () => {
    test('应该正确返回编程语言分类', () => {
      expect(getLanguageCategory('javascript')).toBe('programming');
      expect(getLanguageCategory('python')).toBe('programming');
      expect(getLanguageCategory('java')).toBe('programming');
    });

    test('应该正确返回标记语言分类', () => {
      expect(getLanguageCategory('html')).toBe('markup');
      expect(getLanguageCategory('css')).toBe('markup');
      expect(getLanguageCategory('vue')).toBe('markup');
    });

    test('应该正确返回数据语言分类', () => {
      expect(getLanguageCategory('json')).toBe('data');
      expect(getLanguageCategory('yaml')).toBe('data');
      expect(getLanguageCategory('toml')).toBe('data');
    });

    test('应该正确返回模板语言分类', () => {
      expect(getLanguageCategory('embedded_template')).toBe('template');
      expect(getLanguageCategory('jsx')).toBe('template');
      expect(getLanguageCategory('tsx')).toBe('template');
    });

    test('应该为未知语言返回默认分类', () => {
      expect(getLanguageCategory('unknown')).toBe('programming');
    });
  });

  describe('TREE_SITTER_LANGUAGE_MAP', () => {
    test('应该包含所有预期的语言映射', () => {
      expect(TREE_SITTER_LANGUAGE_MAP['typescript']).toBe('typescript');
      expect(TREE_SITTER_LANGUAGE_MAP['c_sharp']).toBe('csharp');
      expect(TREE_SITTER_LANGUAGE_MAP['javascript']).toBe('javascript');
      expect(TREE_SITTER_LANGUAGE_MAP['python']).toBe('python');
    });

    test('应该包含查询目录中的所有语言', () => {
      // 验证包含查询目录中的主要语言
      const expectedLanguages = [
        'typescript', 'javascript', 'python', 'java', 'go', 'rust',
        'cpp', 'c', 'c_sharp', 'swift', 'kotlin', 'ruby', 'php', 'scala',
        'html', 'css', 'vue', 'json', 'yaml', 'toml', 'tsx', 'elixir',
        'lua', 'ocaml', 'solidity', 'systemrdl', 'tlaplus', 'zig', 'elisp'
      ];

      expectedLanguages.forEach(lang => {
        expect(TREE_SITTER_LANGUAGE_MAP).toHaveProperty(lang);
      });
    });
  });

  describe('LANGUAGE_ALIASES', () => {
    test('应该包含常见的语言别名', () => {
      expect(LANGUAGE_ALIASES['js']).toBe('javascript');
      expect(LANGUAGE_ALIASES['ts']).toBe('typescript');
      expect(LANGUAGE_ALIASES['py']).toBe('python');
      expect(LANGUAGE_ALIASES['rb']).toBe('ruby');
      expect(LANGUAGE_ALIASES['rs']).toBe('rust');
      expect(LANGUAGE_ALIASES['cs']).toBe('csharp');
      expect(LANGUAGE_ALIASES['kt']).toBe('kotlin');
      expect(LANGUAGE_ALIASES['md']).toBe('markdown');
      expect(LANGUAGE_ALIASES['yml']).toBe('yaml');
      expect(LANGUAGE_ALIASES['sh']).toBe('shell');
      expect(LANGUAGE_ALIASES['bash']).toBe('shell');
    });
  });
});