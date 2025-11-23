/*
C Language Tree-Sitter Query Patterns
Index for all C language queries including shared queries
*/

// 导入实体查询
import FUNCTIONS_QUERY from './entities/functions';
import PREPROCESSOR_QUERY from './entities/preprocessor';
import STRUCTS_QUERY from './entities/structs';
import VARIABLES_QUERY from './entities/variables';

// 导入关系查询
import CALL_QUERY from './relationships/call';
import ANNOTATION_QUERY from './relationships/annotation';
import CONTROL_FLOW_QUERY from './relationships/control-flow';
import CREATION_QUERY from './relationships/creation';
import DATA_FLOW_QUERY from './relationships/data-flow';
import DEPENDENCY_QUERY from './relationships/dependency';
import INHERITANCE_QUERY from './relationships/inheritance';
import REFERENCE_QUERY from './relationships/reference';
import CONCURRENCY_QUERY from './relationships/concurrency';
import LIFECYCLE_QUERY from './relationships/lifecycle';
import SEMANTIC_QUERY from './relationships/semantic';

// 导入共享查询
import { SHARED_CALL_EXPRESSIONS, SHARED_FUNCTION_ANNOTATIONS } from './shared';

// 定义查询映射
export const C_QUERIES = {
  // 实体查询
  'entities/functions': FUNCTIONS_QUERY,
  'entities/preprocessor': PREPROCESSOR_QUERY,
  'entities/structs': STRUCTS_QUERY,
  'entities/variables': VARIABLES_QUERY,
  
  // 关系查询
  'relationships/call': CALL_QUERY,
  'relationships/annotation': ANNOTATION_QUERY,
  'relationships/control-flow': CONTROL_FLOW_QUERY,
  'relationships/creation': CREATION_QUERY,
  'relationships/data-flow': DATA_FLOW_QUERY,
  'relationships/dependency': DEPENDENCY_QUERY,
  'relationships/inheritance': INHERITANCE_QUERY,
  'relationships/reference': REFERENCE_QUERY,
  'relationships/concurrency': CONCURRENCY_QUERY,
  'relationships/lifecycle': LIFECYCLE_QUERY,
  'relationships/semantic': SEMANTIC_QUERY,
  
  // 共享查询
 'shared/call-expressions': SHARED_CALL_EXPRESSIONS,
  'shared/function-annotations': SHARED_FUNCTION_ANNOTATIONS,
};

// 导出单独的查询常量
export {
  FUNCTIONS_QUERY,
  PREPROCESSOR_QUERY,
  STRUCTS_QUERY,
  VARIABLES_QUERY,
  CALL_QUERY,
  ANNOTATION_QUERY,
  CONTROL_FLOW_QUERY,
  CREATION_QUERY,
  DATA_FLOW_QUERY,
  DEPENDENCY_QUERY,
  INHERITANCE_QUERY,
  REFERENCE_QUERY,
  CONCURRENCY_QUERY,
  LIFECYCLE_QUERY,
  SEMANTIC_QUERY,
  SHARED_CALL_EXPRESSIONS,
  SHARED_FUNCTION_ANNOTATIONS
};