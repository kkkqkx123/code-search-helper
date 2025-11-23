/**
 * 查询结果处理工具函数
 * 包含从BaseLanguageAdapter中提取的无状态工具方法
 */

import Parser from 'tree-sitter';
import { StandardizedQueryResult } from '../../types';
import { MetadataBuilder } from '../../utils/MetadataBuilder';
import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import { ContentHashUtils } from '../../../../../../utils/cache/ContentHashUtils';

/**
 * 提取起始行号
 */
export function extractStartLine(result: any): number {
  const mainNode = result.captures?.[0]?.node;
  return (mainNode?.startPosition?.row || 0) + 1;
}

/**
 * 提取结束行号
 */
export function extractEndLine(result: any): number {
  const mainNode = result.captures?.[0]?.node;
  return (mainNode?.endPosition?.row || 0) + 1;
}

/**
 * 提取内容
 */
export function extractContent(result: any): string {
  const mainNode = result.captures?.[0]?.node;
  return mainNode?.text || '';
}

/**
 * 提取起始列号
 */
export function extractStartColumn(result: any): number {
  const mainNode = result.captures?.[0]?.node;
  return mainNode?.startPosition?.column || 0;
}

/**
 * 提取结束列号
 */
export function extractEndColumn(result: any): number {
  const mainNode = result.captures?.[0]?.node;
  return mainNode?.endPosition?.column || 0;
}

/**
 * 检查是否为关系类型
 */
export function isRelationshipType(type: string): boolean {
  const relationshipTypes = [
    'call', 'data-flow', 'inheritance', 'concurrency', 'lifecycle',
    'semantic', 'control-flow', 'dependency', 'reference', 'creation', 'annotation'
 ];
  return relationshipTypes.includes(type);
}

/**
 * 判断是否应该创建符号信息
 */
export function shouldCreateSymbolInfo(standardType: string): boolean {
  const entityTypes = ['function', 'class', 'method', 'variable', 'import', 'interface', 'type'];
  return entityTypes.includes(standardType);
}

/**
 * 映射到符号类型
 */
export function mapToSymbolType(standardType: string): 'function' | 'method' | 'class' | 'interface' | 'variable' | 'import' {
  const mapping: Record<string, 'function' | 'method' | 'class' | 'interface' | 'variable' | 'import'> = {
    'function': 'function',
    'method': 'method',
    'class': 'class',
    'interface': 'interface',
    'variable': 'variable',
    'import': 'import'
  };
  return mapping[standardType] || 'variable';
}

/**
 * 确定作用域
 */
export function determineScope(node: Parser.SyntaxNode): 'global' | 'function' | 'class' {
  // 默认作用域确定逻辑
  let current = node.parent;
 while (current) {
    if (isFunctionScope(current)) {
      return 'function';
    }
    if (isClassScope(current)) {
      return 'class';
    }
    current = current.parent;
  }
  return 'global';
}

/**
 * 检查是否为函数作用域
 */
export function isFunctionScope(node: Parser.SyntaxNode): boolean {
  const functionTypes = [
    'function_declaration', 'function_expression', 'arrow_function',
    'method_definition', 'constructor_definition'
  ];
 return functionTypes.includes(node.type);
}

/**
 * 检查是否为类作用域
 */
export function isClassScope(node: Parser.SyntaxNode): boolean {
  const classTypes = [
    'class_declaration', 'class_definition', 'interface_declaration',
    'struct_specifier', 'enum_specifier'
  ];
  return classTypes.includes(node.type);
}

/**
 * 提取参数
 */
export function extractParameters(node: Parser.SyntaxNode): string[] {
  const parameters: string[] = [];
  const parameterList = node.childForFieldName?.('parameters');
  if (parameterList) {
    for (const child of parameterList.children) {
      if (child.type === 'identifier' || child.type === 'formal_parameter') {
        const declarator = child.childForFieldName?.('declarator') || child;
        if (declarator?.text) {
          parameters.push(declarator.text);
        }
      }
    }
  }
  return parameters;
}

/**
 * 提取导入路径
 */
