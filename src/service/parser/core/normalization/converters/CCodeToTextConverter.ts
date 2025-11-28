/**
 * C语言专用的代码转文本转换器实现
 */

import { ICodeToTextConverter } from './ICodeToTextConverter';
import { CodeToTextConfig, CodeToTextResult } from '../../../../../service/vector/types/VectorTypes';

/**
 * C语言代码转文本转换器
 */
export class CCodeToTextConverter implements ICodeToTextConverter {
  private defaultConfig: CodeToTextConfig = {
    namingConversion: {
      camelToNatural: true,
      snakeToNatural: true,
      pascalToNatural: true
    },
    textAssembly: {
      includeCodeType: true,
      includeDescription: true,
      includeSignature: true,
      includeContext: true
    },
    textCleaning: {
      removeSpecialChars: true,
      removeCommentSymbols: true,
      normalizeWhitespace: true
    }
  };

  convertEntity(entity: any, config: CodeToTextConfig = this.defaultConfig): CodeToTextResult {
    const startTime = Date.now();
    
    // 1. 命名风格转换
    const naturalName = this.convertNaming(entity.name, config.namingConversion);
    
    // 2. 提取功能描述
    const description = this.extractDescription(entity, config.textAssembly);
    
    // 3. 提取签名信息
    const signature = this.extractSignature(entity, config.textAssembly);
    
    // 4. 提取上下文信息
    const context = this.extractContext(entity, config.textAssembly);
    
    // 5. 组装文本
    let text = '';
    if (config.textAssembly.includeCodeType) {
      text += `${entity.entityType} `;
    }
    text += naturalName;
    if (config.textAssembly.includeDescription && description) {
      text += ` that does ${description} `;
    }
    if (config.textAssembly.includeSignature && signature) {
      text += `defined as ${signature} `;
    }
    if (config.textAssembly.includeContext && context) {
      text += context;
    }
    
    // 6. 文本清洗
    text = this.cleanText(text, config.textCleaning);
    
    const endTime = Date.now();
    
    return {
      text,
      originalCode: entity.content,
      stats: {
        originalLength: entity.content.length,
        convertedLength: text.length,
        conversionTime: endTime - startTime
      },
      metadata: {
        language: entity.language,
        codeType: entity.entityType,
        conversionRules: this.getUsedRules(entity, config)
      }
    };
  }

  convertRelationship(relationship: any, config: CodeToTextConfig = this.defaultConfig): CodeToTextResult {
    const startTime = Date.now();
    
    // 关系转文本逻辑
    const sourceText = this.convertNaming(relationship.fromNodeId, config.namingConversion);
    const targetText = this.convertNaming(relationship.toNodeId, config.namingConversion);
    const relationshipText = this.convertNaming(relationship.type, config.namingConversion);
    
    let text = `${sourceText} ${relationshipText} ${targetText}`;
    
    // 添加关系特有信息
    if (relationship.properties?.functionName) {
      text += ` via ${relationship.properties.functionName}`;
    }
    if (relationship.properties?.condition) {
      text += ` when ${relationship.properties.condition}`;
    }
    
    text = this.cleanText(text, config.textCleaning);
    
    const endTime = Date.now();
    
    return {
      text,
      originalCode: relationship.properties?.originalCode || '',
      stats: {
        originalLength: relationship.properties?.originalCode?.length || 0,
        convertedLength: text.length,
        conversionTime: endTime - startTime
      },
      metadata: {
        language: relationship.language,
        codeType: 'relationship',
        conversionRules: this.getUsedRules(relationship, config)
      }
    };
  }

  convertBatch(items: any[], config: CodeToTextConfig = this.defaultConfig): CodeToTextResult[] {
    return items.map(item => {
      if ('entityType' in item) {
        return this.convertEntity(item, config);
      } else {
        return this.convertRelationship(item, config);
      }
    });
  }

  getSupportedRules(): string[] {
    return [
      'camel_to_natural',
      'snake_to_natural',
      'pascal_to_natural',
      'extract_function_signature',
      'extract_struct_fields',
      'extract_enum_constants',
      'clean_special_chars',
      'normalize_whitespace'
    ];
  }

  private convertNaming(name: string, config: CodeToTextConfig['namingConversion']): string {
    let result = name;
    
    if (config.snakeToNatural && result.includes('_')) {
      result = result.replace(/_/g, ' ');
    }
    
    if (config.camelToNatural) {
      result = result.replace(/([A-Z])/g, ' $1').toLowerCase();
    }
    
    return result.trim();
  }

  private extractDescription(entity: any, config: CodeToTextConfig['textAssembly']): string {
    // 从注释或文档字符串中提取描述
    if (entity.properties?.docstring) {
      return entity.properties.docstring;
    }
    
    // 从注释中提取描述
    if (entity.properties?.comment) {
      return this.cleanComment(entity.properties.comment);
    }
    
    return '';
  }

  private extractSignature(entity: any, config: CodeToTextConfig['textAssembly']): string {
    // 返回实体签名或定义信息
    return entity.content || '';
  }

  private extractContext(entity: any, config: CodeToTextConfig['textAssembly']): string {
    const context = [];
    if (entity.filePath) {
      context.push(`file ${entity.filePath.split('/').pop()}`);
    }
    if (entity.location?.startLine) {
      context.push(`line ${entity.location.startLine}`);
    }
    return context.join(' ');
  }

  private cleanText(text: string, config: CodeToTextConfig['textCleaning']): string {
    let result = text;
    
    if (config.removeSpecialChars) {
      result = result.replace(/[^\w\s]/g, ' ');
    }
    
    if (config.normalizeWhitespace) {
      result = result.replace(/\s+/g, ' ').trim();
    }
    
    return result;
  }

  private cleanComment(comment: string): string {
    return comment.replace(/[/\*]+/g, '').trim();
  }

  private getUsedRules(item: any, config: CodeToTextConfig): string[] {
    const rules = [];
    
    if (config.namingConversion.camelToNatural) rules.push('camel_to_natural');
    if (config.namingConversion.snakeToNatural) rules.push('snake_to_natural');
    if (config.namingConversion.pascalToNatural) rules.push('pascal_to_natural');
    
    if ('entityType' in item) {
      // 处理实体特定规则
      rules.push('extract_function_signature');
    }
    
    if (config.textCleaning.removeSpecialChars) rules.push('clean_special_chars');
    if (config.textCleaning.normalizeWhitespace) rules.push('normalize_whitespace');
    
    return rules;
  }
}
