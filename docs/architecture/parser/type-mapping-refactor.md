# TypeMappingUtils.ts 重构具体修改步骤

## 第一阶段：清理TypeMappingUtils.ts

### 步骤1：修改TypeMappingUtils.ts
**文件**：`src\service\parser\core\normalization\utils\TypeMappingUtils.ts`

**修改内容**：
1. 删除QueryTypeMapper类（第546-589行）
2. 删除globalQueryTypeMapper实例（第644行）
3. 删除mapQueryType函数（第657-659行）
4. 保留NodeTypeMapper、RelationshipTypeMapper类及其相关功能
5. 更新文件顶部的注释，说明文件专注于节点类型和关系类型映射

## 第二阶段：重构语言适配器

### 步骤2：修改BaseLanguageAdapter.ts
**文件**：`src\service\parser\core\normalization\BaseLanguageAdapter.ts`

**修改内容**：
1. 导入TypeMappingUtils中的NodeTypeMapper
2. 在构造函数中初始化NodeTypeMapper实例
3. 修改mapNodeType方法，使用NodeTypeMapper进行映射
4. 添加protected方法getNodeTypeMapper()供子类访问

### 步骤3：重构各语言适配器
**文件列表**：
- `src\service\parser\core\normalization\adapters\RustLanguageAdapter.ts`
- `src\service\parser\core\normalization\adapters\TypeScriptLanguageAdapter.ts`
- `src\service\parser\core\normalization\adapters\JavaScriptLanguageAdapter.ts`
- `src\service\parser\core\normalization\adapters\PythonLanguageAdapter.ts`
- `src\service\parser\core\normalization\adapters\JavaLanguageAdapter.ts`
- `src\service\parser\core\normalization\adapters\CppLanguageAdapter.ts`
- `src\service\parser\core\normalization\adapters\CLanguageAdapter.ts`
- `src\service\parser\core\normalization\adapters\CSharpLanguageAdapter.ts`
- `src\service\parser\core\normalization\adapters\KotlinLanguageAdapter.ts`
- `src\service\parser\core\normalization\adapters\CssLanguageAdapter.ts`
- `src\service\parser\core\normalization\adapters\HtmlLanguageAdapter.ts`
- `src\service\parser\core\normalization\adapters\VueLanguageAdapter.ts`
- `src\service\parser\core\normalization\adapters\TSXLanguageAdapter.ts`

**修改内容**（每个适配器文件）：
1. 删除节点类型映射常量（如RUST_NODE_TYPE_MAPPING等）
2. 修改构造函数，调用父类构造函数并添加标准映射
3. 删除自定义mapNodeType方法实现
4. 在构造函数中使用getNodeTypeMapper().addStandardMappings(language)添加标准映射
5. 使用getNodeTypeMapper().addMapping()添加语言特定的映射

## 第三阶段：重构关系类型映射

### 步骤4：修改BaseRelationshipExtractor.ts
**文件**：`src\service\parser\core\normalization\base\BaseRelationshipExtractor.ts`

**修改内容**：
1. 导入TypeMappingUtils中的RelationshipTypeMapper
2. 在构造函数中初始化RelationshipTypeMapper实例
3. 修改mapRelationshipType方法，使用RelationshipTypeMapper进行映射
4. 添加protected方法getRelationshipTypeMapper()供子类访问

### 步骤5：修改GraphDataMappingService.ts
**文件**：`src\service\graph\mapping\GraphDataMappingService.ts`

**修改内容**：
1. 导入TypeMappingUtils中的RelationshipTypeMapper
2. 在构造函数中初始化RelationshipTypeMapper实例
3. 修改mapRelationshipTypeToGraphType方法，使用RelationshipTypeMapper进行映射
4. 添加标准关系类型映射

## 第四阶段：更新测试文件

### 步骤6：更新适配器测试文件
**文件列表**：
- `src\service\parser\core\normalization\adapters\__tests__\RustLanguageAdapter.test.ts`
- `src\service\parser\core\normalization\adapters\__tests__\KotlinLanguageAdapter.test.ts`
- `src\service\parser\core\normalization\adapters\__tests__\JavaLanguageAdapter.test.ts`
- 其他相关测试文件

**修改内容**：
1. 更新测试用例，确保映射功能正常工作
2. 添加对TypeMappingUtils缓存功能的测试
3. 验证性能改进

### 步骤7：更新QueryResultNormalizer测试
**文件**：`src\service\parser\core\normalization\__tests__\QueryResultNormalizer.test.ts`

**修改内容**：
1. 更新mapNodeType相关测试
2. 确保与新的映射框架兼容

## 第五阶段：清理和优化

### 步骤8：清理未使用的导入和代码
**文件**：多个相关文件

**修改内容**：
1. 删除不再使用的映射常量导入
2. 清理重复的映射逻辑
3. 优化导入语句

### 步骤9：更新文档
**文件**：`src\service\parser\core\normalization\utils\README.md`

**修改内容**：
1. 更新文档说明TypeMappingUtils的新用途
2. 添加使用示例
3. 说明重构后的架构

## 验证步骤

### 步骤10：运行测试验证
**命令**：
```bash
npm test src/service/parser/core/normalization/adapters/__tests__/
npm test src/service/parser/core/normalization/__tests__/
npm test src/service/graph/mapping/__tests__/
```

**验证内容**：
1. 所有测试用例通过
2. 映射功能正常工作
3. 性能有所提升
4. 缓存机制正常工作

## 预期效果

1. **代码减少**：删除约1000+行重复的映射代码
2. **性能提升**：通过缓存机制提高映射性能
3. **维护性增强**：统一的映射框架，易于维护和扩展
4. **一致性保证**：所有语言使用相同的映射逻辑
5. **功能增强**：支持优先级、条件映射等高级功能

这个重构计划分阶段实施，可以逐步验证每个阶段的效果，确保系统稳定性。