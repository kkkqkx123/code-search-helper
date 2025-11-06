/**
 * JavaScript/TypeScript 依赖关系提取器
 * 提取代码中的导入、导出和依赖关系
 */
export class DependencyRelationshipExtractor {
  extractDependencyRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'import' | 'export' | 'require' | 'dynamic_import';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'import' | 'export' | 'require' | 'dynamic_import';
    }> = [];

    const captures = result.captures;
    if (!captures || !Array.isArray(captures)) {
      return relationships;
    }

    for (const capture of captures) {
      if (capture.name && capture.node?.text) {
        const node = capture.node;

        // 提取ES6导入关系
        if (node.type === 'import_statement') {
          const sourcePath = node.childForFieldName('source');
          if (sourcePath?.text) {
            relationships.push({
              source: 'import-statement',
              target: sourcePath.text.replace(/['"]/g, ''),
              type: 'import'
            });
          }
        }

        // 提取ES6导出关系
        if (node.type === 'export_statement') {
          const sourcePath = node.childForFieldName('source');
          if (sourcePath?.text) {
            relationships.push({
              source: 'export-statement',
              target: sourcePath.text.replace(/['"]/g, ''),
              type: 'export'
            });
          }
        }

        // 提取CommonJS require关系
        if (node.type === 'call_expression') {
          const func = node.childForFieldName('function');
          if (func?.text === 'require') {
            const args = node.childForFieldName('arguments');
            if (args?.children) {
              for (const arg of args.children) {
                if (arg.type === 'string' && arg.text) {
                  relationships.push({
                    source: 'require-call',
                    target: arg.text.replace(/['"]/g, ''),
                    type: 'require'
                  });
                }
              }
            }
          }
        }

        // 提取动态导入关系
        if (node.type === 'import_expression') {
          const sourcePath = node.childForFieldName('source');
          if (sourcePath?.text) {
            relationships.push({
              source: 'dynamic-import',
              target: sourcePath.text.replace(/['"]/g, ''),
              type: 'dynamic_import'
            });
          }
        }
      }
    }

    return relationships;
  }

  extractDependencyMetadata(result: any, astNode: any, symbolTable: any): any {
    // 提取依赖关系元数据
    return {
      type: 'dependency',
      dependencyType: this.getDependencyType(astNode),
      dependencyTarget: this.getDependencyTarget(astNode),
      location: {
        startLine: astNode?.startPosition?.row + 1,
        endLine: astNode?.endPosition?.row + 1,
      }
    };
  }

  private getDependencyType(node: any): string {
    if (!node) return 'import';

    switch (node.type) {
      case 'import_statement':
        return 'import';
      case 'export_statement':
        return 'export';
      case 'call_expression':
        if (node.text.includes('require')) return 'require';
        return 'import';
      case 'import_expression':
        return 'dynamic_import';
      default:
        return 'import';
    }
  }

  private getDependencyTarget(node: any): string {
    if (!node) return 'unknown';

    switch (node.type) {
      case 'import_statement':
      case 'export_statement':
        const source = node.childForFieldName('source');
        return source?.text?.replace(/['"]/g, '') || 'unknown';
      case 'call_expression':
        if (node.text.includes('require')) {
          const args = node.childForFieldName('arguments');
          if (args?.children) {
            for (const arg of args.children) {
              if (arg.type === 'string') {
                return arg.text.replace(/['"]/g, '');
              }
            }
          }
        }
        return 'unknown';
      case 'import_expression':
        const sourcePath = node.childForFieldName('source');
        return sourcePath?.text?.replace(/['"]/g, '') || 'unknown';
      default:
        return 'unknown';
    }
  }
}