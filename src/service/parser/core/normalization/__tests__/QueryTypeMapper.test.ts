/**
 * QueryTypeMapper 测试
 */

import { QueryTypeMapper, LANGUAGE_QUERY_MAPPINGS } from '../QueryTypeMappings';

describe('QueryTypeMapper', () => {
  describe('getMappedQueryTypes', () => {
    it('should map Rust query types correctly', () => {
      const discoveredTypes = ['functions-structs', 'modules-imports'];
      const mappedTypes = QueryTypeMapper.getMappedQueryTypes('rust', discoveredTypes);
      
      expect(mappedTypes).toContain('functions');
      expect(mappedTypes).toContain('classes');
      expect(mappedTypes).toContain('imports');
      expect(mappedTypes).toContain('modules');
    });

    it('should map TypeScript query types correctly', () => {
      const discoveredTypes = ['functions', 'classes', 'imports'];
      const mappedTypes = QueryTypeMapper.getMappedQueryTypes('typescript', discoveredTypes);
      
      expect(mappedTypes).toEqual(['functions', 'classes', 'imports']);
    });

    it('should map Python query types correctly', () => {
      const discoveredTypes = ['functions', 'data-structures', 'types-decorators'];
      const mappedTypes = QueryTypeMapper.getMappedQueryTypes('python', discoveredTypes);
      
      expect(mappedTypes).toContain('functions');
      expect(mappedTypes).toContain('classes');
      expect(mappedTypes).toContain('types');
    });

    it('should map Java query types correctly', () => {
      const discoveredTypes = ['classes-interfaces', 'methods-variables'];
      const mappedTypes = QueryTypeMapper.getMappedQueryTypes('java', discoveredTypes);
      
      expect(mappedTypes).toContain('classes');
      expect(mappedTypes).toContain('interfaces');
      expect(mappedTypes).toContain('methods');
      expect(mappedTypes).toContain('variables');
    });

    it('should return original types for unsupported language', () => {
      const discoveredTypes = ['functions', 'classes'];
      const mappedTypes = QueryTypeMapper.getMappedQueryTypes('unsupported', discoveredTypes);
      
      expect(mappedTypes).toEqual(discoveredTypes);
    });

    it('should handle unknown query types', () => {
      const discoveredTypes = ['functions', 'unknown-type'];
      const mappedTypes = QueryTypeMapper.getMappedQueryTypes('typescript', discoveredTypes);
      
      expect(mappedTypes).toContain('functions');
      expect(mappedTypes).toContain('unknown-type');
    });

    it('should remove duplicates', () => {
      const discoveredTypes = ['functions', 'classes', 'functions'];
      const mappedTypes = QueryTypeMapper.getMappedQueryTypes('typescript', discoveredTypes);
      
      expect(mappedTypes).toEqual(['functions', 'classes']);
    });
  });

  describe('validateQueryTypes', () => {
    it('should validate correct query types for supported language', () => {
      const queryTypes = ['functions', 'classes', 'imports'];
      const isValid = QueryTypeMapper.validateQueryTypes('typescript', queryTypes);
      
      expect(isValid).toBe(true);
    });

    it('should reject invalid query types for supported language', () => {
      const queryTypes = ['functions', 'invalid-type'];
      const isValid = QueryTypeMapper.validateQueryTypes('typescript', queryTypes);
      
      expect(isValid).toBe(false);
    });

    it('should return false for unsupported language', () => {
      const queryTypes = ['functions', 'classes'];
      const isValid = QueryTypeMapper.validateQueryTypes('unsupported', queryTypes);
      
      expect(isValid).toBe(false);
    });
  });

  describe('getSupportedQueryTypes', () => {
    it('should return all supported query types for language', () => {
      const queryTypes = QueryTypeMapper.getSupportedQueryTypes('typescript');
      
      expect(queryTypes).toContain('functions');
      expect(queryTypes).toContain('classes');
      expect(queryTypes).toContain('methods');
      expect(queryTypes).toContain('imports');
      expect(queryTypes).toContain('exports');
      expect(queryTypes).toContain('interfaces');
      expect(queryTypes).toContain('types');
      expect(queryTypes).toContain('variables');
      expect(queryTypes).toContain('control-flow');
      expect(queryTypes).toContain('expressions');
    });

    it('should return empty array for unsupported language', () => {
      const queryTypes = QueryTypeMapper.getSupportedQueryTypes('unsupported');
      
      expect(queryTypes).toEqual([]);
    });

    it('should remove duplicates from supported types', () => {
      const queryTypes = QueryTypeMapper.getSupportedQueryTypes('java');
      const uniqueTypes = [...new Set(queryTypes)];
      
      expect(queryTypes).toEqual(uniqueTypes);
    });
  });

  describe('addLanguageMapping', () => {
    it('should add new language mapping', () => {
      const newMapping = {
        'custom-query': ['custom-type']
      };
      
      QueryTypeMapper.addLanguageMapping('newlang', newMapping);
      
      const supportedTypes = QueryTypeMapper.getSupportedQueryTypes('newlang');
      expect(supportedTypes).toContain('custom-type');
    });

    it('should overwrite existing language mapping', () => {
      const newMapping = {
        'functions': ['custom-function']
      };
      
      QueryTypeMapper.addLanguageMapping('typescript', newMapping);
      
      const supportedTypes = QueryTypeMapper.getSupportedQueryTypes('typescript');
      expect(supportedTypes).toContain('custom-function');
    });
  });

  describe('updateLanguageMapping', () => {
    it('should update existing query file mapping', () => {
      QueryTypeMapper.updateLanguageMapping('typescript', 'functions', ['custom-function']);
      
      const mappedTypes = QueryTypeMapper.getMappedQueryTypes('typescript', ['functions']);
      expect(mappedTypes).toContain('custom-function');
    });

    it('should not update mapping for unsupported language', () => {
      const originalMapping = JSON.parse(JSON.stringify(LANGUAGE_QUERY_MAPPINGS.typescript || {}));
      
      QueryTypeMapper.updateLanguageMapping('unsupported', 'functions', ['custom-function']);
      
      expect(LANGUAGE_QUERY_MAPPINGS.typescript).toEqual(originalMapping);
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return all supported languages', () => {
      const languages = QueryTypeMapper.getSupportedLanguages();
      
      expect(languages).toContain('rust');
      expect(languages).toContain('typescript');
      expect(languages).toContain('python');
      expect(languages).toContain('java');
      expect(languages).toContain('cpp');
      expect(languages).toContain('go');
      expect(languages).toContain('c');
      expect(languages).toContain('csharp');
      expect(languages).toContain('kotlin');
      expect(languages).toContain('swift');
    });
  });

  describe('isLanguageSupported', () => {
    it('should return true for supported languages', () => {
      expect(QueryTypeMapper.isLanguageSupported('rust')).toBe(true);
      expect(QueryTypeMapper.isLanguageSupported('typescript')).toBe(true);
      expect(QueryTypeMapper.isLanguageSupported('python')).toBe(true);
    });

    it('should return false for unsupported languages', () => {
      expect(QueryTypeMapper.isLanguageSupported('unsupported')).toBe(false);
      expect(QueryTypeMapper.isLanguageSupported('')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(QueryTypeMapper.isLanguageSupported('RUST')).toBe(true);
      expect(QueryTypeMapper.isLanguageSupported('TypeScript')).toBe(true);
      expect(QueryTypeMapper.isLanguageSupported('PYTHON')).toBe(true);
    });
  });

  describe('getLanguageMapping', () => {
    it('should return mapping for supported language', () => {
      // 使用一个不太可能被修改的语言进行测试
      const mapping = QueryTypeMapper.getLanguageMapping('rust');
      
      expect(mapping).toBeDefined();
      expect(mapping?.['functions-structs']).toBeDefined();
      expect(mapping?.['functions-structs']).toContain('functions');
      expect(mapping?.['functions-structs']).toContain('classes');
    });

    it('should return null for unsupported language', () => {
      const mapping = QueryTypeMapper.getLanguageMapping('unsupported');
      
      expect(mapping).toBeNull();
    });
  });

  describe('getQueryTypesForFile', () => {
    it('should return query types for valid file', () => {
      // 使用Rust的查询文件，因为它不太可能被修改
      const queryTypes = QueryTypeMapper.getQueryTypesForFile('rust', 'functions-structs');
      
      expect(queryTypes).toContain('functions');
      expect(queryTypes).toContain('classes');
    });

    it('should return empty array for invalid file', () => {
      const queryTypes = QueryTypeMapper.getQueryTypesForFile('typescript', 'invalid-file');
      
      expect(queryTypes).toEqual([]);
    });

    it('should return empty array for unsupported language', () => {
      const queryTypes = QueryTypeMapper.getQueryTypesForFile('unsupported', 'functions');
      
      expect(queryTypes).toEqual([]);
    });
  });

  describe('getFilesForQueryType', () => {
    it('should return files containing the query type', () => {
      const files = QueryTypeMapper.getFilesForQueryType('java', 'classes');
      
      expect(files).toContain('classes-interfaces');
      expect(files).toContain('classes');
      expect(files).toContain('records');
    });

    it('should return empty array for unsupported language', () => {
      const files = QueryTypeMapper.getFilesForQueryType('unsupported', 'functions');
      
      expect(files).toEqual([]);
    });

    it('should return empty array for unknown query type', () => {
      const files = QueryTypeMapper.getFilesForQueryType('typescript', 'unknown-type');
      
      expect(files).toEqual([]);
    });
  });
});