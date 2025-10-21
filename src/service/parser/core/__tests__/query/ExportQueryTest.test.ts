import { TreeSitterCoreService } from '../../parse/TreeSitterCoreService';

describe('Export Query Test', () => {
  let treeSitterService: TreeSitterCoreService;

  beforeAll(() => {
    treeSitterService = new TreeSitterService();
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

    // 测试单个导出查询模式
    const exportStatementQuery = '(export_statement) @export';
    const exportStatementResults = treeSitterService.queryTree(parseResult.ast, exportStatementQuery);
    console.log('Export statement results:', exportStatementResults);
    
    const exportDefaultQuery = '(export_default_declaration) @export';
    const exportDefaultResults = treeSitterService.queryTree(parseResult.ast, exportDefaultQuery);
    console.log('Export default results:', exportDefaultResults);
    
    const exportNamedQuery = '(export_named_declaration) @export';
    const exportNamedResults = treeSitterService.queryTree(parseResult.ast, exportNamedQuery);
    console.log('Export named results:', exportNamedResults);
    
    const exportAllQuery = '(export_all_declaration) @export';
    const exportAllResults = treeSitterService.queryTree(parseResult.ast, exportAllQuery);
    console.log('Export all results:', exportAllResults);
    
    // 验证每个查询都能找到结果
    expect(exportStatementResults.length).toBeGreaterThan(0);
    expect(exportDefaultResults.length).toBeGreaterThan(0);
    expect(exportNamedResults.length).toBeGreaterThan(0);
    expect(exportAllResults.length).toBeGreaterThan(0);
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
(export_default_declaration) @export
(export_named_declaration) @export
(export_all_declaration) @export
`;

    const combinedResults = treeSitterService.queryTree(parseResult.ast, combinedQuery);
    console.log('Combined export results:', combinedResults);
    
    const exportCaptures = combinedResults.flatMap(r => r.captures).filter(c => c.name === 'export');
    console.log('Combined export captures count:', exportCaptures.length);
    
    expect(exportCaptures.length).toBeGreaterThan(0);
  });
});
});