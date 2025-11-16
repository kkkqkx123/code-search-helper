import { LanguageConfig, CommentCategory } from '../types';

/**
 * 语言特定配置
 */
export const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
  javascript: {
    supportedCaptures: [
      'comment.single', 'comment.multi', 'comment.any',
      'comment.jsdoc', 'comment.todo', 'comment.license',
      'comment.jsdoc_tags', 'comment.js_features', 'comment.event_dom',
      'comment.performance_security', 'comment.dev_tools_testing'
    ],
    defaultCategory: CommentCategory.INLINE,
    features: {
      hasStructuredDocs: true,
      hasTaskMarkers: true,
      hasLicenseHeaders: true
    }
  },

  typescript: {
    supportedCaptures: [
      'comment.single', 'comment.multi', 'comment.any',
      'comment.jsdoc', 'comment.todo', 'comment.license',
      'comment.jsdoc_tags', 'comment.js_features', 'comment.event_dom',
      'comment.performance_security', 'comment.dev_tools_testing'
    ],
    defaultCategory: CommentCategory.INLINE,
    features: {
      hasStructuredDocs: true,
      hasTaskMarkers: true,
      hasLicenseHeaders: true
    }
  },

  java: {
    supportedCaptures: [
      'comment.single', 'comment.multi', 'comment.any',
      'comment.javadoc', 'comment.todo', 'comment.license',
      'comment.javadoc_tags', 'comment.java_features'
    ],
    defaultCategory: CommentCategory.DOCUMENTATION,
    features: {
      hasStructuredDocs: true,
      hasTaskMarkers: true,
      hasLicenseHeaders: true
    }
  },

  python: {
    supportedCaptures: [
      'comment.python', 'comment.docstring', 'comment.todo'
    ],
    defaultCategory: CommentCategory.INLINE,
    features: {
      hasStructuredDocs: true,
      hasTaskMarkers: true,
      hasLicenseHeaders: false
    }
  },

  go: {
    supportedCaptures: [
      'comment.single', 'comment.multi', 'comment.any',
      'comment.doc', 'comment.go_doc', 'comment.todo'
    ],
    defaultCategory: CommentCategory.DOCUMENTATION,
    features: {
      hasStructuredDocs: true,
      hasTaskMarkers: true,
      hasLicenseHeaders: true
    }
  },

  rust: {
    supportedCaptures: [
      'comment.single', 'comment.multi', 'comment.any',
      'comment.doc', 'comment.rust_doc', 'comment.module_doc', 'comment.todo'
    ],
    defaultCategory: CommentCategory.DOCUMENTATION,
    features: {
      hasStructuredDocs: true,
      hasTaskMarkers: true,
      hasLicenseHeaders: true
    }
  }
};

/**
 * 获取语言配置
 */
export function getLanguageConfig(language: string): LanguageConfig {
  const normalizedLanguage = language.toLowerCase();
  return LANGUAGE_CONFIGS[normalizedLanguage] || {
    supportedCaptures: ['comment.single', 'comment.multi', 'comment.any'],
    defaultCategory: CommentCategory.OTHER,
    features: {
      hasStructuredDocs: false,
      hasTaskMarkers: false,
      hasLicenseHeaders: false
    }
  };
}