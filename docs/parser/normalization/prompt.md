/step-by-step-analysis 
当前c语言的tree-sitter查询模式见src\service\parser\constants\queries\c\relationships目录和
src\service\parser\constants\queries\c\entities.ts
分析该使用怎样的类型来存储实体查询结果和关系查询结果(可以使用不同的类型定义)
初步设计见 src/service/parser/core/normalization/types.ts 
后续需要用于向量嵌入和图索引。
其中向量索引需要的代码转文本的逻辑参考docs\ref\后处理.md
docs\ref\qdrant经验.md。图索引主要需要在ast节点间建立关系。

分析该如何设计标准化查询结果的类型。设计方案写入docs\parser\normalization目录。请描述即可，不需要完整代码实现

目前代码中的向量嵌入、图索引还未完善，你不必查看。

---

分析StandardizedQueryResult是否能有效表示实体查询结果 
分析StandardizedQueryResult是否能有效表示关系查询结果
此外，分析哪些功能多余，或可以等待后续实现，以免在初期出现太高的复杂度

---

枚举类型建议单独定义，方便适配不同语言，例如struct不适用于c语言。然后继续设计通用的关系类型，枚举同样单独实现。 
采用图数据库的节点-关系模型设计关系类型