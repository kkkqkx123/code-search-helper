/**
 * 热重载状态组件
 * 显示项目的热重载状态和统计信息
 */
export class HotReloadStatus extends HTMLElement {
    private enabled: boolean = false;
    private changesDetected: number = 0;
    private errorsCount: number = 0;

    static get observedAttributes() {
        return ['project-id', 'enabled', 'changes-detected', 'errors-count'];
    }

    attributeChangedCallback(name: string, newValue: string) {
        switch (name) {
            case 'project-id':
                break;
            case 'enabled':
                this.enabled = newValue === 'true';
                break;
            case 'changes-detected':
                this.changesDetected = parseInt(newValue) || 0;
                break;
            case 'errors-count':
                this.errorsCount = parseInt(newValue) || 0;
                break;
        }
        this.render();
    }

    private render() {
        this.innerHTML = `
            <div class="hot-reload-status ${this.enabled ? 'enabled' : 'disabled'}">
                <span class="status-indicator ${this.enabled ? 'active' : 'inactive'}"></span>
                <span class="status-text">${this.enabled ? '已启用' : '已禁用'}</span>
                ${this.enabled ? `
                    <span class="stats">
                        <span class="changes" title="检测到的变更数">📝 ${this.changesDetected}</span>
                        <span class="errors" title="错误数">❌ ${this.errorsCount}</span>
                    </span>
                ` : ''}
            </div>
        `;
    }
}