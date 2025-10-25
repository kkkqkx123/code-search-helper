# 前端项目名称显示实现方案

## 概述

本文档描述了如何在前端显示项目的真实名称而非哈希值，同时保持后端使用哈希值进行项目查询的架构。

## 需求背景

当前系统在前端显示项目时使用的是哈希值（如 `7309b226edd38773`），这对于用户来说不够直观。用户更希望看到项目的真实名称（如 `code-search-helper`）。然而，后端仍然需要使用哈希值进行项目查询以确保数据库命名规范。

## 设计方案

### 1. 后端API扩展

#### 1.1 创建新的API端点

在后端创建一个新的API端点，用于查询哈希值与项目名称的映射关系：

```typescript
// src/api/routes/ProjectRoutes.ts 中添加新路由
this.router.get('/mapping', this.getProjectNameMapping.bind(this));

private async getProjectNameMapping(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // 获取所有项目的哈希值与名称映射
    const mappings = await this.projectPathMappingService.getAllMappings();
    
    // 转换为哈希值到项目名称的映射
    const nameMapping: { [hash: string]: string } = {};
    mappings.forEach(mapping => {
      // 从原始路径中提取项目名称
      const projectName = path.basename(mapping.originalPath);
      nameMapping[mapping.hash] = projectName;
    });
    
    res.status(200).json({
      success: true,
      data: nameMapping,
    });
  } catch (error) {
    next(error);
  }
}

// 也可以提供单个查询接口
this.router.get('/mapping/:hash', this.getProjectNameByHash.bind(this));

private async getProjectNameByHash(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { hash } = req.params;
    
    if (!hash) {
      res.status(400).json({
        success: false,
        error: 'Hash is required',
      });
      return;
    }
    
    // 获取原始路径
    const originalPath = await this.projectPathMappingService.getOriginalPath(hash);
    
    if (!originalPath) {
      res.status(404).json({
        success: false,
        error: 'Project not found',
      });
      return;
    }
    
    // 从原始路径中提取项目名称
    const projectName = path.basename(originalPath);
    
    res.status(200).json({
      success: true,
      data: {
        hash,
        projectName,
        originalPath,
      },
    });
  } catch (error) {
    next(error);
  }
}
```

#### 1.2 扩展现有项目API

修改现有的项目API，在返回的项目信息中包含项目名称：

```typescript
// 在buildProjectResponse方法中添加项目名称字段
private async buildProjectResponse(projectId: string, projectPath: string): Promise<Project> {
  // 从映射服务获取原始路径（如果存在）
  let originalPath = projectPath;
  try {
    // 尝试从映射服务获取原始路径
    const mappedPath = await this.projectPathMappingService.getOriginalPath(projectId);
    if (mappedPath) {
      originalPath = mappedPath;
    }
  } catch (error) {
    // 如果映射服务不可用，使用现有的projectPath
    this.logger.warn('Failed to get original path from mapping service', { error, projectId });
  }
  
  // 提取项目名称
  const projectName = path.basename(originalPath);
  
  // ... 其他现有代码 ...
  
  return {
    id: projectId,
    name: projectName,  // 使用从路径提取的项目名称
    path: projectPath,
    // ... 其他字段 ...
  };
}
```

### 2. 前端实现

#### 2.1 扩展API客户端

在前端API客户端中添加新的方法来获取项目名称映射：

```typescript
// frontend/src/services/api.ts 中添加新方法
/**
 * 获取项目哈希值到名称的映射
 */
async getProjectNameMapping(): Promise<any> {
  try {
    const response = await fetch(`${this.apiBaseUrl}/api/v1/projects/mapping`);
    return await response.json();
  } catch (error) {
    console.error('获取项目名称映射失败:', error);
    throw error;
  }
}

/**
 * 根据哈希值获取项目名称
 */
async getProjectNameByHash(hash: string): Promise<any> {
  try {
    const response = await fetch(`${this.apiBaseUrl}/api/v1/projects/mapping/${hash}`);
    return await response.json();
  } catch (error) {
    console.error('根据哈希值获取项目名称失败:', error);
    throw error;
  }
}
```

#### 2.2 修改项目页面显示

更新项目页面组件，使其能够显示项目的真实名称：

