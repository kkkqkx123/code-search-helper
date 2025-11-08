import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import {
  IHTMLContentExtractor,
  ScriptBlock,
  StyleBlock
} from './LayeredHTMLConfig';
import { ContentHashUtils } from '../../../../../utils/ContentHashUtils';

/**
 * HTML内容提取器
 * 负责从HTML内容中提取Script和Style块
 */
@injectable()
export class HTMLContentExtractor implements IHTMLContentExtractor {
  private logger?: LoggerService;

  constructor(@inject(TYPES.LoggerService) logger?: LoggerService) {
    this.logger = logger;
  }

  /**
   * 提取Script块
   */
  extractScripts(content: string): ScriptBlock[] {
    const scriptBlocks: ScriptBlock[] = [];
    
    // 使用正则表达式匹配script标签
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    let index = 0;

    while ((match = scriptRegex.exec(content)) !== null) {
      const fullMatch = match[0];
      const scriptContent = match[1];
      const startPosition = match.index;
      const endPosition = startPosition + fullMatch.length;

      // 计算行号和列号
      const position = this.calculatePosition(content, startPosition);

      // 提取script标签属性
      const attributes = this.extractAttributes(fullMatch);

      // 检测语言类型
      const language = this.detectScriptLanguage(fullMatch);

      // 生成内容哈希
      const contentHash = this.generateContentHash(scriptContent);

      const scriptBlock: ScriptBlock = {
        id: `script_${index}`,
        content: scriptContent.trim(),
        language,
        position: {
          start: startPosition,
          end: endPosition,
          line: position.line,
          column: position.column
        },
        attributes,
        contentHash
      };

      scriptBlocks.push(scriptBlock);
      index++;

      this.logger?.debug(`Extracted script block: ${scriptBlock.id}, language: ${language}`);
    }

    this.logger?.info(`Extracted ${scriptBlocks.length} script blocks`);
    return scriptBlocks;
  }

  /**
   * 提取Style块
   */
  extractStyles(content: string): StyleBlock[] {
    const styleBlocks: StyleBlock[] = [];
    
    // 使用正则表达式匹配style标签
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let match;
    let index = 0;

    while ((match = styleRegex.exec(content)) !== null) {
      const fullMatch = match[0];
      const styleContent = match[1];
      const startPosition = match.index;
      const endPosition = startPosition + fullMatch.length;

      // 计算行号和列号
      const position = this.calculatePosition(content, startPosition);

      // 提取style标签属性
      const attributes = this.extractAttributes(fullMatch);

      // 检测样式类型
      const styleType = this.detectStyleType(fullMatch);

      // 生成内容哈希
      const contentHash = this.generateContentHash(styleContent);

      const styleBlock: StyleBlock = {
        id: `style_${index}`,
        content: styleContent.trim(),
        styleType,
        position: {
          start: startPosition,
          end: endPosition,
          line: position.line,
          column: position.column
        },
        attributes,
        contentHash
      };

      styleBlocks.push(styleBlock);
      index++;

      this.logger?.debug(`Extracted style block: ${styleBlock.id}, type: ${styleType}`);
    }

    this.logger?.info(`Extracted ${styleBlocks.length} style blocks`);
    return styleBlocks;
  }

  /**
   * 检测Script语言类型
   */
  detectScriptLanguage(scriptTag: string): ScriptBlock['language'] {
    // 检查type属性
    const typeMatch = scriptTag.match(/type=["']([^"']+)["']/i);
    if (typeMatch) {
      const type = typeMatch[1].toLowerCase();
      
      if (type.includes('javascript') || type.includes('babel')) {
        return 'javascript';
      }
      if (type.includes('typescript')) {
        return 'typescript';
      }
      if (type.includes('json')) {
        return 'json';
      }
    }

    // 检查lang属性
    const langMatch = scriptTag.match(/lang=["']([^"']+)["']/i);
    if (langMatch) {
      const lang = langMatch[1].toLowerCase();
      if (lang.includes('ts') || lang.includes('typescript')) {
        return 'typescript';
      }
    }

    // 检查src属性中的文件扩展名
    const srcMatch = scriptTag.match(/src=["']([^"']+)["']/i);
    if (srcMatch) {
      const src = srcMatch[1].toLowerCase();
      if (src.endsWith('.ts') || src.includes('typescript')) {
        return 'typescript';
      }
      if (src.endsWith('.mjs') || src.includes('module')) {
        return 'javascript';
      }
    }

    // 检查内容中的TypeScript特征
    const contentMatch = scriptTag.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    if (contentMatch && contentMatch[1]) {
      const content = contentMatch[1];
      if (this.hasTypeScriptFeatures(content)) {
        return 'typescript';
      }
    }

    // 默认为JavaScript
    return 'javascript';
  }

