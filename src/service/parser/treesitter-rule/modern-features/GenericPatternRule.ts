import * as Parser from 'tree-sitter';
import { AbstractSnippetRule } from '../AbstractSnippetRule';
import { SnippetChunk } from '../../types';

/**
 * Generic Pattern Rule - Identifies generic type usage patterns across different languages
 * Supports: TypeScript generics, Java generics, C# generics, C++ templates
 */
export class GenericPatternRule extends AbstractSnippetRule {
  readonly name = 'GenericPatternRule';
  readonly supportedNodeTypes = new Set([
    // TypeScript/JavaScript
    'type_parameters',
    'generic_type',
    'type_argument',
    // Java
    'type_parameters',
    'type_argument',
    'wildcard',
    // C#
    'type_parameter_list',
    'type_argument_list',
    // C++
    'template_parameter_list',
    'template_argument_list',
    // Generic nodes that might contain generics
    'class_definition',
    'class_declaration',
    'interface_declaration',
    'function_definition',
    'method_definition',
    'type_alias_declaration',
    'variable_declaration',
    'parameter_declaration',
  ]);
  protected readonly snippetType = 'generic_pattern' as const;

  protected shouldProcessNode(node: Parser.SyntaxNode, sourceCode: string): boolean {
    if (!super.shouldProcessNode(node, sourceCode)) return false;

    const content = this.getNodeText(node, sourceCode);

    // Check for generic patterns in the content
    return this.containsGenericPattern(content) && this.hasMeaningfulGenericUsage(content);
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);
    const genericFeatures = this.analyzeGenericFeatures(content);

