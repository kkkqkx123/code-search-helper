// 核心处理逻辑 - 保留在 utils
export { UniversalTextStrategy } from './UniversalTextStrategy';
export { IntelligentFallbackEngine } from '../../guard/IntelligentFallbackEngine';

// 通用工具 - 保留在 utils
export { ContentHashIDGenerator } from './ContentHashIDGenerator';
export { SemanticBoundaryAnalyzer } from './SemanticBoundaryAnalyzer';
export { SyntaxValidator } from './SyntaxValidator';

// 常量
export {
  BACKUP_FILE_PATTERNS,
  LANGUAGE_MAP,
  CODE_LANGUAGES,
  BLOCK_SIZE_LIMITS,
  DEFAULT_CONFIG,
  SHEBANG_PATTERNS,
  SYNTAX_PATTERNS,
  FILE_STRUCTURE_PATTERNS,
  STRONG_FEATURE_LANGUAGES,
  SMALL_FILE_THRESHOLD,
  getDynamicBlockLimits
} from '../constants';

// 保护机制
export { ErrorThresholdInterceptor } from './protection/ErrorThresholdInterceptor';

// 重新导出已移动的模块以保持向后兼容性
export { BackupFileProcessor } from '../detection/BackupFileProcessor';
export { ExtensionlessFileProcessor } from '../detection/ExtensionlessFileProcessor';
export { FileFeatureDetector } from '../detection/FileFeatureDetector';
export { UnifiedDetectionCenter } from '../detection/UnifiedDetectionCenter';
export { UniversalProcessingConfig } from '../config/UniversalProcessingConfig';
export { CodeQualityAssessmentUtils } from './quality/CodeQualityAssessmentUtils';
export { ComplexityCalculator } from './quality/ComplexityCalculator';