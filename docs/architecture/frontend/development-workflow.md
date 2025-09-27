# 前端开发工作流文档

## 开发环境设置

### 1. 环境要求
- **Node.js**: >= 18.0
- **npm**: >= 8.0
- **Git**: 版本控制

### 2. 项目初始化
```bash
# 克隆项目
git clone <repository-url>
cd codebase-index/frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 3. 环境配置
```bash
# 复制环境变量模板
cp .env.example .env

# 配置环境变量
VITE_API_BASE_URL=http://localhost:3001/api/v1
VITE_ENABLE_DEBUG_MODE=true
```

## 开发工作流

### 1. 功能开发流程

#### 1.1 创建功能分支
```bash
# 从主分支创建功能分支
git checkout -b feature/新功能名称
```

#### 1.2 组件开发
```bash
# 创建组件目录结构
mkdir -p components/新功能
touch components/新功能/{新功能.tsx,新功能.module.css,新功能.test.tsx,index.ts}
```

#### 1.3 类型定义
```typescript
// types/新功能.types.ts
export interface 新功能Props {
  id: string;
  name: string;
  description?: string;
  onAction?: (data: any) => void;
}

export interface 新功能State {
  loading: boolean;
  data: any[];
  error: string | null;
}
```

#### 1.4 组件实现
```typescript
// components/新功能/新功能.tsx
import React, { useState, useEffect } from 'react';
import { 新功能Props } from '../../types/新功能.types';
import styles from './新功能.module.css';

const 新功能: React.FC<新功能Props> = ({ 
  id, 
  name, 
  description, 
  onAction 
}) => {
  const [state, setState] = useState<新功能State>({
    loading: false,
    data: [],
    error: null
  });

  useEffect(() => {
    // 组件初始化逻辑
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      const data = await apiService.getData(id);
      setState(prev => ({ ...prev, data, loading: false }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error.message, 
        loading: false 
      }));
    }
  };

  const handleAction = () => {
    onAction?.(state.data);
  };

  if (state.loading) return <LoadingSpinner />;
  if (state.error) return <ErrorMessage error={state.error} />;

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>{name}</h2>
      {description && (
        <p className={styles.description}>{description}</p>
      )}
      <div className={styles.content}>
        {/* 组件内容 */}
      </div>
      <Button onClick={handleAction}>执行操作</Button>
    </div>
  );
};

export default 新功能;
```

#### 1.5 样式实现
```css
/* 新功能.module.css */
.container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--bg-primary);
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-sm);
}

.title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0;
}

.description {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  line-height: 1.5;
}

.content {
  flex: 1;
  min-height: 200px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .container {
    padding: var(--spacing-md);
    gap: var(--spacing-sm);
  }
  
  .title {
    font-size: var(--font-size-md);
  }
}
```

#### 1.6 测试编写
```typescript
// 新功能.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import 新功能 from './新功能';
import * as apiService from '../../services/api.service';

// 模拟 API 服务
jest.mock('../../services/api.service');

