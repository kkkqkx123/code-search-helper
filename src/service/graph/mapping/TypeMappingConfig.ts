/**
 * 类型映射配置
 */
export const TYPE_MAPPING_CONFIG = {
  entityTypes: [
    'function', 'class', 'method', 'import', 'variable', 
    'interface', 'type', 'union', 'enum'
  ],
  
  relationshipTypes: [
    'call', 'data-flow', 'inheritance', 'implements',
    'annotation', 'creation', 'dependency', 'reference',
    'concurrency', 'lifecycle', 'semantic', 'control-flow'
  ],
  
  relationshipTypeMappings: {
    'call': 'CALLS',
    'data-flow': 'DATA_FLOWS_TO',
    'inheritance': 'INHERITS',
    'implements': 'IMPLEMENTS',
    'annotation': 'ANNOTATES',
    'creation': 'CREATES',
    'dependency': 'DEPENDS_ON',
    'reference': 'REFERENCES',
    'concurrency': 'SYNCHRONIZES_WITH',
    'lifecycle': 'MANAGES_LIFECYCLE',
    'semantic': 'OVERRIDES',
    'control-flow': 'CONTROLS'
  }
};