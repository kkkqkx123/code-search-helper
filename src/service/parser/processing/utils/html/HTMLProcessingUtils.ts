/**
 * HTML处理工具类
 * 提取与tree-sitter解析无关的HTML处理功能
 */

import { ScriptBlock, StyleBlock } from './LayeredHTMLConfig';

/**
 * HTML处理工具类
 */
export class HTMLProcessingUtils {
  /**
   * 计算开标签数量
   */
  static countOpeningTags(line: string): number {
    const matches = line.match(/<[^\/][^>]*>/g);
    return matches ? matches.length : 0;
  }

  /**
   * 计算闭标签数量
   */
  static countClosingTags(line: string): number {
    const matches = line.match(/<\/[^>]*>/g);
    return matches ? matches.length : 0;
  }

  /**
   * 计算复杂度
   */
  static calculateComplexity(content: string): number {
    let complexity = 1;

    // 基于长度
    complexity += Math.log10(content.length + 1);

    // 基于行数
    const lines = content.split('\n').length;
    complexity += Math.log10(lines + 1);

    // 基于关键字数量（简单实现）
    const keywords = content.match(/\b(function|class|const|let|var|if|for|while|return|import|export)\b/g);
    if (keywords) {
      complexity += keywords.length * 0.5;
    }

    return Math.round(Math.max(1, complexity));
  }

  /**
   * 处理HTML结构
   */
  static processHTMLStructure(content: string, startLine: number = 1): any[] {
    const chunks: any[] = [];
    const lines = content.split('\n');

    // 简单的HTML结构分段，基于标签平衡
    let currentChunk: string[] = [];
    let currentLine = startLine;
    let tagDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      currentChunk.push(line);

      // 计算标签深度
      tagDepth += this.countOpeningTags(line);
      tagDepth -= this.countClosingTags(line);

      // 分段条件：标签平衡且达到最小大小
      const chunkContent = currentChunk.join('\n');
      const shouldSplit = (tagDepth === 0 && currentChunk.length >= 5) ||
        chunkContent.length > 2000 ||
        i === lines.length - 1;

      if (shouldSplit) {
        chunks.push({
          content: chunkContent,
          startLine: currentLine,
          endLine: currentLine + currentChunk.length - 1,
          language: 'html',
          type: 'structure',
          complexity: this.calculateComplexity(chunkContent)
        });

        currentChunk = [];
        currentLine = i + 1;
        tagDepth = 0;
      }
    }

    // 处理剩余内容
    if (currentChunk.length > 0) {
      const chunkContent = currentChunk.join('\n');
      chunks.push({
        content: chunkContent,
        startLine: currentLine,
        endLine: currentLine + currentChunk.length - 1,
        language: 'html',
        type: 'structure',
        complexity: this.calculateComplexity(chunkContent)
      });
    }

    return chunks;
  }

  /**
   * 生成脚本缓存键
   */
  static generateScriptCacheKey(script: ScriptBlock): string {
    const attrSignature = Object.keys(script.attributes)
      .sort()
      .map(key => `${key}:${script.attributes[key]}`)
      .join('|');
    return `${script.contentHash}_${script.language}_${attrSignature}`;
  }

  /**
   * 生成样式缓存键
   */
  static generateStyleCacheKey(style: StyleBlock): string {
    const attrSignature = Object.keys(style.attributes)
      .sort()
      .map(key => `${key}:${style.attributes[key]}`)
      .join('|');
    return `${style.contentHash}_${style.styleType}_${attrSignature}`;
  }

  /**
   * 分析脚本属性
   */
  static analyzeScriptAttributes(attributes: Record<string, string>) {
    return {
      isModule: attributes.type === 'module',
      isAsync: attributes.async === 'true',
      isDefer: attributes.defer === 'true',
      hasSrc: !!attributes.src,
      isTypeScript: attributes.lang === 'ts' || attributes.type?.includes('typescript'),
      isJSON: attributes.type === 'json',
      hasCrossorigin: !!attributes.crossorigin,
      isNomodule: attributes.nomodule === 'true'
    };
  }

  /**
   * 分析样式属性
   */
  static analyzeStyleAttributes(attributes: Record<string, string>) {
    return {
      isSCSS: attributes.lang === 'scss' || attributes.type?.includes('scss'),
      isLESS: attributes.lang === 'less' || attributes.type?.includes('less'),
      isInline: attributes.type === 'inline',
      hasMedia: !!attributes.media,
      hasScope: !!attributes.scoped,
      isPreprocessor: attributes.lang === 'scss' || attributes.lang === 'less' ||
        attributes.type?.includes('scss') || attributes.type?.includes('less')
    };
  }
}