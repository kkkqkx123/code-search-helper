对比 @/src/service/parser/core/normalization/adapters/ConfigLanguageAdapter.ts 和 @/src/service/parser/core/normalization/adapters/DefaultLanguageAdapter.ts ，分析配置语言适配器是否引入了过高的复杂度，并作出调整

分析当前DefaultLanguageAdapter.ts模块后续是如何完成去重等操作的(src\service\parser\core\normalization\BaseLanguageAdapter.ts)

配置语言适配器能否复用部分通用方法