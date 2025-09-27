# 前端组件架构设计

## 组件设计原则

### 1. 单一职责原则
每个组件只负责一个明确的功能，避免组件过于复杂和难以维护。

### 2. 可复用性
组件设计时考虑通用性，通过 props 配置实现灵活的复用。

### 3. 组合优先
优先使用组件组合而非继承，通过嵌套和组合构建复杂界面。

### 4. 状态管理清晰
明确组件的状态来源，避免不必要的状态提升和复杂的数据流。

## 组件层次结构

### 1. 页面级组件（Pages）
位于 `App.tsx` 中的路由组件，负责页面级的数据获取和状态管理。

```typescript
// 页面级组件示例
const Dashboard: React.FC = () => {
  const { data, isLoading } = useQuery(['dashboard'], fetchDashboardData);
  
  return (
    <PageLayout title="仪表板">
      <DashboardOverview data={data} loading={isLoading} />
      <MetricsDisplay metrics={data?.metrics} />
    </PageLayout>
  );
};
```

### 2. 容器组件（Containers）
负责数据获取和业务逻辑，将数据传递给展示组件。

```typescript
// 容器组件示例
const ProjectContainer: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    projectService.getProjects()
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);
  
  return <ProjectList projects={projects} loading={loading} />;
};
```

### 3. 展示组件（Presentational）
专注于 UI 渲染，通过 props 接收数据和回调函数。

```typescript
// 展示组件示例
interface ProjectListProps {
  projects: Project[];
  loading: boolean;
  onProjectSelect?: (project: Project) => void;
}

const ProjectList: React.FC<ProjectListProps> = ({ 
  projects, 
  loading, 
  onProjectSelect 
}) => {
  if (loading) return <LoadingSpinner />;
  
  return (
    <div className="project-list">
      {projects.map(project => (
        <ProjectCard 
          key={project.id}
          project={project}
          onClick={() => onProjectSelect?.(project)}
        />
      ))}
    </div>
  );
};
```

## 组件分类体系

### 1. 通用组件（Common）
位于 `components/common/` 目录，提供基础的 UI 组件。

#### Layout 组件
```typescript
// 布局框架组件
interface LayoutProps {
  children: React.ReactNode;
  className?: string;
  showSidebar?: boolean;
  headerContent?: React.ReactNode;
  footerContent?: React.ReactNode;
}
```

#### Navigation 组件
```typescript
// 导航菜单组件
interface NavigationProps {
  collapsed?: boolean;
  items?: NavigationItem[];
  onItemSelect?: (item: NavigationItem) => void;
}
```

#### 反馈组件
- **ErrorBoundary**: 错误边界处理
- **LoadingSpinner**: 加载状态显示
- **ErrorMessage**: 错误信息显示
- **StatusBar**: 状态栏组件

### 2. 功能组件（Feature Components）
按功能模块组织的业务组件。

#### Dashboard 组件
```typescript
// 仪表板组件结构
components/dashboard/
├── Dashboard.tsx           # 主仪表板组件
├── MetricsDisplay/         # 指标展示组件
├── ProjectSummary/        # 项目摘要组件
├── SystemHealth/          # 系统健康状态
└── GrafanaIntegration/    # Grafana 集成组件
```

#### Search 组件
```typescript
// 搜索功能组件结构
components/search/
├── CodeSearch.tsx         # 主搜索组件
├── SearchBar/              # 搜索输入框
├── SearchResults/          # 搜索结果展示
├── ResultFilters/          # 结果过滤器
└── SearchHistory/          # 搜索历史记录
```

#### Graph 组件
```typescript
// 图形可视化组件结构
components/graph/
├── GraphVisualization.tsx   # 主图形组件
├── GraphViewer/            # 图形查看器
├── GraphControls/          # 图形控制面板
└── NodeDetails/            # 节点详情展示
```

#### Project 组件
```typescript
// 项目管理组件结构
components/projects/
├── ProjectManagement.tsx    # 主项目管理组件
├── ProjectList/             # 项目列表
├── ProjectForm/              # 项目表单
├── ProjectDetails/          # 项目详情
└── IndexingProgress/        # 索引进度显示
```

