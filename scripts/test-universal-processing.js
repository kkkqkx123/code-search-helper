
#!/usr/bin/env node

/**
 * 通用文件处理系统测试脚本
 * 用于验证整个系统的功能，包括内存泄漏测试和性能测试
 */

const fs = require('fs');
const path = require('path');

// 测试配置
const TEST_CONFIG = {
  testFilesDir: path.join(__dirname, '../test-files'),
  outputDir: path.join(__dirname, '../test-results'),
  maxTestFiles: 100,
  memoryThresholdMB: 500,
  performanceThresholdMs: 5000
};

// 确保测试目录存在
function ensureDirectories() {
  if (!fs.existsSync(TEST_CONFIG.testFilesDir)) {
    fs.mkdirSync(TEST_CONFIG.testFilesDir, { recursive: true });
  }
  
  if (!fs.existsSync(TEST_CONFIG.outputDir)) {
    fs.mkdirSync(TEST_CONFIG.outputDir, { recursive: true });
  }
}

// 生成测试文件
function generateTestFiles() {
  console.log('生成测试文件...');
  
  const testCases = [
    {
      name: 'typescript-normal.ts',
      content: generateTypeScriptCode(1000)
    },
    {
      name: 'javascript-normal.js',
      content: generateJavaScriptCode(1000)
    },
    {
      name: 'python-normal.py',
      content: generatePythonCode(1000)
    },
    {
      name: 'typescript-backup.ts.bak',
      content: generateTypeScriptCode(800)
    },
    {
      name: 'javascript-backup.js.backup',
      content: generateJavaScriptCode(800)
    },
    {
      name: 'python-backup.py.old',
      content: generatePythonCode(800)
    },
    {
      name: 'no-extension',
      content: `#!/usr/bin/env node
${generateJavaScriptCode(500)}`
    },
    {
      name: 'mismatched-extension.md',
      content: generateTypeScriptCode(600)
    },
    {
      name: 'large-typescript.ts',
      content: generateTypeScriptCode(5000)
    },
    {
      name: 'xml-data.xml',
      content: generateXMLCode(1000)
    }
  ];

  testCases.forEach(testCase => {
    const filePath = path.join(TEST_CONFIG.testFilesDir, testCase.name);
    fs.writeFileSync(filePath, testCase.content);
    console.log(`创建测试文件: ${testCase.name}`);
  });
}

// 生成TypeScript代码
function generateTypeScriptCode(lines) {
  const imports = [
    'import { Component, OnInit } from \'@angular/core\';',
    'import { Observable, of } from \'rxjs\';',
    'import { map, catchError } from \'rxjs/operators\';',
    'import { HttpClient } from \'@angular/common/http\';'
  ];

  const interfaces = [
    'interface User {',
    '  id: number;',
    '  name: string;',
    '  email: string;',
    '  isActive: boolean;',
    '}',
    '',
    'interface ApiResponse<T> {',
    '  data: T;',
    '  success: boolean;',
    '  message?: string;',
    '}'
  ];

  const classes = [
    '@Component({',
    '  selector: \'app-user-list\',',
    '  template: \`<div>{{ users.length }} users found</div>\`',
    '})',
    'export class UserListComponent implements OnInit {',
    '  users: User[] = [];',
    '  loading = false;',
    '',
    '  constructor(private http: HttpClient) {}',
    '',
    '  ngOnInit() {',
    '    this.loadUsers();',
    '  }',
    '',
    '  loadUsers(): void {',
    '    this.loading = true;',
    '    this.http.get<ApiResponse<User[]>>(\'/api/users\')',
    '      .pipe(',
    '        map(response => response.data),',
    '        catchError(error => {',
    '          console.error(\'Error loading users:\', error);',
    '          return of([]);',
    '        })',
    '      )',
    '      .subscribe(users => {',
    '        this.users = users;',
    '        this.loading = false;',
    '      });',
    '  }',
    '}'
  ];

  const functions = [
    'function formatUserName(user: User): string {',
    '  return `${user.name} (${user.email})`;',
    '}',
    '',
    'function isUserActive(user: User): boolean {',
    '  return user.isActive && user.lastLogin > new Date(Date.now() - 30