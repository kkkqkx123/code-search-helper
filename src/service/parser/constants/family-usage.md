分析结果
LanguageFamily 枚举是有实际使用的，但存在重复定义问题和可以优化的地方：

当前使用情况
comment-syntax.ts - 正在使用 ✓
按语言家族定义注释语法规则（第53-119行）
这是核心使用场景
发现的问题
存在两套冗余的分类系统：

LanguageFamily (11个分类)：C, JAVA, PYTHON, JAVASCRIPT, FUNCTIONAL, SCRIPTING, MARKUP, STYLE, DATA, CONFIG, UNKNOWN

LanguageCore.ts (6个分类)：advanced_programming, basic_programming, data_format, special_processing, hybrid_processing, text_format

LanguageMappingConfig.ts (4个分类)：programming, markup, data, config

可以优化的地方
统一分类标准 - 删除LanguageMappingConfig中冗余的LANGUAGE_CATEGORIES，使用LanguageCore中的category字段
扩展LanguageFamily用途 - 目前只在comment-syntax中使用，可以扩展到其他地方（如语法检测、错误处理等）
简化映射关系 - 建立LanguageFamily → LanguageCore.category的映射
建议修改
使用LanguageCore的category字段替代LanguageMappingConfig中的分类，统一化管理。