#### Debug 组件
```typescript
// 调试工具组件结构
components/debug/
├── DebugTools.tsx          # 主调试工具组件
├── ApiLogs/                # API 日志查看
├── ErrorViewer/            # 错误信息查看
├── PerformanceMetrics/     # 性能指标
└── DevMode/                # 开发模式工具
```

## 组件通信模式

### 1. 父子组件通信
```typescript
// 父组件
const ParentComponent: React.FC = () => {
  const [value, setValue] = useState('');
  
  const handleChildChange = (newValue: string) => {
    setValue(newValue);
  };
  
  return <ChildComponent value={value} onChange={handleChildChange} />;
};

// 子组件
interface ChildProps {
  value: string;
  onChange: (value: string) => void;
}

const ChildComponent: React.FC<ChildProps> = ({ value, onChange }) => {
  return (
    <input 
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
};
```

### 2. 兄弟组件通信
```typescript
// 通过共同的父组件进行通信
const SiblingContainer: React.FC = () => {
  const [sharedState, setSharedState] = useState('');
  
  return (
    <>
      <SiblingA value={sharedState} onChange={setSharedState} />
      <SiblingB value={sharedState} />
    </>
  );
};
```

### 3. 跨层级通信
```typescript
// 使用 Context 进行跨层级通信
const ThemeContext = createContext<ThemeContextType>(defaultTheme);

// 提供者
const ThemeProvider: React.FC = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('light');
  
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// 消费者
const ThemedComponent: React.FC = () => {
  const { theme, setTheme } = useContext(ThemeContext);
  
  return (
    <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
      切换主题
    </button>
  );
};
```

## 状态管理架构

### 1. 本地状态管理
```typescript
// 使用 useState 管理组件本地状态
const Counter: React.FC = () => {
  const [count, setCount] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  
  const increment = () => {
    setCount(prev => prev + 1);
    setHistory(prev => [...prev, count + 1]);
  };
  
  return (
    <div>
      <p>当前计数: {count}</p>
      <button onClick={increment}>增加</button>
      <HistoryList items={history} />
    </div>
  );
};
```

### 2. 全局状态管理
```typescript
// 使用 Context 管理应用级状态
interface AppState {
  user: User | null;
  settings: AppSettings;
  notifications: Notification[];
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}>({ state: initialState, dispatch: () => null });
```

### 3. 服务端状态管理
```typescript
// 使用 React Query 管理服务端状态
const ProjectList: React.FC = () => {
  const { data, isLoading, error, refetch } = useQuery(
    ['projects', page, filter],
    () => projectService.getProjects(page, filter),
    {
      staleTime: 5 * 60 * 1000, // 5分钟缓存
      cacheTime: 10 * 60 * 1000, // 10分钟缓存时间
      retry: 3, // 失败重试3次
      refetchOnWindowFocus: false, // 窗口聚焦时不自动刷新
    }
  );
  
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  
  return <ProjectGrid projects={data?.items || []} />;
};
```

## 组件样式架构

### 1. CSS Modules
```typescript
// Component.module.css
.container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}

.title {
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--text-primary);
}

// Component.tsx
import styles from './Component.module.css';

const Component: React.FC = () => {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>标题</h1>
    </div>
  );
};
```

### 2. CSS 变量主题系统
```css
/* variables.css */
:root {
  /* 颜色系统 */
  --color-primary: #007bff;
  --color-success: #28a745;
  --color-warning: #ffc107;
  --color-danger: #dc3545;
  
  /* 文本颜色 */
  --text-primary: #212529;
  --text-secondary: #6c757d;
  
  /* 背景颜色 */
  --bg-primary: #ffffff;
  --bg-secondary: #f8f9fa;
  
  /* 间距系统 */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 3rem;
}

/* 暗色主题 */
[data-theme="dark"] {
  --text-primary: #ffffff;
  --text-secondary: #adb5bd;
  --bg-primary: #212529;
  --bg-secondary: #343a40;
}
```

