# NebulaGraph Console 使用说明

## 📖 概述

NebulaGraph Console 是 NebulaGraph 数据库的命令行客户端工具，允许用户通过命令行界面执行 nGQL（NebulaGraph Query Language）语句来管理和查询图数据库。

## 🔧 基本连接

### 连接语法

```bash
nebula-console -addr <ip> -port <port> -u <username> -p <password>
```

### 常用连接参数

| 参数 | 简写 | 描述 | 默认值 |
|------|------|------|--------|
| `-addr` | `-address` | Graph 服务的 IP 地址或主机名 | 127.0.0.1 |
| `-P` | `-port` | Graph 服务的端口 | 9669 |
| `-u` | `-user` | 用户名 | root |
| `-p` | `-password` | 密码 | - |
| `-t` | `-timeout` | 连接超时时间（毫秒） | 120 |

### 连接示例

```bash
# 基本连接
nebula-console -addr 127.0.0.1 -port 9669 -u root -p nebula

# 使用简写参数
nebula-console -addr 127.0.0.1 -P 9669 -u root -p nebula

# 带超时设置的连接
nebula-console -addr 127.0.0.1 -port 9669 -u root -p nebula -t 5000
```

## 🛡️ SSL 连接

### SSL 双向认证连接

```bash
nebula-console -addr 192.168.8.100 -port 9669 -u root -p nebula \
  -enable_ssl \
  -ssl_root_ca_path /home/xxx/cert/root.crt \
  -ssl_cert_path /home/xxx/cert/client.crt \
  -ssl_private_key_path /home/xxx/cert/client.key
```

### SSL 参数说明

| 参数 | 描述 |
|------|------|
| `-enable_ssl` | 启用 SSL 加密进行双向认证 |
| `-ssl_root_ca_path` | CA 根证书的存储路径 |
| `-ssl_cert_path` | SSL 公钥证书的存储路径 |
| `-ssl_private_key_path` | SSL 私钥的存储路径 |
| `-ssl_insecure_skip_verify` | 指定客户端是否跳过验证服务器的证书链和主机名 |

## 📁 文件执行

### 执行单个 nGQL 语句

```bash
nebula-console -addr 127.0.0.1 -port 9669 -u root -p nebula -e "SHOW SPACES"
```

### 执行文件中的 nGQL 语句

```bash
nebula-console -addr 127.0.0.1 -port 9669 -u root -p nebula -f /path/to/queries.ngql
```

## 🎯 Console 内部命令

### 参数管理

```ngql
# 保存参数
:param p1 => "Tim Duncan";

# 保存复杂参数
:param p2 => {"a":3,"b":false,"c":"Tim Duncan"};

# 查看所有参数
:params;

# 查看特定参数
:params p1;

# 删除参数
:param p1 =>;
```

### 结果导出

```ngql
# 导出为 CSV 文件
:CSV output.csv;

# 导出为 DOT 文件（用于 Graphviz 可视化）
:dot graph.dot;

# 导出 PROFILE/EXPLAIN 结果
:profile profile_result.txt;
:explain explain_result.txt;
```

### 性能测试

```ngql
# 重复执行命令 N 次
:repeat 3;
GO FROM "player100" OVER follow YIELD dst(edge);
```

### 加载测试数据

```ngql
# 加载篮球运动员测试数据集
:play basketballplayer;
```

### 退出 Console

```ngQL
:QUIT;
# 或者
:EXIT;
```

## 🔍 常用 nGQL 操作

### 空间管理

```ngql
# 显示所有空间
SHOW SPACES;

# 创建空间
CREATE SPACE my_space (partition_num=10, replica_factor=1, vid_type=fixed_string(30));

# 使用空间
USE my_space;

# 删除空间
DROP SPACE my_space;
```

### 标签和边类型管理

```ngql
# 创建标签
CREATE TAG person(name string, age int);

# 创建边类型
CREATE EDGE like(likeness double);

# 显示标签
SHOW TAGS;

# 显示边类型
SHOW EDGES;
```

### 数据操作

```ngql
# 插入顶点
INSERT VERTEX person(name, age) VALUES "player100":("Tim Duncan", 42);

# 插入边
INSERT EDGE like(likeness) VALUES "player100" -> "player101":(95);

# 查询数据
GO FROM "player100" OVER like YIELD dst(edge) AS friend;
```

## 🐳 Docker 环境使用

### 进入 Console 容器

```bash
docker exec -it nebula-docker-compose_console_1 /bin/sh
```

### 容器内连接

```bash
./usr/local/bin/nebula-console -u root -p nebula --address=graphd --port=9669
```

## ☸️ Kubernetes 环境使用

### 通过 Pod 连接

```bash
# 进入 nebula-console Pod
kubectl exec -it nebula-console -- /bin/sh

# 连接到数据库
nebula-console -addr nebula-graphd-svc.default.svc.cluster.local -port 9669 -u root -p nebula
```

### 临时运行 Console

```bash
kubectl run -ti --image vesoft/nebula-console:latest --restart=Never -- nebula-console \
  -addr <cluster_ip> -port <service_port> -u root -p nebula
```

## 📊 版本检查

### 检查运行中的服务版本

```ngql
SHOW HOSTS META;
```

### 检查二进制文件版本

```bash
./nebula-graphd --version
```

## ⚠️ 注意事项

1. **权限管理**：确保使用的用户具有足够的权限执行相应操作
2. **网络连接**：检查防火墙和网络配置，确保能够访问 NebulaGraph 服务
3. **SSL 证书**：使用 SSL 连接时，确保证书文件路径正确且有效
4. **参数化查询**：VID 和 SAMPLE 子句不支持参数化
5. **会话隔离**：参数只在当前会话中有效

## 🔧 故障排除

### 连接超时

```bash
# 增加超时时间
nebula-console -addr 127.0.0.1 -port 9669 -u root -p nebula -t 10000
```

### 认证失败

- 检查用户名和密码是否正确
- 确认 NebulaGraph 服务是否启用了认证
- 验证用户权限设置

### 网络问题

- 使用 `telnet` 或 `nc` 命令测试端口连通性
- 检查防火墙规则
- 验证服务地址和端口配置

## 📚 相关资源

- [NebulaGraph 官方文档](https://docs.nebula-graph.io/)
- [nGQL 语法参考](https://docs.nebula-graph.io/master/3.ngql-guide/1.nGQL-overview/1.overview.md)
- [NebulaGraph Studio](https://docs.nebula-graph.io/master/nebula-studio/st-ug-what-is-studio.md)