/**
 * HTML分层处理配置
 * 基于文档分析的分层处理策略实现
 */

/**
 * 分层处理类型
 */
export enum LayerType {
  STRUCTURE = 'structure',     // HTML结构层
  SCRIPT = 'script',           // JavaScript内容层
  STYLE = 'style',             // CSS内容层
  TEMPLATE = 'template'        // 模板内容层（如Vue等）
}

/**
 * 处理层配置
 */
export interface LayerConfig {
  /** 层类型 */
  type: LayerType;
  /** 处理器名称 */
  processor: string;
  /** 目标内容 */
  target: string;
  /** 是否启用 */
  enabled: boolean;
  /** 处理优先级 */
  priority: number;
  /** 处理选项 */
  options?: Record<string, any>;
}

/**
 * HTML分层处理配置
 */
export interface LayeredHTMLConfig {
  /** 主要处理策略 */
  primary: string;
  /** 分层配置 */
  layers: LayerConfig[];
  /** 是否启用并行处理 */
  enableParallel: boolean;
  /** 结果合并策略 */
  mergeStrategy: 'sequential' | 'parallel' | 'hybrid';
  /** 错误处理策略 */
  errorHandling: 'fail-fast' | 'continue-on-error' | 'fallback';
  /** 最大处理时间（毫秒） */
  maxProcessingTime: number;
}

/**
 * Script块信息
 */
export interface ScriptBlock {
  /** 块ID */
  id: string;
  /** Script内容 */
  content: string;
  /** 语言类型 */
  language: 'javascript' | 'typescript' | 'json' | 'unknown';
  /** 在文件中的位置 */
  position: {
    start: number;
    end: number;
    line: number;
    column: number;
  };
  /** Script标签属性 */
  attributes: Record<string, string>;
  /** 内容哈希 */
  contentHash: string;
}

/**
 * Style块信息
 */
export interface StyleBlock {
  /** 块ID */
  id: string;
  /** Style内容 */
  content: string;
  /** 样式类型 */
  styleType: 'css' | 'scss' | 'less' | 'unknown';
  /** 在文件中的位置 */
  position: {
    start: number;
    end: number;
    line: number;
    column: number;
  };
  /** Style标签属性 */
  attributes: Record<string, string>;
  /** 内容哈希 */
  contentHash: string;
}

/**
 * 分层处理结果
 */
export interface LayeredProcessingResult {
  /** 结构层处理结果 */
  structureResult: {
    chunks: any[];
    metadata: any;
  };
  /** Script处理结果 */
  scriptResults: Array<{
    scriptBlock: ScriptBlock;
    chunks: any[];
    metadata: any;
  }>;
  /** Style处理结果 */
  styleResults: Array<{
    styleBlock: StyleBlock;
    chunks: any[];
    metadata: any;
  }>;
  /** 合并后的最终结果 */
  finalResult: {
    chunks: any[];
    metadata: {
      strategy: string;
      layers: string[];
      processingTime: number;
      scriptCount: number;
      styleCount: number;
      hasEmbeddedContent: boolean;
    };
  };
}

/**
 * 默认HTML分层处理配置
 */
export const DEFAULT_LAYERED_HTML_CONFIG: LayeredHTMLConfig = {
  primary: 'layered_processing',
  layers: [
    {
      type: LayerType.STRUCTURE,
      processor: 'XMLTextStrategy',
      target: 'html_structure',
      enabled: true,
      priority: 1,
      options: {
        preserveRootElement: true,
        preserveComplexElements: true,
        preserveComments: true,
        preserveCDATA: true
      }
    },
    {
      type: LayerType.SCRIPT,
      processor: 'JavaScriptExtractor',
      target: 'script_content',
      enabled: true,
      priority: 2,
      options: {
        extractFunctions: true,
        extractClasses: true,
        extractImports: true,
        enableTypeScript: true
      }
    },
    {
      type: LayerType.STYLE,
      processor: 'CSSExtractor',
      target: 'style_content',
      enabled: true,
      priority: 3,
      options: {
        extractSelectors: true,
        extractRules: true,
        enablePreprocessors: true
      }
    }
  ],
  enableParallel: true,
  mergeStrategy: 'hybrid',
  errorHandling: 'continue-on-error',
  maxProcessingTime: 10000 // 10秒
};

/**
 * HTML内容提取器接口
 */
export interface IHTMLContentExtractor {
  /**
   * 提取Script块
   */
  extractScripts(content: string): ScriptBlock[];
  
  /**
   * 提取Style块
   */
  extractStyles(content: string): StyleBlock[];
  
  /**
   * 检测Script语言类型
   */
  detectScriptLanguage(scriptTag: string): ScriptBlock['language'];
  
  /**
   * 检测Style类型
   */
  detectStyleType(styleTag: string): StyleBlock['styleType'];
}