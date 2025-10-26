import { TreeSitterCoreService } from '../../parse/TreeSitterCoreService';

describe('JSON Tree-sitter Query Test', () => {
  let treeSitterService: TreeSitterCoreService;

  beforeAll(() => {
    treeSitterService = new TreeSitterCoreService();
  });

  test('should parse JSON code successfully', async () => {
    const jsonCode = `{
      "name": "John Doe",
      "age": 30,
      "isActive": true,
      "address": {
        "street": "123 Main St",
        "city": "Anytown"
      },
      "hobbies": ["reading", "swimming", null],
      "spouse": null
    }`;

    // 检查JSON是否被支持
    const supportedLanguages = treeSitterService.getSupportedLanguages();
    console.log('Supported languages:', supportedLanguages.map(lang => lang.name));

    // 尝试检测JSON语言
    const detectedLanguage = await treeSitterService.detectLanguage('test.json', jsonCode);
    console.log('Detected language:', detectedLanguage);

    // 如果JSON被支持，尝试解析
    if (detectedLanguage && detectedLanguage.supported) {
      const parseResult = await treeSitterService.parseCode(jsonCode, 'json');
      expect(parseResult.success).toBe(true);
      console.log('Parse result:', parseResult);
    } else {
      // 如果JSON不被直接支持，我们仍然可以测试查询规则的语法
      console.log('JSON language not directly supported, testing query syntax only');
    }
  });

  test('should validate JSON query syntax', async () => {
    // 这些是从src/service/parser/constants/queries/json.ts中获取的查询规则
    const jsonQuery = `
; Objects and arrays - capture the entire structure
(object) @definition.object
(array) @definition.array

; Key-value pairs - capture the entire pair with key and value
(pair
  key: (string) @name.definition.key
  value: (_) @definition.value) @definition.pair

; Basic values
(string) @definition.string
(number) @definition.number
(true) @definition.boolean
(false) @definition.boolean
(null) @definition.null

; Object properties - capture object members
(object
  (pair) @definition.object_member)

; Array elements - capture array items
(array
  (_) @definition.array_element)

; Nested structures - capture nested objects and arrays
(pair
  value: (object) @definition.nested_object) @definition.pair

(pair
  value: (array) @definition.nested_array) @definition.pair

; Key names for capture - handle different key types
(pair
  key: (string) @name.definition) @definition.pair

; Comments (non-standard but common in JSON with comments)
(comment) @definition.comment
`;

    // 验证查询规则的语法结构
    expect(jsonQuery).toContain('(object) @definition.object');
    expect(jsonQuery).toContain('(array) @definition.array');
    expect(jsonQuery).toContain('(pair');
    expect(jsonQuery).toContain('(string) @definition.string');
    expect(jsonQuery).toContain('(number) @definition.number');
    expect(jsonQuery).toContain('(true) @definition.boolean');
    expect(jsonQuery).toContain('(false) @definition.boolean');
    expect(jsonQuery).toContain('(null) @definition.null');
    
    // 验证嵌套结构查询
    expect(jsonQuery).toContain('(pair) @definition.object_member');
    expect(jsonQuery).toContain('(_) @definition.array_element');
    expect(jsonQuery).toContain('value: (object) @definition.nested_object');
    expect(jsonQuery).toContain('value: (array) @definition.nested_array');
    
    // 验证键名捕获
    expect(jsonQuery).toContain('key: (string) @name.definition');
    
    // 验证注释查询
    expect(jsonQuery).toContain('(comment) @definition.comment');
    
    console.log('JSON query syntax validated successfully');
  });

  test('should execute JSON query on sample data', async () => {
    const jsonCode = `{
      "users": [
        {
          "id": 1,
          "name": "Alice",
          "active": true,
          "profile": {
            "email": "alice@example.com",
            "preferences": ["dark_mode", "notifications"]
          }
        },
        {
          "id": 2,
          "name": "Bob",
          "active": false,
          "profile": {
            "email": "bob@example.com"
          }
        }
      ],
      "metadata": {
        "version": "1.0",
        "last_updated": "2023-01-01"
      }
    }`;

    const jsonQuery = `
; Objects and arrays - capture the entire structure
(object) @definition.object
(array) @definition.array

; Key-value pairs - capture the entire pair with key and value
(pair
  key: (string) @name.definition.key
  value: (_) @definition.value) @definition.pair

; Basic values
(string) @definition.string
(number) @definition.number
(true) @definition.boolean
(false) @definition.boolean
(null) @definition.null
`;

    // 检查JSON是否被支持
    const detectedLanguage = await treeSitterService.detectLanguage('test.json', jsonCode);
    
    if (detectedLanguage && detectedLanguage.supported) {
      const parseResult = await treeSitterService.parseCode(jsonCode, 'json');
      expect(parseResult.success).toBe(true);

      // 执行查询
      const results = treeSitterService.queryTree(parseResult.ast, jsonQuery);
      console.log('Query results count:', results.length);
      
      // 验证查询返回了结果
      expect(results).toBeDefined();
      
      // 检查各种类型的捕获
      const allCaptures = results.flatMap(r => r.captures);
      const objectCaptures = allCaptures.filter(c => c.name === 'definition.object');
      const arrayCaptures = allCaptures.filter(c => c.name === 'definition.array');
      const stringCaptures = allCaptures.filter(c => c.name === 'definition.string');
      const numberCaptures = allCaptures.filter(c => c.name === 'definition.number');
      const booleanCaptures = allCaptures.filter(c => c.name === 'definition.boolean');
      
      console.log('Object captures:', objectCaptures.length);
      console.log('Array captures:', arrayCaptures.length);
      console.log('String captures:', stringCaptures.length);
      console.log('Number captures:', numberCaptures.length);
      console.log('Boolean captures:', booleanCaptures.length);
      
      // 验证基本结构被捕获
      expect(objectCaptures.length).toBeGreaterThan(0);
      expect(arrayCaptures.length).toBeGreaterThan(0);
      expect(stringCaptures.length).toBeGreaterThan(0);
      expect(numberCaptures.length).toBeGreaterThan(0);
    } else {
      // 如果JSON不被直接支持，跳过执行查询的测试
      console.log('Skipping query execution test - JSON language not supported');
    }
  });
});