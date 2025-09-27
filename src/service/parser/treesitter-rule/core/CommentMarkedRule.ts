import Parser from 'tree-sitter';
import { SnippetExtractionRule } from '../SnippetExtractionRule';
import { SnippetChunk, SnippetMetadata } from '../../types';
import { SnippetValidationService } from '../../analysis/SnippetValidationService';

export class CommentMarkedRule implements SnippetExtractionRule {
  name = 'CommentMarkedRule';
  supportedNodeTypes = new Set(['comment']);
  private snippetMarkerRegex: RegExp;

  constructor() {
    // Precompile regex for snippet markers
    const snippetMarkers = ['@snippet', '@code', '@example', 'SNIPPET:', 'EXAMPLE:'];
    this.snippetMarkerRegex = new RegExp(
      snippetMarkers.map(marker => marker.replace(/[.*+?^${}()|[\]\/\\]/g, '\\$&')).join('|')
    );
  }

  extract(ast: Parser.SyntaxNode, sourceCode: string): SnippetChunk[] {
    const snippets: SnippetChunk[] = [];
    const lines = sourceCode.split('\n');

    // First, look for comment nodes in the AST
    const findCommentNodes = (node: Parser.SyntaxNode, depth: number = 0) => {
      // Limit traversal depth to prevent excessive recursion
      if (depth > 50) return;

      if (node.type === 'comment') {
        const commentText = this.getNodeText(node, sourceCode);
        if (this.snippetMarkerRegex.test(commentText)) {
          // Find the code block following the marker
          const startLine = node.startPosition.row + 1;
          const snippetLines = this.extractCodeBlockAfterMarker(lines, startLine + 1);
          if (snippetLines.length > 0) {
            const snippetContent = snippetLines.join('\n');
            const endLine = startLine + snippetLines.length;

            // Calculate byte positions more accurately
            let startByte = lines.slice(0, startLine).join('\n').length;
            if (startLine > 0) startByte++; // Account for newline character
            const endByte = startByte + snippetContent.length;

            const snippet: SnippetChunk = {
              id: this.generateSnippetId(snippetContent, startLine),
              content: snippetContent,
              startLine: startLine,
              endLine,
              startByte,
              endByte,
              type: 'snippet',
              imports: [],
              exports: [],
              metadata: {},
              snippetMetadata: {
                snippetType: 'comment_marked',
                contextInfo: {
                  nestingLevel: 0,
                  surroundingCode: this.getSurroundingCode(lines, startLine + 1, endLine),
                },
                languageFeatures: this.analyzeLanguageFeatures(snippetContent),
                complexity: this.calculateComplexity(snippetContent),
                isStandalone: true,
                hasSideEffects: this.hasSideEffects(snippetContent),
                commentMarkers: [commentText],
              },
            };

            snippets.push(snippet);
          }
        }
      }

      // Recursively search child nodes with depth tracking
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          findCommentNodes(child, depth + 1);
        }
      }
    };

    findCommentNodes(ast);

    // Track which markers we've already found via AST to avoid duplicates in direct scanning
    const foundMarkers = new Set(
      snippets.map(snippet => snippet.snippetMetadata.commentMarkers?.[0]?.trim()).filter(Boolean)
    );

    // If we already found snippets via AST, skip direct scanning to avoid duplicates
    if (snippets.length > 0) {
      console.log(`[DEBUG] Skipping direct scan - found ${snippets.length} snippets via AST`);
      return snippets;
    }

    // Also scan source code directly for comment markers (fallback)
    // This is more reliable than relying on the AST structure in our mock environment

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Use precompiled regex for better performance
      const hasMarker = this.snippetMarkerRegex.test(line);

      // Skip if we already found this marker in the AST
      if (hasMarker && !foundMarkers.has(line)) {
        // Find the code block following the marker
        const snippetLines = this.extractCodeBlockAfterMarker(lines, i + 1);
        if (snippetLines.length > 0) {
          const snippetContent = snippetLines.join('\n');
          const startLine = i + 1;
          const endLine = i + snippetLines.length;

          // Calculate byte positions more accurately
          let startByte = lines.slice(0, startLine - 1).join('\n').length;
          if (startLine > 1) startByte++; // Account for newline character
          const endByte = startByte + snippetContent.length;

          const snippet: SnippetChunk = {
            id: this.generateSnippetId(snippetContent, startLine),
            content: snippetContent,
            startLine,
            endLine,
            startByte,
            endByte,
            type: 'snippet',
            imports: [],
            exports: [],
            metadata: {},
            snippetMetadata: {
              snippetType: 'comment_marked',
              contextInfo: {
                nestingLevel: 0,
                surroundingCode: this.getSurroundingCode(lines, startLine, endLine),
              },
              languageFeatures: this.analyzeLanguageFeatures(snippetContent),
              complexity: this.calculateComplexity(snippetContent),
              isStandalone: true,
              hasSideEffects: this.hasSideEffects(snippetContent),
              commentMarkers: [line],
            },
          };

          snippets.push(snippet);
        }
      }
    }

    // Debug: Log the number of comment markers found
    console.log(`[DEBUG] Found ${snippets.length} comment-marked snippets`);
    console.log(`[DEBUG] AST markers: ${Array.from(foundMarkers).join(', ')}`);
    console.log(`[DEBUG] AST snippets count: ${snippets.length}`);

    // Debug: Log direct scanning results
    const directMarkers = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (this.snippetMarkerRegex.test(line)) {
        directMarkers.push(line);
      }
    }
    console.log(`[DEBUG] Direct markers: ${directMarkers.join(', ')}`);

    return snippets;
  }

  private getNodeText(node: Parser.SyntaxNode, sourceCode: string): string {
    return sourceCode.substring(node.startIndex, node.endIndex);
  }

  private extractCodeBlockAfterMarker(lines: string[], startLine: number): string[] {
    const snippetLines: string[] = [];

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Stop if we encounter another marker
      if (i > startLine && this.snippetMarkerRegex.test(trimmedLine)) {
        break;
      }

      // Stop if we encounter an empty line (end of function)
      if (trimmedLine === '') {
        break;
      }

      snippetLines.push(line);
    }

    return snippetLines;
  }

  private getSurroundingCode(lines: string[], startLine: number, endLine: number): string {
    const contextLines = 2;
    const surroundingLines = [];

    // Add lines before
    for (let i = Math.max(0, startLine - contextLines); i < startLine; i++) {
      surroundingLines.push(lines[i]);
    }

    // Add lines after
    for (let i = endLine; i < Math.min(lines.length, endLine + contextLines); i++) {
      surroundingLines.push(lines[i]);
    }

    return surroundingLines.join('\n');
  }

  private analyzeLanguageFeatures(content: string): SnippetMetadata['languageFeatures'] {
    return SnippetValidationService.analyzeLanguageFeatures(content);
  }

  private calculateComplexity(content: string): number {
    return SnippetValidationService.calculateComplexity(content);
  }

  private hasSideEffects(content: string): boolean {
    return SnippetValidationService.hasSideEffects(content);
  }

  private generateSnippetId(content: string, startLine: number): string {
    const hash = this.simpleHash(content).substring(0, 8);
    return `snippet_${startLine}_${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }
}
