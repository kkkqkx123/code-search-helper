import { TreeSitterCoreService } from '../../parse/TreeSitterCoreService';
import { QueryRegistry } from '../../query/QueryRegistry';

describe('Simple Query Test', () => {
  let treeSitterService: TreeSitterCoreService;

  beforeAll(() => {
    treeSitterService = new TreeSitterCoreService();
  });

  test('should test JavaScript simple queries', async () => {
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

    // 测试函数查询
    const functionQuery = QueryRegistry.getPattern('javascript', 'functions');
    console.log('JavaScript function query:', functionQuery);
    
    if (!functionQuery) {
      throw new Error('Function query pattern is null');
    }
    
    const functionResults = treeSitterService.queryTree(parseResult.ast, functionQuery);
    console.log('Function query results:', functionResults);
    
    const functionCaptures = functionResults.flatMap(r => r.captures).filter(c => c.name === 'function');
    console.log('Function captures count:', functionCaptures.length);
    
    // 测试类查询
    const classQuery = QueryRegistry.getPattern('javascript', 'classes');
    console.log('JavaScript class query:', classQuery);
    
    if (!classQuery) {
      throw new Error('Class query pattern is null');
    }
    
    const classResults = treeSitterService.queryTree(parseResult.ast, classQuery);
    console.log('Class query results:', classResults);
    
    const classCaptures = classResults.flatMap(r => r.captures).filter(c => c.name === 'class');
    console.log('Class captures count:', classCaptures.length);
    
    // 测试导出查询
    const exportQuery = QueryRegistry.getPattern('javascript', 'exports');
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

  test('should test TypeScript simple queries', async () => {
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
    const functionQuery = QueryRegistry.getPattern('typescript', 'functions');
    console.log('TypeScript function query:', functionQuery);
    
    if (!functionQuery) {
      throw new Error('TypeScript function query pattern is null');
    }
    
    const functionResults = treeSitterService.queryTree(parseResult.ast, functionQuery);
    console.log('Function query results:', functionResults);
    
    const functionCaptures = functionResults.flatMap(r => r.captures).filter(c => c.name === 'function');
    console.log('Function captures count:', functionCaptures.length);
    
    // 测试类查询
    const classQuery = QueryRegistry.getPattern('typescript', 'classes');
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
});