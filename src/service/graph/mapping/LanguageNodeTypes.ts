export interface LanguageNodeMapping {
  callExpression: string[];
  functionDeclaration: string[];
  classDeclaration: string[];
  interfaceDeclaration: string[];
  importDeclaration: string[];
  exportDeclaration: string[];
  memberExpression: string[];
  propertyIdentifier: string[];
}

export const LANGUAGE_NODE_MAPPINGS: Record<string, LanguageNodeMapping> = {
  'javascript': {
    callExpression: ['call_expression'],
    functionDeclaration: ['function_declaration', 'function_expression', 'arrow_function'],
    classDeclaration: ['class_declaration'],
    interfaceDeclaration: ['interface_declaration'],
    importDeclaration: ['import_statement'],
    exportDeclaration: ['export_statement'],
    memberExpression: ['member_expression'],
    propertyIdentifier: ['property_identifier']
  },
  'typescript': {
    callExpression: ['call_expression'],
    functionDeclaration: ['function_declaration', 'function_expression', 'arrow_function'],
    classDeclaration: ['class_declaration', 'abstract_class_declaration'],
    interfaceDeclaration: ['interface_declaration'],
    importDeclaration: ['import_statement'],
    exportDeclaration: ['export_statement'],
    memberExpression: ['member_expression'],
    propertyIdentifier: ['property_identifier']
  },
  'python': {
    callExpression: ['call'],
    functionDeclaration: ['function_definition'],
    classDeclaration: ['class_definition'],
    interfaceDeclaration: [], // Python没有接口
    importDeclaration: ['import_statement', 'import_from_statement'],
    exportDeclaration: [], // Python没有显式导出
    memberExpression: ['attribute'],
    propertyIdentifier: ['identifier']
  },
  'java': {
    callExpression: ['method_invocation'],
    functionDeclaration: ['method_declaration', 'constructor_declaration'],
    classDeclaration: ['class_declaration'],
    interfaceDeclaration: ['interface_declaration'],
    importDeclaration: ['import_declaration'],
    exportDeclaration: [], // Java没有显式导出
    memberExpression: ['field_access'],
    propertyIdentifier: ['identifier']
  },
  'go': {
    callExpression: ['call_expression'],
    functionDeclaration: ['function_declaration'],
    classDeclaration: [], // Go使用struct
    interfaceDeclaration: [], // Go使用interface
    importDeclaration: ['import_spec'],
    exportDeclaration: [], // Go通过大小写控制导出
    memberExpression: ['selector_expression'],
    propertyIdentifier: ['identifier']
  }
  // ... 其他语言
};