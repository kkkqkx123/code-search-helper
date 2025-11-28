/*
C Creation Relationships-specific Tree-Sitter Query Patterns
用于识别和分析代码中的对象创建关系
合并了lifecycle.ts和semantic.ts中的重复内存分配查询
*/
export default `
; 内存分配创建关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.creation.function.from)
  body: (compound_statement
    (_
      (init_declarator
        declarator: (pointer_declarator
          declarator: (identifier) @relationship.creation.allocation.to)
        value: (call_expression
          function: (identifier) _
          (#match? _ "^(malloc|calloc|realloc|alloca)$")
        )
      ) @relationship.creation.allocation
    )
  )
)

; 文件创建/打开关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.creation.function.from)
  body: (compound_statement
    (_
      (init_declarator
        declarator: (identifier) @relationship.creation.file.to)
        value: (call_expression
          function: (identifier) _
          (#match? _ "^(fopen|open|create)$")
        )
      ) @relationship.creation.file
    )
  )
)

; 文件关闭关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.creation.function.from)
  body: (compound_statement
    (_
      (call_expression
        function: (identifier) @relationship.creation.file-close.to
        (#match? @relationship.creation.file-close.to "^(fclose|close)$")
      ) @relationship.creation.file-close
    )
  )
)

; 文件读取关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.creation.function.from)
  body: (compound_statement
    (_
      (call_expression
        function: (identifier) @relationship.creation.file-read.to
        (#match? @relationship.creation.file-read.to "^(fread|read|fgets|getline)$")
      ) @relationship.creation.file-read
    )
  )
)

; 文件写入关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.creation.function.from)
  body: (compound_statement
    (_
      (call_expression
        function: (identifier) @relationship.creation.file-write.to
        (#match? @relationship.creation.file-write.to "^(fwrite|write|fputs|fprintf)$")
      ) @relationship.creation.file-write
    )
  )
)

; 条件变量创建关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.creation.function.from)
  body: (compound_statement
    (_
      (call_expression
        function: (identifier) @relationship.creation.condition.to)
      ) @relationship.creation.condition
    )
  )
)

; 信号量创建关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.creation.function.from)
  body: (compound_statement
    (_
      (call_expression
        function: (identifier) @relationship.creation.semaphore.to)
      ) @relationship.creation.semaphore
    )
  )
)

; 套接字创建关系
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @relationship.creation.function.from)
  body: (compound_statement
    (_
      (call_expression
        function: (identifier) @relationship.creation.socket.to)
      ) @relationship.creation.socket
    )
  )
)
`;