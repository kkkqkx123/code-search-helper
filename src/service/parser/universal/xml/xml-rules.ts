/**
 * XML 文件分段规则配置
 * 专门处理 XML 文件的分段策略和规则
 */

export interface XMLChunkingConfig {
  // 分段大小限制
  minChunkSize: number;        // 最小分段大小（字符数）
  maxChunkSize: number;        // 最大分段大小（字符数）
  minLinesPerChunk: number;    // 最小行数
  maxLinesPerChunk: number;    // 最大行数
  
  // 元素处理
  preserveRootElement: boolean;   // 保持根元素完整
  preserveComplexElements: boolean; // 保持复杂元素完整
  mergeAttributes: boolean;       // 合并属性到父元素
  
  // 特殊元素处理
  preserveComments: boolean;      // 保持注释完整
  preserveCDATA: boolean;         // 保持CDATA完整
  preserveProcessingInstructions: boolean; // 保持处理指令完整
  
  // 合并策略
  mergeShortElements: boolean;    // 合并短元素
  mergeSiblingElements: boolean;  // 合并兄弟元素
  mergeNestedElements: boolean;   // 合并嵌套元素
  
  // 语义分析
  enableSemanticMerge: boolean;      // 启用语义合并
  semanticSimilarityThreshold: number; // 语义相似度阈值
  
  // 命名空间处理
  handleNamespaces: boolean;        // 处理命名空间
  namespaceAware: boolean;          // 命名空间感知
}

/**
 * XML 正则表达式模式
 */
export const XML_PATTERNS = {
  // XML 声明
  XML_DECLARATION: /<\?xml\s+version="[^"]*"\s*(encoding="[^"]*")?\s*\?>/i,
  
  // 文档类型定义
  DOCTYPE: /<!DOCTYPE\s+[^>]*>/i,
  
  // 处理指令
  PROCESSING_INSTRUCTION: /<\?[^?>]+\?>/g,
  
  // 注释
  COMMENT: /<!--[\s\S]*?-->/g,
  
  // CDATA
  CDATA: /<!\[CDATA\[[\s\S]*?\]\]>/g,
  
  // 元素标签
  OPENING_TAG: /<([a-zA-Z_:][\w:.-]*)(\s[^>]*)?>/g,
  CLOSING_TAG: /<\/([a-zA-Z_:][\w:.-]*)\s*>/g,
  SELF_CLOSING_TAG: /<([a-zA-Z_:][\w:.-]*)(\s[^>]*)?\/>/g,
  
  // 属性
  ATTRIBUTE: /\s([a-zA-Z_:][\w:.-]*)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g,
  
  // 文本内容
  TEXT_CONTENT: />([^<]+)</g,
  
  // 空元素
  EMPTY_ELEMENT: /<([a-zA-Z_:][\w:.-]*)(\s[^>]*)?\/>/g,
  
  // 根元素
  ROOT_ELEMENT: /^<([a-zA-Z_:][\w:.-]*)(\s[^>]*)?>[\s\S]*<\/\1>$/i,
  
  // 命名空间声明
  NAMESPACE_DECLARATION: /\sxmlns(?::([a-zA-Z_][\w.-]*))?\s*=\s*("[^"]*"|'[^']*')/g,
  
  // 实体引用
  ENTITY_REFERENCE: /&[a-zA-Z][\w.-]*;/g,
  NUMERIC_ENTITY: /&#[0-9]+;/g,
  HEX_ENTITY: /&#x[0-9a-fA-F]+;/g
} as const;

/**
 * XML 块类型定义
 */
export enum XMLBlockType {
  XML_DECLARATION = 'xml_declaration',
  DOCTYPE = 'doctype',
  PROCESSING_INSTRUCTION = 'processing_instruction',
  COMMENT = 'comment',
  CDATA = 'cdata',
  ELEMENT = 'element',
  TEXT = 'text',
  ROOT_ELEMENT = 'root_element',
  EMPTY_ELEMENT = 'empty_element',
  SELF_CLOSING_ELEMENT = 'self_closing_element'
}

/**
 * XML 分段配置默认值
 */
