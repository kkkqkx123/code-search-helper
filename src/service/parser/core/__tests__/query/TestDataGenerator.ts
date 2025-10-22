import Parser from 'tree-sitter';

/**
 * 测试数据生成器 - 创建更真实的AST模拟数据
 */
export class TestDataGenerator {
  /**
   * 创建真实的TypeScript代码AST
   */
  static createRealisticTypeScriptAST(size: number = 10): Parser.SyntaxNode {
    const code = this.generateTypeScriptCode(size);
    return this.createMockASTFromCode(code, 'typescript');
  }

  /**
   * 创建真实的JavaScript代码AST
   */
  static createRealisticJavaScriptAST(size: number = 10): Parser.SyntaxNode {
    const code = this.generateJavaScriptCode(size);
    return this.createMockASTFromCode(code, 'javascript');
  }

  /**
   * 生成真实的TypeScript代码
   */
  private static generateTypeScriptCode(size: number): string {
    const imports = [
      `import { Logger } from './utils/logger';`,
      `import { DatabaseService } from './services/database';`,
      `import { HttpClient } from './http/client';`
    ].join('\n');

    const functions = Array.from({ length: size }, (_, i) => `
/**
 * ${i % 2 === 0 ? 'Async' : 'Sync'} function ${i}
 * @param param${i} - The parameter for function ${i}
 * @returns Promise<string> | string
 */
${i % 2 === 0 ? 'async' : ''} function function${i}(param${i}: ${i % 3 === 0 ? 'string' : 'number'}): ${i % 2 === 0 ? 'Promise<string>' : 'string'} {
  const result = \`processed_\${param${i}}_\${${i}}\`;
  ${i % 2 === 0 ? 'return Promise.resolve(result);' : 'return result;'}
}`).join('\n');

    const classes = Array.from({ length: Math.floor(size / 2) }, (_, i) => `
/**
 * Class ${i} - ${i % 2 === 0 ? 'Service' : 'Controller'} class
 */
export class Class${i} {
  private readonly id: number = ${i};
  protected name: string = \`class\${i}\`;
  
  constructor(name?: string) {
    if (name) {
      this.name = name;
    }
  }

  /**
   * Method ${i} - ${i % 3 === 0 ? 'Public' : 'Private'} method
   */
  ${i % 3 === 0 ? 'public' : 'private'} method${i}(): void {
    console.log(\`Method ${i} called from \${this.name}\`);
  }

  /**
   * Async method ${i}
   */
  async asyncMethod${i}(): Promise<string> {
    return \`async_result_\${this.id}\`;
  }

  /**
   * Getter for name
   */
  get getName(): string {
    return this.name;
  }

  /**
   * Setter for name
   */
  set setName(value: string) {
    this.name = value;
  }
}`).join('\n');

    const interfaces = Array.from({ length: Math.floor(size / 3) }, (_, i) => `
/**
 * Interface ${i}
 */
export interface Interface${i} {
  id: number;
  name: string;
  ${i % 2 === 0 ? 'data?: Record<string, any>;' : ''}
  method${i}(): ${i % 2 === 0 ? 'void' : 'string'};
}`).join('\n');

    const exports = [
      `export default function main() { console.log('Main function'); }`,
      `export { Class0, Class1 } from './classes';`,
      `export type TestType = string | number;`
    ].join('\n');

    return [imports, functions, classes, interfaces, exports].join('\n\n');
  }

  /**
   * 生成真实的JavaScript代码
   */
  private static generateJavaScriptCode(size: number): string {
    const imports = [
      `const fs = require('fs');`,
      `const path = require('path');`,
      `const { EventEmitter } = require('events');`
    ].join('\n');

    const functions = Array.from({ length: size }, (_, i) => `
/**
 * Function ${i} - ${i % 2 === 0 ? 'Arrow' : 'Regular'} function
 */
${i % 2 === 0 ? 'const' : 'function'} ${i % 2 === 0 ? `arrowFunction${i}` : `function${i}`} = ${i % 2 === 0 ? '' : 'function'}(${i % 3 === 0 ? 'param' : ''})${i % 2 === 0 ? ' =>' : ' {'}
  const result = \`js_function_\${i}_\${Date.now()}\`;
  ${i % 2 === 0 ? `return result;` : `return result;`}
${i % 2 === 0 ? ';' : '\n}'};`).join('\n');

    const classes = Array.from({ length: Math.floor(size / 2) }, (_, i) => `
/**
 * JS Class ${i}
 */
class JSClass${i} extends ${i % 2 === 0 ? 'EventEmitter' : 'Object'} {
  constructor(options = {}) {
    super();
    this.id = ${i};
    this.options = options;
  }

  /**
   * Prototype method ${i}
   */
  method${i}() {
    console.log(\`JS Class \${i} method\`);
    this.emit('methodCalled', { method: \`method\${i}\`, id: this.id });
  }

  /**
   * Static method ${i}
   */
  static staticMethod${i}() {
    return \`static_${i}_result\`;
  }
}`).join('\n');

    const exports = [
      `module.exports = { JSClass0, JSClass1 };`,
      `exports.HELPER = 'helper_value';`,
      `exports.default = function() { return 'default export'; };`
    ].join('\n');

    return [imports, functions, classes, exports].join('\n\n');
  }

