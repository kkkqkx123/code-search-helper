src\infrastructure\monitoring\PerformanceMonitor.ts

recordOperation('search_vectors', duration) - 直接在应用层使用字符串传参，避免任何重复的监控管理实现
多个参数：字符串格式化
应用层直接传字符串，更符合单一职责原则。