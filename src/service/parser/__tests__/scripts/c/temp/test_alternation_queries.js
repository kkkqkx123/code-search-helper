const Parser = require('tree-sitter');
const C = require('tree-sitter-c');

// 初始化解析器
const parser = new Parser();
parser.setLanguage(C);

// 测试代码 - 来自测试用例
const testCode = `// 结构体定义测试
struct Point {
    int x;
    int y;
};

struct Person {
    char name[50];
    int age;
    float height;
};

// 嵌套结构体
struct Rectangle {
    struct Point top_left;
    struct Point bottom_right;
};

// 联合体定义测试
union Data {
    int integer;
    float floating;
    char text[20];
};

union Value {
    long number;
    double real;
};

// 枚举定义测试
enum Color {
    RED,
    GREEN,
    BLUE
};

enum Status {
    SUCCESS = 0,
    ERROR = 1,
    PENDING = 2
};

// 数组和指针声明测试
int numbers[10];
char* string;
struct Point* point_ptr;

// 成员访问测试
int main() {
    struct Point p;
    p.x = 10;
    p.y = 20;
    
    struct Point* ptr = &p;
    ptr->x = 30;
    ptr->y = 40;
    
    // 数组访问
    numbers[0] = 1;
    numbers[1] = 2;
    
    return 0;
}`;

console.log('开始测试交替查询...');

try {
  // 解析代码
  const tree = parser.parse(testCode);
  console.log('✅ 代码解析成功');

  // 测试原始结构体查询
  console.log('\n--- 测试原始结构体查询 ---');
  const structQueryPattern = `(struct_specifier
    name: (type_identifier) @type.name
    body: (field_declaration_list
      (field_declaration
        type: (_) @field.type
        declarator: (field_identifier) @field.name)*)) @definition.struct`;
  
  const structQuery = new Parser.Query(C, structQueryPattern);
  console.log('✅ 结构体查询编译成功');

  // 执行结构体查询
  const structMatches = structQuery.matches(tree.rootNode);
  console.log(`\n找到 ${structMatches.length} 个结构体定义匹配:`);
  
  structMatches.forEach((match, index) => {
    console.log(`匹配 ${index + 1}:`);
    match.captures.forEach(capture => {
      console.log(`  ${capture.name}: '${capture.node.text}' at ${capture.node.startPosition} - ${capture.node.endPosition}`);
    });
  });

  // 测试交替查询 - 结构体、联合体、枚举定义
  console.log('\n--- 测试交替查询：结构体、联合体、枚举定义 ---');
  const typeAlternationQueryPattern = `[
    (struct_specifier
      name: (type_identifier) @type.name
      body: (field_declaration_list
        (field_declaration
          type: (_) @field.type
          declarator: (field_identifier) @field.name)*)) @definition.struct
    (union_specifier
      name: (type_identifier) @type.name
      body: (field_declaration_list
        (field_declaration
          type: (_) @field.type
          declarator: (field_identifier) @field.name)*)) @definition.union
    (enum_specifier
      name: (type_identifier) @type.name
      body: (enumerator_list
        (enumerator
          name: (identifier) @enum.constant)*)) @definition.enum
  ] @definition.type`;
  
  const typeAlternationQuery = new Parser.Query(C, typeAlternationQueryPattern);
  console.log('✅ 类型定义交替查询编译成功');

  // 执行交替查询
 const typeAlternationMatches = typeAlternationQuery.matches(tree.rootNode);
  console.log(`\n类型定义交替查询找到 ${typeAlternationMatches.length} 个匹配:`);
  
  typeAlternationMatches.forEach((match, index) => {
    console.log(`匹配 ${index + 1}:`);
    match.captures.forEach(capture => {
      console.log(`  ${capture.name}: '${capture.node.text}' at ${capture.node.startPosition} - ${capture.node.endPosition}`);
    });
  });

  // 测试成员访问的交替查询
 console.log('\n--- 测试交替查询：成员访问 ---');
  const memberAccessQueryPattern = `[
    (field_expression
      argument: (identifier) @object.name
      field: (field_identifier) @field.name) @definition.member.access
    (field_expression
      argument: (identifier) @pointer.name
      field: (field_identifier) @field.name) @definition.pointer.member.access
   (field_expression
      argument: (parenthesized_expression
        (pointer_expression
          argument: (identifier) @pointer.name))
      field: (field_identifier) @field.name) @definition.pointer.member.access
 ] @definition.access`;
  
  const memberAccessQuery = new Parser.Query(C, memberAccessQueryPattern);
  console.log('✅ 成员访问交替查询编译成功');

  // 执行成员访问查询
  const memberAccessMatches = memberAccessQuery.matches(tree.rootNode);
  console.log(`\n成员访问交替查询找到 ${memberAccessMatches.length} 个匹配:`);
  
  memberAccessMatches.forEach((match, index) => {
    console.log(`匹配 ${index + 1}:`);
    match.captures.forEach(capture => {
      console.log(`  ${capture.name}: '${capture.node.text}' at ${capture.node.startPosition} - ${capture.node.endPosition}`);
    });
  });

  // 测试数组和指针声明的交替查询
 console.log('\n--- 测试交替查询：数组和指针声明 ---');
  const variableDeclarationQueryPattern = `[
    (declaration
      type: (_)
      declarator: (array_declarator
        declarator: (identifier) @array.name
        size: (_)? @array.size)) @definition.array
    (declaration
      type: (_)
      declarator: (pointer_declarator
        declarator: (identifier) @pointer.name)) @definition.pointer
  ] @definition.variable`;
  
  const variableDeclarationQuery = new Parser.Query(C, variableDeclarationQueryPattern);
  console.log('✅ 变量声明交替查询编译成功');

  // 执行变量声明查询
  const variableDeclarationMatches = variableDeclarationQuery.matches(tree.rootNode);
  console.log(`\n变量声明交替查询找到 ${variableDeclarationMatches.length} 个匹配:`);
  
  variableDeclarationMatches.forEach((match, index) => {
    console.log(`匹配 ${index + 1}:`);
    match.captures.forEach(capture => {
      console.log(`  ${capture.name}: '${capture.node.text}' at ${capture.node.startPosition} - ${capture.node.endPosition}`);
    });
  });

  // 测试数组访问的交替查询
  console.log('\n--- 测试交替查询：数组访问 ---');
  const arrayAccessQueryPattern = `[
    (subscript_expression
      argument: (identifier) @array.name
      index: (_) @index) @definition.array.access
    (subscript_expression
      argument: (subscript_expression
        argument: (identifier) @array.name
        index: (_))
      index: (_) @index) @definition.array.access
 ] @definition.array.access`;
  
  const arrayAccessQuery = new Parser.Query(C, arrayAccessQueryPattern);
  console.log('✅ 数组访问交替查询编译成功');

  // 执行数组访问查询
  const arrayAccessMatches = arrayAccessQuery.matches(tree.rootNode);
  console.log(`\n数组访问交替查询找到 ${arrayAccessMatches.length} 个匹配:`);
  
  arrayAccessMatches.forEach((match, index) => {
    console.log(`匹配 ${index + 1}:`);
    match.captures.forEach(capture => {
      console.log(`  ${capture.name}: '${capture.node.text}' at ${capture.node.startPosition} - ${capture.node.endPosition}`);
    });
  });

  console.log('\n🎉 所有测试通过！交替查询工作正常。');
} catch (error) {
  console.error('❌ 测试失败:', error.message);
  console.error('堆栈:', error.stack);
}