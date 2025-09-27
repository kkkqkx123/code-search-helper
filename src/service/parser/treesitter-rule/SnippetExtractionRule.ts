import Parser from 'tree-sitter';
import { SnippetChunk } from '../types';

export interface SnippetExtractionRule {
  name: string;
  extract(ast: Parser.SyntaxNode, sourceCode: string): SnippetChunk[];
  supportedNodeTypes: Set<string>;
}