  /**
   * 从代码创建模拟AST
   */
  private static createMockASTFromCode(code: string, language: string): Parser.SyntaxNode {
    // 为AST对象添加一个稳定的标识符，用于缓存键生成
    const astId = this.generateStableId(code, language);
    
    return {
      type: 'program',
      startIndex: 0,
      endIndex: code.length,
      startPosition: { row: 0, column: 0 },
      endPosition: { row: code.split('\n').length, column: code.split('\n').pop()?.length || 0 },
      text: code,
      children: [],
      parent: null,
      nextSibling: null,
      previousSibling: null,
      tree: {
        language: { 
          name: language,
          query: (pattern: string) => ({
            matches: () => this.generateMockMatches(code, pattern)
          })
        }
      },
      id: 0,
      typeId: 0,
      grammarId: 0,
      // 添加稳定标识符用于缓存
      _stableId: astId
    } as unknown as Parser.SyntaxNode;
  }

  /**
   * 生成稳定的标识符
   */
  private static generateStableId(code: string, language: string): string {
    // 使用代码内容和语言生成稳定的哈希
    const content = `${language}:${code.length}`;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString();
  }

  /**
   * 生成模拟匹配结果
   */
  private static generateMockMatches(code: string, pattern: string): any[] {
    const matches: any[] = [];
    
    // 根据查询模式生成相应的匹配结果
    if (pattern.includes('function') || pattern.includes('function_declaration')) {
      const functionRegex = /(?:async\s+)?function\s+(\w+)|const\s+(\w+)\s*=\s*\([^)]*\)\s*=>|(\w+)\s*:\s*\([^)]*\)\s*=>/g;
      let match;
      while ((match = functionRegex.exec(code)) !== null) {
        const startPos = match.index;
        const matchedText = match[0];
        const lineNum = code.substring(0, startPos).split('\n').length - 1;
        
        matches.push({
          captures: [
            {
              name: 'function',
              node: {
                type: 'function_declaration',
                startPosition: { row: lineNum, column: startPos - code.lastIndexOf('\n', startPos) },
                endPosition: { row: lineNum, column: startPos - code.lastIndexOf('\n', startPos) + matchedText.length },
                startIndex: startPos,
                endIndex: startPos + matchedText.length,
                text: matchedText,
                parent: null,
                children: [],
                tree: null,
                id: 0,
                typeId: 0,
                grammarId: 0
              }
            }
          ]
        });
      }
    }

    if (pattern.includes('class') || pattern.includes('class_declaration')) {
      const classRegex = /class\s+(\w+)|export\s+class\s+(\w+)/g;
      let match;
      while ((match = classRegex.exec(code)) !== null) {
        const startPos = match.index;
        const matchedText = match[0];
        const lineNum = code.substring(0, startPos).split('\n').length - 1;
        
        matches.push({
          captures: [
            {
              name: 'class',
              node: {
                type: 'class_declaration',
                startPosition: { row: lineNum, column: startPos - code.lastIndexOf('\n', startPos) },
                endPosition: { row: lineNum, column: startPos - code.lastIndexOf('\n', startPos) + matchedText.length },
                startIndex: startPos,
                endIndex: startPos + matchedText.length,
                text: matchedText,
                parent: null,
                children: [],
                tree: null,
                id: 0,
                typeId: 0,
                grammarId: 0
              }
            }
          ]
        });
      }
    }

    if (pattern.includes('import')) {
      const importRegex = /import\s+.*?from\s+['"][^'"]+['"]|const\s+\w+\s*=\s*require\(['"][^'"]+['"]\)/g;
      let match;
      while ((match = importRegex.exec(code)) !== null) {
        const startPos = match.index;
        const matchedText = match[0];
        const lineNum = code.substring(0, startPos).split('\n').length - 1;
        
        matches.push({
          captures: [
            {
              name: 'import',
              node: {
                type: 'import_statement',
                startPosition: { row: lineNum, column: startPos - code.lastIndexOf('\n', startPos) },
                endPosition: { row: lineNum, column: startPos - code.lastIndexOf('\n', startPos) + matchedText.length },
                startIndex: startPos,
                endIndex: startPos + matchedText.length,
                text: matchedText,
                parent: null,
                children: [],
                tree: null,
                id: 0,
                typeId: 0,
                grammarId: 0
              }
            }
          ]
        });
      }
    }

    if (pattern.includes('export')) {
      const exportRegex = /export\s+.*?(?=\n|$)|module\.exports\s*=/g;
      let match;
      while ((match = exportRegex.exec(code)) !== null) {
        const startPos = match.index;
        const matchedText = match[0];
        const lineNum = code.substring(0, startPos).split('\n').length - 1;
        
        matches.push({
          captures: [
            {
              name: 'export',
              node: {
                type: 'export_statement',
                startPosition: { row: lineNum, column: startPos - code.lastIndexOf('\n', startPos) },
                endPosition: { row: lineNum, column: startPos - code.lastIndexOf('\n', startPos) + matchedText.length },
                startIndex: startPos,
                endIndex: startPos + matchedText.length,
                text: matchedText,
                parent: null,
                children: [],
                tree: null,
                id: 0,
                typeId: 0,
                grammarId: 0
              }
            }
          ]
        });
      }
    }

    return matches;
  }

  /**
   * 创建大型AST用于压力测试
   */
  static createLargeAST(size: number = 100): Parser.SyntaxNode {
    const code = this.generateTypeScriptCode(size);
    return this.createMockASTFromCode(code, 'typescript');
  }

  /**
   * 创建空AST用于边界测试
   */
  static createEmptyAST(): Parser.SyntaxNode {
    return this.createMockASTFromCode('', 'typescript');
  }

  /**
   * 创建包含错误的AST用于错误处理测试
   */
  static createErrorAST(): Parser.SyntaxNode {
    const code = `
// This code contains syntax errors
function brokenFunction( {
  return missing closing;
}

class BrokenClass {
  constructor(
  // missing closing parenthesis
}
`;
    return this.createMockASTFromCode(code, 'typescript');
  }
}