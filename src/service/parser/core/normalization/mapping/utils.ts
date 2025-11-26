import { QueryMapping, MappingConfig, QueryPatternType, SupportedLanguage, QueryType } from './types';

/**
 * 映射工具函数
 */

/**
 * 检查查询模式是否为有效的捕获组名称
 */
export function isValidCaptureName(pattern: string): boolean {
  // 检查是否以@开头，且只包含有效字符
  return /^@[a-zA-Z_][a-zA-Z0-9_.]*$/.test(pattern);
}

/**
 * 从查询模式中提取捕获组名称
 */
export function extractCaptureNames(pattern: string): string[] {
  const captureRegex = /@([a-zA-Z_][a-zA-Z0-9_.]*)/g;
  const captures: string[] = [];
  let match;

  while ((match = captureRegex.exec(pattern)) !== null) {
    captures.push(match[1]);
  }

  return captures;
}

/**
 * 标准化查询模式
 */
export function normalizeQueryPattern(pattern: string): string {
  return pattern.trim().replace(/\s+/g, ' ');
}

/**
 * 检查映射配置是否兼容指定语言
 */
export function isLanguageCompatible(config: MappingConfig, language: SupportedLanguage): boolean {
  return config.language === language;
}

/**
 * 检查映射配置是否兼容指定查询类型
 */
export function isQueryTypeCompatible(config: MappingConfig, queryType: QueryType): boolean {
  return config.queryType === queryType;
}

/**
 * 根据优先级排序映射数组
 */
export function sortMappingsByPriority(mappings: QueryMapping[]): QueryMapping[] {
  return [...mappings].sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

/**
 * 过滤指定模式的映射
 */
export function filterMappingsByPattern(
  mappings: QueryMapping[],
  patternType: QueryPatternType
): QueryMapping[] {
  return mappings.filter(mapping => mapping.patternType === patternType);
}

/**
 * 查找匹配查询模式的映射
 */
export function findMappingsByPattern(
  mappings: QueryMapping[],
  queryPattern: string
): QueryMapping[] {
  const normalizedPattern = normalizeQueryPattern(queryPattern);
  return mappings.filter(mapping =>
    normalizeQueryPattern(mapping.queryPattern) === normalizedPattern
  );
}

/**
 * 验证捕获组配置的完整性
 */
export function validateCaptureConfig(mapping: QueryMapping): {
  isValid: boolean;
  missingCaptures: string[];
  extraCaptures: string[];
} {
  const patternCaptures = extractCaptureNames(mapping.queryPattern);
  const configCaptures = Object.values(mapping.captures).filter(Boolean) as string[];

  const missingCaptures = patternCaptures.filter(capture =>
    !configCaptures.some(config => config.includes(capture))
  );

  const extraCaptures = configCaptures.filter(config =>
    !patternCaptures.some(capture => config.includes(capture))
  );

  return {
    isValid: missingCaptures.length === 0 && extraCaptures.length === 0,
    missingCaptures,
    extraCaptures
  };
}

/**
 * 生成映射配置的摘要信息
 */
export function generateMappingSummary(config: MappingConfig): {
  totalMappings: number;
  entityMappings: number;
  relationshipMappings: number;
  sharedMappings: number;
  patterns: string[];
} {
  const entityMappings = filterMappingsByPattern(config.mappings, QueryPatternType.ENTITY).length;
  const relationshipMappings = filterMappingsByPattern(config.mappings, QueryPatternType.RELATIONSHIP).length;
  const sharedMappings = filterMappingsByPattern(config.mappings, QueryPatternType.SHARED).length;
  const patterns = config.mappings.map(mapping => mapping.queryPattern);

  return {
    totalMappings: config.mappings.length,
    entityMappings,
    relationshipMappings,
    sharedMappings,
    patterns
  };
}

/**
 * 合并多个映射配置
 */
export function mergeMappingConfigs(...configs: MappingConfig[]): MappingConfig | null {
  if (configs.length === 0) {
    return null;
  }

  if (configs.length === 1) {
    return configs[0];
  }

  // 检查语言和查询类型是否一致
  const firstConfig = configs[0];
  const language = firstConfig.language;
  const queryType = firstConfig.queryType;

  for (const config of configs) {
    if (config.language !== language || config.queryType !== queryType) {
      throw new Error('无法合并不同语言或查询类型的映射配置');
    }
  }

  // 合并映射数组
  const allMappings = configs.flatMap(config => config.mappings);
  const uniqueMappings = removeDuplicateMappings(allMappings);

  return {
    language,
    queryType,
    mappings: sortMappingsByPriority(uniqueMappings)
  };
}

/**
 * 移除重复的映射
 */
export function removeDuplicateMappings(mappings: QueryMapping[]): QueryMapping[] {
  const seen = new Set<string>();
  const unique: QueryMapping[] = [];

  for (const mapping of mappings) {
    const key = `${mapping.queryPattern}|${mapping.patternType}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(mapping);
    }
  }

  return unique;
}

/**
 * 深度克隆映射配置
 */
export function cloneMappingConfig(config: MappingConfig): MappingConfig {
  return JSON.parse(JSON.stringify(config));
}

/**
 * 检查映射配置是否为空
 */
export function isMappingConfigEmpty(config: MappingConfig): boolean {
  return !config.mappings || config.mappings.length === 0;
}

/**
 * 格式化映射配置为可读的字符串
 */
export function formatMappingConfig(config: MappingConfig): string {
  const summary = generateMappingSummary(config);

  return [
    `语言: ${config.language}`,
    `查询类型: ${config.queryType}`,
    `总映射数: ${summary.totalMappings}`,
    `实体映射: ${summary.entityMappings}`,
    `关系映射: ${summary.relationshipMappings}`,
    `共享映射: ${summary.sharedMappings}`,
    `查询模式:`,
    ...summary.patterns.map(pattern => `  - ${pattern}`)
  ].join('\n');
}

/**
 * 创建映射配置的键
 */
export function createMappingConfigKey(language: SupportedLanguage, queryType: QueryType): string {
  return `${language}:${queryType}`;
}

/**
 * 从键解析语言和查询类型
 */
export function parseMappingConfigKey(key: string): {
  language: SupportedLanguage;
  queryType: QueryType;
} | null {
  const parts = key.split(':');
  if (parts.length !== 2) {
    return null;
  }

  const [language, queryType] = parts;

  // 这里可以添加更严格的验证
  return {
    language: language as SupportedLanguage,
    queryType: queryType as QueryType
  };
}