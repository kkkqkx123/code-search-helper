/http-debug.md 
使用当前项目执行nebula相关操作，将使用说明写入文档(放在docs\nebula-graph目录)，再编写hurl的配置文件，放在scripts\hurl目录，之后使用hurl运行这些指令来执行http调试。
现在nebula graph已经启用，nebula-consule命令也直接可用(exe文件已经加入系统路径)，服务也已经运行在3010端口

目前hurl文件已经在scripts\hurl\nebula-graph目录

 .env:10-22
```
# NebulaGraph Configuration
NEBULA_ENABLED = false
NEBULA_HOST = 127.0.0.1
NEBULA_PORT = 9669
NEBULA_USERNAME = root
NEBULA_PASSWORD = nebula
NEBULA_TIMEOUT = 3000
NEBULA_MAX_CONNECTIONS = 10
NEBULA_RETRY_ATTEMPTS = 3
NEBULA_RETRY_DELAY = 30000
NEBULA_BUFFER_SIZE = 1000
NEBULA_PING_INTERVAL = 3000
NEBULA_VID_TYPE_LENGTH = 128
```