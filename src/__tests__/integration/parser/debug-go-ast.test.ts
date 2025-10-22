import { TreeSitterService } from '../../../service/parser/core/parse/TreeSitterService';
import { TreeSitterCoreService } from '../../../service/parser/core/parse/TreeSitterCoreService';
import { LoggerService } from '../../../utils/LoggerService';
import * as fs from 'fs';
import * as path from 'path';

describe('Debug Go AST Analysis', () => {
  let treeSitterService: TreeSitterService;
  let logger: LoggerService;

  beforeAll(() => {
    logger = new LoggerService();
    const treeSitterCoreService = new TreeSitterCoreService();
    treeSitterService = new TreeSitterService(treeSitterCoreService);
  });

  it('should analyze Go file AST and show node types', async () => {
    const goFilePath = path.join(process.cwd(), 'test-files', 'dataStructure', 'datastructure', 'linked_list.go');
    const content = fs.readFileSync(goFilePath, 'utf-8');
    
    logger.info('Analyzing Go file content:');
    logger.info(content);
    
    const parseResult = await treeSitterService.parseCode(content, 'go');
    
    if (parseResult.success && parseResult.ast) {
      logger.info('AST root node type:', parseResult.ast.type);
      
      // 遍历AST结构
      const traverse = (node: any, depth = 0) => {
        if (depth > 3) return; // 限制深度以避免输出过多
        
        const indent = '  '.repeat(depth);
        logger.info(`${indent}Node: ${node.type} (${node.startLine}-${node.endLine})`);
        
        if (node.children && Array.isArray(node.children)) {
          for (const child of node.children) {
            traverse(child, depth + 1);
          }
        }
      };
      
      logger.info('AST structure:');
      traverse(parseResult.ast);
      
      // 提取函数并显示详细信息
      const functions = await treeSitterService.extractFunctions(parseResult.ast);
      logger.info(`Found ${functions.length} functions:`);
      
      for (const func of functions) {
        logger.info(`Function node type: ${func.type}`);
        const startLine = func.startPosition.row + 1;
        const endLine = func.endPosition.row + 1;
        logger.info(`Function location: ${startLine}-${endLine}`);
        const funcContent = content.split('\n').slice(startLine - 1, endLine).join('\n');
        logger.info(`Function content: ${funcContent}`);
      }
      
      // 检查是否有Go特定的函数节点类型
      const allNodeTypes = new Set<string>();
      const collectTypes = (node: any) => {
        allNodeTypes.add(node.type);
        if (node.children && Array.isArray(node.children)) {
          for (const child of node.children) {
            collectTypes(child);
          }
        }
      };
      collectTypes(parseResult.ast);
      
      logger.info('All node types found in AST:', Array.from(allNodeTypes).sort());
      
    } else {
      logger.error('Failed to parse Go file:', parseResult.error);
    }
  });
});