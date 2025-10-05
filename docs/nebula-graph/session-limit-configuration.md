# Nebula Graph 会话限制配置指南

## 问题描述

当遇到以下错误时：

```
Create Session failed: Too many sessions created from [IP] by user [username]. the threshold is 1000. You can change it by modifying 'max_sessions_per_ip_per_user' in nebula-graphd.conf
```

这表明Nebula Graph服务器上的会话限制已达到上限。

## 解决方案

### 服务器端配置修改

要解决这个问题，需要修改Nebula Graph服务器的配置文件：

1. **找到配置文件**：
   - 通常位于 `/usr/local/nebula/etc/nebula-graphd.conf` 或 `/opt/nebula/etc/nebula-graphd.conf`
   - 在Docker环境中，可能位于容器内的 `/usr/local/nebula/etc/`

2. **修改配置参数**：
   ```conf
   # 在graphd配置文件中找到或添加以下参数
   --max_sessions_per_ip_per_user=5000  # 增加会话限制到5000，或根据需要调整
   # 或者设置为0表示无限制（仅在开发环境推荐）
   --max_sessions_per_ip_per_user=0
   ```

3. **其他相关参数**：
   ```conf
   --max_sessions_per_user=5000        # 每用户最大会话数
   --session_idle_timeout_secs=28800   # 会话空闲超时时间（秒）
   --session_expire_timeout_secs=604800 # 会话过期时间（秒）
   ```

4. **重启Nebula Graph服务**：
   ```bash
   # Docker方式
   docker restart nebula-graphd
   
   # 或系统服务方式
   sudo systemctl restart nebula-graphd
   ```

### 客户端连接管理

除了服务器端配置，还需要确保客户端正确管理连接：

1. **确保正确关闭连接**：
   - 在应用退出时调用 `disconnect()` 方法
   - 使用 try-finally 块确保连接被清理
   - 实现连接池管理以避免频繁的连接/断开

2. **连接池配置**：
   - 设置合理的连接池大小
   - 配置连接超时时间
   - 启用连接健康检查

### 监控会话使用情况

可以使用以下Nebula查询来监控当前会话：

```sql
# 查看所有活跃会话
SHOW SESSIONS;

# 查看本地会话
SHOW LOCAL SESSIONS;
```

### 最佳实践

1. **在生产环境中**：
   - 设置合理的会话限制（如2000-5000）
   - 定期监控会话使用情况
   - 实现适当的连接池管理
   - 配置会话超时

2. **在开发环境中**：
   - 可以设置较高的限制或无限制
   - 重点关注连接的正确关闭

### Docker环境注意事项

如果使用Docker部署Nebula Graph：

1. **挂载配置文件**：
   ```bash
   docker run -v /path/to/nebula-graphd.conf:/usr/local/nebula/etc/nebula-graphd.conf ...
   ```

2. **检查Docker网络**：
   - Docker容器可能共享相同的IP地址
   - 根据容器数量合理设置会话限制

### 故障排除

如果修改配置后问题仍然存在：

1. 确认配置文件是否正确加载
2. 检查服务是否已重启
3. 验证新配置是否生效（查看服务日志）
4. 检查是否有多个graphd实例需要配置

## 配置示例

完整的graphd配置示例：

```conf
--port=9669
--data_path=data/graph
--pid_file=pid
--log_dir=logs
--v=1
--minloglevel=0
--max_sessions_per_ip_per_user=5000
--max_sessions_per_user=5000
--session_idle_timeout_secs=28800
--session_expire_timeout_secs=604800
--num_netio_threads=0
--num_worker_threads=0
--max_allowed_connections=10000
--listen_backlog=1024
--graph_refill_interval=60
--slow_query_threshold_us=5000000