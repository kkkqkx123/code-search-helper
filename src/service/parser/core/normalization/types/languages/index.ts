/**
 * 语言特定实体类型定义模块导出
 */

// C语言特定类型定义
export * from './c/CEntityTypes';

// C语言特定关系类型定义
export * from './c/CRelationshipTypes';

// 初始化函数，用于注册语言特定的工厂
import { EntityTypeRegistry } from '../EntityTypes';
import { CEntityTypeFactory } from './c/CEntityTypes';
import { RelationshipTypeRegistry } from '../RelationshipTypes';
import { CRelationshipTypeFactory } from './c/CRelationshipTypes';

/**
 * 初始化并注册所有语言特定的实体类型工厂
 */
export function initializeLanguageFactories(): void {
  const entityRegistry = EntityTypeRegistry.getInstance();
  const relationshipRegistry = RelationshipTypeRegistry.getInstance();

  // 注册C语言实体工厂
  if (!entityRegistry.isLanguageRegistered('c')) {
    entityRegistry.registerFactory('c', new CEntityTypeFactory());
  }

  // 注册C语言关系工厂
  if (!relationshipRegistry.isLanguageRegistered('c')) {
    relationshipRegistry.registerFactory('c', new CRelationshipTypeFactory());
  }

  // 可以在这里添加其他语言的工厂注册
  // if (!entityRegistry.isLanguageRegistered('cpp')) {
  //   entityRegistry.registerFactory('cpp', new CppEntityTypeFactory());
  // }
  // 
  // if (!relationshipRegistry.isLanguageRegistered('cpp')) {
  //   relationshipRegistry.registerFactory('cpp', new CppRelationshipTypeFactory());
  // }

  // if (!entityRegistry.isLanguageRegistered('javascript')) {
  //   entityRegistry.registerFactory('javascript', new JavaScriptEntityTypeFactory());
  // }
  // 
  // if (!relationshipRegistry.isLanguageRegistered('javascript')) {
  //   relationshipRegistry.registerFactory('javascript', new JavaScriptRelationshipTypeFactory());
  // }
}

/**
 * 自动初始化语言工厂
 */
initializeLanguageFactories();