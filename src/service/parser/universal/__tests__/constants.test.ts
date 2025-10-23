import {
  BACKUP_FILE_PATTERNS,
  BACKUP_FILE_TYPE_MAP,
  LANGUAGE_MAP,
  CODE_LANGUAGES,
  STRUCTURED_LANGUAGES,
  BLOCK_SIZE_LIMITS,
  getDynamicBlockLimits,
  SMALL_FILE_THRESHOLD,
  DEFAULT_CONFIG,
  SHEBANG_PATTERNS,
  SYNTAX_PATTERNS,
  FILE_STRUCTURE_PATTERNS,
  STRONG_FEATURE_LANGUAGES
} from '../constants';

describe('Constants', () => {
  describe('BACKUP_FILE_PATTERNS', () => {
    it('should contain expected backup file patterns', () => {
      expect(BACKUP_FILE_PATTERNS).toContain('.bak');
      expect(BACKUP_FILE_PATTERNS).toContain('.backup');
      expect(BACKUP_FILE_PATTERNS).toContain('.old');
      expect(BACKUP_FILE_PATTERNS).toContain('.tmp');
      expect(BACKUP_FILE_PATTERNS).toContain('.temp');
      expect(BACKUP_FILE_PATTERNS).toContain('.orig');
      expect(BACKUP_FILE_PATTERNS).toContain('.save');
    });

    it('should be an array of strings', () => {
      expect(Array.isArray(BACKUP_FILE_PATTERNS)).toBe(true);
      BACKUP_FILE_PATTERNS.forEach(pattern => {
        expect(typeof pattern).toBe('string');
      });
    });
  });

  describe('BACKUP_FILE_TYPE_MAP', () => {
    it('should map backup patterns to types', () => {
      expect(BACKUP_FILE_TYPE_MAP['.bak']).toBe('standard-backup');
      expect(BACKUP_FILE_TYPE_MAP['.backup']).toBe('full-backup');
      expect(BACKUP_FILE_TYPE_MAP['.old']).toBe('old-version');
      expect(BACKUP_FILE_TYPE_MAP['.tmp']).toBe('temporary');
      expect(BACKUP_FILE_TYPE_MAP['.temp']).toBe('temporary');
      expect(BACKUP_FILE_TYPE_MAP['.orig']).toBe('original');
      expect(BACKUP_FILE_TYPE_MAP['.save']).toBe('saved');
    });

    it('should have consistent keys with BACKUP_FILE_PATTERNS', () => {
      Object.keys(BACKUP_FILE_TYPE_MAP).forEach(key => {
        expect(BACKUP_FILE_PATTERNS).toContain(key);
      });
    });
  });

  describe('LANGUAGE_MAP', () => {
    it('should map file extensions to languages', () => {
      expect(LANGUAGE_MAP['.js']).toBe('javascript');
      expect(LANGUAGE_MAP['.ts']).toBe('typescript');
      expect(LANGUAGE_MAP['.py']).toBe('python');
      expect(LANGUAGE_MAP['.java']).toBe('java');
      expect(LANGUAGE_MAP['.cpp']).toBe('cpp');
      expect(LANGUAGE_MAP['.c']).toBe('c');
      expect(LANGUAGE_MAP['.cs']).toBe('csharp');
      expect(LANGUAGE_MAP['.go']).toBe('go');
      expect(LANGUAGE_MAP['.rs']).toBe('rust');
      expect(LANGUAGE_MAP['.php']).toBe('php');
      expect(LANGUAGE_MAP['.rb']).toBe('ruby');
      expect(LANGUAGE_MAP['.swift']).toBe('swift');
      expect(LANGUAGE_MAP['.kt']).toBe('kotlin');
      expect(LANGUAGE_MAP['.scala']).toBe('scala');
      expect(LANGUAGE_MAP['.md']).toBe('markdown');
      expect(LANGUAGE_MAP['.json']).toBe('json');
      expect(LANGUAGE_MAP['.xml']).toBe('xml');
      expect(LANGUAGE_MAP['.yaml']).toBe('yaml');
      expect(LANGUAGE_MAP['.yml']).toBe('yaml');
      expect(LANGUAGE_MAP['.sql']).toBe('sql');
      expect(LANGUAGE_MAP['.sh']).toBe('shell');
      expect(LANGUAGE_MAP['.bash']).toBe('shell');
      expect(LANGUAGE_MAP['.zsh']).toBe('shell');
      expect(LANGUAGE_MAP['.fish']).toBe('shell');
      expect(LANGUAGE_MAP['.html']).toBe('html');
      expect(LANGUAGE_MAP['.htm']).toBe('html');
      expect(LANGUAGE_MAP['.css']).toBe('css');
      expect(LANGUAGE_MAP['.scss']).toBe('scss');
      expect(LANGUAGE_MAP['.sass']).toBe('sass');
      expect(LANGUAGE_MAP['.less']).toBe('less');
      expect(LANGUAGE_MAP['.vue']).toBe('vue');
      expect(LANGUAGE_MAP['.svelte']).toBe('svelte');
      expect(LANGUAGE_MAP['.txt']).toBe('text');
      expect(LANGUAGE_MAP['.log']).toBe('log');
      expect(LANGUAGE_MAP['.ini']).toBe('ini');
      expect(LANGUAGE_MAP['.cfg']).toBe('ini');
      expect(LANGUAGE_MAP['.conf']).toBe('ini');
      expect(LANGUAGE_MAP['.toml']).toBe('toml');
      expect(LANGUAGE_MAP['.dockerfile']).toBe('dockerfile');
      expect(LANGUAGE_MAP['.makefile']).toBe('makefile');
      expect(LANGUAGE_MAP['.cmake']).toBe('cmake');
      expect(LANGUAGE_MAP['.pl']).toBe('perl');
      expect(LANGUAGE_MAP['.r']).toBe('r');
      expect(LANGUAGE_MAP['.m']).toBe('matlab');
      expect(LANGUAGE_MAP['.lua']).toBe('lua');
      expect(LANGUAGE_MAP['.dart']).toBe('dart');
      expect(LANGUAGE_MAP['.ex']).toBe('elixir');
      expect(LANGUAGE_MAP['.exs']).toBe('elixir');
      expect(LANGUAGE_MAP['.erl']).toBe('erlang');
      expect(LANGUAGE_MAP['.hs']).toBe('haskell');
      expect(LANGUAGE_MAP['.ml']).toBe('ocaml');
      expect(LANGUAGE_MAP['.fs']).toBe('fsharp');
      expect(LANGUAGE_MAP['.vb']).toBe('visualbasic');
      expect(LANGUAGE_MAP['.ps1']).toBe('powershell');
      expect(LANGUAGE_MAP['.bat']).toBe('batch');
      expect(LANGUAGE_MAP['.cmd']).toBe('batch');
    });

    it('should handle unknown extensions', () => {
      expect(LANGUAGE_MAP['.unknown']).toBeUndefined();
      expect(LANGUAGE_MAP['.xyz']).toBeUndefined();
    });
  });

  describe('CODE_LANGUAGES', () => {
    it('should contain programming languages', () => {
      expect(CODE_LANGUAGES).toContain('javascript');
      expect(CODE_LANGUAGES).toContain('typescript');
      expect(CODE_LANGUAGES).toContain('python');
      expect(CODE_LANGUAGES).toContain('java');
      expect(CODE_LANGUAGES).toContain('cpp');
      expect(CODE_LANGUAGES).toContain('c');
      expect(CODE_LANGUAGES).toContain('csharp');
      expect(CODE_LANGUAGES).toContain('go');
      expect(CODE_LANGUAGES).toContain('rust');
      expect(CODE_LANGUAGES).toContain('php');
      expect(CODE_LANGUAGES).toContain('ruby');
      expect(CODE_LANGUAGES).toContain('swift');
      expect(CODE_LANGUAGES).toContain('kotlin');
      expect(CODE_LANGUAGES).toContain('scala');
      expect(CODE_LANGUAGES).toContain('shell');
      expect(CODE_LANGUAGES).toContain('html');
      expect(CODE_LANGUAGES).toContain('css');
      expect(CODE_LANGUAGES).toContain('scss');
      expect(CODE_LANGUAGES).toContain('sass');
      expect(CODE_LANGUAGES).toContain('less');
      expect(CODE_LANGUAGES).toContain('vue');
      expect(CODE_LANGUAGES).toContain('svelte');
      expect(CODE_LANGUAGES).toContain('json');
      expect(CODE_LANGUAGES).toContain('xml');
      expect(CODE_LANGUAGES).toContain('yaml');
      expect(CODE_LANGUAGES).toContain('sql');
      expect(CODE_LANGUAGES).toContain('dockerfile');
      expect(CODE_LANGUAGES).toContain('cmake');
      expect(CODE_LANGUAGES).toContain('perl');
      expect(CODE_LANGUAGES).toContain('r');
      expect(CODE_LANGUAGES).toContain('matlab');
      expect(CODE_LANGUAGES).toContain('lua');
      expect(CODE_LANGUAGES).toContain('dart');
      expect(CODE_LANGUAGES).toContain('elixir');
      expect(CODE_LANGUAGES).toContain('erlang');
      expect(CODE_LANGUAGES).toContain('haskell');
      expect(CODE_LANGUAGES).toContain('ocaml');
      expect(CODE_LANGUAGES).toContain('fsharp');
      expect(CODE_LANGUAGES).toContain('visualbasic');
      expect(CODE_LANGUAGES).toContain('powershell');
      expect(CODE_LANGUAGES).toContain('batch');
    });

    it('should not contain non-code languages', () => {
      expect(CODE_LANGUAGES).not.toContain('text');
      expect(CODE_LANGUAGES).not.toContain('log');
      expect(CODE_LANGUAGES).not.toContain('unknown');
    });

    it('should be an array of strings', () => {
      expect(Array.isArray(CODE_LANGUAGES)).toBe(true);
      CODE_LANGUAGES.forEach(lang => {
        expect(typeof lang).toBe('string');
      });
    });
  });

  describe('STRUCTURED_LANGUAGES', () => {
    it('should contain structured data languages', () => {
      expect(STRUCTURED_LANGUAGES).toContain('json');
      expect(STRUCTURED_LANGUAGES).toContain('xml');
      expect(STRUCTURED_LANGUAGES).toContain('yaml');
      expect(STRUCTURED_LANGUAGES).toContain('html');
      expect(STRUCTURED_LANGUAGES).toContain('css');
      expect(STRUCTURED_LANGUAGES).toContain('scss');
      expect(STRUCTURED_LANGUAGES).toContain('sass');
    });

    it('should be a subset of CODE_LANGUAGES', () => {
      STRUCTURED_LANGUAGES.forEach(lang => {
        expect(CODE_LANGUAGES).toContain(lang);
      });
    });
  });

  describe('BLOCK_SIZE_LIMITS', () => {
    it('should have expected block size limits', () => {
      expect(BLOCK_SIZE_LIMITS.MIN_BLOCK_CHARS).toBe(20);
      expect(BLOCK_SIZE_LIMITS.MAX_BLOCK_CHARS).toBe(1000);
      expect(BLOCK_SIZE_LIMITS.MAX_CHARS_TOLERANCE_FACTOR).toBe(1.2);
      expect(BLOCK_SIZE_LIMITS.MIN_CHUNK_REMAINDER_CHARS).toBe(100);
    });

    it('should have reasonable values', () => {
      expect(BLOCK_SIZE_LIMITS.MIN_BLOCK_CHARS).toBeGreaterThan(0);
      expect(BLOCK_SIZE_LIMITS.MAX_BLOCK_CHARS).toBeGreaterThan(BLOCK_SIZE_LIMITS.MIN_BLOCK_CHARS);
      expect(BLOCK_SIZE_LIMITS.MAX_CHARS_TOLERANCE_FACTOR).toBeGreaterThan(1.0);
      expect(BLOCK_SIZE_LIMITS.MIN_CHUNK_REMAINDER_CHARS).toBeGreaterThan(0);
      expect(BLOCK_SIZE_LIMITS.MIN_CHUNK_REMAINDER_CHARS).toBeLessThan(BLOCK_SIZE_LIMITS.MIN_BLOCK_CHARS);
    });
  });

  describe('getDynamicBlockLimits', () => {
    it('should return relaxed limits for small files', () => {
      const limits = getDynamicBlockLimits(400, 15); // Small file
      
      expect(limits.MIN_BLOCK_CHARS).toBe(10);
      expect(limits.MAX_BLOCK_CHARS).toBe(800);
      expect(limits.MAX_CHARS_TOLERANCE_FACTOR).toBe(1.5);
      expect(limits.MIN_CHUNK_REMAINDER_CHARS).toBe(50);
    });

    it('should return standard limits for medium files', () => {
      const limits = getDynamicBlockLimits(1000, 50); // Medium file
      
      expect(limits).toEqual(BLOCK_SIZE_LIMITS);
    });

    it('should return strict limits for large files', () => {
      const limits = getDynamicBlockLimits(3000, 150); // Large file
      
      expect(limits.MIN_BLOCK_CHARS).toBe(50);
      expect(limits.MAX_BLOCK_CHARS).toBe(1000);
      expect(limits.MAX_CHARS_TOLERANCE_FACTOR).toBe(1.2);
      expect(limits.MIN_CHUNK_REMAINDER_CHARS).toBe(200);
    });

    it('should handle edge cases', () => {
      // Very small file
      let limits = getDynamicBlockLimits(100, 5);
      expect(limits.MIN_BLOCK_CHARS).toBe(10);
      
      // Very large file
      limits = getDynamicBlockLimits(10000, 500);
      expect(limits.MIN_BLOCK_CHARS).toBe(50);
      
      // Boundary conditions
      limits = getDynamicBlockLimits(500, 20); // Exactly small threshold
      expect(limits).toEqual(BLOCK_SIZE_LIMITS);
      
      limits = getDynamicBlockLimits(2000, 100); // Exactly medium threshold
      expect(limits).toEqual(BLOCK_SIZE_LIMITS);
    });
  });

  describe('SMALL_FILE_THRESHOLD', () => {
    it('should have expected thresholds', () => {
      expect(SMALL_FILE_THRESHOLD.CHARS).toBe(300);
      expect(SMALL_FILE_THRESHOLD.LINES).toBe(15);
    });

    it('should have reasonable values', () => {
      expect(SMALL_FILE_THRESHOLD.CHARS).toBeGreaterThan(0);
      expect(SMALL_FILE_THRESHOLD.LINES).toBeGreaterThan(0);
    });
  });

  describe('DEFAULT_CONFIG', () => {
    it('should have expected default configuration', () => {
      expect(DEFAULT_CONFIG.MAX_ERRORS).toBe(5);
      expect(DEFAULT_CONFIG.ERROR_RESET_INTERVAL).toBe(60000);
      expect(DEFAULT_CONFIG.MEMORY_LIMIT_MB).toBe(500);
      expect(DEFAULT_CONFIG.MEMORY_CHECK_INTERVAL).toBe(5000);
      expect(DEFAULT_CONFIG.MAX_CHUNK_SIZE).toBe(2000);
      expect(DEFAULT_CONFIG.CHUNK_OVERLAP).toBe(200);
      expect(DEFAULT_CONFIG.MAX_LINES_PER_CHUNK).toBe(50);
    });

    it('should have reasonable default values', () => {
      expect(DEFAULT_CONFIG.MAX_ERRORS).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.ERROR_RESET_INTERVAL).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.MEMORY_LIMIT_MB).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.MEMORY_CHECK_INTERVAL).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.MAX_CHUNK_SIZE).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.CHUNK_OVERLAP).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_CONFIG.MAX_LINES_PER_CHUNK).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.CHUNK_OVERLAP).toBeLessThan(DEFAULT_CONFIG.MAX_CHUNK_SIZE);
    });

    it('should have nested configuration objects', () => {
      expect(DEFAULT_CONFIG.TEXT_SPLITTER_OPTIONS).toBeDefined();
      expect(DEFAULT_CONFIG.TEXT_SPLITTER_OPTIONS.maxChunkSize).toBe(2000);
      expect(DEFAULT_CONFIG.TEXT_SPLITTER_OPTIONS.overlapSize).toBe(200);
      expect(DEFAULT_CONFIG.TEXT_SPLITTER_OPTIONS.maxLinesPerChunk).toBe(50);
      expect(DEFAULT_CONFIG.TEXT_SPLITTER_OPTIONS.errorThreshold).toBe(5);
      expect(DEFAULT_CONFIG.TEXT_SPLITTER_OPTIONS.memoryLimitMB).toBe(500);
      expect(DEFAULT_CONFIG.TEXT_SPLITTER_OPTIONS.enableBracketBalance).toBe(true);
      expect(DEFAULT_CONFIG.TEXT_SPLITTER_OPTIONS.enableSemanticDetection).toBe(true);
    });
  });

  describe('SHEBANG_PATTERNS', () => {
    it('should contain expected shebang patterns', () => {
      expect(SHEBANG_PATTERNS).toContain(['#!/bin/bash', 'shell']);
      expect(SHEBANG_PATTERNS).toContain(['#!/bin/sh', 'shell']);
      expect(SHEBANG_PATTERNS).toContain(['#!/usr/bin/env python', 'python']);
      expect(SHEBANG_PATTERNS).toContain(['#!/usr/bin/env python3', 'python']);
      expect(SHEBANG_PATTERNS).toContain(['#!/usr/bin/env node', 'javascript']);
      expect(SHEBANG_PATTERNS).toContain(['#!/usr/bin/env ruby', 'ruby']);
      expect(SHEBANG_PATTERNS).toContain(['#!/usr/bin/env perl', 'perl']);
      expect(SHEBANG_PATTERNS).toContain(['#!/usr/bin/env php', 'php']);
      expect(SHEBANG_PATTERNS).toContain(['#!/usr/bin/env lua', 'lua']);
      expect(SHEBANG_PATTERNS).toContain(['#!/usr/bin/env fish', 'fish']);
      expect(SHEBANG_PATTERNS).toContain(['#!/usr/bin/env zsh', 'shell']);
    });

    it('should be an array of tuples', () => {
      expect(Array.isArray(SHEBANG_PATTERNS)).toBe(true);
      SHEBANG_PATTERNS.forEach(pattern => {
        expect(Array.isArray(pattern)).toBe(true);
        expect(pattern).toHaveLength(2);
        expect(typeof pattern[0]).toBe('string');
        expect(typeof pattern[1]).toBe('string');
      });
    });

    it('should have unique patterns', () => {
      const patterns = SHEBANG_PATTERNS.map(p => p[0]);
      const uniquePatterns = [...new Set(patterns)];
      expect(patterns).toEqual(uniquePatterns);
    });
  });

  describe('SYNTAX_PATTERNS', () => {
    it('should contain patterns for major languages', () => {
      expect(SYNTAX_PATTERNS.python).toBeDefined();
      expect(SYNTAX_PATTERNS.javascript).toBeDefined();
      expect(SYNTAX_PATTERNS.typescript).toBeDefined();
      expect(SYNTAX_PATTERNS.java).toBeDefined();
      expect(SYNTAX_PATTERNS.cpp).toBeDefined();
      expect(SYNTAX_PATTERNS.c).toBeDefined();
      expect(SYNTAX_PATTERNS.go).toBeDefined();
      expect(SYNTAX_PATTERNS.rust).toBeDefined();
      expect(SYNTAX_PATTERNS.ruby).toBeDefined();
      expect(SYNTAX_PATTERNS.php).toBeDefined();
      expect(SYNTAX_PATTERNS.shell).toBeDefined();
      expect(SYNTAX_PATTERNS.json).toBeDefined();
      expect(SYNTAX_PATTERNS.yaml).toBeDefined();
      expect(SYNTAX_PATTERNS.html).toBeDefined();
      expect(SYNTAX_PATTERNS.css).toBeDefined();
      expect(SYNTAX_PATTERNS.sql).toBeDefined();
      expect(SYNTAX_PATTERNS.dockerfile).toBeDefined();
      expect(SYNTAX_PATTERNS.markdown).toBeDefined();
      expect(SYNTAX_PATTERNS.xml).toBeDefined();
      expect(SYNTAX_PATTERNS.toml).toBeDefined();
      expect(SYNTAX_PATTERNS.ini).toBeDefined();
      expect(SYNTAX_PATTERNS.makefile).toBeDefined();
      expect(SYNTAX_PATTERNS.cmake).toBeDefined();
      expect(SYNTAX_PATTERNS.perl).toBeDefined();
      expect(SYNTAX_PATTERNS.lua).toBeDefined();
      expect(SYNTAX_PATTERNS.r).toBeDefined();
      expect(SYNTAX_PATTERNS.matlab).toBeDefined();
    });

    it('should have valid regex patterns for each language', () => {
      Object.entries(SYNTAX_PATTERNS).forEach(([language, patterns]) => {
        expect(Array.isArray(patterns)).toBe(true);
        patterns.forEach(pattern => {
          expect(pattern).toBeInstanceOf(RegExp);
        });
      });
    });

    it('should have language-specific patterns', () => {
      // Python-specific patterns
      expect(SYNTAX_PATTERNS.python.some(p => p.source.includes('import'))).toBe(true);
      expect(SYNTAX_PATTERNS.python.some(p => p.source.includes('def'))).toBe(true);
      expect(SYNTAX_PATTERNS.python.some(p => p.source.includes('class'))).toBe(true);

      // JavaScript-specific patterns
      expect(SYNTAX_PATTERNS.javascript.some(p => p.source.includes('function'))).toBe(true);
      expect(SYNTAX_PATTERNS.javascript.some(p => p.source.includes('const'))).toBe(true);
      expect(SYNTAX_PATTERNS.javascript.some(p => p.source.includes('import'))).toBe(true);

      // TypeScript-specific patterns
      expect(SYNTAX_PATTERNS.typescript.some(p => p.source.includes('interface'))).toBe(true);
      expect(SYNTAX_PATTERNS.typescript.some(p => p.source.includes('type'))).toBe(true);

      // Java-specific patterns
      expect(SYNTAX_PATTERNS.java.some(p => p.source.includes('public class'))).toBe(true);
      expect(SYNTAX_PATTERNS.java.some(p => p.source.includes('package'))).toBe(true);

      // C++-specific patterns
      expect(SYNTAX_PATTERNS.cpp.some(p => p.source.includes('#include'))).toBe(true);
      expect(SYNTAX_PATTERNS.cpp.some(p => p.source.includes('using namespace'))).toBe(true);

      // Go-specific patterns
      expect(SYNTAX_PATTERNS.go.some(p => p.source.includes('package'))).toBe(true);
      expect(SYNTAX_PATTERNS.go.some(p => p.source.includes('func'))).toBe(true);

      // Rust-specific patterns
      expect(SYNTAX_PATTERNS.rust.some(p => p.source.includes('fn'))).toBe(true);
      expect(SYNTAX_PATTERNS.rust.some(p => p.source.includes('let'))).toBe(true);
      expect(SYNTAX_PATTERNS.rust.some(p => p.source.includes('impl'))).toBe(true);

      // SQL-specific patterns
      expect(SYNTAX_PATTERNS.sql.some(p => p.source.includes('SELECT'))).toBe(true);
      expect(SYNTAX_PATTERNS.sql.some(p => p.source.includes('INSERT'))).toBe(true);
      expect(SYNTAX_PATTERNS.sql.some(p => p.source.includes('UPDATE'))).toBe(true);

      // Dockerfile-specific patterns
      expect(SYNTAX_PATTERNS.dockerfile.some(p => p.source.includes('FROM'))).toBe(true);
      expect(SYNTAX_PATTERNS.dockerfile.some(p => p.source.includes('RUN'))).toBe(true);
    });
  });

  describe('FILE_STRUCTURE_PATTERNS', () => {
    it('should contain expected file structure patterns', () => {
      expect(FILE_STRUCTURE_PATTERNS).toContain(['dockerfile', /^(FROM|RUN|COPY|ADD|CMD|ENTRYPOINT|ENV|EXPOSE|VOLUME|WORKDIR|USER)/i]);
      expect(FILE_STRUCTURE_PATTERNS).toContain(['makefile', /^[a-zA-Z_][a-zA-Z0-9_]*\s*:/m]);
      expect(FILE_STRUCTURE_PATTERNS).toContain(['cmake', /^(cmake_minimum_required|project|add_executable|add_library)/i]);
      expect(FILE_STRUCTURE_PATTERNS).toContain(['python', /^(import|from|def|class)\s+/m]);
    });

    it('should be an array of tuples', () => {
      expect(Array.isArray(FILE_STRUCTURE_PATTERNS)).toBe(true);
      FILE_STRUCTURE_PATTERNS.forEach(pattern => {
        expect(Array.isArray(pattern)).toBe(true);
        expect(pattern).toHaveLength(2);
        expect(typeof pattern[0]).toBe('string');
        expect(pattern[1]).toBeInstanceOf(RegExp);
      });
    });
  });

  describe('STRONG_FEATURE_LANGUAGES', () => {
    it('should contain languages with strong features', () => {
      expect(STRONG_FEATURE_LANGUAGES).toContain('javascript');
      expect(STRONG_FEATURE_LANGUAGES).toContain('typescript');
      expect(STRONG_FEATURE_LANGUAGES).toContain('python');
      expect(STRONG_FEATURE_LANGUAGES).toContain('java');
      expect(STRONG_FEATURE_LANGUAGES).toContain('cpp');
      expect(STRONG_FEATURE_LANGUAGES).toContain('c');
      expect(STRONG_FEATURE_LANGUAGES).toContain('go');
      expect(STRONG_FEATURE_LANGUAGES).toContain('rust');
      expect(STRONG_FEATURE_LANGUAGES).toContain('php');
      expect(STRONG_FEATURE_LANGUAGES).toContain('ruby');
      expect(STRONG_FEATURE_LANGUAGES).toContain('shell');
      expect(STRONG_FEATURE_LANGUAGES).toContain('json');
      expect(STRONG_FEATURE_LANGUAGES).toContain('html');
      expect(STRONG_FEATURE_LANGUAGES).toContain('css');
      expect(STRONG_FEATURE_LANGUAGES).toContain('sql');
      expect(STRONG_FEATURE_LANGUAGES).toContain('dockerfile');
    });

    it('should be a subset of CODE_LANGUAGES', () => {
      STRONG_FEATURE_LANGUAGES.forEach(lang => {
        expect(CODE_LANGUAGES).toContain(lang);
      });
    });

    it('should be an array of strings', () => {
      expect(Array.isArray(STRONG_FEATURE_LANGUAGES)).toBe(true);
      STRONG_FEATURE_LANGUAGES.forEach(lang => {
        expect(typeof lang).toBe('string');
      });
    });
  });

  describe('Integration Tests', () => {
    it('should have consistent language mappings across constants', () => {
      // Check that all languages in CODE_LANGUAGES have corresponding extensions in LANGUAGE_MAP
      const languagesFromExtensions = new Set(Object.values(LANGUAGE_MAP));
      
      CODE_LANGUAGES.forEach(lang => {
        expect(languagesFromExtensions).toContain(lang);
      });
    });

    it('should have valid regex patterns', () => {
      // Test that all regex patterns are valid
      Object.values(SYNTAX_PATTERNS).forEach(patterns => {
        patterns.forEach(pattern => {
          expect(() => pattern.test('')).not.toThrow();
        });
      });

      FILE_STRUCTURE_PATTERNS.forEach(([, pattern]) => {
        expect(() => pattern.test('')).not.toThrow();
      });
    });

    it('should have reasonable default configuration values', () => {
      // Check that default values are consistent with each other
      expect(DEFAULT_CONFIG.MAX_CHUNK_SIZE).toBe(DEFAULT_CONFIG.TEXT_SPLITTER_OPTIONS.maxChunkSize);
      expect(DEFAULT_CONFIG.CHUNK_OVERLAP).toBe(DEFAULT_CONFIG.TEXT_SPLITTER_OPTIONS.overlapSize);
      expect(DEFAULT_CONFIG.MAX_LINES_PER_CHUNK).toBe(DEFAULT_CONFIG.TEXT_SPLITTER_OPTIONS.maxLinesPerChunk);
      expect(DEFAULT_CONFIG.MAX_ERRORS).toBe(DEFAULT_CONFIG.TEXT_SPLITTER_OPTIONS.errorThreshold);
      expect(DEFAULT_CONFIG.MEMORY_LIMIT_MB).toBe(DEFAULT_CONFIG.TEXT_SPLITTER_OPTIONS.memoryLimitMB);
    });
  });
});