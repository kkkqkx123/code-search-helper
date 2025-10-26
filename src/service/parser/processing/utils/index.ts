export { BackupFileProcessor } from './BackupFileProcessor';
export { ExtensionlessFileProcessor } from './ExtensionlessFileProcessor';
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
} from './backup-constants';
export { ErrorThresholdInterceptor } from './protection/ErrorThresholdInterceptor';