### 3. 响应式设计
```typescript
// 响应式 Hook
const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  
  useEffect(() => {
    const checkResponsive = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
      setIsDesktop(window.innerWidth >= 1024);
    };
    
    checkResponsive();
    window.addEventListener('resize', checkResponsive);
    
    return () => window.removeEventListener('resize', checkResponsive);
  }, []);
  
  return { isMobile, isTablet, isDesktop };
};

// 使用响应式 Hook
const ResponsiveComponent: React.FC = () => {
  const { isMobile, isTablet, isDesktop } = useResponsive();
  
  return (
    <div className={`component ${isMobile ? 'mobile' : ''} ${isDesktop ? 'desktop' : ''}`}>
      {isMobile && <MobileView />}
      {isTablet && <TabletView />}
      {isDesktop && <DesktopView />}
    </div>
  );
};
```

## 组件测试策略

### 1. 单元测试
```typescript
// 组件单元测试示例
describe('Button Component', () => {
  it('should render with correct text', () => {
    render(<Button>点击我</Button>);
    expect(screen.getByText('点击我')).toBeInTheDocument();
  });
  
  it('should call onClick handler when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>点击我</Button>);
    
    fireEvent.click(screen.getByText('点击我'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
  
  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>点击我</Button>);
    expect(screen.getByText('点击我')).toBeDisabled();
  });
});
```

### 2. 集成测试
```typescript
// 组件集成测试示例
describe('Search Feature Integration', () => {
  it('should perform search and display results', async () => {
    render(<CodeSearch />);
    
    // 输入搜索关键词
    const searchInput = screen.getByPlaceholderText('搜索代码...');
    fireEvent.change(searchInput, { target: { value: 'react' } });
    
    // 触发搜索
    const searchButton = screen.getByRole('button', { name: /搜索/i });
    fireEvent.click(searchButton);
    
    // 等待结果显示
    await waitFor(() => {
      expect(screen.getByText('搜索结果')).toBeInTheDocument();
      expect(screen.getAllByRole('article')).toHaveLength(10);
    });
  });
});
```

### 3. 快照测试
```typescript
// 快照测试示例
it('should match snapshot', () => {
  const { asFragment } = render(<Component prop="value" />);
  expect(asFragment()).toMatchSnapshot();
});
```

## 组件性能优化

### 1. React.memo 优化
```typescript
// 防止不必要的重新渲染
const ExpensiveComponent = React.memo(({ data, onUpdate }) => {
  // 昂贵的渲染逻辑
  return <div>{/* 复杂的内容 */}</div>;
}, (prevProps, nextProps) => {
  // 自定义比较函数
  return prevProps.data.id === nextProps.data.id;
});
```

### 2. useMemo 和 useCallback
```typescript
// 记忆化昂贵的计算
const ExpensiveCalculation = ({ data }) => {
  const processedData = useMemo(() => {
    return data.map(item => ({
      ...item,
      computed: heavyComputation(item)
    }));
  }, [data]);
  
  // 记忆化回调函数
  const handleClick = useCallback((id) => {
    console.log('Item clicked:', id);
  }, []);
  
  return (
    <div>
      {processedData.map(item => (
        <div key={item.id} onClick={() => handleClick(item.id)}>
          {item.computed}
        </div>
      ))}
    </div>
  );
};
```

### 3. 虚拟滚动
```typescript
// 大数据列表虚拟滚动
const VirtualList = ({ items, itemHeight, containerHeight }) => {
  const [scrollTop, setScrollTop] = useState(0);
  
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(
    startIndex + Math.ceil(containerHeight / itemHeight),
    items.length
  );
  
  const visibleItems = items.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;
  
  return (
    <div 
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={(e) => setScrollTop(e.target.scrollTop)}
    >
      <div style={{ height: items.length * itemHeight }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map(item => (
            <div key={item.id} style={{ height: itemHeight }}>
              {item.content}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
```

这个组件架构设计确保了前端应用的可维护性、可测试性和高性能，为构建复杂的代码库索引界面提供了坚实的基础。