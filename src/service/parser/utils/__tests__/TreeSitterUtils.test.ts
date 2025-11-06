import { TreeSitterUtils } from '../TreeSitterUtils';

describe('TreeSitterUtils', () => {
  let mockNode: any;

  beforeEach(() => {
    mockNode = {
      id: 1,
      type: 'function_declaration',
      startIndex: 12,
      endIndex: 48,
      startPosition: { row: 1, column: 0 },
      endPosition: { row: 1, column: 36 },
      text: 'function test() { return "hello"; }',
      children: [
        {
          type: 'identifier',
          text: 'test',
          startIndex: 21,
          endIndex: 25,
          startPosition: { row: 1, column: 9 },
          endPosition: { row: 1, column: 13 },
        }
      ],
      parent: null,
      childForFieldName: jest.fn(),
    };
  });

  describe('基础工具方法', () => {
    it('应该正确提取节点文本', () => {
      const sourceCode = 'const x = 1;\nfunction test() { return "hello"; }\nconst y = 2;';
      const text = TreeSitterUtils.getNodeText(mockNode, sourceCode);
      expect(text).toBe('\nfunction test() { return "hello"; }');
    });

    it('应该正确获取节点位置', () => {
      const location = TreeSitterUtils.getNodeLocation(mockNode);
      expect(location).toEqual({
        startLine: 2,
        endLine: 2,
        startColumn: 1,
        endColumn: 37,
      });
    });

    it('应该生成片段ID', () => {
      const content = 'function test() { return "hello"; }';
      const snippetId = TreeSitterUtils.generateSnippetId(content, 5);
      expect(snippetId).toMatch(/^snippet_5_[a-z0-9]+$/);
    });

    it('应该生成简单哈希', () => {
      const hash1 = TreeSitterUtils.simpleHash('test');
      const hash2 = TreeSitterUtils.simpleHash('test');
      const hash3 = TreeSitterUtils.simpleHash('different');
      
      expect(typeof hash1).toBe('string');
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
    });

    it('应该生成节点哈希', () => {
      const hash = TreeSitterUtils.getNodeHash(mockNode);
      expect(hash).toBe('function_declaration:12:48');
    });
  });

  describe('节点类型检查', () => {
    it('应该正确检查节点类型', () => {
      expect(TreeSitterUtils.isNodeType(mockNode, 'function_declaration')).toBe(true);
      expect(TreeSitterUtils.isNodeType(mockNode, 'class_declaration')).toBe(false);
    });

    it('应该正确检查多种节点类型', () => {
      expect(TreeSitterUtils.isNodeTypes(mockNode, ['function_declaration', 'class_declaration'])).toBe(true);
      expect(TreeSitterUtils.isNodeTypes(mockNode, ['class_declaration', 'interface_declaration'])).toBe(false);
    });
  });

  describe('子节点操作', () => {
    it('应该获取子节点', () => {
      const childNodes = TreeSitterUtils.getChildNodes(mockNode);
      expect(childNodes).toHaveLength(1);
      expect(childNodes[0].type).toBe('identifier');
    });

    it('应该检查字段是否存在', () => {
      mockNode.childForFieldName.mockReturnValue(mockNode.children[0]);
      expect(TreeSitterUtils.hasField(mockNode, 'name')).toBe(true);
      
      mockNode.childForFieldName.mockReturnValue(null);
      expect(TreeSitterUtils.hasField(mockNode, 'unknown')).toBe(false);
    });

    it('应该获取指定字段的子节点', () => {
      const identifierNode = mockNode.children[0];
      mockNode.childForFieldName.mockReturnValue(identifierNode);
      
      const childNode = TreeSitterUtils.getChildNode(mockNode, 'name');
      expect(childNode).toBe(identifierNode);
    });
  });

  describe('节点分析', () => {
    it('应该获取节点文本长度', () => {
      const length = TreeSitterUtils.getNodeTextLength(mockNode);
      expect(length).toBe(36); // 48 - 12
    });

    it('应该检查节点是否为空', () => {
      const emptyNode = { ...mockNode, startIndex: 10, endIndex: 10 };
      expect(TreeSitterUtils.isNodeEmpty(emptyNode)).toBe(true);
      expect(TreeSitterUtils.isNodeEmpty(mockNode)).toBe(false);
    });

    it('应该获取节点深度', () => {
      // 根节点
      expect(TreeSitterUtils.getNodeDepth(mockNode)).toBe(0);
      
      // 子节点
      const childNode = { ...mockNode.children[0], parent: mockNode };
      expect(TreeSitterUtils.getNodeDepth(childNode)).toBe(1);
    });

    it('应该检查后代关系', () => {
      const childNode = { ...mockNode.children[0], parent: mockNode };
      const unrelatedNode = { ...mockNode, parent: null };
      
      expect(TreeSitterUtils.isDescendant(childNode, mockNode)).toBe(true);
      expect(TreeSitterUtils.isDescendant(unrelatedNode, mockNode)).toBe(false);
    });

    it('应该获取节点路径', () => {
      const childNode = { ...mockNode.children[0], parent: mockNode };
      const path = TreeSitterUtils.getNodePath(childNode);
      expect(path).toEqual(['function_declaration', 'identifier']);
    });
  });

  describe('位置比较', () => {
    it('应该格式化节点位置', () => {
      const location = TreeSitterUtils.formatNodeLocation(mockNode);
      expect(location).toBe('2:1-2:37');
    });

    it('应该比较节点位置', () => {
      const node1 = { ...mockNode, startIndex: 10 };
      const node2 = { ...mockNode, startIndex: 20 };
      const node3 = { ...mockNode, startIndex: 10 };
      
      expect(TreeSitterUtils.compareNodePositions(node1, node2)).toBe(-1);
      expect(TreeSitterUtils.compareNodePositions(node2, node1)).toBe(1);
      expect(TreeSitterUtils.compareNodePositions(node1, node3)).toBe(0);
    });

    it('应该检查节点重叠', () => {
      const node1 = { ...mockNode, startIndex: 10, endIndex: 50 };
      const node2 = { ...mockNode, startIndex: 30, endIndex: 70 };
      const node3 = { ...mockNode, startIndex: 60, endIndex: 90 };
      
      expect(TreeSitterUtils.nodesOverlap(node1, node2)).toBe(true);
      expect(TreeSitterUtils.nodesOverlap(node1, node3)).toBe(false);
    });
  });

  describe('AST遍历', () => {
    it('应该遍历AST', () => {
      const visitedNodes: any[] = [];
      const callback = jest.fn((node, depth) => {
        visitedNodes.push({ type: node.type, depth });
      });

      TreeSitterUtils.traverseAST(mockNode, callback);
      
      expect(callback).toHaveBeenCalledWith(mockNode, 0);
      expect(callback).toHaveBeenCalledWith(mockNode.children[0], 1);
    });

    it('应该收集满足条件的节点', () => {
      const functionNodes = TreeSitterUtils.collectNodes(mockNode, (node) => 
        node.type === 'function_declaration'
      );
      
      expect(functionNodes).toHaveLength(1);
      expect(functionNodes[0]).toBe(mockNode);
    });

    it('应该在指定位置找到节点', () => {
      const foundNode = TreeSitterUtils.findNodeAtPosition(mockNode, 25);
      expect(foundNode).toBe(mockNode);
      
      const notFoundNode = TreeSitterUtils.findNodeAtPosition(mockNode, 100);
      expect(notFoundNode).toBeNull();
    });
  });
});