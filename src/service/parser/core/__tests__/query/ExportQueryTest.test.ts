import { TreeSitterCoreService } from '../../parse/TreeSitterCoreService';

describe('Export Query Test', () => {
  let treeSitterService: TreeSitterCoreService;

  beforeAll(() => {
    treeSitterService = new TreeSitterCoreService();
  });

  test('should test individual export queries', async () => {
    const jsCode = `
export const constant = "value";
export function namedFunction() {
  return "named";
}
export default class DefaultClass {
  method() {
    return "method";
  }
}
`;

    const parseResult = await treeSitterService.parseCode(jsCode, 'javascript');
    expect(parseResult.success).toBe(true);

    // 测试导出语句查询模式
    const exportStatementQuery = '(export_statement) @export';
    const exportStatementResults = treeSitterService.queryTree(parseResult.ast, exportStatementQuery);
    console.log('Export statement results:', exportStatementResults);

    // 测试导出默认声明
    const exportDefaultQuery = '(export_statement "default" (class_declaration) @declaration) @export';
    const exportDefaultResults = treeSitterService.queryTree(parseResult.ast, exportDefaultQuery);
    console.log('Export default results:', exportDefaultResults);

    // 测试导出命名声明
    const exportNamedQuery = '(export_statement (function_declaration name: (identifier) @name) @export)';
    const exportNamedResults = treeSitterService.queryTree(parseResult.ast, exportNamedQuery);
    console.log('Export named results:', exportNamedResults);

    // 测试导出常量
    const exportConstQuery = '(export_statement (lexical_declaration (variable_declarator name: (identifier) @name)) @export)';
    const exportConstResults = treeSitterService.queryTree(parseResult.ast, exportConstQuery);
    console.log('Export const results:', exportConstResults);

    // 验证每个查询都能找到结果
    expect(exportStatementResults.length).toBeGreaterThan(0);
    expect(exportDefaultResults.length).toBeGreaterThan(0);
    expect(exportNamedResults.length).toBeGreaterThan(0);
    expect(exportConstResults.length).toBeGreaterThan(0);
  });

  test('should test combined export query', async () => {
    const jsCode = `
export const constant = "value";
export function namedFunction() {
  return "named";
}
export default class DefaultClass {
  method() {
    return "method";
  }
}
`;

    const parseResult = await treeSitterService.parseCode(jsCode, 'javascript');
    expect(parseResult.success).toBe(true);

    // 测试组合查询模式
    const combinedQuery = `
(export_statement) @export
(export_statement "default" (class_declaration) @default_export)
(export_statement (function_declaration name: (identifier) @name) @function_export)
(export_statement (lexical_declaration (variable_declarator name: (identifier) @name)) @const_export)
`;

    const combinedResults = treeSitterService.queryTree(parseResult.ast, combinedQuery);
    console.log('Combined export results:', combinedResults);

    const exportCaptures = combinedResults.flatMap(r => r.captures).filter(c => c.name === 'export');
    console.log('Combined export captures count:', exportCaptures.length);

    expect(exportCaptures.length).toBeGreaterThan(0);
  });
});