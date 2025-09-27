import { injectable, inject } from 'inversify';
import Parser from 'tree-sitter';
import { SnippetChunk } from '../types';
import { TreeSitterCoreService } from '../core/parse/TreeSitterCoreService';
import { TYPES } from '../../../types';
import { TreeSitterUtils } from '../utils/TreeSitterUtils';
import { SnippetValidationService } from '../analysis/SnippetValidationService';

export interface SnippetExtractionRule {
  name: string;
  extract(ast: Parser.SyntaxNode, sourceCode: string): SnippetChunk[];
  supportedNodeTypes: Set<string>;
}

@injectable()
export class SnippetExtractionService {
  private snippetMarkerRegex: RegExp;
  private snippetHashCache: Map<string, string> = new Map();

  constructor(
    @inject(TYPES.TreeSitterCoreService)
    private readonly coreService: TreeSitterCoreService,
    @inject(TYPES.SnippetExtractionRules)
    private readonly rules: SnippetExtractionRule[]
  ) {
    const snippetMarkers = ['@snippet', '@code', '@example', 'SNIPPET:', 'EXAMPLE:'];
    this.snippetMarkerRegex = new RegExp(
      snippetMarkers.map(marker => marker.replace(/[.*+?^${}()|[\]\/\\]/g, '\\$&')).join('|')
    );
  }

  extractSnippets(ast: Parser.SyntaxNode, sourceCode: string): SnippetChunk[] {
    const allSnippets: SnippetChunk[] = [];

    for (const rule of this.rules) {
      try {
        const snippets = rule.extract(ast, sourceCode);
        allSnippets.push(...snippets);
      } catch (error) {
        console.error(`Error applying rule ${rule.name}:`, error);
      }
    }

    return this.filterAndDeduplicateSnippets(allSnippets);
  }

  createSnippetFromNode(
    node: Parser.SyntaxNode,
    sourceCode: string,
    snippetType: SnippetChunk['snippetMetadata']['snippetType'],
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.coreService.getNodeText(node, sourceCode);
    const location = this.coreService.getNodeLocation(node);

    // 使用增强的验证逻辑
    if (!SnippetValidationService.enhancedIsValidSnippet(content, snippetType, 'typescript')) {
      return null;
    }

    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);

    return {
      id: TreeSitterUtils.generateSnippetId(content, location.startLine),
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
        snippetType,
        contextInfo,
        languageFeatures: SnippetValidationService.analyzeLanguageFeatures(content),
        complexity: SnippetValidationService.calculateComplexity(content),
        isStandalone: SnippetValidationService.isStandaloneSnippet(content, snippetType),
        hasSideEffects: SnippetValidationService.hasSideEffects(content),
      },
    };
  }

  private extractContextInfo(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk['snippetMetadata']['contextInfo'] {
    const contextInfo: SnippetChunk['snippetMetadata']['contextInfo'] = {
      nestingLevel,
    };

    let parent = node.parent;
    let depth = 0;
    while (parent && depth < 50) {
      if (
        parent.type === 'function_declaration' ||
        parent.type === 'function_definition' ||
        parent.type === 'method_definition' ||
        parent.type === 'arrow_function'
      ) {
        const nameNode = parent.childForFieldName('name');
        if (nameNode) {
          contextInfo.parentFunction = this.coreService.getNodeText(nameNode, sourceCode);
          break;
        }
      }
      parent = parent.parent;
      depth++;
    }

    parent = node.parent;
    depth = 0;
    while (parent && depth < 50) {
      if (parent.type === 'class_declaration' || parent.type === 'class_definition') {
        const nameNode = parent.childForFieldName('name');
        if (nameNode) {
          contextInfo.parentClass = this.coreService.getNodeText(nameNode, sourceCode);
          break;
        }
      }
      parent = parent.parent;
      depth++;
    }

    return contextInfo;
  }

  private filterAndDeduplicateSnippets(snippets: SnippetChunk[]): SnippetChunk[] {
    const filtered: SnippetChunk[] = [];
    const seen = new Set<string>();

    for (const snippet of snippets) {
      if (snippet.snippetMetadata.complexity < 1 || snippet.snippetMetadata.complexity > 15) {
        continue;
      }

      if (snippet.content.length < 20 || snippet.content.length > 1000) {
        continue;
      }

      let contentHash = this.snippetHashCache.get(snippet.content);
      if (!contentHash) {
        contentHash = TreeSitterUtils.simpleHash(snippet.content);
        this.snippetHashCache.set(snippet.content, contentHash);
      }

      if (seen.has(contentHash)) {
        continue;
      }

      seen.add(contentHash);
      filtered.push(snippet);
    }

    if (this.snippetHashCache.size > 1000) {
      this.snippetHashCache.clear();
    }

    seen.clear();

    return filtered;
  }

  getSnippetMarkerRegex(): RegExp {
    return this.snippetMarkerRegex;
  }

  extractCodeBlockAfterMarker(lines: string[], startLine: number): string[] {
    const snippetLines: string[] = [];

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      if (i > startLine && this.snippetMarkerRegex.test(trimmedLine)) {
        break;
      }

      if (trimmedLine === '') {
        break;
      }

      snippetLines.push(line);
    }

    return snippetLines;
  }

  getSurroundingCode(lines: string[], startLine: number, endLine: number): string {
    const contextLines = 2;
    const surroundingLines = [];

    for (let i = Math.max(0, startLine - contextLines); i < startLine; i++) {
      surroundingLines.push(lines[i]);
    }

    for (let i = endLine; i < Math.min(lines.length, endLine + contextLines); i++) {
      surroundingLines.push(lines[i]);
    }

    return surroundingLines.join('\n');
  }
}