    return {
      id: this.generateSnippetId(content, location.startLine),
      content,
      startLine: location.startLine,
      endLine: location.endLine,
      startByte: node.startIndex,
      endByte: node.endIndex,
      type: 'snippet',
      imports: [],
      exports: [],
      metadata: {},
      snippetMetadata: {
        snippetType: this.snippetType,
        contextInfo,
        languageFeatures: {
          ...this.analyzeLanguageFeatures(content),
          ...genericFeatures,
        },
        complexity: this.calculateComplexity(content),
        isStandalone: true,
        hasSideEffects: this.hasSideEffects(content),
        genericInfo: this.extractGenericInfo(content),
      },
    };
  }

  private containsGenericPattern(content: string): boolean {
    const genericPatterns = [
      // TypeScript/JavaScript generics
      /<\s*[A-Z]\w*(?:\s*,\s*[A-Z]\w*)*\s*>/,
      /<\s*\w+\s+extends\s+\w+/,
      /<T\s*>/,
      /<T\s+extends\s+\w+\s*>/,
      // Java generics
      /<\s*[A-Z]\w*(?:\s*,\s*[A-Z]\w*)*\s*>/,
      /<\s*\?\s+extends\s+\w+\s*>/,
      /<\s*\?\s+super\s+\w+\s*>/,
      // C++ templates
      /template\s*<\s*typename\s+\w+\s*>/,
      /template\s*<\s*class\s+\w+\s*>/,
      // Generic method signatures
      /\bpublic\s+<T>\s+\w+/,
      /\bprivate\s+<T>\s+\w+/,
      /\bstatic\s+<T>\s+\w+/,
    ];

    return genericPatterns.some(pattern => pattern.test(content));
  }

  private hasMeaningfulGenericUsage(content: string): boolean {
    // Should have actual generic type parameters and usage
    const typeParams = (content.match(/<[A-Z]\w*(?:\s*,\s*[A-Z]\w*)*>/g) || []).length;
    const typeUsage = (content.match(/\bT\b|[A-Z]\w*<\w+>/g) || []).length;

    return typeParams > 0 && typeUsage > 0;
  }

  private analyzeGenericFeatures(content: string): {
    usesGenerics?: boolean;
    usesTypeConstraints?: boolean;
    usesWildcards?: boolean;
    genericLanguage?: 'typescript' | 'java' | 'csharp' | 'cpp';
    genericComplexity?: number;
  } {
    const tsPatterns = /<T\s*(?:extends\s+\w+)?\s*>|interface\s+\w+\s*<T>/;
    const javaPatterns = /<\s*\?\s+(?:extends|super)\s+\w+\s*>|public\s+<T>/;
    const cppPatterns = /template\s*<\s*(?:typename|class)\s+\w+\s*>/;
    const csharpPatterns = /public\s+class\s+\w+<T>\s*:\s*\w+/;

    let genericLanguage: 'typescript' | 'java' | 'csharp' | 'cpp' | undefined;
    if (tsPatterns.test(content)) {
      genericLanguage = 'typescript';
    } else if (javaPatterns.test(content)) {
      genericLanguage = 'java';
    } else if (cppPatterns.test(content)) {
      genericLanguage = 'cpp';
    } else if (csharpPatterns.test(content)) {
      genericLanguage = 'csharp';
    }

    const genericComplexity = this.calculateGenericComplexity(content);

    return {
      usesGenerics: /<[A-Z]\w*(?:\s*,\s*[A-Z]\w*)*>/.test(content),
      usesTypeConstraints: /extends\s+\w+|super\s+\w+|where\s+T\s*:\s*\w+/.test(content),
      usesWildcards: /\?\s+(?:extends|super)\s+\w+/.test(content),
      genericLanguage,
      genericComplexity,
    };
  }

  private extractGenericInfo(content: string): {
    typeParameters: string[];
    constraints: string[];
    usesWildcards: boolean;
    genericPurpose?: string;
    nestingLevel: number;
  } {
    const typeParameters: string[] = [];
    const constraints: string[] = [];
    let usesWildcards = false;
    let nestingLevel = 0;

    // Extract type parameters
    const typeParamRegex = /<\s*([A-Z]\w*(?:\s*,\s*[A-Z]\w*)*)\s*>/g;
    let match;
    while ((match = typeParamRegex.exec(content)) !== null) {
      const params = match[1].split(',').map(p => p.trim());
      typeParameters.push(...params);

      // Calculate nesting level
      const nestedParams = match[1].match(/<[^>]*>/g) || [];
      nestingLevel = Math.max(nestingLevel, nestedParams.length);

      // Also check for nested generics in the entire content
      const allNestedGenerics = content.match(/<[^<>]*<[^<>]*>[^<>]*>/g) || [];
      if (allNestedGenerics.length > 0) {
        nestingLevel = Math.max(nestingLevel, 1);
      }
    }

    // Extract constraints
    const constraintPatterns = [
      /extends\s+(\w+(?:\s*,\s*\w+)*)/g,
      /super\s+(\w+)/g,
      /where\s+T\s*:\s*(\w+(?:\s*,\s*\w+)*)/g,
    ];

    for (const pattern of constraintPatterns) {
      let constraintMatch;
      while ((constraintMatch = pattern.exec(content)) !== null) {
        constraints.push(...constraintMatch[1].split(',').map(c => c.trim()));
      }
    }

    // Check for wildcards
    usesWildcards = /\?\s+(?:extends|super)\s+\w+/.test(content);

    const purpose = this.inferGenericPurpose(content, typeParameters, constraints);

    return {
      typeParameters: [...new Set(typeParameters)], // Remove duplicates
      constraints: [...new Set(constraints)],
      usesWildcards,
      genericPurpose: purpose,
      nestingLevel,
    };
  }

  private inferGenericPurpose(
    content: string,
    typeParameters: string[],
    constraints: string[]
  ): string {
    if (content.includes('interface') || content.includes('abstract')) {
      return 'generic_interface';
    }
    if (content.includes('class') && typeParameters.length > 0) {
      return 'generic_class';
    }
    if (content.includes('function') || content.includes('method')) {
      return 'generic_method';
    }
    if (constraints.some(c => ['Comparable', 'Serializable', 'Cloneable'].includes(c))) {
      return 'generic_constraint_utility';
    }
    if (typeParameters.includes('T') && typeParameters.includes('R')) {
      return 'generic_transformation';
    }
    if (content.includes('List<') || content.includes('Map<') || content.includes('Set<')) {
      return 'generic_collection';
    }
    return 'general_generic';
  }

  private calculateGenericComplexity(content: string): number {
    let complexity = 0;

    // Add complexity for type parameters
    complexity += (content.match(/<[A-Z]\w*(?:\s*,\s*[A-Z]\w*)*>/g) || []).length;

    // Add complexity for constraints
    complexity += (content.match(/extends\s+\w+/g) || []).length * 2;
    complexity += (content.match(/super\s+\w+/g) || []).length * 2;
    complexity += (content.match(/where\s+T\s*:\s*\w+/g) || []).length * 2;

    // Add complexity for wildcards
    complexity += (content.match(/\?\s+(?:extends|super)\s+\w+/g) || []).length * 2;

    // Add complexity for nested generics
    const nestedGenerics = content.match(/<[^<>]*<[^<>]*>[^<>]*>/g) || [];
    complexity += nestedGenerics.length * 3;

    // Add complexity for complex generic types
    const complexTypes = [
      (content.match(/Map<\w+,\s*\w+>/g) || []).length * 2,
      (content.match(/Function<\w+,\s*\w+>/g) || []).length * 2,
      (content.match(/Promise<\w+>/g) || []).length * 2,
      (content.match(/Optional<\w+>/g) || []).length * 2,
    ].reduce((sum, val) => sum + val, 0);

    complexity += complexTypes;

    return complexity;
  }

  // Override complexity calculation for generic patterns
  protected calculateComplexity(content: string): number {
    const baseComplexity = super.calculateComplexity(content);
    const genericComplexity = this.calculateGenericComplexity(content);

    return baseComplexity + genericComplexity;
  }
}
