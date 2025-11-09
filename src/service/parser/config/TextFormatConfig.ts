/**
* 纯文本格式语言配置
* 包含 txt、ini、csv、log 等纯文本文件
* 这些文件应该直接使用通用文本处理逻辑，跳过复杂的 AST 解析和查询
*/

export { TEXT_FORMAT_STRATEGY, TEXT_FORMAT_LANGUAGES } from '../constants/language-constants';