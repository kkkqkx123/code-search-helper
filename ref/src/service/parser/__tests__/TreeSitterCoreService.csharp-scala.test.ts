import { TreeSitterCoreService } from '../core/parse/TreeSitterCoreService';

describe('TreeSitterCoreService C# and Scala Support', () => {
  let treeSitterCoreService: TreeSitterCoreService;

  beforeEach(() => {
    treeSitterCoreService = new TreeSitterCoreService();
  });

  describe('C# Language Support', () => {
    test('should detect C# language from .cs file extension', () => {
      const language = treeSitterCoreService.detectLanguage('/test/example.cs');
      expect(language).toBeDefined();
      expect(language?.name).toBe('C#');
      expect(language?.fileExtensions).toContain('.cs');
      expect(language?.supported).toBe(true);
    });

    test('should include C# in supported languages', () => {
      const supportedLanguages = treeSitterCoreService.getSupportedLanguages();
      const csharpLanguage = supportedLanguages.find(lang => lang.name === 'C#');
      expect(csharpLanguage).toBeDefined();
      expect(csharpLanguage?.fileExtensions).toContain('.cs');
      expect(csharpLanguage?.supported).toBe(true);
    });

    test('should parse C# code', async () => {
      const code = `
using System;

class Program
{
    static void Main()
    {
        Console.WriteLine("Hello, World!");
    }
}
      `;

      const result = await treeSitterCoreService.parseCode(code, 'csharp');
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.language.name).toBe('C#');
    });

    test('should extract C# functions', () => {
      // Create a mock AST for C# code
      const mockAST = {
        type: 'compilation_unit',
        children: [
          {
            type: 'class_declaration',
            children: [
              {
                type: 'method_declaration',
                startIndex: 0,
                endIndex: 100,
              }
            ]
          }
        ]
      };

      const functions = treeSitterCoreService.extractFunctions(mockAST as any);
      expect(functions).toBeDefined();
      expect(Array.isArray(functions)).toBe(true);
    });

    test('should extract C# classes', () => {
      // Create a mock AST for C# code
      const mockAST = {
        type: 'compilation_unit',
        children: [
          {
            type: 'class_declaration',
            startIndex: 0,
            endIndex: 100,
          }
        ]
      };

      const classes = treeSitterCoreService.extractClasses(mockAST as any);
      expect(classes).toBeDefined();
      expect(Array.isArray(classes)).toBe(true);
      expect(classes.length).toBeGreaterThan(0);
    });
  });

  describe('Scala Language Support', () => {
    test('should detect Scala language from .scala file extension', () => {
      const language = treeSitterCoreService.detectLanguage('/test/example.scala');
      expect(language).toBeDefined();
      expect(language?.name).toBe('Scala');
      expect(language?.fileExtensions).toContain('.scala');
      expect(language?.supported).toBe(true);
    });

    test('should include Scala in supported languages', () => {
      const supportedLanguages = treeSitterCoreService.getSupportedLanguages();
      const scalaLanguage = supportedLanguages.find(lang => lang.name === 'Scala');
      expect(scalaLanguage).toBeDefined();
      expect(scalaLanguage?.fileExtensions).toContain('.scala');
      expect(scalaLanguage?.supported).toBe(true);
    });

    test('should parse Scala code', async () => {
      const code = `
object HelloWorld {
  def main(args: Array[String]): Unit = {
    println("Hello, World!")
  }
}
      `;

      const result = await treeSitterCoreService.parseCode(code, 'scala');
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.language.name).toBe('Scala');
    });

    test('should extract Scala functions', () => {
      // Create a mock AST for Scala code
      const mockAST = {
        type: 'compilation_unit',
        children: [
          {
            type: 'object_definition',
            children: [
              {
                type: 'function_definition',
                startIndex: 0,
                endIndex: 100,
              }
            ]
          }
        ]
      };

      const functions = treeSitterCoreService.extractFunctions(mockAST as any);
      expect(functions).toBeDefined();
      expect(Array.isArray(functions)).toBe(true);
    });

    test('should extract Scala classes', () => {
      // Create a mock AST for Scala code
      const mockAST = {
        type: 'compilation_unit',
        children: [
          {
            type: 'class_definition',
            startIndex: 0,
            endIndex: 100,
          }
        ]
      };

      const classes = treeSitterCoreService.extractClasses(mockAST as any);
      expect(classes).toBeDefined();
      expect(Array.isArray(classes)).toBe(true);
      expect(classes.length).toBeGreaterThan(0);
    });
  });

  describe('Language Detection', () => {
    test('should correctly identify C# files', () => {
      const extensions = ['.cs'];
      for (const ext of extensions) {
        const language = treeSitterCoreService.detectLanguage(`/test/file${ext}`);
        expect(language).toBeDefined();
        expect(language?.name).toBe('C#');
      }
    });

    test('should correctly identify Scala files', () => {
      const extensions = ['.scala'];
      for (const ext of extensions) {
        const language = treeSitterCoreService.detectLanguage(`/test/file${ext}`);
        expect(language).toBeDefined();
        expect(language?.name).toBe('Scala');
      }
    });

    test('should return null for unsupported file types', () => {
      const language = treeSitterCoreService.detectLanguage('/test/file.unsupported');
      expect(language).toBeNull();
    });
  });
});