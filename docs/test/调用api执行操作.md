1. Invoke-RestMethod -Uri "http://localhost:3010/api/v1/indexing/create" -Method Post -ContentType "application/json" -Body "{`"projectPath`":`"D:/ide/tool/code-search-helper/test-files`", `"options`":{`"recursive`":true}}"
用于为项目构建索引

2. Invoke-RestMethod -Uri "http://localhost:3010/api/v1/projects" -Method Get
用于查询索引后的项目信息