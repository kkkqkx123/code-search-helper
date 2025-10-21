import { TreeSitterCoreService } from '../../parse/TreeSitterCoreService';

describe('AST Structure Test', () => {
  let treeSitterService: TreeSitterCoreService;

  beforeAll(() => {
    treeSitterService = new TreeSitterCoreService();
  });

  test('should examine JavaScript AST structure', async () => {
    const jsCode = `
function testFunction() {
  return "hello";
}

const arrowFunction = () => {
  return "arrow";
};

class TestClass {
  method() {
    return "method";
  }
}

export const constant = "value";
export function namedFunction() {
  return "named";
}
`;

    const parseResult = await treeSitterService.parseCode(jsCode, 'javascript');
    expect(parseResult.success).toBe(true);

    // 递归遍历AST，打印所有节点类型
    const nodeTypes = new Set<string>();
    
    const traverse = (node: any, depth: number = 0) => {
      if (depth > 10) return;
      
      nodeTypes.add(node.type);
      
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverse(child, depth + 1);
        }
      }
    };

    traverse(parseResult.ast);
    
    console.log('JavaScript AST node types:');
    const sortedTypes = Array.from(nodeTypes).sort();
    sortedTypes.forEach(type => console.log(`  ${type}`));
    
    // 检查特定的节点类型
    expect(nodeTypes.has('function_declaration')).toBe(true);
    expect(nodeTypes.has('arrow_function')).toBe(true);
    expect(nodeTypes.has('method_definition')).toBe(true);
    
    // 检查类相关的节点类型
    console.log('Class-related node types:');
    sortedTypes.filter(type => 
      type.includes('class') || 
      type.includes('interface') || 
      type.includes('struct')
    ).forEach(type => console.log(`  ${type}`));
    
    // 检查导出相关的节点类型
    console.log('Export-related node types:');
    sortedTypes.filter(type => 
      type.includes('export')
    ).forEach(type => console.log(`  ${type}`));
  });

  test('should examine TypeScript AST structure', async () => {
    const tsCode = `
interface TestInterface {
  method(): string;
}

function testFunction(): string {
  return "test";
}

const arrowFunction = (): string => {
  return "arrow";
};

class TestClass implements TestInterface {
  private property: string;
  
  constructor(private value: number) {}
  
  method(): string {
    return this.property;
  }
}
`;

    const parseResult = await treeSitterService.parseCode(tsCode, 'typescript');
    expect(parseResult.success).toBe(true);

    // 递归遍历AST，打印所有节点类型
    const nodeTypes = new Set<string>();
    
    const traverse = (node: any, depth: number = 0) => {
      if (depth > 10) return;
      
      nodeTypes.add(node.type);
      
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverse(child, depth + 1);
        }
      }
    };

    traverse(parseResult.ast);
    
    console.log('TypeScript AST node types:');
    const sortedTypes = Array.from(nodeTypes).sort();
    sortedTypes.forEach(type => console.log(`  ${type}`));
    
    // 检查特定的节点类型
    expect(nodeTypes.has('function_declaration')).toBe(true);
    expect(nodeTypes.has('arrow_function')).toBe(true);
    expect(nodeTypes.has('method_definition')).toBe(true);
    
    // 检查类相关的节点类型
    console.log('Class-related node types:');
    sortedTypes.filter(type => 
      type.includes('class') || 
      type.includes('interface') || 
      type.includes('struct')
    ).forEach(type => console.log(`  ${type}`));
  });
});