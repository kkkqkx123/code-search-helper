/**
 * HTML处理工具模块导出
 */

// 内容提取器
export { HTMLContentExtractor } from './HTMLContentExtractor';

// 处理工具
export { HTMLProcessingUtils } from './HTMLProcessingUtils';

// 配置和类型
export {
    LayerType,
    LayerConfig,
    LayeredHTMLConfig,
    ScriptBlock,
    StyleBlock,
    LayeredProcessingResult,
    DEFAULT_LAYERED_HTML_CONFIG,
    IHTMLContentExtractor
} from './LayeredHTMLConfig';

// 新增的工具类
export { HTMLContentSeparator } from './HTMLContentSeparator';
export { HTMLFallbackProcessor } from './HTMLFallbackProcessor';
export { HTMLChunkFactory } from './HTMLChunkFactory';
export { HTMLResultMerger } from './HTMLResultMerger';