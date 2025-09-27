import * as Parser from 'tree-sitter';
import { AbstractSnippetRule } from '../../AbstractSnippetRule';
import { SnippetChunk } from '../../../types';

/**
 * Go Interface Rule - Identifies Go interface definitions and implementations
 */
export class GoInterfaceRule extends AbstractSnippetRule {
  readonly name = 'GoInterfaceRule';
  readonly supportedNodeTypes = new Set([
    'interface_type',
    'struct_type',
    'method_declaration',
    'type_declaration',
    'field_declaration',
  ]);
  protected readonly snippetType = 'go_interface' as const;

  protected shouldProcessNode(node: Parser.SyntaxNode, sourceCode: string): boolean {
    if (!super.shouldProcessNode(node, sourceCode)) return false;

    const content = this.getNodeText(node, sourceCode);

    // Check for Go interface patterns
    return this.containsGoInterfacePattern(content);
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);
    const interfaceFeatures = this.analyzeGoInterfaceFeatures(content);

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
          ...interfaceFeatures,
        },
        complexity: this.calculateComplexity(content),
        isStandalone: true,
        hasSideEffects: this.hasSideEffects(content),
        goInterfaceInfo: this.extractGoInterfaceInfo(content),
      },
    };
  }

  private containsGoInterfacePattern(content: string): boolean {
    const interfacePatterns = [
      // Interface definitions
      /type\s+\w+\s+interface/,
      // Method sets
      /\(\s*\w+\s+\*\w+\)\s+\w+\s*\(/,
      // Interface embedding
      /interface\s*\{\s*\w+\s+\w+\s*\}/,
      // Empty interface
      /interface\s*\{\s*\}/,
      // Method implementations
      /func\s*\([^)]*\)\s+\w+\s*\([^)]*\)\s*\{/,
    ];

    return interfacePatterns.some(pattern => pattern.test(content));
  }

  private analyzeGoInterfaceFeatures(content: string): {
    usesInterfaces?: boolean;
    usesInterfaceEmbedding?: boolean;
    usesMethodSets?: boolean;
    interfaceComplexity?: number;
  } {
    const interfaceCount = (content.match(/type\s+\w+\s+interface/g) || []).length;
    const embeddingCount = (content.match(/interface\s*\{\s*\w+\s+\w+\s*\}/g) || []).length;
    const methodSetCount = (content.match(/\(\s*\w+\s+\*\w+\)\s+\w+\s*\(/g) || []).length;

    return {
      usesInterfaces: interfaceCount > 0,
      usesInterfaceEmbedding: embeddingCount > 0,
      usesMethodSets: methodSetCount > 0,
      interfaceComplexity: interfaceCount + embeddingCount + methodSetCount,
    };
  }

  private extractGoInterfaceInfo(content: string): {
    interfaces: string[];
    embeddedInterfaces: string[];
    methodSignatures: string[];
    implementations: string[];
    usesEmptyInterface: boolean;
    interfaceSize: number;
    purpose?: string;
  } {
    const interfaces: string[] = [];
    const embeddedInterfaces: string[] = [];
    const methodSignatures: string[] = [];
    const implementations: string[] = [];

    // Extract interface names
    const interfaceRegex = /type\s+(\w+)\s+interface/g;
    let match;
    while ((match = interfaceRegex.exec(content)) !== null) {
      interfaces.push(match[1]);
    }

    // Extract embedded interfaces
    const embeddingRegex = /interface\s*\{\s*([^}]+)\s*\}/g;
    while ((match = embeddingRegex.exec(content)) !== null) {
      const embedded = match[1].trim();
      if (embedded && !embedded.includes('func')) {
        embeddedInterfaces.push(embedded);
      }
    }

    // Extract method signatures
    const methodRegex = /(\w+)\s*\([^)]*\)\s*(\w+)\s*\([^)]*\)/g;
    while ((match = methodRegex.exec(content)) !== null) {
      methodSignatures.push(`${match[2]} ${match[1]}(...)`);
    }

    // Extract struct implementations
    const implementationRegex = /func\s*\(\s*(\w+)\s+\*(\w+)\)\s+(\w+)\s*\(/g;
    while ((match = implementationRegex.exec(content)) !== null) {
      implementations.push(`${match[2]}.${match[3]}`);
    }

    const usesEmptyInterface = /interface\s*\{\s*\}/.test(content);
    const interfaceSize = this.calculateInterfaceSize(content);
    const purpose = this.inferInterfacePurpose(content, interfaces, methodSignatures);

    return {
      interfaces,
      embeddedInterfaces: [...new Set(embeddedInterfaces)],
      methodSignatures: [...new Set(methodSignatures)],
      implementations: [...new Set(implementations)],
      usesEmptyInterface,
      interfaceSize,
      purpose,
    };
  }

  private calculateInterfaceSize(content: string): number {
    const interfaceBlocks = content.match(/interface\s*\{([^}]*)\}/g) || [];
    return interfaceBlocks.reduce((size, block) => {
      const methods = block.match(/\w+\s*\([^)]*\)/g) || [];
      return size + methods.length;
    }, 0);
  }

  private inferInterfacePurpose(
    content: string,
    interfaces: string[],
    methodSignatures: string[]
  ): string {
    if (content.includes('Reader') || content.includes('Writer') || content.includes('io.')) {
      return 'io_operations';
    }
    if (content.includes('Handler') || content.includes('ServeHTTP')) {
      return 'web_server';
    }
    if (content.includes('Stringer') || content.includes('String()')) {
      return 'string_representation';
    }
    if (content.includes('error')) {
      return 'error_handling';
    }
    if (methodSignatures.some(sig => sig.includes('Add') || sig.includes('Remove'))) {
      return 'collection_operations';
    }
    if (methodSignatures.some(sig => sig.includes('Open') || sig.includes('Close'))) {
      return 'resource_management';
    }
    if (interfaces.some(iface => iface.includes('Manager') || iface.includes('Service'))) {
      return 'service_abstraction';
    }
    return 'general_abstraction';
  }

  protected calculateComplexity(content: string): number {
    const baseComplexity = super.calculateComplexity(content);
    const interfaceComplexity = this.calculateGoInterfaceComplexity(content);

    return baseComplexity + interfaceComplexity;
  }

  private calculateGoInterfaceComplexity(content: string): number {
    let complexity = 0;

    // Add complexity for interface definitions
    complexity += (content.match(/type\s+\w+\s+interface/g) || []).length * 3;

    // Add complexity for method signatures
    complexity += (content.match(/\w+\s*\([^)]*\)\s*\w+\s*\([^)]*\)/g) || []).length * 2;

    // Add complexity for interface embedding
    complexity += (content.match(/interface\s*\{\s*\w+\s+\w+\s*\}/g) || []).length * 4;

    // Add complexity for method implementations
    complexity += (content.match(/func\s*\([^)]*\)\s+\w+\s*\([^)]*\)\s*\{/g) || []).length * 2;

    // Add complexity for receiver methods
    complexity += (content.match(/func\s*\(\s*\w+\s+\*\w+\)/g) || []).length * 3;

    // Add complexity for empty interface usage
    complexity += (content.match(/interface\s*\{\s*\}/g) || []).length * 1;

    // Add complexity for common interface patterns
    const commonPatterns = [
      (content.match(/Stringer/g) || []).length * 2,
      (content.match(/Reader|Writer/g) || []).length * 2,
      (content.match(/Handler/g) || []).length * 2,
    ].reduce((sum, val) => sum + val, 0);

    complexity += commonPatterns;

    return complexity;
  }
}
