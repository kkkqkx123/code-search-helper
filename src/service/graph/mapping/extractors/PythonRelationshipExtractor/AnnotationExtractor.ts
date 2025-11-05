import {
  Parser,
  AnnotationRelationship,
  generateDeterministicNodeId
} from '../types';
import { BasePythonRelationshipExtractor } from './BasePythonRelationshipExtractor';

export class AnnotationExtractor extends BasePythonRelationshipExtractor {
  async extract(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<AnnotationRelationship[]> {
    // Since tree-sitter is removed, return empty array
    return [];
  }
}