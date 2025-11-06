import { TreeSitterService } from '../../../service/parser/core/parse/TreeSitterService';
import { TreeSitterCoreService } from '../../../service/parser/core/parse/TreeSitterCoreService';
import { LoggerService } from '../../../utils/LoggerService';
import * as fs from 'fs';
import * as path from 'path';
import { QueryLoader } from '../../../service/parser/core/query/QueryLoader';
import { SimpleQueryEngine } from '../../../service/parser/core/query/TreeSitterQueryFacade';

describe('Go AST Full Workflow Test', () => {
  let treeSitterService: TreeSitterService;
  let treeSitterCoreService: TreeSitterCoreService;
  let logger: LoggerService;

  beforeAll(async () => {
    logger = new LoggerService();

    // 等待查询系统初始化
    await QueryLoader.loadLanguageQueries('go');

    // 初始化TreeSitter服务
    treeSitterCoreService = new TreeSitterCoreService();
    treeSitterService = new TreeSitterService(treeSitterCoreService);

    // 等待初始化完成
    const maxWaitTime = 10000;
    const startTime = Date.now();
    while (!treeSitterCoreService.isInitialized() && Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    expect(treeSitterCoreService.isInitialized()).toBe(true);
  }, 15000);

  it('should correctly parse and extract functions from Go file using TreeSitter', async () => {
    // 读取测试文件
    const goFilePath = path.join(process.cwd(), 'test-files', 'dataStructure', 'datastructure', 'linked_list.go');
    const content = fs.readFileSync(goFilePath, 'utf-8');

    logger.info('Testing Go file content parsing...');

    // 检测语言
    const detectedLanguage = await treeSitterService.detectLanguage(goFilePath);
    expect(detectedLanguage).toBeDefined();
    // 语言名称可能是 "Go" 或 "go"，都接受
    expect(['go', 'Go']).toContain(detectedLanguage?.name.toLowerCase());

    // 解析代码
    const parseResult = await treeSitterService.parseCode(content, detectedLanguage?.name || 'go');
    expect(parseResult.success).toBe(true);
    expect(parseResult.ast).toBeDefined();

    logger.info('Parse result success:', parseResult.success);

    // 使用SimpleQueryEngine提取函数
    const functions = await SimpleQueryEngine.findFunctions(parseResult.ast, detectedLanguage?.name.toLowerCase() || 'go');
    logger.info(`SimpleQueryEngine found ${functions.length} functions`);
    expect(functions.length).toBeGreaterThan(0);

    // 验证函数节点
    for (const func of functions) {
      const location = treeSitterService.getNodeLocation(func);
      const text = treeSitterService.getNodeText(func, content);

      expect(location.startLine).toBeGreaterThan(0);
      expect(location.endLine).toBeGreaterThan(0);
      expect(text.length).toBeGreaterThan(0);
      expect(['function_declaration']).toContain(func.type);
    }

    // 使用TreeSitterService提取函数
    const serviceFunctions = await treeSitterService.extractFunctions(parseResult.ast, detectedLanguage?.name.toLowerCase() || 'go');
    logger.info(`TreeSitterService found ${serviceFunctions.length} functions`);
    expect(serviceFunctions.length).toBeGreaterThan(0);

    // 验证函数内容
    const functionContents = serviceFunctions.map(func => treeSitterService.getNodeText(func, content));

    // 应该包含NewLinkedList函数
    expect(functionContents.some(content => content.includes('func NewLinkedList()'))).toBe(true);

    // 应该包含ListIsEmpty函数
    expect(functionContents.some(content => content.includes('func ListIsEmpty('))).toBe(true);

    // 应该包含Append函数
    expect(functionContents.some(content => content.includes('func Append('))).toBe(true);

    // 应该包含PrintList函数
    expect(functionContents.some(content => content.includes('func PrintList('))).toBe(true);

    // 应该包含DeleteNode函数
    expect(functionContents.some(content => content.includes('func DeleteNode('))).toBe(true);

    // 应该包含main函数
    expect(functionContents.some(content => content.includes('func main()'))).toBe(true);
  }, 15000);

  it('should correctly extract classes (structs) from Go file', async () => {
    // 读取测试文件
    const goFilePath = path.join(process.cwd(), 'test-files', 'dataStructure', 'datastructure', 'linked_list.go');
    const content = fs.readFileSync(goFilePath, 'utf-8');

    // 解析代码
    const parseResult = await treeSitterService.parseCode(content, 'go');
    expect(parseResult.success).toBe(true);
    expect(parseResult.ast).toBeDefined();

    // 使用SimpleQueryEngine提取类
    const classes = await SimpleQueryEngine.findClasses(parseResult.ast, 'go');
    logger.info(`SimpleQueryEngine found ${classes.length} classes`);

    // 使用TreeSitterService提取类
    const serviceClasses = await treeSitterService.extractClasses(parseResult.ast, 'go');
    logger.info(`TreeSitterService found ${serviceClasses.length} classes`);
    expect(serviceClasses.length).toBeGreaterThan(0);

    // 验证类节点 - Go语言中结构体的节点类型可能是struct_type而不是type_declaration
    for (const cls of serviceClasses) {
      const location = treeSitterService.getNodeLocation(cls);
      const text = treeSitterService.getNodeText(cls, content);

      expect(location.startLine).toBeGreaterThan(0);
      expect(location.endLine).toBeGreaterThan(0);
      expect(text.length).toBeGreaterThan(0);
      // Go语言中结构体的节点类型可能是struct_type或type_declaration
      expect(['type_declaration', 'struct_type']).toContain(cls.type);
    }

    // 验证类内容
    const classContents = serviceClasses.map(cls => treeSitterService.getNodeText(cls, content));

    // 应该包含node结构体
    expect(classContents.some(content => content.includes('type node struct'))).toBe(true);

    // 应该包含linkedList结构体
    expect(classContents.some(content => content.includes('type linkedList struct'))).toBe(true);
  }, 15000);
});