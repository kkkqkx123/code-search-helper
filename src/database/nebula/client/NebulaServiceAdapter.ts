import { injectable, inject } from 'inversify';
import { EventEmitter } from 'events';
import { TYPES } from '../../../types';
import { NebulaConfig, NebulaConnectionStatus, NebulaQueryResult, NebulaNode, NebulaRelationship } from '../NebulaTypes';
import { INebulaClient } from './NebulaClient';
import { INebulaService } from '../NebulaService';
import { BaseDatabaseService } from '../common/BaseDatabaseService';
import { IConnectionManager, IProjectManager } from '../common/IDatabaseService';
import { Subscription } from '../common/DatabaseEventTypes';

// 适配器类，将 NebulaService 接口适配到 NebulaClient 实现
@injectable()
export class NebulaServiceAdapter extends BaseDatabaseService implements INebulaService {
  constructor(
    @inject(TYPES.NebulaClient) private nebulaClient: INebulaClient,
    @inject(TYPES.IConnectionManager) connectionManager: IConnectionManager,
    @inject(TYPES.IProjectManager) projectManager: IProjectManager
  ) {
    super(connectionManager, projectManager);
  }

  // 基础操作 - 委托给 NebulaClient
  async initialize(): Promise<boolean> {
    // 从配置加载 Nebula 配置并初始化客户端
    const config = this.getConfigFromConfigService();
    await this.nebulaClient.initialize(config);
    return this.nebulaClient.isConnected();
  }

  private getConfigFromConfigService(): NebulaConfig {
    // 这里需要从配置服务获取配置
    // 为了简化，我们返回一个默认配置
    // 在实际实现中，应该从 NebulaConfigService 获取配置
    return {
      host: process.env.NEBULA_HOST || 'localhost',
      port: parseInt(process.env.NEBULA_PORT || '9669'),
      username: process.env.NEBULA_USERNAME || 'root',
      password: process.env.NEBULA_PASSWORD || 'nebula',
      timeout: 30000,
      maxConnections: 10,
      retryAttempts: 3,
      retryDelay: 1000,
      space: process.env.NEBULA_SPACE || 'test_space',
      bufferSize: 1024,
      pingInterval: 30000,
      vidTypeLength: 32
    };
  }

  isConnected(): boolean {
    return this.nebulaClient.isConnected();
  }

  isInitialized(): boolean {
    return this.nebulaClient.isConnected(); // 简化实现
  }

  async close(): Promise<void> {
    await this.nebulaClient.close();
  }

  async reconnect(): Promise<boolean> {
    try {
      await this.nebulaClient.disconnect();
      await this.nebulaClient.connect();
      return true;
    } catch (error) {
      console.error('Reconnection failed:', error);
      return false;
    }
  }

  // 项目相关操作 - 委托给 NebulaClient
  async createSpaceForProject(projectPath: string): Promise<boolean> {
    return await this.nebulaClient.createSpaceForProject(projectPath);
  }

  async deleteSpaceForProject(projectPath: string): Promise<boolean> {
    return await this.nebulaClient.deleteSpaceForProject(projectPath);
  }

  // 数据操作 - 委托给 NebulaClient
  async insertNodes(nodes: NebulaNode[]): Promise<boolean> {
    return await this.nebulaClient.insertNodes(nodes);
  }

  async insertRelationships(relationships: NebulaRelationship[]): Promise<boolean> {
    return await this.nebulaClient.insertRelationships(relationships);
  }

  // 查询操作 - 委托给 NebulaClient
  async findNodesByLabel(label: string, filter?: any): Promise<any[]> {
    return await this.nebulaClient.findNodesByLabel(label, filter);
  }

  async findRelationships(type?: string, filter?: any): Promise<any[]> {
    return await this.nebulaClient.findRelationships(type, filter);
  }

  // 兼容性方法 - 委托给 NebulaClient
  async executeReadQuery(nGQL: string, parameters?: Record<string, any>): Promise<any> {
    return await this.nebulaClient.executeReadQuery(nGQL, parameters);
  }

  async executeWriteQuery(nGQL: string, parameters?: Record<string, any>): Promise<any> {
    return await this.nebulaClient.executeWriteQuery(nGQL, parameters);
  }

  async useSpace(spaceName: string): Promise<void> {
    return await this.nebulaClient.useSpace(spaceName);
  }

  async createNode(label: string, properties: Record<string, any>): Promise<string> {
    return await this.nebulaClient.createNode(label, properties);
  }

  async createRelationship(
    type: string,
    sourceId: string,
    targetId: string,
    properties?: Record<string, any>
  ): Promise<void> {
    return await this.nebulaClient.createRelationship(type, sourceId, targetId, properties);
  }

  async findNodes(label: string, properties?: Record<string, any>): Promise<any[]> {
    return await this.nebulaClient.findNodes(label, properties);
  }

  async getDatabaseStats(): Promise<any> {
    return await this.nebulaClient.getDatabaseStats();
  }

  // 事件处理 - 委托给 NebulaClient
  subscribe(type: string, listener: (event: any) => void): Subscription {
    // 适配事件订阅机制
    this.nebulaClient.on(type, listener);
    return {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      eventType: type,
      handler: listener,
      unsubscribe: () => this.nebulaClient.off(type, listener)
    };
  }

  // 为了兼容性，添加一些额外的方法
  async deleteDataForFile(filePath: string): Promise<void> {
    return await this.nebulaClient.deleteDataForFile(filePath);
  }
}