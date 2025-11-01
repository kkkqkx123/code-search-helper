import { LANGUAGE_MAP, DEFAULT_SUPPORTED_EXTENSIONS } from '../languageConstants';

describe('languageConstants', () => {
  describe('LANGUAGE_MAP', () => {
    it('should be a record mapping file extensions to language names', () => {
      expect(typeof LANGUAGE_MAP).toBe('object');
      expect(LANGUAGE_MAP).not.toBeNull();
    });

    it('should include common programming language extensions', () => {
      expect(LANGUAGE_MAP['.ts']).toBe('typescript');
      expect(LANGUAGE_MAP['.tsx']).toBe('typescript');
      expect(LANGUAGE_MAP['.js']).toBe('javascript');
      expect(LANGUAGE_MAP['.jsx']).toBe('javascript');
      expect(LANGUAGE_MAP['.py']).toBe('python');
      expect(LANGUAGE_MAP['.java']).toBe('java');
      expect(LANGUAGE_MAP['.go']).toBe('go');
      expect(LANGUAGE_MAP['.rs']).toBe('rust');
      expect(LANGUAGE_MAP['.cpp']).toBe('cpp');
      expect(LANGUAGE_MAP['.c']).toBe('c');
      expect(LANGUAGE_MAP['.h']).toBe('c');
      expect(LANGUAGE_MAP['.hpp']).toBe('cpp');
    });

    it('should include common text/markup extensions', () => {
      expect(LANGUAGE_MAP['.txt']).toBe('text');
      expect(LANGUAGE_MAP['.md']).toBe('markdown');
      expect(LANGUAGE_MAP['.json']).toBe('json');
      expect(LANGUAGE_MAP['.yaml']).toBe('yaml');
      expect(LANGUAGE_MAP['.yml']).toBe('yaml');
      expect(LANGUAGE_MAP['.xml']).toBe('xml');
      expect(LANGUAGE_MAP['.csv']).toBe('csv');
    });

    it('should have unique language mappings (no conflicting extensions)', () => {
      const extensions = Object.keys(LANGUAGE_MAP);
      const uniqueExtensions = [...new Set(extensions)];
      expect(uniqueExtensions.length).toBe(extensions.length);
    });

    it('should use consistent casing for language names', () => {
      const languageNames = Object.values(LANGUAGE_MAP);
      languageNames.forEach(lang => {
        // Language names should be lowercase
        expect(lang).toBe(lang.toLowerCase());
      });
    });
  });

  describe('DEFAULT_SUPPORTED_EXTENSIONS', () => {
    it('should be an array of strings', () => {
      expect(Array.isArray(DEFAULT_SUPPORTED_EXTENSIONS)).toBe(true);
      expect(DEFAULT_SUPPORTED_EXTENSIONS.length).toBeGreaterThan(0);
      expect(typeof DEFAULT_SUPPORTED_EXTENSIONS[0]).toBe('string');
    });

    it('should include all extensions from LANGUAGE_MAP', () => {
      const languageMapExtensions = Object.keys(LANGUAGE_MAP);
      DEFAULT_SUPPORTED_EXTENSIONS.forEach(ext => {
        expect(languageMapExtensions).toContain(ext);
      });
    });

    it('should include common programming language extensions', () => {
      expect(DEFAULT_SUPPORTED_EXTENSIONS).toContain('.ts');
      expect(DEFAULT_SUPPORTED_EXTENSIONS).toContain('.js');
      expect(DEFAULT_SUPPORTED_EXTENSIONS).toContain('.tsx');
      expect(DEFAULT_SUPPORTED_EXTENSIONS).toContain('.jsx');
      expect(DEFAULT_SUPPORTED_EXTENSIONS).toContain('.py');
      expect(DEFAULT_SUPPORTED_EXTENSIONS).toContain('.java');
      expect(DEFAULT_SUPPORTED_EXTENSIONS).toContain('.go');
      expect(DEFAULT_SUPPORTED_EXTENSIONS).toContain('.rs');
      expect(DEFAULT_SUPPORTED_EXTENSIONS).toContain('.cpp');
      expect(DEFAULT_SUPPORTED_EXTENSIONS).toContain('.c');
      expect(DEFAULT_SUPPORTED_EXTENSIONS).toContain('.h');
      expect(DEFAULT_SUPPORTED_EXTENSIONS).toContain('.hpp');
    });

    it('should include common text/markup extensions', () => {
      expect(DEFAULT_SUPPORTED_EXTENSIONS).toContain('.txt');
      expect(DEFAULT_SUPPORTED_EXTENSIONS).toContain('.md');
      expect(DEFAULT_SUPPORTED_EXTENSIONS).toContain('.json');
      expect(DEFAULT_SUPPORTED_EXTENSIONS).toContain('.yaml');
      expect(DEFAULT_SUPPORTED_EXTENSIONS).toContain('.yml');
      expect(DEFAULT_SUPPORTED_EXTENSIONS).toContain('.xml');
      expect(DEFAULT_SUPPORTED_EXTENSIONS).toContain('.csv');
    });

    it('should have unique extensions (no duplicates)', () => {
      const uniqueExtensions = [...new Set(DEFAULT_SUPPORTED_EXTENSIONS)];
      expect(uniqueExtensions.length).toBe(DEFAULT_SUPPORTED_EXTENSIONS.length);
    });

    it('should be in a consistent order', () => {
      // Check that the array maintains a consistent order (first few elements)
      expect(DEFAULT_SUPPORTED_EXTENSIONS[0]).toBe('.ts');
      expect(DEFAULT_SUPPORTED_EXTENSIONS[1]).toBe('.js');
      expect(DEFAULT_SUPPORTED_EXTENSIONS[2]).toBe('.tsx');
      expect(DEFAULT_SUPPORTED_EXTENSIONS[3]).toBe('.jsx');
    });
  });

  describe('consistency between LANGUAGE_MAP and DEFAULT_SUPPORTED_EXTENSIONS', () => {
    it('should have all supported extensions in the language map', () => {
      DEFAULT_SUPPORTED_EXTENSIONS.forEach(ext => {
        expect(LANGUAGE_MAP[ext]).toBeDefined();
        expect(typeof LANGUAGE_MAP[ext]).toBe('string');
      });
    });

    it('should have all language map extensions in supported extensions', () => {
      const languageMapExtensions = Object.keys(LANGUAGE_MAP);
      languageMapExtensions.forEach(ext => {
        expect(DEFAULT_SUPPORTED_EXTENSIONS).toContain(ext);
      });
    });
  });
});