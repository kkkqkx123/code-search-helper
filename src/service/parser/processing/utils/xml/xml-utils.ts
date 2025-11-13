/**
 * XML 工具函数集合
 * 包含 XML 处理中常用的工具函数
 */

import { XML_PATTERNS } from './xml-rules';

/**
 * 判断是否为 XML 声明
 * @param line 要检查的文本行
 * @returns 如果是 XML 声明则返回 true
 */
export function isXMLDeclaration(line: string): boolean {
  return XML_PATTERNS.XML_DECLARATION.test(line.trim());
}

/**
 * 判断是否为文档类型定义
 * @param line 要检查的文本行
 * @returns 如果是 DOCTYPE 则返回 true
 */
export function isDOCTYPE(line: string): boolean {
  return XML_PATTERNS.DOCTYPE.test(line.trim());
}