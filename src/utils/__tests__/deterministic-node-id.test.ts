import Parser from 'tree-sitter';
import { generateDeterministicNodeId } from '../deterministic-node-id';

// Mock tree-sitter node for testing
const createMockNode = (type: string, row: number, column: number): Parser.SyntaxNode => {
  return {
    type,
    startPosition: { row, column },
  } as Parser.SyntaxNode;
};

describe('generateDeterministicNodeId', () => {
  it('should generate a consistent ID for the same node', () => {
    const node = createMockNode('function_definition', 10, 4);
    const id1 = generateDeterministicNodeId(node);
    const id2 = generateDeterministicNodeId(node);

    expect(id1).toBe('function_definition:10:4');
    expect(id1).toBe(id2);
  });

  it('should generate different IDs for different node types', () => {
    const node1 = createMockNode('function_definition', 10, 4);
    const node2 = createMockNode('call_expression', 10, 4);

    const id1 = generateDeterministicNodeId(node1);
    const id2 = generateDeterministicNodeId(node2);

    expect(id1).toBe('function_definition:10:4');
    expect(id2).toBe('call_expression:10:4');
    expect(id1).not.toBe(id2);
  });

  it('should generate different IDs for nodes at different positions', () => {
    const node1 = createMockNode('identifier', 5, 0);
    const node2 = createMockNode('identifier', 5, 1);
    const node3 = createMockNode('identifier', 6, 0);

    const id1 = generateDeterministicNodeId(node1);
    const id2 = generateDeterministicNodeId(node2);
    const id3 = generateDeterministicNodeId(node3);

    expect(id1).toBe('identifier:5:0');
    expect(id2).toBe('identifier:5:1');
    expect(id3).toBe('identifier:6:0');
    
    expect(id1).not.toBe(id2);
    expect(id1).not.toBe(id3);
    expect(id2).not.toBe(id3);
  });

  it('should handle zero-indexed positions correctly', () => {
    const node = createMockNode('program', 0, 0);
    const id = generateDeterministicNodeId(node);
    expect(id).toBe('program:0:0');
  });

  it('should throw an error for a null node', () => {
    expect(() => generateDeterministicNodeId(null as any)).toThrow('Cannot generate ID for a null or undefined node.');
  });

  it('should throw an error for an undefined node', () => {
    expect(() => generateDeterministicNodeId(undefined as any)).toThrow('Cannot generate ID for a null or undefined node.');
  });
});