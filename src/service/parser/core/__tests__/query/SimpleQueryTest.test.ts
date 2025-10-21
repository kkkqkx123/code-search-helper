import { TreeSitterCoreService } from '../../parse/TreeSitterCoreService';
import { QueryRegistry } from '../../query/QueryRegistry';

describe('Simple Query Test (重构后)', () => {
  let treeSitterService: TreeSitterCoreService;

  beforeAll(async () => {
    treeSitterService = new TreeSitterCoreService();
    // 确保查询注册表已初始化
    await QueryRegistry.initialize();
  });

  test('should test JavaScript queries from constants', async () => {
    const jsCode = `
function testFunction() {
  return "hello";
}

const arrowFunction = () => {
  return "world";
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

    // 使用新的查询系统
    const functionQuery = await QueryRegistry.getPatternAsync('javascript', 'functions');
    console.log('JavaScript function query:', functionQuery);
    
    if (!functionQuery) {
      throw new Error('Function query pattern is null');
    }
    
    const functionResults = treeSitterService.queryTree(parseResult.ast, functionQuery);
    console.log('Function query results:', functionResults);
    
    const functionCaptures = functionResults.flatMap(r => r.captures).filter(c => c.name === 'function');
    console.log('Function captures count:', functionCaptures.length);
    
    // 测试类查询
    const classQuery = await QueryRegistry.getPatternAsync('javascript', 'classes');
    console.log('JavaScript class query:', classQuery);
    
    if (!classQuery) {
      throw new Error('Class query pattern is null');
    }
    
    const classResults = treeSitterService.queryTree(parseResult.ast, classQuery);
    console.log('Class query results:', classResults);
    
    const classCaptures = classResults.flatMap(r => r.captures).filter(c => c.name === 'class');
    console.log('Class captures count:', classCaptures.length);
    
    // 测试导出查询
    const exportQuery = await QueryRegistry.getPatternAsync('javascript', 'exports');
    console.log('JavaScript export query:', exportQuery);
    
    if (!exportQuery) {
      throw new Error('Export query pattern is null');
    }
    
    const exportResults = treeSitterService.queryTree(parseResult.ast, exportQuery);
    console.log('Export query results:', exportResults);
    
    const exportCaptures = exportResults.flatMap(r => r.captures).filter(c => c.name === 'export');
    console.log('Export captures count:', exportCaptures.length);
    
    expect(functionCaptures.length).toBeGreaterThan(0);
    expect(classCaptures.length).toBeGreaterThan(0);
    expect(exportCaptures.length).toBeGreaterThan(0);
  });

  test('should test TypeScript queries from constants', async () => {
    const tsCode = `
interface TestInterface {
  method(): string;
}

abstract class AbstractClass {
  abstract abstractMethod(): void;
  
  concreteMethod(): string {
    return "concrete";
  }
}

class TestClass implements TestInterface {
  private property: string;
  
  constructor(private value: number) {}
  
  method(): string {
    return this.property;
  }
  
  get getter(): string {
    return "getter";
  }
  
  set setter(value: string) {
    this.property = value;
  }
}

const arrowFunction = (param: string): string => {
  return param;
};

function genericFunction<T>(param: T): T {
  return param;
}
`;

    const parseResult = await treeSitterService.parseCode(tsCode, 'typescript');
    expect(parseResult.success).toBe(true);

    // 测试函数查询
    const functionQuery = await QueryRegistry.getPatternAsync('typescript', 'functions');
    console.log('TypeScript function query:', functionQuery);
    
    if (!functionQuery) {
      throw new Error('TypeScript function query pattern is null');
    }
    
    const functionResults = treeSitterService.queryTree(parseResult.ast, functionQuery);
    console.log('Function query results:', functionResults);
    
    const functionCaptures = functionResults.flatMap(r => r.captures).filter(c => c.name === 'function');
    console.log('Function captures count:', functionCaptures.length);
    
    // 测试类查询
    const classQuery = await QueryRegistry.getPatternAsync('typescript', 'classes');
    console.log('TypeScript class query:', classQuery);
    
    if (!classQuery) {
      throw new Error('TypeScript class query pattern is null');
    }
    
    const classResults = treeSitterService.queryTree(parseResult.ast, classQuery);
    console.log('Class query results:', classResults);
    
    const classCaptures = classResults.flatMap(r => r.captures).filter(c => 
      c.name === 'class' || c.name === 'interface'
    );
    console.log('Class/Interface captures count:', classCaptures.length);
    
    expect(functionCaptures.length).toBeGreaterThan(0);
    expect(classCaptures.length).toBeGreaterThan(0);
  });

  // 添加新的测试：验证查询转换的正确性
  test('should validate query transformation correctness', async () => {
    const jsCode = `function test() { return "test"; }`;
    const parseResult = await treeSitterService.parseCode(jsCode, 'javascript');
    
    // 使用新的查询系统
    const newFunctionQuery = await QueryRegistry.getPatternAsync('javascript', 'functions');
    const newResults = treeSitterService.queryTree(parseResult.ast, newFunctionQuery!);
    
    // 验证结果包含预期的捕获
    const functionCaptures = newResults.flatMap(r => r.captures).filter(c => c.name === 'function');
    expect(functionCaptures.length).toBe(1);
    
    // 验证捕获的节点类型正确
    const functionNode = functionCaptures[0].node;
    expect(functionNode.type).toBe('function_declaration');
  });

  // 测试向后兼容性
  test('should maintain backward compatibility', async () => {
    const jsCode = `function test() { return "test"; }`;
    
    // 使用同步接口应该仍然工作
    const syncQuery = QueryRegistry.getPattern('javascript', 'functions');
    expect(syncQuery).toBeTruthy();
    
    // 验证同步查询包含预期的内容
    expect(syncQuery).toContain('function_declaration');
  });
});