import * as Parser from 'tree-sitter';
import { AbstractSnippetRule } from '../AbstractSnippetRule';
import { SnippetChunk } from '../../types';

/**
 * Decorator Pattern Rule - Identifies decorator patterns across different languages
 * Supports: TypeScript/JavaScript decorators, Python decorators, Java annotations
 */
export class DecoratorPatternRule extends AbstractSnippetRule {
  readonly name = 'DecoratorPatternRule';
  readonly supportedNodeTypes = new Set([
    // TypeScript/JavaScript
    'decorator',
    'decorator_definition',
    // Python
    'decorated_definition',
    'decorator_statement',
    // Java
    'annotation',
    'marker_annotation',
    'single_member_annotation',
    'normal_annotation',
    // General nodes that might contain decorators
    'class_definition',
    'class_declaration',
    'method_definition',
    'function_definition',
    'property_definition',
    'parameter_declaration',
  ]);
  protected readonly snippetType = 'decorator_pattern' as const;

  protected shouldProcessNode(node: Parser.SyntaxNode, sourceCode: string): boolean {
    if (!super.shouldProcessNode(node, sourceCode)) return false;

    const content = this.getNodeText(node, sourceCode);

    // Check for decorator patterns in the content
    return this.containsDecoratorPattern(content);
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);
    const decoratorFeatures = this.analyzeDecoratorFeatures(content);

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
          ...decoratorFeatures,
        },
        complexity: this.calculateComplexity(content),
        isStandalone: true,
        hasSideEffects: this.hasSideEffects(content),
        decoratorInfo: {
          decorators: this.extractDecoratorInfo(content).decorators,
          annotationTypes: this.extractDecoratorInfo(content).annotationTypes,
          hasParameterizedDecorators: this.extractDecoratorInfo(content).hasParameterizedDecorators,
          decoratorPurpose: this.extractDecoratorInfo(content).decoratorPurpose,
          decoratorCount: this.extractDecoratorInfo(content).decorators.length,
          decoratorTypes: this.extractDecoratorInfo(content).annotationTypes,
          hasClassDecorators: this.extractDecoratorInfo(content).decorators.some(
            d => d.includes('Component') || d.includes('Service')
          ),
          hasMethodDecorators: this.extractDecoratorInfo(content).decorators.some(
            d => d.includes('Get') || d.includes('Post')
          ),
          hasPropertyDecorators: this.extractDecoratorInfo(content).decorators.some(
            d => d.includes('Column') || d.includes('Field')
          ),
        },
      },
    };
  }

  private containsDecoratorPattern(content: string): boolean {
    const decoratorPatterns = [
      // TypeScript/JavaScript decorators
      /^@\w+/m,
      /@\w+\(/,
      // Python decorators
      /^@\w+/m,
      /@\w+\./,
      // Java annotations
      /^@\w+/m,
      /@\w+\(.*\)/,
      // General decorator patterns
      /@\w+(\.\w+)*(\(.*\))?/m,
    ];

    return decoratorPatterns.some(pattern => pattern.test(content));
  }

  private analyzeDecoratorFeatures(content: string): {
    usesDecorators?: boolean;
    usesAnnotations?: boolean;
    decoratorLanguage?: 'typescript' | 'javascript' | 'python' | 'java';
    decoratorCount?: number;
  } {
    const tsJsPatterns =
      /@(?:Component|Injectable|NgModule|Directive|Service|Pipe|Controller|Get|Post|Put|Delete|Patch)/;
    const pythonPatterns =
      /@(?:decorator|property|classmethod|staticmethod|abstractmethod|property\.setter)/;
    const javaPatterns =
      /@(?:Override|Deprecated|SuppressWarnings|RestController|RequestMapping|Autowired)/;

    let decoratorLanguage: 'typescript' | 'javascript' | 'python' | 'java' | undefined;
    if (tsJsPatterns.test(content)) {
      decoratorLanguage = 'typescript';
    } else if (pythonPatterns.test(content)) {
      decoratorLanguage = 'python';
    } else if (javaPatterns.test(content)) {
      decoratorLanguage = 'java';
    }

    const decoratorCount = (content.match(/^@\w+/gm) || []).length;

    return {
      usesDecorators: /@\w+/.test(content),
      usesAnnotations: /@\w+\(.*\)/.test(content),
      decoratorLanguage,
      decoratorCount,
    };
  }

  private extractDecoratorInfo(content: string): {
    decorators: string[];
    annotationTypes: string[];
    hasParameterizedDecorators: boolean;
    decoratorPurpose?: string;
  } {
    // Use a regex that matches decorators at the beginning of any line (with optional leading whitespace)
    const decoratorRegex = /^\s*@(\w+(?:\.\w+)*(?:\(.*\))?)/gm;
    const decorators: string[] = [];
    const annotationTypes: string[] = [];
    let hasParameterizedDecorators = false;

    let match;
    while ((match = decoratorRegex.exec(content)) !== null) {
      const decorator = match[1];
      decorators.push(decorator);

      if (decorator.includes('(')) {
        hasParameterizedDecorators = true;
        annotationTypes.push(decorator.split('(')[0]);
      } else {
        annotationTypes.push(decorator);
      }
    }

    const purpose = this.inferDecoratorPurpose(decorators);

    return {
      decorators,
      annotationTypes,
      hasParameterizedDecorators,
      decoratorPurpose: purpose,
    };
  }

  private inferDecoratorPurpose(decorators: string[]): string {
    const purposes: Record<string, string[]> = {
      dependency_injection: [
        'Inject',
        'Injectable',
        'Autowired',
        'Component',
        'Service',
        'Repository',
      ],
      routing: [
        'Get',
        'Post',
        'Put',
        'Delete',
        'Patch',
        'RequestMapping',
        'Controller',
        'RestController',
      ],
      metadata: ['Deprecated', 'Override', 'SuppressWarnings', 'Author', 'Version'],
      validation: ['Validate', 'IsEmail', 'IsOptional', 'Length', 'Min', 'Max'],
      orm: ['Entity', 'Table', 'Column', 'OneToMany', 'ManyToOne', 'OneToOne'],
      ui_components: ['Component', 'Directive', 'Pipe', 'NgModule'],
      python_specific: ['property', 'classmethod', 'staticmethod', 'abstractmethod'],
    };

    for (const [purpose, patterns] of Object.entries(purposes)) {
      if (decorators.some(dec => patterns.some(pattern => dec.includes(pattern)))) {
        return purpose;
      }
    }

    return 'general';
  }

  // Override complexity calculation for decorator patterns
  protected calculateComplexity(content: string): number {
    const baseComplexity = super.calculateComplexity(content);
    const decoratorComplexity = this.calculateDecoratorComplexity(content);

    return baseComplexity + decoratorComplexity;
  }

  private calculateDecoratorComplexity(content: string): number {
    let complexity = 0;

    // Add complexity for decorators
    complexity += (content.match(/^@\w+/gm) || []).length;
    complexity += (content.match(/@\w+\([^)]*\)/gm) || []).length * 2; // Parameterized decorators

    // Add complexity for common frameworks
    const frameworkComplexity = [
      (content.match(/@(Component|Service|Controller)/g) || []).length * 2,
      (content.match(/@(Get|Post|Put|Delete)/g) || []).length * 2,
      (content.match(/@(Entity|Table|Column)/g) || []).length * 2,
    ].reduce((sum, val) => sum + val, 0);

    complexity += frameworkComplexity;

    return complexity;
  }
}