describe('新功能 Component', () => {
  const defaultProps = {
    id: 'test-id',
    name: '测试功能',
    description: '测试描述'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该正确渲染组件', () => {
    render(<新功能 {...defaultProps} />);
    
    expect(screen.getByText('测试功能')).toBeInTheDocument();
    expect(screen.getByText('测试描述')).toBeInTheDocument();
  });

  it('应该在加载时显示加载状态', () => {
    (apiService.getData as jest.Mock).mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 1000))
    );
    
    render(<新功能 {...defaultProps} />);
    
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('应该在出错时显示错误信息', async () => {
    const errorMessage = '获取数据失败';
    (apiService.getData as jest.Mock).mockRejectedValue(
      new Error(errorMessage)
    );
    
    render(<新功能 {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('应该在获取数据成功后显示内容', async () => {
    const mockData = [{ id: 1, name: '数据1' }];
    (apiService.getData as jest.Mock).mockResolvedValue(mockData);
    
    render(<新功能 {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('数据1')).toBeInTheDocument();
    });
  });

  it('应该调用 onAction 回调函数', async () => {
    const mockData = [{ id: 1, name: '数据1' }];
    const onAction = jest.fn();
    
    (apiService.getData as jest.Mock).mockResolvedValue(mockData);
    
    render(<新功能 {...defaultProps} onAction={onAction} />);
    
    await waitFor(() => {
      const button = screen.getByText('执行操作');
      fireEvent.click(button);
      expect(onAction).toHaveBeenCalledWith(mockData);
    });
  });
});
```

### 2. 代码质量检查

#### 2.1 类型检查
```bash
# 运行 TypeScript 类型检查
npm run tsc --noEmit
```

#### 2.2 代码规范检查
```bash
# 运行 ESLint 检查
npm run lint

# 自动修复代码规范问题
npm run lint:fix
```

#### 2.3 代码格式化
```bash
# 格式化代码
npm run format

# 检查代码格式
npm run format:check
```

### 3. 测试流程

#### 3.1 单元测试
```bash
# 运行所有测试
npm run test

# 运行测试并监听文件变化
npm run test:watch

# 运行测试并生成覆盖率报告
npm run test:coverage
```

#### 3.2 组件测试
```typescript
// 组件测试最佳实践
describe('ComponentName', () => {
  // 测试组件渲染
  it('should render correctly', () => {
    render(<ComponentName prop="value" />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  // 测试用户交互
  it('should handle user interactions', () => {
    const mockHandler = jest.fn();
    render(<ComponentName onClick={mockHandler} />);
    
    fireEvent.click(screen.getByRole('button'));
    expect(mockHandler).toHaveBeenCalled();
  });

  // 测试状态变化
  it('should update state correctly', async () => {
    render(<ComponentName />);
    
    fireEvent.click(screen.getByText('Update'));
    
    await waitFor(() => {
      expect(screen.getByText('Updated State')).toBeInTheDocument();
    });
  });

  // 测试错误处理
  it('should handle errors gracefully', async () => {
    render(<ComponentName shouldError={true} />);
    
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
```

### 4. 构建和部署

#### 4.1 生产构建
```bash
# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

#### 4.2 构建优化
```typescript
// vite.config.ts 构建配置
export default defineConfig({
  build: {
    outDir: '../../dist/frontend',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // 第三方库代码分割
          vendor: ['react', 'react-dom', 'react-router-dom'],
          dataVis: ['d3', 'vis-network', 'vis-data'],
          state: ['react-query'],
        },
      },
    },
    // 构建优化
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
});
```

## 开发规范和最佳实践

### 1. 代码组织规范

#### 1.1 文件命名
- 组件文件: `PascalCase.tsx`
- 样式文件: `PascalCase.module.css`
- 测试文件: `PascalCase.test.tsx`
- 工具函数: `camelCase.ts`
- 类型定义: `PascalCase.types.ts`

#### 1.2 目录结构
```
components/
├── ComponentName/
│   ├── ComponentName.tsx
│   ├── ComponentName.module.css
│   ├── ComponentName.test.tsx
│   ├── ComponentName.stories.tsx (可选)
│   ├── index.ts
│   └── __tests__/
│       └── integration.test.tsx
```

### 2. 编码规范

#### 2.1 TypeScript 使用
```typescript
// 接口定义优先
interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string; // 可选属性
}

// 类型别名用于联合类型
type Status = 'loading' | 'success' | 'error';

// 泛型组件
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
}

function List<T>({ items, renderItem }: ListProps<T>) {
  return <>{items.map(renderItem)}</>;
}
```

#### 2.2 React 组件编写
```typescript
// 使用函数组件和 Hooks
const ComponentName: React.FC<ComponentProps> = ({ prop1, prop2 }) => {
  const [state, setState] = useState<StateType>(initialState);
  
  // 使用 useCallback 优化函数
  const handleClick = useCallback(() => {
    // 事件处理逻辑
  }, [dependency]);
  
  // 使用 useMemo 优化计算
  const computedValue = useMemo(() => {
    return expensiveComputation(data);
  }, [data]);
  
  return (
    <div className={styles.container}>
      {/* 组件内容 */}
    </div>
  );
};

// 默认导出
export default ComponentName;
```

#### 2.3 状态管理
```typescript
// 本地状态管理
const [localState, setLocalState] = useState<LocalState>(initialState);

// 服务端状态管理
const { data, isLoading, error } = useQuery(
  ['queryKey', param],
  () => fetchData(param),
  {
    staleTime: 5 * 60 * 1000, // 5分钟
    retry: 3, // 重试3次
    refetchOnWindowFocus: false, // 窗口聚焦不刷新
  }
);

// 全局状态管理
const { state, dispatch } = useContext(AppContext);
```

### 3. 性能优化规范

#### 3.1 组件优化
```typescript
// React.memo 防止不必要的重新渲染
const ExpensiveComponent = React.memo(({ data, onUpdate }) => {
  // 组件内容
}, (prevProps, nextProps) => {
  // 自定义比较函数
  return prevProps.data.id === nextProps.data.id;
});

// 使用 useMemo 缓存计算结果
const processedData = useMemo(() => {
  return data.map(item => ({
    ...item,
    computed: expensiveComputation(item)
  }));
}, [data]);

// 使用 useCallback 缓存函数
const handleClick = useCallback((id: string) => {
  console.log('Clicked:', id);
}, []);
```

#### 3.2 列表渲染优化
```typescript
// 使用 key 属性
const ListComponent = ({ items }) => {
  return (
    <ul>
      {items.map(item => (
        <li key={item.id}> {/* 使用稳定的唯一标识 */}
          {item.name}
        </li>
      ))}
    </ul>
  );
};

// 虚拟滚动用于长列表
const VirtualList = ({ items, itemHeight, containerHeight }) => {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  
  const visibleItems = items.slice(visibleRange.start, visibleRange.end);
  
  return (
    <div style={{ height: containerHeight, overflow: 'auto' }}>
      <div style={{ height: items.length * itemHeight }}>
        {visibleItems.map((item, index) => (
          <div 
            key={item.id}
            style={{ 
              position: 'absolute',
              top: (visibleRange.start + index) * itemHeight,
              height: itemHeight
            }}
          >
            {item.content}
          </div>
        ))}
      </div>
    </div>
  );
};
```

### 4. 错误处理规范

#### 4.1 组件错误边界
```typescript
// 错误边界组件
class ErrorBoundary extends React.Component<
  ErrorBoundaryProps, 
  ErrorBoundaryState
> {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // 发送错误到监控服务
    errorReportingService.captureException(error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return this.props.fallback || <ErrorFallback />;
    }
    
    return this.props.children;
  }
}
```

#### 4.2 异步错误处理
```typescript
// 异步操作错误处理
const DataFetchingComponent = () => {
  const [state, setState] = useState<{
    data: DataType | null;
    loading: boolean;
    error: string | null;
  }>({ data: null, loading: false, error: null });
  
  const fetchData = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const data = await apiService.fetchData();
      setState(prev => ({ ...prev, data, loading: false }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: error.message || '获取数据失败'
      }));
      
      // 用户友好的错误提示
      notificationService.error('数据获取失败，请稍后重试');
    }
  };
  
  if (state.loading) return <LoadingSpinner />;
  if (state.error) return <ErrorMessage error={state.error} onRetry={fetchData} />;
  
  return <DataDisplay data={state.data} />;
};
```

## 持续集成和部署

### 1. CI/CD 流程
```yaml
# GitHub Actions 示例
name: Frontend CI/CD

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
        cache-dependency-path: frontend/package-lock.json
    
    - name: Install dependencies
      run: npm ci
      working-directory: frontend
    
    - name: Run type check
      run: npm run tsc --noEmit
      working-directory: frontend
    
    - name: Run lint
      run: npm run lint
      working-directory: frontend
    
    - name: Run tests
      run: npm run test:coverage
      working-directory: frontend
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        directory: frontend/coverage
```

### 2. 部署策略
```bash
# 自动化部署脚本
#!/bin/bash

# 构建应用
npm run build

# 运行测试
npm run test:coverage

# 检查覆盖率阈值
if [ $(cat coverage/coverage-summary.json | jq '.total.lines.pct') -lt 80 ]; then
  echo "Coverage too low"
  exit 1
fi

# 部署到服务器
rsync -avz --delete dist/ user@server:/var/www/frontend/
```

这个开发工作流确保了代码质量、团队协作效率和项目的可持续发展。