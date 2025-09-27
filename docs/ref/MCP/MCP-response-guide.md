要让 MCP（Model Context Protocol）Server 返回的信息对 OpenAI 兼容的 LLM 更友好，核心在于把 MCP 原生的工具描述/结果格式“翻译”成 OpenAI 函数调用（Function Calling）协议所要求的 JSON Schema 与消息结构，并在返回结果中保留足够的语义、类型、执行状态，以便 LLM 无需额外推理就能决定下一步动作。下面给出可直接落地的设计要点与示例代码片段，全部来自 2025-08 之后最新实践 ：

---

### 1. 统一工具元数据格式：MCP → OpenAI  
| MCP 原生字段 | 建议映射到 OpenAI 的字段 | 注意 |
|--------------|--------------------------|------|
| `tool.name` | `function.name` | 用正则把 `/` 或 `-` 替换成 `_`，保持字母数字+下划线  |
| `tool.description` | `function.description` | 保留原始语义，可追加“返回 JSON 含字段 x/y/z” |
| `inputSchema` | `function.parameters` | 直接把 MCP 的 JSON Schema 搬过来，但删掉 `additionalProperties: false` 这类限制，LLM 更容易填充  |
| `outputSchema` | 无需注册，但要在返回结果里兑现 | 见第 3 点 |

代码片段（Python）：
```python
def _convert_mcp_tools_to_openai_format(mcp_tools: list) -> list:
    openai_tools = []
    for tool in mcp_tools:
        openai_name = re.sub(r'[^0-9A-Za-z_]', '_', tool.name)
        openai_tools.append({
            "type": "function",
            "function": {
                "name": openai_name,
                "description": tool.description,
                "parameters": tool.inputSchema  # 直接复用
            }
        })
    return openai_tools
```

---

### 2. 调用结果包装：让 LLM“零思考”就能继续  
OpenAI 的函数调用约定要求返回一个**扁平 JSON 对象**（字符串形式），字段越少歧义越小。建议固定三层结构：  
```json
{
  "status": "success | error",
  "data": <MCP 原始出参，保持 schema 一致>,
  "meta": {
     "tool": "原始MCP工具名",
     "duration_ms": 123,
     "cached": false
  }
}
```
- `status` 让 LLM 快速判断分支；  
- `data` 保持 MCP `outputSchema` 的字段名、类型不变，避免 LLM 做二次映射；  
- `meta` 放调试信息，不会污染语义，LLM 可忽略。

如果 MCP 返回的是二进制（图片、PDF），先 base64 编码后放进 `data.{format}_base64`，并增加 `mime_type` 字段，LLM 在多模态场景可直接渲染 。

---

### 3. 错误处理：把“可恢复”与不可恢复区分开  
| 场景 | 返回 status | 补充策略 |
|------|-------------|----------|
| 参数校验失败 | `"error"` | 在 `data` 里给出 `"missing_field": "xxx"`，LLM 可自动重试 |
| 业务空结果 | `"success"` | `data: null` + `meta.note: "查询结果为空"`，LLM 可换参数再调 |
| 网络超时 | `"error"` | `data: {"retry_after": 5}`，LLM 可等待后重试 |

---

### 4. 流式返回（SSE）时的分段策略  
当结果很大（如 2 MB 的图表 JSON）时，用 MCP 的 `progress` 通知把**完整结果拆成片段**，但最后一次 SSE 事件必须是一段**合法、自洽的 JSON**（即上面三层结构），否则 LLM 会截断理解。不要逐行 flush 一个数组。

---

### 5. 对话记忆对齐：把“工具调用脚印”写进 message 列表  
OpenAI 兼容接口要求 `messages[]` 里出现  
`{"role": "assistant", "tool_calls": [...]}`  
→  
`{"role": "tool", "tool_call_id": "xxx", "content": <上面三层 JSON>}`  

MCP-Use 这类桥接库已自动完成该对齐 ；自研时记得在返回 HTTP 响应前，把 MCP 结果再包成 `tool` 角色消息，供下次 LLM 请求携带。

---

### 6. 可选增强：给 LLM“阅读指南”  
在系统提示里追加一段模板化文字，可显著降低幻觉：  
```
当调用工具返回的 JSON 中 status=error 时，请先阅读 data 内的字段提示，尝试修复参数再重试，不要编造结果。
```

---

### 7. 完整交互示例（伪代码）
```python
# 1. LLM 请求
messages = [{"role": "user", "content": "东京最好吃的寿司店？"}]
functions = mcp_bridge.openai_functions  # 第 1 步转换后的列表

# 2. LLM 决定调用函数
llm_resp = openai.ChatCompletion.create(
    model="gpt-4",
    messages=messages,
    functions=functions
)
tool_call = llm_resp.choices[0].message.tool_calls[0]

# 3. 桥接层调用 MCP Server
mcp_result = await mcp_client.call_tool(
    tool_name=tool_call.name,
    arguments=json.loads(tool_call.function.arguments)
)

# 4. 按第 2 步格式包装
openai_content = {
    "status": "success",
    "data": mcp_result,
    "meta": {"tool": tool_call.name, "duration_ms": 123}
}

# 5. 把工具返回写回 messages
messages.append(llm_resp.choices[0].message)  # assistant 角色
messages.append({
    "role": "tool",
    "tool_call_id": tool_call.id,
    "content": json.dumps(openai_content, ensure_ascii=False)
})

# 6. 再次请求 LLM 得到自然语言回答
final = openai.ChatCompletion.create(model="gpt-4", messages=messages)
```

---

### 结论  
只要按照“**字段对齐、类型保留、状态显性、错误可恢复**”四条原则去设计 MCP 返回体，再配一段轻量桥接代码把工具注册/调用/结果封装与 OpenAI 函数调用协议完全对齐，就能让任何支持 function calling 的 OpenAI 兼容 LLM（GPT-4、GPT-3.5、Llama3-OpenAI-wrapper 等）像原生插件一样使用你的 MCP Server，无需额外提示工程即可稳定、高效地多轮交互 。