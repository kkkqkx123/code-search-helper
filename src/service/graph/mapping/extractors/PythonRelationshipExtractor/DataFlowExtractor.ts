import {
  Parser,
  DataFlowRelationship,
  generateDeterministicNodeId
} from '../types';
import { BasePythonRelationshipExtractor } from './BasePythonRelationshipExtractor';

export class DataFlowExtractor extends BasePythonRelationshipExtractor {
  async extract(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<DataFlowRelationship[]> {
    // Since tree-sitter is removed, return empty array
    return [];
  }




}