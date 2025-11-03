当前项目中包含 language mapping 定义的文件如下：

1. [`src/service/parser/core/normalization/QueryTypeMappings.ts`](src/service/parser/core/normalization/QueryTypeMappings.ts:23) - 这是主要的 language mapping 定义文件，其中：
   - 定义了 `LANGUAGE_QUERY_MAPPINGS` 常量，包含了多种编程语言（如 Rust、TypeScript、Python、Java 等）的查询类型映射关系
   - 提供了 `QueryTypeMapper` 类，包含添加、更新、验证和查询 language mapping 的方法
   - 实现了完整的语言映射系统，支持类型映射、验证和查询功能

2. [`src/service/parser/core/normalization/__tests__/QueryTypeMapper.test.ts`](src/service/parser/core/normalization/__tests__/QueryTypeMapper.test.ts:121) - 这是 language mapping 的测试文件，其中：
   - 包含了对 `addLanguageMapping` 方法的测试用例
   - 验证了 language mapping 的添加和覆盖功能
   - 测试了各种语言映射的正确性