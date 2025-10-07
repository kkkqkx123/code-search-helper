import { IGraphAnalysisService } from './IGraphAnalysisService';
import { IGraphDataService } from './IGraphDataService';
import { IGraphSearchService } from './IGraphSearchService';
import { IGraphSpaceService } from './IGraphSpaceService';

/**
 * 图服务组合接口
 * 遵循接口隔离原则，通过组合多个专用接口提供完整的图服务功能
 * 
 * 客户端可以根据实际需求选择性地依赖特定的接口，而不是被迫实现不需要的方法
 */
export interface IGraphService extends 
  IGraphAnalysisService,
  IGraphDataService,
  IGraphSearchService,
  IGraphSpaceService {
  // 组合接口本身不需要额外的方法，所有功能都通过继承专用接口获得
}

/**
 * 图服务工厂接口
 * 用于创建和管理不同类型的图服务实例
 */
export interface IGraphServiceFactory {
  /**
   * 创建分析服务实例
   */
  createAnalysisService(): IGraphAnalysisService;

  /**
   * 创建数据服务实例
   */
  createDataService(): IGraphDataService;

  /**
   * 创建搜索服务实例
   */
  createSearchService(): IGraphSearchService;

  /**
   * 创建空间管理服务实例
   */
  createSpaceService(): IGraphSpaceService;

  /**
   * 创建完整的图服务实例
   */
  createGraphService(): IGraphService;
}

/**
 * 图服务适配器接口
 * 用于适配不同的图服务实现，确保接口兼容性
 */
export interface IGraphServiceAdapter {
  /**
   * 获取分析服务
   */
  getAnalysisService(): IGraphAnalysisService;

  /**
   * 获取数据服务
   */
  getDataService(): IGraphDataService;

  /**
   * 获取搜索服务
   */
  getSearchService(): IGraphSearchService;

  /**
   * 获取空间管理服务
   */
  getSpaceService(): IGraphSpaceService;

  /**
   * 获取完整的图服务
   */
  getGraphService(): IGraphService;
}