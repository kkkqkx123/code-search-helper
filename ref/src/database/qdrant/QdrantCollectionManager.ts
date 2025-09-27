import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { QdrantClientWrapper, CollectionInfo } from './QdrantClientWrapper';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';

export interface VectorConfig {
  vectorSize: number;
  distance: 'Cosine' | 'Euclid' | 'Dot' | 'Manhattan';
  recreateCollection?: boolean;
}

@injectable()
export class QdrantCollectionManager {
  private client: QdrantClientWrapper;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;

  constructor(
    @inject(TYPES.QdrantClientWrapper) client: QdrantClientWrapper,
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService
  ) {
    this.client = client;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
  }

  private generateCollectionName(projectId: string): string {
    return `project-${projectId}`;
  }

  async createCollection(projectId: string, config: VectorConfig): Promise<boolean> {
    const collectionName = this.generateCollectionName(projectId);
    try {
      const created = await this.client.createCollection(
        collectionName,
        config.vectorSize,
        config.distance,
        config.recreateCollection
      );
      if (created) {
        this.logger.info(
          `Successfully created collection ${collectionName} for project ${projectId}`
        );
      }
      return created;
    } catch (error) {
      this.logger.error(`Failed to create collection ${collectionName}:`, error);
      return false;
    }
  }

  async deleteCollection(projectId: string): Promise<boolean> {
    const collectionName = this.generateCollectionName(projectId);
    try {
      const deleted = await this.client.deleteCollection(collectionName);
      if (deleted) {
        this.logger.info(
          `Successfully deleted collection ${collectionName} for project ${projectId}`
        );
      }
      return deleted;
    } catch (error) {
      this.logger.error(`Failed to delete collection ${collectionName}:`, error);
      return false;
    }
  }

  async listCollections(): Promise<string[]> {
    try {
      // Access the underlying client's getCollections method
      const collections = await (this.client as any).client.getCollections();
      return collections.collections.map((c: { name: string }) => c.name);
    } catch (error) {
      this.logger.error('Failed to list collections:', error);
      return [];
    }
  }

  async getCollectionInfo(projectId: string): Promise<CollectionInfo | null> {
    const collectionName = this.generateCollectionName(projectId);
    try {
      return await this.client.getCollectionInfo(collectionName);
    } catch (error) {
      this.logger.error(`Failed to get collection info for ${collectionName}:`, error);
      return null;
    }
  }

  async collectionExists(projectId: string): Promise<boolean> {
    const collectionName = this.generateCollectionName(projectId);
    try {
      return await this.client.collectionExists(collectionName);
    } catch (error) {
      this.logger.error(`Failed to check if collection ${collectionName} exists:`, error);
      return false;
    }
  }

  async clearCollection(projectId: string): Promise<boolean> {
    const collectionName = this.generateCollectionName(projectId);
    try {
      const cleared = await this.client.clearCollection(collectionName);
      if (cleared) {
        this.logger.info(
          `Successfully cleared collection ${collectionName} for project ${projectId}`
        );
      }
      return cleared;
    } catch (error) {
      this.logger.error(`Failed to clear collection ${collectionName}:`, error);
      return false;
    }
  }

  async getCollectionSize(projectId: string): Promise<number> {
    const collectionName = this.generateCollectionName(projectId);
    try {
      const info = await this.client.getCollectionInfo(collectionName);
      return info ? info.pointsCount : 0;
    } catch (error) {
      this.logger.error(`Failed to get collection size for ${collectionName}:`, error);
      return 0;
    }
  }
}
