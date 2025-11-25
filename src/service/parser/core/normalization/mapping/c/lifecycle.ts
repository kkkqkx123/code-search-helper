import { MappingConfig, QueryPatternType, MappingPriority } from '../types';

/**
 * C语言生命周期关系映射配置
 */
export const LIFECYCLE_MAPPINGS: MappingConfig = {
  language: 'c',
  queryType: 'lifecycle',
  mappings: [
    {
      queryPattern: '@lifecycle.relationship.memory.deallocation',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@deallocation.function',
        target: '@deallocated.pointer'
      },
      relationship: {
        type: 'deallocates',
        category: 'lifecycle',
        metadata: {
          phase: 'destruction',
          resourceType: 'memory',
          operation: 'deallocate'
        }
      },
      priority: MappingPriority.CRITICAL,
      description: '内存释放关系'
    },
    {
      queryPattern: '@lifecycle.relationship.memory.reallocation',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@reallocation.function',
        target: '@original.pointer'
      },
      relationship: {
        type: 'reallocates',
        category: 'lifecycle',
        metadata: {
          phase: 'modification',
          resourceType: 'memory',
          operation: 'reallocate'
        }
      },
      priority: MappingPriority.CRITICAL,
      description: '内存重新分配关系'
    },
    {
      queryPattern: '@lifecycle.relationship.memory.variable.binding',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@pointer.variable',
        target: '@allocation.function'
      },
      relationship: {
        type: 'binds',
        category: 'lifecycle',
        metadata: {
          phase: 'creation',
          resourceType: 'memory',
          operation: 'allocate'
        }
      },
      priority: MappingPriority.CRITICAL,
      description: '内存分配变量绑定关系'
    },
    {
      queryPattern: '@lifecycle.relationship.file.close',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@file.close.function',
        target: '@file.handle'
      },
      relationship: {
        type: 'closes',
        category: 'lifecycle',
        metadata: {
          phase: 'destruction',
          resourceType: 'file',
          operation: 'close'
        }
      },
      priority: MappingPriority.HIGH,
      description: '文件关闭关系'
    },
    {
      queryPattern: '@lifecycle.relationship.file.read',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@file.read.function',
        target: '@file.handle'
      },
      relationship: {
        type: 'reads',
        category: 'lifecycle',
        metadata: {
          phase: 'usage',
          resourceType: 'file',
          operation: 'read'
        }
      },
      priority: MappingPriority.HIGH,
      description: '文件读取关系'
    },
    {
      queryPattern: '@lifecycle.relationship.file.write',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@file.write.function',
        target: '@file.handle'
      },
      relationship: {
        type: 'writes',
        category: 'lifecycle',
        metadata: {
          phase: 'usage',
          resourceType: 'file',
          operation: 'write'
        }
      },
      priority: MappingPriority.HIGH,
      description: '文件写入关系'
    },
    {
      queryPattern: '@lifecycle.relationship.file.handle.binding',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@file.handle.variable',
        target: '@file.open.function'
      },
      relationship: {
        type: 'binds',
        category: 'lifecycle',
        metadata: {
          phase: 'creation',
          resourceType: 'file',
          operation: 'open'
        }
      },
      priority: MappingPriority.HIGH,
      description: '文件句柄变量绑定关系'
    },
    {
      queryPattern: '@lifecycle.relationship.thread.join',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@thread.join.function',
        target: '@thread.handle'
      },
      relationship: {
        type: 'joins',
        category: 'lifecycle',
        metadata: {
          phase: 'destruction',
          resourceType: 'thread',
          operation: 'join'
        }
      },
      priority: MappingPriority.MEDIUM,
      description: '线程加入关系'
    },
    {
      queryPattern: '@lifecycle.relationship.thread.detach',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@thread.detach.function',
        target: '@thread.handle'
      },
      relationship: {
        type: 'detaches',
        category: 'lifecycle',
        metadata: {
          phase: 'modification',
          resourceType: 'thread',
          operation: 'detach'
        }
      },
      priority: MappingPriority.MEDIUM,
      description: '线程分离关系'
    },
    {
      queryPattern: '@lifecycle.relationship.mutex.destroy',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@mutex.destroy.function',
        target: '@mutex.handle'
      },
      relationship: {
        type: 'destroys',
        category: 'lifecycle',
        metadata: {
          phase: 'destruction',
          resourceType: 'mutex',
          operation: 'destroy'
        }
      },
      priority: MappingPriority.LOW,
      description: '互斥锁销毁关系'
    },
    {
      queryPattern: '@lifecycle.relationship.mutex.lock',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@mutex.lock.function',
        target: '@mutex.handle'
      },
      relationship: {
        type: 'locks',
        category: 'lifecycle',
        metadata: {
          phase: 'usage',
          resourceType: 'mutex',
          operation: 'lock'
        }
      },
      priority: MappingPriority.LOW,
      description: '互斥锁加锁关系'
    },
    {
      queryPattern: '@lifecycle.relationship.mutex.unlock',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@mutex.unlock.function',
        target: '@mutex.handle'
      },
      relationship: {
        type: 'unlocks',
        category: 'lifecycle',
        metadata: {
          phase: 'usage',
          resourceType: 'mutex',
          operation: 'unlock'
        }
      },
      priority: MappingPriority.LOW,
      description: '互斥锁解锁关系'
    },
    {
      queryPattern: '@lifecycle.relationship.resource.destructor',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@resource.destructor',
        target: '@resource.pointer'
      },
      relationship: {
        type: 'destructs',
        category: 'lifecycle',
        metadata: {
          phase: 'destruction',
          resourceType: 'custom',
          operation: 'destruct'
        }
      },
      priority: MappingPriority.LOW,
      description: '资源析构函数关系'
    },
    {
      queryPattern: '@lifecycle.relationship.resource.init',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@resource.init.function',
        target: '@resource.pointer'
      },
      relationship: {
        type: 'initializes',
        category: 'lifecycle',
        metadata: {
          phase: 'creation',
          resourceType: 'custom',
          operation: 'init'
        }
      },
      priority: MappingPriority.LOW,
      description: '资源初始化函数关系'
    },
    {
      queryPattern: '@lifecycle.relationship.resource.cleanup',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@resource.cleanup.function',
        target: '@resource.pointer'
      },
      relationship: {
        type: 'cleans',
        category: 'lifecycle',
        metadata: {
          phase: 'destruction',
          resourceType: 'custom',
          operation: 'cleanup'
        }
      },
      priority: MappingPriority.LOW,
      description: '资源清理函数关系'
    },
    {
      queryPattern: '@lifecycle.relationship.scope.local.begin',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@local.variable.name',
        target: '@local.variable.type'
      },
      relationship: {
        type: 'begins_scope',
        category: 'lifecycle',
        metadata: {
          phase: 'creation',
          resourceType: 'scope',
          operation: 'scope.begin'
        }
      },
      priority: MappingPriority.MINIMAL,
      description: '局部变量作用域开始关系'
    },
    {
      queryPattern: '@lifecycle.relationship.scope.local.end',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@local.variable.name',
        target: '@local.variable.type'
      },
      relationship: {
        type: 'ends_scope',
        category: 'lifecycle',
        metadata: {
          phase: 'destruction',
          resourceType: 'scope',
          operation: 'scope.end'
        }
      },
      priority: MappingPriority.MINIMAL,
      description: '局部变量作用域结束关系'
    },
    {
      queryPattern: '@lifecycle.relationship.scope.global',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@global.variable.name',
        target: '@global.variable.type'
      },
      relationship: {
        type: 'global_scope',
        category: 'lifecycle',
        metadata: {
          phase: 'creation',
          resourceType: 'scope',
          operation: 'scope.global'
        }
      },
      priority: MappingPriority.MINIMAL,
      description: '全局变量生命周期关系'
    },
    {
      queryPattern: '@lifecycle.relationship.scope.static',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@static.variable.name',
        target: '@static.variable.type'
      },
      relationship: {
        type: 'static_scope',
        category: 'lifecycle',
        metadata: {
          phase: 'creation',
          resourceType: 'scope',
          operation: 'scope.static'
        }
      },
      priority: MappingPriority.MINIMAL,
      description: '静态变量生命周期关系'
    },
    {
      queryPattern: '@lifecycle.relationship.scope.parameter',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@parameter.name',
        target: '@parameter.type'
      },
      relationship: {
        type: 'parameter_scope',
        category: 'lifecycle',
        metadata: {
          phase: 'creation',
          resourceType: 'scope',
          operation: 'scope.parameter'
        }
      },
      priority: MappingPriority.MINIMAL,
      description: '函数参数生命周期关系'
    }
  ]
};

export default LIFECYCLE_MAPPINGS;