  /**
   * 检测Style类型
   */
  detectStyleType(styleTag: string): StyleBlock['styleType'] {
    // 检查type属性
    const typeMatch = styleTag.match(/type=["']([^"']+)["']/i);
    if (typeMatch) {
      const type = typeMatch[1].toLowerCase();
      
      if (type.includes('scss')) {
        return 'scss';
      }
      if (type.includes('less')) {
        return 'less';
      }
      if (type.includes('css') || type.includes('text/css')) {
        return 'css';
      }
    }

    // 检查lang属性
    const langMatch = styleTag.match(/lang=["']([^"']+)["']/i);
    if (langMatch) {
      const lang = langMatch[1].toLowerCase();
      if (lang.includes('scss')) {
        return 'scss';
      }
      if (lang.includes('less')) {
        return 'less';
      }
    }

    // 检查内容中的预处理器特征
    const contentMatch = styleTag.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    if (contentMatch && contentMatch[1]) {
      const content = contentMatch[1];
      if (this.hasSCSSFeatures(content)) {
        return 'scss';
      }
      if (this.hasLESSFeatures(content)) {
        return 'less';
      }
    }

    // 默认为CSS
    return 'css';
  }

  /**
   * 计算位置信息（行号和列号）
   */
  private calculatePosition(content: string, offset: number): { line: number; column: number } {
    const beforeOffset = content.substring(0, offset);
    const lines = beforeOffset.split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    
    return { line, column };
  }

  /**
   * 提取标签属性
   */
  private extractAttributes(tag: string): Record<string, string> {
    const attributes: Record<string, string> = {};
    const attrRegex = /(\w+(?:-\w+)*)\s*=\s*["']([^"']*)["']/g;
    let match;

    while ((match = attrRegex.exec(tag)) !== null) {
      const attrName = match[1];
      const attrValue = match[2];
      attributes[attrName] = attrValue;
    }

    return attributes;
  }

  /**
   * 生成内容哈希
   */
  private generateContentHash(content: string): string {
    return ContentHashUtils.generateContentHash(content);
  }

  /**
   * 检查是否包含TypeScript特征
   */
  private hasTypeScriptFeatures(content: string): boolean {
    const tsFeatures = [
      /:\s*(string|number|boolean|void|any|unknown|never)/g,  // 类型注解
      /interface\s+\w+/g,                                      // 接口
      /type\s+\w+\s*=/g,                                       // 类型别名
      /enum\s+\w+/g,                                           // 枚举
      /import\s+.*\s+from\s+['"][^'"]*['"]\s*;/g,              // ES6导入
      /export\s+(default\s+)?(class|interface|type|enum)/g,    // 导出
      /<\w+>/g,                                                // 泛型
      /\?\s*:/g,                                               // 可选属性
      /\.\.\.\w+/g                                             // 展开操作符
    ];

    return tsFeatures.some(feature => feature.test(content));
  }

  /**
   * 检查是否包含SCSS特征
   */
  private hasSCSSFeatures(content: string): boolean {
    const scssFeatures = [
      /@mixin\s+\w+/g,                                         // 混入
      /@include\s+\w+/g,                                       // 包含混入
      /\$\w+:/g,                                               // 变量
      /@extend\s+\w+/g,                                        // 继承
      /@if\s+/g,                                               // 条件语句
      /@for\s+/g,                                              // 循环
      /@each\s+/g,                                             // 遍历
      /@while\s+/g,                                            // while循环
      /%\w+/g,                                                 // 占位符选择器
      /&:\w+/g                                                 // 嵌套伪类
    ];

    return scssFeatures.some(feature => feature.test(content));
  }

  /**
   * 检查是否包含LESS特征
   */
  private hasLESSFeatures(content: string): boolean {
    const lessFeatures = [
      /@\w+:\s*[^;]+;/g,                                       // 变量
      /\.mixin\(\)/g,                                          // 混入
      /#\{.*\}/g,                                              // 变量插值
      /&\s*>\s*\w+/g,                                          // 直接子选择器
      /&\s*\+\s*\w+/g,                                         // 相邻兄弟选择器
      /&\s*~\s*\w+/g,                                          // 通用兄弟选择器
      /@import\s+['"][^'"]*['"]\s*;/g,                         // 导入
      /when\s*\(/g                                             // when条件
    ];

    return lessFeatures.some(feature => feature.test(content));
  }
}