export const DEFAULT_XML_CONFIG: XMLChunkingConfig = {
  minChunkSize: 200,      // 最小200字符
  maxChunkSize: 1500,     // 最大1500字符
  minLinesPerChunk: 2,    // 最少2行
  maxLinesPerChunk: 50,   // 最多50行
  
  // 元素处理
  preserveRootElement: true,
  preserveComplexElements: true,
  mergeAttributes: true,
  
  // 特殊元素处理
  preserveComments: true,
  preserveCDATA: true,
  preserveProcessingInstructions: true,
  
  // 合并策略
  mergeShortElements: true,
  mergeSiblingElements: true,
  mergeNestedElements: false,
  
  // 语义分析
  enableSemanticMerge: true,
  semanticSimilarityThreshold: 0.6,
  
  // 命名空间处理
  handleNamespaces: true,
  namespaceAware: true
};

/**
 * XML 语义分数权重
 */
export const XML_SEMANTIC_WEIGHTS = {
  [XMLBlockType.XML_DECLARATION]: 8,
  [XMLBlockType.DOCTYPE]: 7,
  [XMLBlockType.ROOT_ELEMENT]: 10,
  [XMLBlockType.ELEMENT]: 5,
  [XMLBlockType.SELF_CLOSING_ELEMENT]: 3,
  [XMLBlockType.EMPTY_ELEMENT]: 2,
  [XMLBlockType.PROCESSING_INSTRUCTION]: 4,
  [XMLBlockType.COMMENT]: 2,
  [XMLBlockType.CDATA]: 6,
  [XMLBlockType.TEXT]: 1
} as const;

/**
 * 判断是否为 XML 文件
 */
export function isXMLFile(filePath: string): boolean {
  const xmlExtensions = ['.xml', '.xhtml', '.xsd', '.xsl', '.xslt', '.svg', '.rss', '.atom'];
  const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
  return xmlExtensions.includes(ext);
}

/**
 * 获取元素名称
 */
export function getElementName(tag: string): string {
  const match = tag.match(XML_PATTERNS.OPENING_TAG);
  if (match && match[1]) {
    return match[1];
  }
  
  const closingMatch = tag.match(XML_PATTERNS.CLOSING_TAG);
  if (closingMatch && closingMatch[1]) {
    return closingMatch[1];
  }
  
  const selfClosingMatch = tag.match(XML_PATTERNS.SELF_CLOSING_TAG);
  if (selfClosingMatch && selfClosingMatch[1]) {
    return selfClosingMatch[1];
  }
  
  return '';
}

/**
 * 判断是否为开始标签
 */
export function isOpeningTag(line: string): boolean {
  return XML_PATTERNS.OPENING_TAG.test(line.trim()) && !XML_PATTERNS.SELF_CLOSING_TAG.test(line.trim());
}

/**
 * 判断是否为结束标签
 */
export function isClosingTag(line: string): boolean {
  return XML_PATTERNS.CLOSING_TAG.test(line.trim());
}

/**
 * 判断是否为自闭合标签
 */
export function isSelfClosingTag(line: string): boolean {
  return XML_PATTERNS.SELF_CLOSING_TAG.test(line.trim());
}

/**
 * 判断是否为注释
 */
export function isComment(line: string): boolean {
  return XML_PATTERNS.COMMENT.test(line.trim());
}

/**
 * 判断是否为 CDATA
 */
export function isCDATA(line: string): boolean {
  return XML_PATTERNS.CDATA.test(line.trim());
}

/**
 * 判断是否为处理指令
 */
export function isProcessingInstruction(line: string): boolean {
  return XML_PATTERNS.PROCESSING_INSTRUCTION.test(line.trim());
}

/**
 * 判断是否为 XML 声明
 */
export function isXMLDeclaration(line: string): boolean {
  return XML_PATTERNS.XML_DECLARATION.test(line.trim());
}

/**
 * 判断是否为文档类型定义
 */
export function isDOCTYPE(line: string): boolean {
  return XML_PATTERNS.DOCTYPE.test(line.trim());
}

/**
 * 获取块类型
 */
