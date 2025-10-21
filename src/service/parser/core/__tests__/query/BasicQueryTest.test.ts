import { TreeSitterCoreService } from '../../parse/TreeSitterCoreService';

describe('Basic Tree-sitter Query Test', () => {
  let treeSitterService: TreeSitterCoreService;

  beforeAll(() => {
    treeSitterService = new TreeSitterCoreService();
  });

  test('should execute basic tree-sitter query', async () => {
    const jsCode = `
function testFunction() {
  return "hello";
}

class TestClass {
  method() {
    return "method";
  }
}
`;

    const parseResult = await treeSitterService.parseCode(jsCode, 'javascript');
    expect(parseResult.success).toBe(true);

    // 使用简单的查询模式，不包含特殊谓词
    const simpleQuery = `
(function_declaration) @function
(class_declaration) @class
(method_definition) @method
`;

    const results = treeSitterService.queryTree(parseResult.ast, simpleQuery);
    console.log('Query results:', results);
    
    expect(results.length).toBeGreaterThan(0);
    
    // 检查是否找到了函数和类
    const functionCaptures = results.flatMap(r => r.captures).filter(c => c.name === 'function');
    const classCaptures = results.flatMap(r => r.captures).filter(c => c.name === 'class');
    
    console.log('Function captures:', functionCaptures.length);
    console.log('Class captures:', classCaptures.length);
    
    expect(functionCaptures.length).toBeGreaterThan(0);
    expect(classCaptures.length).toBeGreaterThan(0);
  });

  test('should execute query with captures', async () => {
    const jsCode = `
function testFunction() {
  return "hello";
}
`;

    const parseResult = await treeSitterService.parseCode(jsCode, 'javascript');
    expect(parseResult.success).toBe(true);

    // 测试带捕获的查询
    const queryWithCaptures = `
(function_declaration
  name: (identifier) @name) @function
`;

    const results = treeSitterService.queryTree(parseResult.ast, queryWithCaptures);
    console.log('Query with captures results:', results);
    
    expect(results.length).toBeGreaterThan(0);
    
    // 检查捕获的名称
    const nameCaptures = results.flatMap(r => r.captures).filter(c => c.name === 'name');
    const functionCaptures = results.flatMap(r => r.captures).filter(c => c.name === 'function');
    
    console.log('Name captures:', nameCaptures.length);
    console.log('Function captures:', functionCaptures.length);
    
    expect(nameCaptures.length).toBeGreaterThan(0);
    expect(functionCaptures.length).toBeGreaterThan(0);
  });
});