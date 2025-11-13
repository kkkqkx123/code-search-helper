分析当前 .env:104-104
```
EMBEDDING_BATCH_SIZE = 64
```中设置的批处理大小与 .env:114-114
```
EMBEDDING_PROVIDER_SIMILARITY_BATCH_SIZE = 64
```中单独设置的单独用于相似度计算的provider的配置是否完全独立。此外，需要分析两者现在是如何并行使用的
[x]


src\service\parser\processing\utils\html\HTMLContentExtractor.ts是否越权

stragety的supportedLanguages硬编码，需要统一为src\service\parser\constants\language-constants.ts

ast解析是否不全？标准化查询模块与提取模块是否对应？


@/src/service/parser/processing/strategies/implementations/ASTCodeSplitter.ts 
目前这里全部使用空实现。分析如何获取parser模块中处理后的codechunk与metedata，从而完成分段 
此外，这一段配置是否存在问题：src\service\parser\processing\strategies\implementations\ASTCodeSplitter.ts:33-41
```
    this.config = {
      maxFunctionSize: 3000,
      maxClassSize: 5000,
      minFunctionLines: 3,
      minClassLines: 2,
      maxChunkSize: 1000,
      minChunkSize: 50,
      ...config
    };
```

可以修改接口，配置的修改也是合理的。但需要支持嵌套提取。不过需要给出更好的方案，例如将底层的块作为独立代码块，并额外保留上层结构，但内部的方法等仅保留签名和返回值[仅保留下一层的，更多层的不保留，以提高查询精度]
提取失败则降级处理，使用该目录下的其他策略，优先使用复杂的处理逻辑，以行分段+括号平衡作为最终降级方案。
你可以以cpp的适配器src\service\parser\core\normalization\adapters\CppLanguageAdapter.ts为例进一步分析可以提取哪些模式。模块、导入、导出、结构体等逻辑可以使用单独的块
