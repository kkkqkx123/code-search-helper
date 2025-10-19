/**
 * 热重载配置模态框组件
 * 提供项目级热重载配置的图形界面
 */
export class HotReloadConfigModal extends HTMLElement {
    private projectId: string = '';
    private projectName: string = '';
    private config: any = {};
    private shadow: ShadowRoot;

    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
    }

    // 设置项目信息和配置
    setProjectInfo(projectId: string, projectName: string, config: any) {
        this.projectId = projectId;
        this.projectName = projectName;
        this.config = { ...config };
        this.render();
    }

    private render() {
        this.shadow.innerHTML = `
            <style>
                /* 模态框样式 */
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }
                
                .modal-content {
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    max-width: 500px;
                    width: 90%;
                    max-height: 80vh;
                    overflow-y: auto;
                }
                
                .form-group {
                    margin-bottom: 15px;
                }
                
                label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: bold;
                }
                
                input[type="number"], select {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                }
                
                .modal-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    margin-top: 20px;
                }
                
                button {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }
                
                button.primary {
                    background: #007bff;
                    color: white;
                }
                
                button.secondary {
                    background: #6c757d;
                    color: white;
                }
            </style>
            
            <div class="modal-overlay">
                <div class="modal-content">
                    <h3>热重载配置 - ${this.projectName}</h3>
                    
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="enabled" 
                                   ${this.config.enabled ? 'checked' : ''}>
                            启用热重载
                        </label>
                    </div>
                    
                    <div class="form-group">
                        <label for="debounceInterval">去抖间隔 (毫秒)</label>
                        <input type="number" id="debounceInterval" 
                               value="${this.config.debounceInterval || 500}" 
                               min="50" max="5000" step="50">
                    </div>
                    
                    <div class="form-group">
                        <label for="maxFileSize">最大文件大小 (MB)</label>
                        <input type="number" id="maxFileSize" 
                               value="${(this.config.maxFileSize || 10485760) / 1024 / 1024}" 
                               min="1" max="100" step="1">
                    </div>
                    
                    <div class="form-group">
                        <label for="maxRetries">最大重试次数</label>
                        <input type="number" id="maxRetries" 
                               value="${this.config.errorHandling?.maxRetries || 3}" 
                               min="0" max="10" step="1">
                    </div>
                    
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="autoRecovery" 
                                   ${this.config.errorHandling?.autoRecovery !== false ? 'checked' : ''}>
                            自动恢复
                        </label>
                    </div>
                    
                    <div class="modal-actions">
                        <button id="save" class="primary">保存</button>
                        <button id="cancel" class="secondary">取消</button>
                    </div>
                </div>
            </div>
        `;

        this.setupEventListeners();
    }

    private setupEventListeners() {
        this.shadow.getElementById('save')?.addEventListener('click', () => this.saveConfig());
        this.shadow.getElementById('cancel')?.addEventListener('click', () => this.close());
        
        // 启用状态变化时，动态显示/隐藏配置选项
        const enabledCheckbox = this.shadow.getElementById('enabled') as HTMLInputElement;
        enabledCheckbox.addEventListener('change', () => this.toggleConfigFields());
        this.toggleConfigFields(); // 初始状态
    }

    private toggleConfigFields() {
        const enabled = (this.shadow.getElementById('enabled') as HTMLInputElement).checked;
        const configFields = this.shadow.querySelectorAll('.form-group:not(:first-child)');
        
        configFields.forEach(field => {
            (field as HTMLElement).style.opacity = enabled ? '1' : '0.5';
            (field as HTMLElement).style.pointerEvents = enabled ? 'auto' : 'none';
        });
    }

    private async saveConfig() {
        const enabled = (this.shadow.getElementById('enabled') as HTMLInputElement).checked;
        const debounceInterval = parseInt((this.shadow.getElementById('debounceInterval') as HTMLInputElement).value) || 500;
        const maxFileSize = parseInt((this.shadow.getElementById('maxFileSize') as HTMLInputElement).value) * 1024 * 1024 || 10485760;
        const maxRetries = parseInt((this.shadow.getElementById('maxRetries') as HTMLInputElement).value) || 3;
        const autoRecovery = (this.shadow.getElementById('autoRecovery') as HTMLInputElement).checked;

        // 验证配置
        const errors = this.validateConfig({
            enabled,
            debounceInterval,
            maxFileSize,
            errorHandling: {
                maxRetries,
                autoRecovery
            }
        });

        if (errors.length > 0) {
            alert('配置验证失败:\n' + errors.join('\n'));
            return;
        }

        const config = {
            enabled,
            debounceInterval,
            maxFileSize,
            errorHandling: {
                maxRetries,
                autoRecovery
            }
        };

        try {
            // 假设全局apiClient可用
            const apiClient = (window as any).apiClient;
            const result = await apiClient.updateProjectHotReloadConfig(this.projectId, config);
            
            if (result.success) {
                this.dispatchEvent(new CustomEvent('config-saved', {
                    detail: { projectId: this.projectId, config }
                }));
                this.close();
            } else {
                alert('保存配置失败: ' + (result.error || '未知错误'));
            }
        } catch (error) {
            alert('保存配置时发生错误: ' + (error as Error).message);
        }
    }

    private validateConfig(config: any): string[] {
        const errors: string[] = [];
        
        if (config.debounceInterval < 50) {
            errors.push('去抖间隔不能小于50毫秒');
        }
        
        if (config.maxFileSize > 100 * 1024 * 1024) {
            errors.push('最大文件大小不能超过100MB');
        }
        
        if (config.errorHandling?.maxRetries < 0) {
            errors.push('最大重试次数不能为负数');
        }
        
        return errors;
    }

    private close() {
        this.dispatchEvent(new CustomEvent('modal-closed'));
        this.remove();
    }
}

// 注册自定义元素
customElements.define('hot-reload-config-modal', HotReloadConfigModal);