export function getXMLBlockType(line: string, inElement: boolean, elementStack: string[]): XMLBlockType {
  const trimmed = line.trim();
  
  if (!trimmed) return XMLBlockType.TEXT;
  if (inElement && !isOpeningTag(trimmed) && !isClosingTag(trimmed)) return XMLBlockType.TEXT;
  
  if (isXMLDeclaration(trimmed)) return XMLBlockType.XML_DECLARATION;
  if (isDOCTYPE(trimmed)) return XMLBlockType.DOCTYPE;
  if (isComment(trimmed)) return XMLBlockType.COMMENT;
  if (isCDATA(trimmed)) return XMLBlockType.CDATA;
  if (isProcessingInstruction(trimmed)) return XMLBlockType.PROCESSING_INSTRUCTION;
  if (isSelfClosingTag(trimmed)) return XMLBlockType.SELF_CLOSING_ELEMENT;
  if (isOpeningTag(trimmed)) return XMLBlockType.ELEMENT;
  if (isClosingTag(trimmed)) return XMLBlockType.ELEMENT;
  
  return XMLBlockType.TEXT;
}

/**
 * 计算语义相似度（基于元素结构和属性）
 */
export function calculateXMLSemanticSimilarity(xml1: string, xml2: string): number {
  const element1 = extractXMLElementInfo(xml1);
  const element2 = extractXMLElementInfo(xml2);
  
  if (!element1.name || !element2.name) return 0;
  
  // 元素名称相似度
  const nameSimilarity = element1.name === element2.name ? 1 : 0;
  
  // 属性相似度
  const attr1 = Object.keys(element1.attributes);
  const attr2 = Object.keys(element2.attributes);
  
  if (attr1.length === 0 && attr2.length === 0) return nameSimilarity;
  
  const intersection = attr1.filter(attr => attr2.includes(attr));
  const union = [...new Set([...attr1, ...attr2])];
  const attrSimilarity = union.length > 0 ? intersection.length / union.length : 0;
  
  // 综合相似度
  return (nameSimilarity * 0.7 + attrSimilarity * 0.3);
}

/**
 * 提取 XML 元素信息
 */
function extractXMLElementInfo(xml: string): {
  name: string;
  attributes: Record<string, string>;
  hasChildren: boolean;
  isSelfClosing: boolean;
} {
  const name = getElementName(xml);
  const attributes: Record<string, string> = {};
  let hasChildren = false;
  let isSelfClosing = false;
  
  // 提取属性
  const attrMatches = xml.match(XML_PATTERNS.ATTRIBUTE);
  if (attrMatches) {
    attrMatches.forEach(attr => {
      const match = attr.match(/\s([a-zA-Z_:][\w:.-]*)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/);
      if (match) {
        const attrName = match[1];
        const attrValue = match[2].replace(/^["']|["']$/g, ''); // 移除引号
        attributes[attrName] = attrValue;
      }
    });
  }
  
  // 检查是否有子元素
  hasChildren = xml.includes('</') && !isSelfClosingTag(xml);
  
  // 检查是否为自闭合
  isSelfClosing = isSelfClosingTag(xml);
  
  return {
    name,
    attributes,
    hasChildren,
    isSelfClosing
  };
}

/**
 * 提取关键词（用于语义分析）
 */
function extractXMLKeywords(text: string): string[] {
  // 提取元素名称、属性名称作为关键词
  const keywords: string[] = [];
  
  // 提取元素名称
  const elementMatches = text.match(XML_PATTERNS.OPENING_TAG);
  if (elementMatches) {
    elementMatches.forEach(match => {
      const name = getElementName(match);
      if (name) keywords.push(name);
    });
  }
  
  // 提取属性名称
  const attrMatches = text.match(XML_PATTERNS.ATTRIBUTE);
  if (attrMatches) {
    attrMatches.forEach(attr => {
      const match = attr.match(/\s([a-zA-Z_:][\w:.-]*)\s*=/);
      if (match) {
        keywords.push(match[1]);
      }
    });
  }
  
  return [...new Set(keywords)]; // 去重
}

/**
 * 判断是否为常见 XML 元素
 */
function isCommonXMLElement(elementName: string): boolean {
  const commonElements = [
    'xml', 'root', 'config', 'configuration', 'settings', 'data',
    'item', 'entry', 'element', 'node', 'property', 'attribute',
    'header', 'body', 'footer', 'content', 'text', 'value',
    'name', 'id', 'type', 'class', 'style', 'href', 'src'
  ];
  
  return commonElements.includes(elementName.toLowerCase());
}