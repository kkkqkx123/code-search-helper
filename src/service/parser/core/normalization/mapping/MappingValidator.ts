import {
  MappingConfig,
  MappingValidationResult,
  MappingValidationError,
  QueryPatternType,
  QueryMapping
} from './types';

/**
 * 映射验证器
 * 提供映射配置的验证功能
 */
export class MappingValidator {
  /**
   * 验证映射配置
   */
  static validateMapping(config: MappingConfig): MappingValidationResult {
    const errors: MappingValidationError[] = [];
    const warnings: string[] = [];

    // 验证基本字段
    this.validateBasicFields(config, errors);

    // 验证映射数组
    if (config.mappings) {
      this.validateMappings(config.mappings, errors, warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 验证基本字段
   */
  private static validateBasicFields(config: MappingConfig, errors: MappingValidationError[]): void {
    if (!config.language) {
      errors.push({
        type: 'MISSING_REQUIRED_FIELD',
        message: '映射配置必须包含 language 字段',
        location: { field: 'language' }
      });
    }

    if (!config.queryType) {
      errors.push({
        type: 'MISSING_REQUIRED_FIELD',
        message: '映射配置必须包含 queryType 字段',
        location: { field: 'queryType' }
      });
    }
  }

  /**
   * 验证映射数组
   */
  private static validateMappings(
    mappings: QueryMapping[],
    errors: MappingValidationError[],
    warnings: string[]
  ): void {
    if (!Array.isArray(mappings)) {
      errors.push({
        type: 'INVALID_PATTERN',
        message: 'mappings 必须是数组类型',
        location: { field: 'mappings' }
      });
      return;
    }

    if (mappings.length === 0) {
      warnings.push('mappings 数组为空，没有定义任何映射规则');
      return;
    }

    // 验证每个映射
    for (let i = 0; i < mappings.length; i++) {
      const mapping = mappings[i];
      const mappingErrors = this.validateSingleMapping(mapping, i);
      errors.push(...mappingErrors);
    }

    // 检查重复的查询模式
    this.checkDuplicatePatterns(mappings, warnings);
  }

  /**
   * 验证单个映射
   */
  private static validateSingleMapping(mapping: QueryMapping, index: number): MappingValidationError[] {
    const errors: MappingValidationError[] = [];

    // 验证必需字段
    if (!mapping.queryPattern) {
      errors.push({
        type: 'MISSING_REQUIRED_FIELD',
        message: `映射 [${index}] 必须包含 queryPattern`,
        location: { field: 'queryPattern', line: index }
      });
    }

    if (!mapping.patternType) {
      errors.push({
        type: 'MISSING_REQUIRED_FIELD',
        message: `映射 [${index}] 必须包含 patternType`,
        location: { field: 'patternType', line: index }
      });
    } else if (!Object.values(QueryPatternType).includes(mapping.patternType)) {
      errors.push({
        type: 'INVALID_PATTERN',
        message: `映射 [${index}] 的 patternType 值无效: ${mapping.patternType}`,
        location: { field: 'patternType', line: index }
      });
    }

    if (!mapping.captures) {
      errors.push({
        type: 'MISSING_REQUIRED_FIELD',
        message: `映射 [${index}] 必须包含 captures`,
        location: { field: 'captures', line: index }
      });
    } else {
      // 验证捕获组配置
      this.validateCaptures(mapping, index, errors);
    }

    // 根据模式类型验证特定字段
    if (mapping.patternType === QueryPatternType.RELATIONSHIP) {
      this.validateRelationshipMapping(mapping, index, errors);
    } else if (mapping.patternType === QueryPatternType.ENTITY) {
      this.validateEntityMapping(mapping, index, errors);
    } else if (mapping.patternType === QueryPatternType.SHARED) {
      this.validateSharedMapping(mapping, index, errors);
    }

    return errors;
  }

  /**
   * 验证捕获组配置
   */
  private static validateCaptures(mapping: QueryMapping, index: number, errors: MappingValidationError[]): void {
    const captures = mapping.captures;

    if (mapping.patternType === QueryPatternType.RELATIONSHIP) {
      if (!captures.source) {
        errors.push({
          type: 'MISSING_REQUIRED_FIELD',
          message: `关系映射 [${index}] 必须包含 source 捕获组`,
          location: { field: 'captures.source', line: index }
        });
      }

      if (!mapping.relationship) {
        errors.push({
          type: 'MISSING_REQUIRED_FIELD',
          message: `关系映射 [${index}] 必须包含 relationship 定义`,
          location: { field: 'relationship', line: index }
        });
      }
    } else if (mapping.patternType === QueryPatternType.ENTITY) {
      if (!captures.entityType) {
        errors.push({
          type: 'MISSING_REQUIRED_FIELD',
          message: `实体映射 [${index}] 必须包含 entityType 捕获组`,
          location: { field: 'captures.entityType', line: index }
        });
      }

      if (!mapping.entity) {
        errors.push({
          type: 'MISSING_REQUIRED_FIELD',
          message: `实体映射 [${index}] 必须包含 entity 定义`,
          location: { field: 'entity', line: index }
        });
      }
    } else if (mapping.patternType === QueryPatternType.SHARED) {
      // 共享模式需要同时有实体和关系定义，或者至少有一个
      if (!captures.entityType && !captures.source) {
        errors.push({
          type: 'MISSING_REQUIRED_FIELD',
          message: `共享映射 [${index}] 必须包含 entityType 或 source 捕获组`,
          location: { field: 'captures', line: index }
        });
      }

      if (!mapping.entity && !mapping.relationship) {
        errors.push({
          type: 'MISSING_REQUIRED_FIELD',
          message: `共享映射 [${index}] 必须包含 entity 或 relationship 定义`,
          location: { field: 'entity/relationship', line: index }
        });
      }
    }
  }

  /**
   * 验证关系映射
   */
  private static validateRelationshipMapping(mapping: QueryMapping, index: number, errors: MappingValidationError[]): void {
    if (!mapping.relationship) return;

    const relationship = mapping.relationship;

    if (!relationship.type) {
      errors.push({
        type: 'MISSING_REQUIRED_FIELD',
        message: `关系映射 [${index}] 的 relationship 必须包含 type`,
        location: { field: 'relationship.type', line: index }
      });
    }

    if (!relationship.category) {
      errors.push({
        type: 'MISSING_REQUIRED_FIELD',
        message: `关系映射 [${index}] 的 relationship 必须包含 category`,
        location: { field: 'relationship.category', line: index }
      });
    }
  }

  /**
   * 验证实体映射
   */
  private static validateEntityMapping(mapping: QueryMapping, index: number, errors: MappingValidationError[]): void {
    if (!mapping.entity) return;

    const entity = mapping.entity;

    if (!entity.type) {
      errors.push({
        type: 'MISSING_REQUIRED_FIELD',
        message: `实体映射 [${index}] 的 entity 必须包含 type`,
        location: { field: 'entity.type', line: index }
      });
    }

    if (!entity.category) {
      errors.push({
        type: 'MISSING_REQUIRED_FIELD',
        message: `实体映射 [${index}] 的 entity 必须包含 category`,
        location: { field: 'entity.category', line: index }
      });
    }
  }

  /**
   * 验证共享映射
   */
  private static validateSharedMapping(mapping: QueryMapping, index: number, errors: MappingValidationError[]): void {
    // 共享模式需要同时验证关系和实体定义
    if (mapping.relationship) {
      this.validateRelationshipMapping(mapping, index, errors);
    }

    if (mapping.entity) {
      this.validateEntityMapping(mapping, index, errors);
    }
  }

  /**
   * 检查重复的查询模式
   */
  private static checkDuplicatePatterns(mappings: QueryMapping[], warnings: string[]): void {
    const patternCounts = new Map<string, number>();

    for (const mapping of mappings) {
      if (mapping.queryPattern) {
        const count = patternCounts.get(mapping.queryPattern) || 0;
        patternCounts.set(mapping.queryPattern, count + 1);
      }
    }

    for (const [pattern, count] of patternCounts.entries()) {
      if (count > 1) {
        warnings.push(`查询模式 "${pattern}" 重复出现 ${count} 次`);
      }
    }
  }

  /**
   * 验证映射配置的完整性
   */
  static validateMappingIntegrity(config: MappingConfig): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const result = this.validateMapping(config);

    return {
      isValid: result.isValid,
      errors: result.errors.map(e => e.message),
      warnings: result.warnings
    };
  }

  /**
   * 验证多个映射配置
   */
  static validateMultipleMappings(configs: MappingConfig[]): {
    overallValid: boolean;
    results: Array<{
      config: MappingConfig;
      validation: MappingValidationResult;
    }>;
  } {
    const results = [];
    let overallValid = true;

    for (const config of configs) {
      const validation = this.validateMapping(config);
      results.push({ config, validation });

      if (!validation.isValid) {
        overallValid = false;
      }
    }

    return { overallValid, results };
  }
}