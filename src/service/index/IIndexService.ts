import { IndexSyncOptions } from './IndexService';

export interface IIndexService {
  indexProject(projectPath: string, options?: IndexSyncOptions): Promise<string>;
  getIndexStatus(projectId: string): Promise<any> | any;
  stopIndexing(projectId: string): Promise<boolean>;
  reindexProject(projectPath: string, options?: IndexSyncOptions): Promise<string>;
}