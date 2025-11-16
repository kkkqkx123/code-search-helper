import { CommentCategory } from "./CommentTypes";

/**
 * 语义信息接口
 */
export interface SemanticInfo {
  type: string;
  confidence: number;
  attributes: Record<string, any>;
}

/**
 * 查询映射配置
 */
export interface QueryMapping {
  category: CommentCategory;
  confidence: number;
  attributes?: Record<string, any>;
}

/**
 * 语言配置接口
 */
export interface LanguageConfig {
  supportedCaptures: string[];
  defaultCategory: CommentCategory;
  features: {
    hasStructuredDocs: boolean;
    hasTaskMarkers: boolean;
    hasLicenseHeaders: boolean;
  };
}