```typescript
// frontend/src/pages/ProjectsPage.ts 中修改渲染方法
private renderProjectsList(projects: any[], container: HTMLElement) {
  if (!container) return;

  container.innerHTML = projects.map(project => {
    // 使用项目名称而非ID显示
    const displayName = project.name || project.id;
    
    return `
      <tr>
        <td><input type="checkbox" class="project-checkbox" data-project-id="${project.id}" title="选择项目"></td>
        <td class="project-info-cell">
          <div class="project-name">${this.escapeHtml(displayName)}</div>
          <div class="project-path">${this.escapeHtml(project.path || 'N/A')}</div>
          <div class="project-meta">
            <span class="file-count">📁 ${project.fileCount || 0} 文件</span>
            <span class="last-indexed">🕒 ${this.formatDate(project.lastIndexed)}</span>
          </div>
        </td>
        <!-- 其他列保持不变 -->
        <td class="status-cell">
          <div class="status-indicators">
            <div class="project-status status-${project.status}">
              ${this.getStatusText(project.status)}
            </div>
            <!-- 其他状态指示器 -->
          </div>
        </td>
        <td class="actions-cell">
          <!-- 操作按钮保持不变 -->
        </td>
      </tr>
    `;
  }).join('');
}
```

#### 2.3 添加缓存机制

为了避免频繁请求映射信息，可以在前端添加缓存机制：

```typescript
// frontend/src/services/api.ts 中扩展ApiClient类
export class ApiClient {
  // ... 现有代码 ...
  
  private projectNameMappingCache: {
    data: { [hash: string]: string } | null;
    lastUpdated: number | null;
  } = {
    data: null,
    lastUpdated: null
  };
  
  private projectNameMappingCacheTTL: number = 5 * 60 * 1000; // 5分钟缓存
  
  /**
   * 获取项目哈希值到名称的映射（带缓存）
   */
  async getProjectNameMapping(useCache: boolean = true): Promise<any> {
    const now = Date.now();
    
    // 检查缓存
    if (useCache && 
        this.projectNameMappingCache.data && 
        this.projectNameMappingCache.lastUpdated &&
        (now - this.projectNameMappingCache.lastUpdated < this.projectNameMappingCacheTTL)) {
      console.debug('使用缓存的项目名称映射');
      return { success: true, data: this.projectNameMappingCache.data };
    }
    
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/v1/projects/mapping`);
      const result = await response.json();
      
      // 更新缓存
      if (result.success && result.data) {
        this.projectNameMappingCache.data = result.data;
        this.projectNameMappingCache.lastUpdated = now;
        console.debug('项目名称映射已缓存');
      }
      
      return result;
    } catch (error) {
      console.error('获取项目名称映射失败:', error);
      
      // 如果有缓存数据，即使请求失败也返回缓存数据
      if (this.projectNameMappingCache.data) {
        console.warn('项目名称映射API请求失败，返回缓存数据');
        return { success: true, data: this.projectNameMappingCache.data };
      }
      
      throw error;
    }
  }
  
  /**
   * 清除项目名称映射缓存
   */
  clearProjectNameMappingCache() {
    this.projectNameMappingCache.data = null;
    this.projectNameMappingCache.lastUpdated = null;
    console.debug('项目名称映射缓存已清除');
  }
  
  // 在clearAllCache方法中添加清除项目名称映射缓存
  clearAllCache() {
    // ... 现有代码 ...
    this.clearProjectNameMappingCache();
    console.debug('所有缓存已清除');
  }
}
```

### 3. 实现步骤

#### 步骤1：后端实现
1. 创建ProjectPathMappingService（如之前文档所述）
2. 在ProjectRoutes中添加映射查询API端点
3. 修改buildProjectResponse方法以包含项目名称

#### 步骤2：前端实现
1. 扩展ApiClient以支持新的API端点
2. 修改ProjectsPage以显示项目名称
3. 添加缓存机制以提高性能

#### 步骤3：测试验证
1. 验证API端点返回正确的映射信息
2. 验证前端正确显示项目名称
3. 验证缓存机制正常工作

## 优势

1. **用户体验提升**：用户可以看到直观的项目名称而非哈希值
2. **向后兼容**：后端仍使用哈希值进行项目查询，不影响现有功能
3. **性能优化**：通过缓存机制减少API请求次数
4. **易于维护**：通过标准化的API端点提供映射信息

## 注意事项

1. **错误处理**：需要妥善处理映射服务不可用的情况
2. **缓存失效**：当项目被删除或重命名时，需要清除相应的缓存
3. **性能考虑**：对于大量项目的情况，需要考虑分页或增量更新机制
4. **安全性**：API端点应添加适当的身份验证和授权机制

## 总结

通过以上实现方案，我们可以在保持后端使用哈希值进行项目查询的同时，让前端显示用户友好的项目名称。这既提升了用户体验，又保持了系统的稳定性和可维护性。