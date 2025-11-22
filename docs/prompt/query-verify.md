为 @/src/service/parser/constants/queries/cpp/concurrency-relationships.ts 中所有没有谓词限制的查询模式添加谓词限制，以免匹配无关的。
注意：只能以标准库函数或标准类型作为谓词限制。如果只能以变量名约束，建议直接移除该查询模式并标记为弃用

处理过程：复杂的优先(例如有谓词)