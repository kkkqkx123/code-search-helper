-- Migration 002: Add project_path_mapping table
-- 添加 project_path_mapping 表用于存储哈希值与原始项目路径的映射关系

BEGIN TRANSACTION;

-- Create project_path_mapping table
-- 创建 project_path_mapping 表
CREATE TABLE IF NOT EXISTS project_path_mapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT UNIQUE NOT NULL,
    original_path TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_project_path_mapping_hash 
ON project_path_mapping(hash);

CREATE INDEX IF NOT EXISTS idx_project_path_mapping_original_path 
ON project_path_mapping(original_path);

CREATE INDEX IF NOT EXISTS idx_project_path_mapping_created_at 
ON project_path_mapping(created_at);

-- Create trigger to automatically update updated_at timestamp
-- 创建触发器自动更新 updated_at 时间戳
CREATE TRIGGER IF NOT EXISTS update_project_path_mapping_timestamp 
AFTER UPDATE ON project_path_mapping
BEGIN
    UPDATE project_path_mapping 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;

COMMIT;

-- Migration completed successfully
-- 迁移完成