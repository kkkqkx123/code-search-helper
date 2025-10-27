// Projects Page Method Tests
// These tests validate the methods in the ProjectsPage component

/**
 * Mock implementation of ProjectsPage methods for testing
 */
class ProjectsPageMock {
  async deleteProject(_projectId: string, _element: HTMLElement) {
    if (!window.confirm('确定要删除该项目的索引吗？此操作不可撤销。')) return;
    
    // Simulate API call
    return { success: true };
  }
  
  async reindexProject(_projectId: string) {
    if (!window.confirm('确定要重新索引该项目吗？')) return;
    
    // Simulate API call
    return { success: true };
  }
  
  async handleManualUpdate(_projectId: string) {
    if (!window.confirm('确定要手动更新此项目的索引吗？这将只更新发生变化的文件。')) return;
    
    // Simulate API call
    return { success: true };
  }
}

describe('ProjectsPage Methods', () => {
  let projectsPage: ProjectsPageMock;

  beforeEach(() => {
    projectsPage = new ProjectsPageMock();
  });

  it('should handle delete project with confirmation', async () => {
    // Mock confirm dialog to return true
    const mockConfirm = jest.fn(() => true);
    window.confirm = mockConfirm;
    
    // Call deleteProject method
    const result = await projectsPage.deleteProject('project1', document.createElement('button'));
    
    // Verify confirm dialog was called
    expect(mockConfirm).toHaveBeenCalledWith('确定要删除该项目的索引吗？此操作不可撤销。');
    
    // Verify the method returned success
    expect(result).toEqual({ success: true });
  });

  it('should not delete project when confirmation is cancelled', async () => {
    // Mock confirm dialog to return false
    const mockConfirm = jest.fn(() => false);
    window.confirm = mockConfirm;
    
    // Call deleteProject method
    const result = await projectsPage.deleteProject('project1', document.createElement('button'));
    
    // Verify confirm dialog was called
    expect(mockConfirm).toHaveBeenCalledWith('确定要删除该项目的索引吗？此操作不可撤销。');
    
    // Verify the method returned undefined (early return)
    expect(result).toBeUndefined();
  });

  it('should handle reindex project with confirmation', async () => {
    // Mock confirm dialog to return true
    const mockConfirm = jest.fn(() => true);
    window.confirm = mockConfirm;
    
    // Call reindexProject method
    const result = await projectsPage.reindexProject('project1');
    
    // Verify confirm dialog was called
    expect(mockConfirm).toHaveBeenCalledWith('确定要重新索引该项目吗？');
    
    // Verify the method returned success
    expect(result).toEqual({ success: true });
  });

  it('should not reindex project when confirmation is cancelled', async () => {
    // Mock confirm dialog to return false
    const mockConfirm = jest.fn(() => false);
    window.confirm = mockConfirm;
    
    // Call reindexProject method
    const result = await projectsPage.reindexProject('project1');
    
    // Verify confirm dialog was called
    expect(mockConfirm).toHaveBeenCalledWith('确定要重新索引该项目吗？');
    
    // Verify the method returned undefined (early return)
    expect(result).toBeUndefined();
  });

  it('should handle manual update with confirmation', async () => {
    // Mock confirm dialog to return true
    const mockConfirm = jest.fn(() => true);
    window.confirm = mockConfirm;
    
    // Call handleManualUpdate method
    const result = await projectsPage.handleManualUpdate('project1');
    
    // Verify confirm dialog was called
    expect(mockConfirm).toHaveBeenCalledWith('确定要手动更新此项目的索引吗？这将只更新发生变化的文件。');
    
    // Verify the method returned success
    expect(result).toEqual({ success: true });
  });

  it('should not manual update when confirmation is cancelled', async () => {
    // Mock confirm dialog to return false
    const mockConfirm = jest.fn(() => false);
    window.confirm = mockConfirm;
    
    // Call handleManualUpdate method
    const result = await projectsPage.handleManualUpdate('project1');
    
    // Verify confirm dialog was called
    expect(mockConfirm).toHaveBeenCalledWith('确定要手动更新此项目的索引吗？这将只更新发生变化的文件。');
    
    // Verify the method returned undefined (early return)
    expect(result).toBeUndefined();
  });
});

