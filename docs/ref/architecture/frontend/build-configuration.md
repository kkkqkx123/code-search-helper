# 前端构建配置文档

## 构建工具配置

### 1. Vite 配置详解

#### 1.1 基础配置
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // 插件配置
  plugins: [react()],
  
  // 路径别名配置
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './components'),
      '@hooks': path.resolve(__dirname, './hooks'),
      '@services': path.resolve(__dirname, './services'),
      '@types': path.resolve(__dirname, './types'),
      '@utils': path.resolve(__dirname, './utils'),
      '@store': path.resolve(__dirname, './store'),
      '@styles': path.resolve(__dirname, './styles'),
      '@config': path.resolve(__dirname, './config'),
    },
  },
  
  // 开发服务器配置
  server: {
    port: 3000,
    open: true,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/api/v1'),
      },
    },
  },
  
  // 预览服务器配置
  preview: {
    port: 4173,
    host: true,
  },
  
  // 依赖优化
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'react-query',
      'd3',
      'vis-network',
      'vis-data',
    ],
  },
});
```

#### 1.2 生产构建配置
```typescript
// 生产环境构建配置
export default defineConfig({
  build: {
    // 输出目录
    outDir: '../../dist/frontend',
    
    // 清空输出目录
    emptyOutDir: true,
    
    // 资源内联限制
    assetsInlineLimit: 4096,
    
    // 代码分割配置
    rollupOptions: {
      output: {
        manualChunks: {
          // 第三方库代码分割
          vendor: ['react', 'react-dom', 'react-router-dom'],
          dataVis: ['d3', 'vis-network', 'vis-data'],
          state: ['react-query'],
          utils: ['axios', 'use-debounce'],
        },
        // 资源文件命名
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const extType = info[info.length - 1];
          if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(assetInfo.name)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/\.(woff|woff2|ttf|eot|otf)$/i.test(assetInfo.name)) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          if (/\.(css)$/i.test(assetInfo.name)) {
            return `assets/css/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        // JS 文件命名
        chunkFileNames: 'assets/js/[name]-[hash].js',
        // 入口文件命名
        entryFileNames: 'assets/js/[name]-[hash].js',
      },
    },
    
    // 压缩配置
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'],
      },
      format: {
        comments: false,
      },
    },
    
    // 生成 source map
    sourcemap: true,
    
    // 构建报告
    reportCompressedSize: true,
    
    // 目标浏览器
    target: ['es2015', 'chrome58', 'firefox57', 'safari11', 'edge16'],
    
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    
    // CSS 目标
    cssTarget: ['es2015', 'chrome58', 'firefox57', 'safari11', 'edge16'],
  },
});
```

#### 1.3 环境变量配置
```bash
# .env.development
VITE_API_BASE_URL=http://localhost:3001/api/v1
VITE_ENABLE_DEBUG_MODE=true
VITE_APP_NAME=Codebase Index MCP
VITE_APP_VERSION=1.0.0

# .env.production
VITE_API_BASE_URL=https://api.example.com/api/v1
VITE_ENABLE_DEBUG_MODE=false
VITE_APP_NAME=Codebase Index MCP
VITE_APP_VERSION=1.0.0
VITE_ANALYTICS_ID=GA-XXXXXXXXX
```

### 2. TypeScript 配置

#### 2.1 主配置文件
```json
// tsconfig.json
{
  "compilerOptions": {
    // 目标版本
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    
    // 模块解析
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    
    // JavaScript 支持
    "allowJs": false,
    "checkJs": false,
    
    // 发射配置
    "noEmit": true,
    "isolatedModules": true,
    
    // 语法检查
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    
    // React 配置
    "jsx": "react-jsx",
    
    // 路径映射
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@api/*": ["api/*"],
      "@components/*": ["components/*"],
      "@contexts/*": ["contexts/*"],
      "@hooks/*": ["hooks/*"],
      "@services/*": ["services/*"],
      "@types/*": ["types/*"],
      "@utils/*": ["utils/*"],
      "@store/*": ["store/*"],
      "@styles/*": ["styles/*"],
      "@config/*": ["config/*"]
    },
    
    // 类型声明
    "declaration": false,
    "declarationMap": false,
    "sourceMap": true,
    
    // 实验性特性
    "experimentalDecorators": false,
    "emitDecoratorMetadata": false,
    
    // 高级配置
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "useDefineForClassFields": true
  },
  
  "include": [
    "src",
    "components",
    "hooks",
    "services",
    "types",
    "utils",
    "store",
    "styles",
    "config",
    "contexts",
    "api",
    "__tests__",
    "App.tsx",
    "main.tsx",
    "global.d.ts",
    "vite-env.d.ts"
  ],
  
  "exclude": [
    "node_modules",
    "dist",
    "coverage",
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/*.spec.ts",
    "**/*.spec.tsx"
  ],
  
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

#### 2.2 Node.js 配置
```json
// tsconfig.node.json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "target": "ES2020"
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

#### 2.3 应用配置
```json
// tsconfig.app.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist/types"
  },
  "exclude": [
    "node_modules",
    "dist",
    "coverage",
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/*.spec.ts",
    "**/*.spec.tsx",
    "vite.config.ts",
    "vitest.config.ts"
  ]
}
```

### 3. 代码质量工具配置

#### 3.1 ESLint 配置
```javascript
// eslint.config.js
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  // 基础规则
  js.configs.recommended,
  
  // TypeScript 规则
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        project: './tsconfig.json',
      },
      globals: {
        ...globals.browser,
        ...globals.es2020,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // TypeScript 规则
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_' 
      }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/prefer-const': 'error',
      '@typescript-eslint/no-var-requires': 'error',
      
      // React Hooks 规则
      ...reactHooks.configs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      
      // React Refresh 规则
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      
      // 通用规则
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'template-curly-spacing': 'error',
      'prefer-destructuring': ['error', { 
        array: true, 
        object: true 
      }, { 
        enforceForRenamedProperties: false 
      }],
    },
  },
  
  // 忽略文件
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '*.config.js',
      '*.config.ts',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
    ],
  },
];
```

#### 3.2 Prettier 配置
```javascript
// .prettierrc.js
module.exports = {
  // 打印宽度
  printWidth: 100,
  
  // 制表符宽度
  tabWidth: 2,
  
  // 使用制表符
  useTabs: false,
  
  // 分号
  semi: true,
  
  // 单引号
  singleQuote: true,
  
  // 引号类型
  quoteProps: 'as-needed',
  
  // JSX 引号
  jsxSingleQuote: true,
  
  // 尾随逗号
  trailingComma: 'es5',
  
  // 括号空格
  bracketSpacing: true,
  
  // JSX 括号
  bracketSameLine: false,
  
  // 箭头函数括号
  arrowParens: 'always',
  
  // 文件末尾换行
  endOfLine: 'lf',
  
  // 格式化注释
  proseWrap: 'preserve',
  
  // HTML 空格敏感性
  htmlWhitespaceSensitivity: 'css',
  
  // Vue 脚本缩进
  vueIndentScriptAndStyle: false,
  
  // 嵌入式语言格式化
  embeddedLanguageFormatting: 'auto',
  
  // 覆盖配置文件
  configPath: '.prettierrc.js',
  
  // 忽略文件
  ignorePath: '.prettierignore',
};
```

#### 3.3 忽略文件配置
```
# .prettierignore
# 依赖目录
node_modules/

# 构建输出
dist/
build/

# 测试覆盖率
coverage/

# 静态资源
public/
*.min.js
*.min.css

# 锁文件
package-lock.json
yarn.lock

# 日志文件
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# 环境文件
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# 编辑器配置
.vscode/
.idea/
*.swp
*.swo
*~

# 操作系统文件
.DS_Store
Thumbs.db
```

### 4. 测试配置

#### 4.1 Jest 配置详解
```javascript
// jest.config.js
module.exports = {
  // 预设配置
  preset: 'ts-jest',
  
  // 测试环境
  testEnvironment: 'jsdom',
  
  // 测试文件匹配
  testMatch: [
    '<rootDir>/__tests__/**/*.test.(ts|tsx)',
    '<rootDir>/components/**/__tests__/*.(ts|tsx)',
    '<rootDir>/hooks/**/__tests__/*.(ts|tsx)',
    '<rootDir>/services/**/__tests__/*.(ts|tsx)',
  ],
  
  // 测试文件忽略
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
  ],
  
  // 设置文件
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  
  // 模块名称映射
  moduleNameMapper: {
    // CSS 模块处理
    '\\.module\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    
    // 路径别名映射
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@api/(.*)$': '<rootDir>/api/$1',
    '^@components/(.*)$': '<rootDir>/components/$1',
    '^@contexts/(.*)$': '<rootDir>/contexts/$1',
    '^@hooks/(.*)$': '<rootDir>/hooks/$1',
    '^@services/(.*)$': '<rootDir>/services/$1',
    '^@types/(.*)$': '<rootDir>/types/$1',
    '^@utils/(.*)$': '<rootDir>/utils/$1',
    '^@store/(.*)$': '<rootDir>/store/$1',
    '^@styles/(.*)$': '<rootDir>/styles/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
    
    // D3 模块模拟
    '^d3$': '<rootDir>/__mocks__/d3Mock.js',
    '^d3-(.*)$': '<rootDir>/__mocks__/d3Mock.js',
  },
  
  // 转换配置
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      diagnostics: {
        ignoreCodes: ['TS1343'] // 忽略 import.meta 语法错误
      },
      astTransformers: {
        before: [
          {
            path: 'ts-jest-mock-import-meta',
            options: {
              metaObjectReplacement: {
                env: {
                  VITE_API_BASE_URL: 'http://localhost:3001/api/v1',
                  VITE_ENABLE_DEBUG_MODE: 'false'
                }
              }
            }
          }
        ]
      }
    }],
  },
  
  // 转换忽略模式
  transformIgnorePatterns: [
    'node_modules/(?!d3|d3-array|d3-axis|d3-brush|d3-chord|d3-color|d3-contour|d3-delaunay|d3-dispatch|d3-drag|d3-dsv|d3-ease|d3-fetch|d3-force|d3-format|d3-geo|d3-hierarchy|d3-interpolate|d3-path|d3-polygon|d3-quadtree|d3-random|d3-scale-chromatic|d3-selection|d3-shape|d3-time|d3-time-format|d3-timer|d3-transition|d3-zoom)/'
  ],
  
  // 覆盖率配置
  collectCoverageFrom: [
    'components/**/*.(ts|tsx)',
    'hooks/**/*.(ts|tsx)',
    'services/**/*.(ts|tsx)',
    'utils/**/*.(ts|tsx)',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/*.d.ts',
    '!**/index.ts',
    '!**/*.stories.tsx',
  ],
  
  // 覆盖率目录
  coverageDirectory: '../coverage/frontend',
  
  // 覆盖率报告格式
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  
  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  
  // 测试超时
  testTimeout: 10000,
  
  // 慢测试阈值
  slowTestThreshold: 5,
  
  // 工作进程数
  maxWorkers: '50%',
  
  // 模块文件扩展
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // 根目录
  rootDir: '.',
};
```

#### 4.2 测试设置文件
```typescript
// __tests__/setup.ts
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';

// 全局测试配置
global.CSS = {
  supports: jest.fn(() => false),
  escape: jest.fn((str) => str),
};

// 模拟 window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // 废弃
    removeListener: jest.fn(), // 废弃
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// 模拟 IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
  root = null;
  rootMargin = '';
  thresholds = [];
};

// 模拟 ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// 清理函数
afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

// 全局错误处理
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
```

## 性能优化配置

### 1. 代码分割策略

#### 1.1 路由级代码分割
```typescript
// 路由配置使用懒加载
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';

// 懒加载组件
const Dashboard = lazy(() => import('./components/dashboard/Dashboard'));
const Search = lazy(() => import('./components/search/CodeSearch'));
const Graph = lazy(() => import('./components/graph/GraphVisualization'));

// 路由配置
const AppRoutes = () => (
  <Suspense fallback={<LoadingSpinner />}>
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/search" element={<Search />} />
      <Route path="/graph" element={<Graph />} />
    </Routes>
  </Suspense>
);
```

#### 1.2 组件级代码分割
```typescript
// 大型组件动态导入
import { lazy, Suspense } from 'react';

// 动态导入大型组件
const HeavyComponent = lazy(() => 
  import('./components/heavy/HeavyComponent')
);

// 条件渲染时使用
const ConditionalHeavyComponent = ({ shouldRender }) => {
  if (!shouldRender) return null;
  
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <HeavyComponent />
    </Suspense>
  );
};
```

#### 1.3 第三方库代码分割
```typescript
// vite.config.ts 中的 manualChunks
manualChunks: {
  // React 相关库
  'react-vendor': ['react', 'react-dom', 'react-router-dom'],
  
  // 状态管理
  'state-management': ['react-query', 'zustand'],
  
  // 数据可视化
  'data-visualization': ['d3', 'vis-network', 'vis-data'],
  
  // HTTP 客户端
  'http-client': ['axios'],
  
  // 工具库
  'utilities': ['lodash', 'dayjs', 'clsx'],
}
```

### 2. 资源优化配置

#### 2.1 图片资源优化
```typescript
// vite.config.ts 中的资源处理
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const extType = info[info.length - 1];
          
          // 图片资源
          if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(assetInfo.name)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          
          // 字体资源
          if (/\.(woff|woff2|ttf|eot|otf)$/i.test(assetInfo.name)) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          
          // CSS 文件
          if (/\.(css)$/i.test(assetInfo.name)) {
            return `assets/css/[name]-[hash][extname]`;
          }
          
          // 其他资源
          return `assets/[name]-[hash][extname]`;
        },
      },
    },
  },
  
  // 图片压缩插件配置
  plugins: [
    react(),
    viteImagemin({
      gifsicle: {
        optimizationLevel: 7,
        interlaced: false,
      },
      optipng: {
        optimizationLevel: 7,
      },
      mozjpeg: {
        quality: 20,
      },
      pngquant: {
        quality: [0.8, 0.9],
        speed: 4,
      },
      svgo: {
        plugins: [
          {
            name: 'removeViewBox',
          },
          {
            name: 'removeEmptyAttrs',
            active: false,
          },
        ],
      },
    }),
  ],
});
```

#### 2.2 字体优化配置
```css
/* styles/fonts.css */
/* 字体预加载 */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/assets/fonts/Inter-Regular.woff2') format('woff2');
}

@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url('/assets/fonts/Inter-Medium.woff2') format('woff2');
}

@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url('/assets/fonts/Inter-SemiBold.woff2') format('woff2');
}

/* 字体族定义 */
:root {
  --font-family-base: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  --font-family-mono: 'Fira Code', 'Monaco', 'Cascadia Code', 'Roboto Mono', monospace;
}
```

#### 2.3 CSS 优化配置
```typescript
// vite.config.ts CSS 配置
export default defineConfig({
  css: {
    // CSS 模块配置
    modules: {
      scopeBehaviour: 'local',
      localsConvention: 'camelCaseOnly',
      generateScopedName: '[name]__[local]___[hash:base64:5]',
      hashPrefix: 'prefix',
      globalModulePaths: [/global\.css$/],
    },
    
    // PostCSS 配置
    postcss: {
      plugins: [
        require('autoprefixer')({
          overrideBrowserslist: [
            '> 1%',
            'last 2 versions',
            'not dead',
            'not ie 11'
          ],
          grid: true,
        }),
        require('postcss-preset-env')({
          stage: 3,
          features: {
            'nesting-rules': true,
            'custom-media-queries': true,
            'custom-properties': true,
          },
        }),
        require('cssnano')({
          preset: ['default', {
            discardComments: { removeAll: true },
            normalizeWhitespace: true,
            colormin: true,
            convertValues: true,
            discardDuplicates: true,
            mergeLonghand: true,
            mergeRules: true,
            minifyFontValues: true,
            minifySelectors: true,
            reduceIdents: false,
            svgo: true,
            uniqueSelectors: true,
            zindex: false,
          }],
        }),
      ],
    },
    
    // 预处理器选项
    preprocessorOptions: {
      scss: {
        additionalData: `@import "@styles/variables.scss";`,
      },
      less: {
        modifyVars: {
          '@primary-color': '#007bff',
          '@success-color': '#28a745',
          '@warning-color': '#ffc107',
          '@error-color': '#dc3545',
        },
      },
    },
    
    // 开发源映射
    devSourcemap: true,
  },
});
```

### 3. 运行时性能优化

#### 3.1 预加载和预连接
```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    
    <!-- DNS 预连接 -->
    <link rel="dns-prefetch" href="https://api.example.com" />
    <link rel="preconnect" href="https://api.example.com" crossorigin />
    
    <!-- 字体预加载 -->
    <link rel="preload" href="/assets/fonts/Inter-Regular.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="/assets/fonts/Inter-Medium.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="/assets/fonts/Inter-SemiBold.woff2" as="font" type="font/woff2" crossorigin />
    
    <!-- 关键 CSS -->
    <link rel="preload" href="/assets/css/critical.css" as="style" />
    <link rel="stylesheet" href="/assets/css/critical.css" />
    
    <!-- 预加载关键 JS 模块 -->
    <link rel="modulepreload" href="/assets/js/vendor-[hash].js" />
    <link rel="modulepreload" href="/assets/js/react-vendor-[hash].js" />
    
    <title>Codebase Index MCP</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

#### 3.2 资源提示配置
```typescript
// vite.config.ts 中的资源提示
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'resource-hints',
      transformIndexHtml(html) {
        return {
          html,
          tags: [
            {
              tag: 'link',
              attrs: {
                rel: 'dns-prefetch',
                href: 'https://fonts.googleapis.com',
              },
              injectTo: 'head',
            },
            {
              tag: 'link',
              attrs: {
                rel: 'preconnect',
                href: 'https://fonts.gstatic.com',
                crossorigin: '',
              },
              injectTo: 'head',
            },
            {
              tag: 'meta',
              attrs: {
                name: 'theme-color',
                content: '#007bff',
              },
              injectTo: 'head',
            },
          ],
        };
      },
    },
  ],
});
```

#### 3.3 Service Worker 配置
```typescript
// vite.config.ts PWA 配置
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.example\.com\/api\/v1\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      manifest: {
        name: 'Codebase Index MCP',
        short_name: 'CodebaseIndex',
        description: 'Codebase Index MCP Frontend Application',
        theme_color: '#007bff',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
});
```

这个构建配置文档详细说明了前端项目的构建工具配置、性能优化策略和部署准备，确保应用在生产环境中具有最佳的性能和用户体验。