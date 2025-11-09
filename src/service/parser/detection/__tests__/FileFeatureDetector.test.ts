import { FileFeatureDetector } from '../FileFeatureDetector';
import { LoggerService } from '../../../../utils/LoggerService';

describe('FileFeatureDetector', () => {
  let detector: FileFeatureDetector;
  let mockLogger: LoggerService;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    // Create new instance for each test
    detector = new FileFeatureDetector(mockLogger);
  });

  describe('constructor', () => {
    it('should create new instance', () => {
      const instance = new FileFeatureDetector(mockLogger);

      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(FileFeatureDetector);
    });

    it('should log debug message on initialization', () => {
      new FileFeatureDetector(mockLogger);

      expect(mockLogger.debug).toHaveBeenCalledWith('FileFeatureDetector initialized');
    });
  });

  describe('isCodeLanguage', () => {
    it('should identify code languages', () => {
      const codeLanguages = [
        'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp',
        'go', 'rust', 'php', 'ruby', 'css', 'html', 'json', 'yaml', 'xml'
      ];

      codeLanguages.forEach(language => {
        expect(detector.isCodeLanguage(language)).toBe(true);
      });
    });

    it('should handle case insensitive input', () => {
      expect(detector.isCodeLanguage('JavaScript')).toBe(true);
      expect(detector.isCodeLanguage('PYTHON')).toBe(true);
      expect(detector.isCodeLanguage('TypeScript')).toBe(true);
    });

    it('should not identify non-code languages', () => {
      const nonCodeLanguages = [
        'text', 'markdown', 'log', 'binary', 'image', 'audio', 'video'
      ];

      nonCodeLanguages.forEach(language => {
        expect(detector.isCodeLanguage(language)).toBe(false);
      });
    });
  });

  describe('isTextLanguage', () => {
    it('should identify text languages', () => {
      const textLanguages = [
        'markdown', 'text', 'log', 'ini', 'cfg', 'conf', 'toml'
      ];

      textLanguages.forEach(language => {
        expect(detector.isTextLanguage(language)).toBe(true);
      });
    });

    it('should handle case insensitive input', () => {
      expect(detector.isTextLanguage('MARKDOWN')).toBe(true);
      expect(detector.isTextLanguage('TEXT')).toBe(true);
    });

    it('should not identify non-text languages', () => {
      const nonTextLanguages = [
        'javascript', 'python', 'binary', 'image', 'audio'
      ];

      nonTextLanguages.forEach(language => {
        expect(detector.isTextLanguage(language)).toBe(false);
      });
    });
  });

  describe('isMarkdown', () => {
    it('should identify markdown languages', () => {
      expect(detector.isMarkdown('markdown')).toBe(true);
      expect(detector.isMarkdown('md')).toBe(true);
    });

    it('should handle case insensitive input', () => {
      expect(detector.isMarkdown('MARKDOWN')).toBe(true);
      expect(detector.isMarkdown('MD')).toBe(true);
    });

    it('should not identify non-markdown languages', () => {
      expect(detector.isMarkdown('javascript')).toBe(false);
      expect(detector.isMarkdown('text')).toBe(false);
    });
  });

  describe('isXML', () => {
    it('should identify XML-based languages', () => {
      const xmlLanguages = ['xml', 'svg'];

      xmlLanguages.forEach(language => {
        expect(detector.isXML(language)).toBe(true);
      });
    });

    it('should handle case insensitive input', () => {
      expect(detector.isXML('XML')).toBe(true);
      expect(detector.isXML('SVG')).toBe(true);
    });

    it('should not identify non-XML languages', () => {
      expect(detector.isXML('javascript')).toBe(false);
      expect(detector.isXML('python')).toBe(false);
    });
  });

  describe('canUseTreeSitter', () => {
    it('should identify TreeSitter-supported languages', () => {
      const treeSitterLanguages = [
        'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp',
        'go', 'rust', 'php', 'ruby'
      ];

      treeSitterLanguages.forEach(language => {
        expect(detector.canUseTreeSitter(language)).toBe(true);
      });
    });

    it('should handle case insensitive input', () => {
      expect(detector.canUseTreeSitter('JAVASCRIPT')).toBe(true);
      expect(detector.canUseTreeSitter('PYTHON')).toBe(true);
    });

    it('should not identify unsupported languages', () => {
      const unsupportedLanguages = [
        'text', 'markdown', 'json', 'yaml', 'xml', 'html'
      ];

      unsupportedLanguages.forEach(language => {
        const result = detector.canUseTreeSitter(language);
        if (result) {
          console.log(`Language "${language}" incorrectly identified as TreeSitter supported`);
        }
        expect(result).toBe(false);
      });
    });
  });

  describe('isStructuredFile', () => {
    it('should identify structured languages by name', () => {
      const structuredLanguages = ['json', 'xml', 'html', 'yaml', 'css', 'sql'];

      structuredLanguages.forEach(language => {
        expect(detector.isStructuredFile('some content', language)).toBe(true);
      });
    });

    it('should identify structured content by brackets', () => {
      const structuredContent = `
function test() {
  if (condition) {
    return [1, 2, 3];
  }
}
      `;
      expect(detector.isStructuredFile(structuredContent, 'text')).toBe(true);
    });

    it('should identify structured content by tags', () => {
      const xmlContent = `
<div class="container">
  <h1>Title</h1>
  <p>Content</p>
</div>
      `;
      expect(detector.isStructuredFile(xmlContent, 'text')).toBe(true);
    });

    it('should not identify non-structured content', () => {
      const plainContent = `
This is just plain text
without any brackets or tags.
It's just regular content.
      `;
      expect(detector.isStructuredFile(plainContent, 'text')).toBe(false);
    });

    it('should log debug information for structured content', () => {
      const structuredContent = '{ "key": "value" }';
      detector.isStructuredFile(structuredContent, 'text');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Detected structured content:'),
        expect.any(Object)
      );
    });
  });

  describe('isHighlyStructured', () => {
    it('should be an alias for isStructuredFile', () => {
      const content = '{ "key": "value" }';
      const language = 'json';

      const result1 = detector.isStructuredFile(content, language);
      const result2 = detector.isHighlyStructured(content, language);

      expect(result1).toBe(result2);
    });
  });

  describe('detectLanguageByExtension', () => {
    it('should detect language from extension map', () => {
      const languageMap = {
        '.js': 'javascript',
        '.py': 'python',
        '.java': 'java'
      };

      expect(detector.detectLanguageByExtension('.js', languageMap)).toBe('javascript');
      expect(detector.detectLanguageByExtension('.py', languageMap)).toBe('python');
      expect(detector.detectLanguageByExtension('.java', languageMap)).toBe('java');
    });

    it('should return unknown for unrecognized extensions', () => {
      const languageMap = {
        '.js': 'javascript',
        '.py': 'python'
      };

      expect(detector.detectLanguageByExtension('.unknown', languageMap)).toBe('unknown');
    });
  });

  describe('calculateComplexity', () => {
    it('should calculate complexity based on code structures', () => {
      const simpleContent = 'console.log("Hello");';
      const simpleComplexity = detector.calculateComplexity(simpleContent);

      const complexContent = `
if (condition) {
  for (let i = 0; i < 10; i++) {
    try {
      function complexFunction(param) {
        if (param) {
          return { result: param.value };
        }
      }
    } catch (error) {
      console.error(error);
    }
  }
}
      `;
      const complexComplexity = detector.calculateComplexity(complexContent);

      expect(complexComplexity).toBeGreaterThan(simpleComplexity);
    });

    it('should increase complexity for control structures', () => {
      const contentWithControls = `
if (a) { }
while (b) { }
for (let i = 0; i < 10; i++) { }
switch (c) { case 1: break; }
try { } catch (e) { } finally { }
      `;
      const complexity = detector.calculateComplexity(contentWithControls);

      // Each control structure adds 2 to complexity
      expect(complexity).toBeGreaterThanOrEqual(10);
    });

    it('should increase complexity for functions and classes', () => {
      const contentWithFunctions = `
function test() { }
class MyClass { }
interface MyInterface { }
method test() { }
      `;
      const complexity = detector.calculateComplexity(contentWithFunctions);

      // Each function/class adds 3 to complexity
      expect(complexity).toBeGreaterThanOrEqual(12);
    });

    it('should increase complexity for brackets', () => {
      const contentWithBrackets = '{}{}{}{}{}';
      const complexity = detector.calculateComplexity(contentWithBrackets);

      // Each bracket adds 1 to complexity
      expect(complexity).toBeGreaterThanOrEqual(10);
    });

    it('should increase complexity for parentheses', () => {
      const contentWithParens = '()()()()()';
      const complexity = detector.calculateComplexity(contentWithParens);

      // Each parenthesis adds 0.5 to complexity
      expect(complexity).toBeGreaterThanOrEqual(5);
    });

    it('should increase complexity based on line count', () => {
      const shortContent = 'line 1';
      const longContent = 'line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8\nline 9\nline 10';

      const shortComplexity = detector.calculateComplexity(shortContent);
      const longComplexity = detector.calculateComplexity(longContent);

      expect(longComplexity).toBeGreaterThan(shortComplexity);
    });
  });

  describe('isSmallFile', () => {
    it('should identify small files', () => {
      const smallContent = 'This is a small file';
      expect(detector.isSmallFile(smallContent)).toBe(true);
    });

    it('should identify large files', () => {
      const largeContent = 'x'.repeat(2000);
      expect(detector.isSmallFile(largeContent)).toBe(false);
    });

    it('should use custom threshold', () => {
      const content = 'x'.repeat(500);
      expect(detector.isSmallFile(content, 100)).toBe(false);
      expect(detector.isSmallFile(content, 1000)).toBe(true);
    });
  });

  describe('hasImports', () => {
    it('should detect imports in TypeScript', () => {
      const content = 'import React from "react";\nimport { Component } from "./component";';
      expect(detector.hasImports(content, 'typescript')).toBe(true);
    });

    it('should detect imports in JavaScript', () => {
      const content = 'import React from "react";\nconst module = require("module");';
      expect(detector.hasImports(content, 'javascript')).toBe(true);
    });

    it('should detect imports in Python', () => {
      const content = 'import os\nfrom collections import defaultdict';
      expect(detector.hasImports(content, 'python')).toBe(true);
    });

    it('should detect imports in Java', () => {
      const content = 'import java.util.List;\nimport java.util.ArrayList;';
      expect(detector.hasImports(content, 'java')).toBe(true);
    });

    it('should detect imports in Go', () => {
      const content = 'import "fmt"\nimport "os"';
      expect(detector.hasImports(content, 'go')).toBe(true);
    });

    it('should detect imports in Rust', () => {
      const content = 'use std::collections::HashMap;\nuse std::fs::File;';
      expect(detector.hasImports(content, 'rust')).toBe(true);
    });

    it('should detect imports in C', () => {
      const content = '#include <stdio.h>\n#include "stdlib.h"';
      expect(detector.hasImports(content, 'c')).toBe(true);
    });

    it('should detect imports in C++', () => {
      const content = '#include <iostream>\n#include <vector>\nusing namespace std;';
      expect(detector.hasImports(content, 'cpp')).toBe(true);
    });

    it('should use generic pattern for unknown languages', () => {
      const content = 'import something\nfrom module import something\nrequire("module")';
      expect(detector.hasImports(content, 'unknown')).toBe(true);
    });

    it('should not detect imports when none exist', () => {
      const content = 'function test() {\n  console.log("Hello");\n}';
      expect(detector.hasImports(content, 'javascript')).toBe(false);
    });
  });

  describe('hasExports', () => {
    it('should detect exports in TypeScript', () => {
      const content = 'export const value = 42;\nexport default class Test {}';
      expect(detector.hasExports(content, 'typescript')).toBe(true);
    });

    it('should detect exports in JavaScript', () => {
      const content = 'export const value = 42;\nmodule.exports = { test: function() {} };';
      expect(detector.hasExports(content, 'javascript')).toBe(true);
    });

    it('should detect exports in Python', () => {
      const content = '__all__ = ["function1", "function2"]';
      expect(detector.hasExports(content, 'python')).toBe(true);
    });

    it('should use generic pattern for unknown languages', () => {
      const content = 'export something\nmodule.exports = {}\n__all__ = []';
      expect(detector.hasExports(content, 'unknown')).toBe(true);
    });

    it('should not detect exports when none exist', () => {
      const content = 'import something from "module";\nfunction test() {}';
      expect(detector.hasExports(content, 'javascript')).toBe(false);
    });
  });

  describe('hasFunctions', () => {
    it('should detect functions in TypeScript', () => {
      const content = 'function test() {}\nconst arrow = () => {}\nconst func = function() {}';
      expect(detector.hasFunctions(content, 'typescript')).toBe(true);
    });

    it('should detect functions in JavaScript', () => {
      const content = 'function test() {}\nconst arrow = () => {}\nconst func = function() {}';
      expect(detector.hasFunctions(content, 'javascript')).toBe(true);
    });

    it('should detect functions in Python', () => {
      const content = 'def test():\n    pass\ndef another_test(param):';
      expect(detector.hasFunctions(content, 'python')).toBe(true);
    });

    it('should detect functions in Java', () => {
      const content = 'public void test() {}\nprivate String getName(int id) {}';
      expect(detector.hasFunctions(content, 'java')).toBe(true);
    });

    it('should detect functions in Go', () => {
      const content = 'func test() {}\nfunc getName(id int) string {}';
      expect(detector.hasFunctions(content, 'go')).toBe(true);
    });

    it('should detect functions in Rust', () => {
      const content = 'fn test() {}\nfn get_name(id: i32) -> String {}';
      expect(detector.hasFunctions(content, 'rust')).toBe(true);
    });

    it('should use generic pattern for unknown languages', () => {
      const content = 'function test() {}\ndef test():\nfunc test() {}\nfn test() {}';
      expect(detector.hasFunctions(content, 'unknown')).toBe(true);
    });

    it('should not detect functions when none exist', () => {
      const content = 'const value = 42;\nlet name = "test";';
      expect(detector.hasFunctions(content, 'javascript')).toBe(false);
    });
  });

  describe('hasClasses', () => {
    it('should detect classes in TypeScript', () => {
      const content = 'class Test {}\nexport default class MyClass {}';
      expect(detector.hasClasses(content, 'typescript')).toBe(true);
    });

    it('should detect classes in JavaScript', () => {
      const content = 'class Test {}\nexport default class MyClass {}';
      expect(detector.hasClasses(content, 'javascript')).toBe(true);
    });

    it('should detect classes in Python', () => {
      const content = 'class Test:\n    pass\nclass MyClass(object):';
      expect(detector.hasClasses(content, 'python')).toBe(true);
    });

    it('should detect classes in Java', () => {
      const content = 'public class Test {}\nprivate class InnerClass {}';
      expect(detector.hasClasses(content, 'java')).toBe(true);
    });

    it('should detect structs in Go', () => {
      const content = 'type Test struct {}\ntype MyStruct struct {';
      expect(detector.hasClasses(content, 'go')).toBe(true);
    });

    it('should detect structs in Rust', () => {
      const content = 'struct Test {}\nstruct MyStruct {';
      expect(detector.hasClasses(content, 'rust')).toBe(true);
    });

    it('should use generic pattern for unknown languages', () => {
      const content = 'class Test {}\ntype Test struct {}\nstruct Test {}';
      expect(detector.hasClasses(content, 'unknown')).toBe(true);
    });

    it('should not detect classes when none exist', () => {
      const content = 'function test() {}\nconst value = 42;';
      expect(detector.hasClasses(content, 'javascript')).toBe(false);
    });
  });

  describe('getFileStats', () => {
    it('should return correct file statistics', () => {
      const content = `
function test() {
  if (condition) {
    return [1, 2, 3];
  }
}
<div class="container">
  <span>Content</span>
</div>
      `;
      const stats = detector.getFileStats(content);

      expect(stats.contentLength).toBe(content.length);
      expect(stats.lineCount).toBe(content.split('\n').length);
      expect(stats.bracketCount).toBeGreaterThan(0);
      expect(stats.tagCount).toBeGreaterThan(0);
      expect(stats.complexity).toBeGreaterThan(0);
    });

    it('should handle empty content', () => {
      const stats = detector.getFileStats('');

      expect(stats.contentLength).toBe(0);
      expect(stats.lineCount).toBe(1);
      expect(stats.bracketCount).toBe(0);
      expect(stats.tagCount).toBe(0);
      expect(stats.complexity).toBe(0);
    });

    it('should handle content without brackets or tags', () => {
      const content = 'This is just plain text\nwithout any special characters.';
      const stats = detector.getFileStats(content);

      expect(stats.bracketCount).toBe(0);
      expect(stats.tagCount).toBe(0);
      expect(stats.complexity).toBeGreaterThanOrEqual(0);
    });
  });
});