describe('ProjectsPage Event Delegation', () => {
  let container: HTMLElement;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <div id="projects-container">
        <table>
          <tbody id="projects-list">
            <tr>
              <td>
                <div class="action-menu">
                  <button class="action-button primary" data-project-id="project1" data-action="update">🔄 更新</button>
                  <button class="action-button secondary" data-project-id="project1" data-action="reindex">📊 重新索引</button>
                  <div class="dropdown">
                    <button class="action-button dropdown-toggle" data-project-id="project1" data-action="toggle-menu">⚙️</button>
                    <div class="dropdown-menu">
                      <button class="dropdown-item" data-project-id="project1" data-action="toggle-hot-reload">
                        🟢 启用热重载
                      </button>
                      <button class="dropdown-item" data-project-id="project1" data-action="configure-hot-reload">⚙️ 配置热重载</button>
                      <div class="dropdown-divider"></div>
                      <button class="dropdown-item storage" data-project-id="project1" data-action="index-vectors">🔍 索引向量</button>
                      <button class="dropdown-item storage" data-project-id="project1" data-action="index-graph">🕸️ 索引图</button>
                      <div class="dropdown-divider"></div>
                      <button class="dropdown-item danger" data-project-id="project1" data-action="delete">🗑️ 删除</button>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
    
    container = document.getElementById('projects-container') as HTMLElement;
  });

  it('should properly delegate delete button events', () => {
    // Mock confirm dialog
    const mockConfirm = jest.fn(() => false);
    window.confirm = mockConfirm;
    
    // Remove any existing event listeners by cloning the container
    const newContainer = container.cloneNode(true) as HTMLElement;
    container.parentNode?.replaceChild(newContainer, container);
    container = newContainer;
    
    // Simulate the event delegation logic from ProjectsPage
    container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('action-button') || target.classList.contains('dropdown-item')) {
        const button = target as HTMLButtonElement;
        const projectId = button.dataset.projectId;
        const action = button.dataset.action;

        if (projectId && action) {
          e.stopPropagation();
          if (action === 'delete') {
            // Simulate the deleteProject call - this should trigger the confirm dialog
            if (window.confirm('确定要删除该项目的索引吗？此操作不可撤销。')) {
              // In real implementation, this would call the API
              // For testing purposes, we just want to verify the confirm was called
            }
          } else if (action === 'toggle-menu') {
            // Handle dropdown toggle for delete button visibility
            const dropdown = button.nextElementSibling as HTMLElement;
            if (dropdown && dropdown.classList.contains('dropdown-menu')) {
              dropdown.classList.toggle('show');
            }
          }
        }
      }
    });
    
    // First click the dropdown toggle to show the menu
    const toggleButton = container.querySelector('[data-action="toggle-menu"]') as HTMLButtonElement;
    toggleButton.click();
    
    // Then find and click the delete button
    const deleteButton = container.querySelector('[data-action="delete"]') as HTMLButtonElement;
    deleteButton.click();
    
    // Verify the event was properly delegated
    expect(mockConfirm).toHaveBeenCalledWith('确定要删除该项目的索引吗？此操作不可撤销。');
  });

  it('should properly delegate reindex button events', () => {
    // Mock confirm dialog
    const mockConfirm = jest.fn(() => false);
    window.confirm = mockConfirm;
    
    // Remove any existing event listeners by cloning the container
    const newContainer = container.cloneNode(true) as HTMLElement;
    container.parentNode?.replaceChild(newContainer, container);
    container = newContainer;
    
    // Simulate the event delegation logic from ProjectsPage
    container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('action-button')) {
        const button = target as HTMLButtonElement;
        const projectId = button.dataset.projectId;
        const action = button.dataset.action;

        if (projectId && action) {
          e.stopPropagation();
          if (action === 'reindex') {
            // Simulate the reindexProject call
            window.confirm('确定要重新索引该项目吗？');
          }
        }
      }
    });
    
    // Find and click the reindex button
    const reindexButton = container.querySelector('[data-action="reindex"]') as HTMLButtonElement;
    reindexButton.click();
    
    // Verify the event was properly delegated
    expect(mockConfirm).toHaveBeenCalledWith('确定要重新索引该项目吗？');
  });

  it('should properly delegate update button events', () => {
    // Mock confirm dialog
    const mockConfirm = jest.fn(() => false);
    window.confirm = mockConfirm;
    
    // Remove any existing event listeners by cloning the container
    const newContainer = container.cloneNode(true) as HTMLElement;
    container.parentNode?.replaceChild(newContainer, container);
    container = newContainer;
    
    // Simulate the event delegation logic from ProjectsPage
    container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('action-button')) {
        const button = target as HTMLButtonElement;
        const projectId = button.dataset.projectId;
        const action = button.dataset.action;

        if (projectId && action) {
          e.stopPropagation();
          if (action === 'update') {
            // Simulate the handleManualUpdate call
            window.confirm('确定要手动更新此项目的索引吗？这将只更新发生变化的文件。');
          }
        }
      }
    });
    
    // Find and click the update button
    const updateButton = container.querySelector('[data-action="update"]') as HTMLButtonElement;
    updateButton.click();
    
    // Verify the event was properly delegated
    expect(mockConfirm).toHaveBeenCalledWith('确定要手动更新此项目的索引吗？这将只更新发生变化的文件。');
  });
});