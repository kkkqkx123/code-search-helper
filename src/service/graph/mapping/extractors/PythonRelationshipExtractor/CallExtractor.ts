import {
  Parser,
  CallRelationship,
  ILanguageRelationshipExtractor,
  generateDeterministicNodeId
} from '../types';
import { BasePythonRelationshipExtractor } from './BasePythonRelationshipExtractor';

export class CallExtractor extends BasePythonRelationshipExtractor {
  async extract(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<CallRelationship[]> {
    // Since tree-sitter is removed, return empty array
    return [];
  }
}