export function extractImportPath(node: Parser.SyntaxNode): string | undefined {
  // 默认导入路径提取逻辑
  if (node.type === 'import_statement' || node.type === 'import_declaration') {
    const pathNode = node.childForFieldName('source') || node.childForFieldName('name');
    return pathNode ? pathNode.text.replace(/['"]/g, '') : undefined;
  }
 return undefined;
}

/**
 * 预处理查询结果
 */
export function preprocessResults(queryResults: any[]): any[] {
  return queryResults.filter(result =>
    result &&
    result.captures &&
    Array.isArray(result.captures) &&
    result.captures.length > 0 &&
    result.captures[0]?.node
  );
}

/**
 * 创建标准化结果
 */
export function createStandardizedResult(
  result: any, 
  queryType: string, 
  language: string,
  mapQueryTypeToStandardType: (queryType: string) => StandardizedQueryResult['type'],
  extractName: (result: any) => string,
  extractDependencies: (result: any) => string[],
  extractModifiers: (result: any) => string[],
  extractLanguageSpecificMetadata: (result: any) => Record<string, any>,
  calculateComplexity: (result: any) => number
): StandardizedQueryResult {
  const astNode = result.captures?.[0]?.node;
  const nodeId = NodeIdGenerator.safeForAstNode(astNode, queryType, extractName(result) || 'unknown');

  // Use MetadataBuilder to create enhanced metadata
  const metadataBuilder = createMetadataBuilder(
    result, 
    language,
    calculateComplexity,
    extractDependencies,
    extractModifiers,
    extractLanguageSpecificMetadata
  );

  return {
    nodeId,
    type: mapQueryTypeToStandardType(queryType),
    name: extractName(result),
    startLine: extractStartLine(result),
    endLine: extractEndLine(result),
    content: extractContent(result),
    metadata: metadataBuilder.build()
  };
}

/**
 * 创建增强的元数据构建器
 */
export function createMetadataBuilder(
  result: any, 
  language: string,
  calculateComplexity: (result: any) => number,
  extractDependencies: (result: any) => string[],
  extractModifiers: (result: any) => string[],
  extractLanguageSpecificMetadata: (result: any) => Record<string, any>
): MetadataBuilder {
  const builder = new MetadataBuilder()
    .setLanguage(language)
    .setComplexity(calculateComplexity(result))
    .addDependencies(extractDependencies(result))
    .addModifiers(extractModifiers(result))
    .setLocation(result.filePath || '', extractStartLine(result), extractStartColumn(result) || 0)
    .setRange(
      extractStartLine(result),
      extractEndLine(result),
      extractStartColumn(result) || 0,
      extractEndColumn(result) || 0
    )
    .setCodeSnippet(extractContent(result));

  const languageSpecificMetadata = extractLanguageSpecificMetadata(result);

  // Add language-specific metadata as custom fields
  builder.addCustomFields(languageSpecificMetadata);

  return builder;
}

/**
 * 生成唯一键
 */
export function generateUniqueKey(result: StandardizedQueryResult): string {
 return `${result.type}:${result.name}:${result.startLine}:${result.endLine}`;
}

/**
 * 合并元数据
 */
export function mergeMetadata(existing: StandardizedQueryResult, newResult: StandardizedQueryResult): void {
  // Use MetadataBuilder to properly merge metadata
  const existingBuilder = MetadataBuilder.fromComplete(existing.metadata);
  const newBuilder = MetadataBuilder.fromComplete(newResult.metadata);

  // Merge the metadata using the builder's merge method
  existingBuilder.merge(newBuilder);

  // Update the existing result with merged metadata
  existing.metadata = existingBuilder.build();
}

/**
 * 使用广度优先迭代算法计算嵌套深度
 * 替代原有的递归实现，避免栈溢出
 */
export function calculateNestingDepthIterative(startNode: any): number {
  if (!startNode || !startNode.children) {
    return 0;
  }

  let maxDepth = 0;
  const queue: Array<{ node: any, depth: number }> = [];
  queue.push({ node: startNode, depth: 0 });

  while (queue.length > 0) {
    const { node, depth } = queue.shift()!;
    maxDepth = Math.max(maxDepth, depth);

    if (node.children && depth < 15) { // 设置合理的深度上限
      for (const child of node.children) {
        if (isBlockNode(child)) {
          queue.push({ node: child, depth: depth + 1 });
        }
      }
    }
  }

  return maxDepth;
}

/**
 * 检查是否为块节点
 */
export function isBlockNode(node: any): boolean {
  const blockTypes = [
    'block', 'statement_block', 'class_body', 'interface_body', 'suite',
    'function_definition', 'method_definition', 'class_definition',
    'if_statement', 'for_statement', 'while_statement',
    'switch_statement', 'try_statement', 'catch_clause',
    'object_expression', 'array_expression'
  ];

  return blockTypes.includes(node.type);
}

/**
 * 计算节点结构复杂度
 * 考虑：块节点数量、嵌套模式复杂度
 */
export function calculateNodeComplexity(node: any): number {
  let nodeScore = 0;
  let blockNodeCount = 0;

  // 使用迭代方式统计块节点数量
  const nodeQueue: any[] = [node];
  const visited = new Set<any>();

  while (nodeQueue.length > 0) {
    const currentNode = nodeQueue.shift()!;

    if (visited.has(currentNode)) {
      continue;
    }
    visited.add(currentNode);

    if (isBlockNode(currentNode)) {
      blockNodeCount++;
    }

    if (currentNode.children) {
      for (const child of currentNode.children) {
        if (!visited.has(child)) {
          nodeQueue.push(child);
        }
      }
    }
  }

  // 基于块节点数量的复杂度加成
 if (blockNodeCount > 20) {
    nodeScore += 3;
  } else if (blockNodeCount > 10) {
    nodeScore += 2;
  } else if (blockNodeCount > 5) {
    nodeScore += 1;
  }

  return nodeScore;
}

/**
 * 生成节点缓存键
 */
export function getNodeCacheKey(node: any): string {
  if (node.id) {
    return `${node.type}:${node.id}`;
  }
 if (node.startPosition && node.endPosition) {
    return `${node.type}:${node.startPosition.row}:${node.startPosition.column}-${node.endPosition.row}:${node.endPosition.column}`;
  }
  return `${node.type}:${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 查找类型引用
 */
export function findTypeReferences(node: any, dependencies: string[]): void {
  if (!node || !node.children) {
    return;
  }

  for (const child of node.children) {
    if (child.type === 'type_identifier' || child.type === 'identifier') {
      const text = child.text;
      if (text && text[0] === text[0].toUpperCase()) {
        dependencies.push(text);
      }
    }

    findTypeReferences(child, dependencies);
  }
}

/**
 * 哈希查询结果
 */
export function hashResults(queryResults: any[]): string {
  const content = queryResults.map(r => r?.captures?.[0]?.node?.text || '').join('|');
  return simpleHash(content);
}

/**
 * 简单哈希函数
 */
export function simpleHash(str: string): string {
  return ContentHashUtils.generateContentHash(str);
}