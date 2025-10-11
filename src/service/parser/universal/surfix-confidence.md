根据提供的 `BackupFileProcessor` 类代码，我们可以提取出不同备份文件模式及其对应的 **confidence 值**。这些置信度反映了系统对推断原始文件类型准确性的判断。

以下是整理的常用备份文件匹配模式及其最终置信度（confidence）的 Markdown 表格：

---

### 📁 备份文件模式与置信度对照表

| 备份文件模式示例 | 匹配规则说明 | 置信度 (Confidence) | 触发条件 |
|------------------|--------------|---------------------|----------|
| `.filename.swp` | Vim 交换文件（以 `.` 开头并以 `.swp` 结尾） | `0.9` | `baseName.startsWith('.') && baseName.endsWith('.swp')` |
| `#filename#` | Vim 风格临时文件（前后都有 `#`） | `0.9` | `baseName.startsWith('#') && baseName.endsWith('#')` |
| `filename~` | Emacs 风格备份文件（波浪号结尾） | `0.7` | `endsWith('~')` 且不为 `.bak~` |
| `filename.py.bak`, `app.js.backup` 等 | 特殊复合模式：`name.ext.bakType`，其中 `ext` 是有效编程语言扩展名 | `0.95` | 正则匹配 `/^(.+?)\.([a-z0-9]+)\.(?:bak\|backup\|old\|tmp\|temp\|orig\|save\|swo)$/i` 且扩展名有效 |
| `filename.bak`, `filename.backup`, `filename.old` 等 | 标准备份后缀（由 `BACKUP_FILE_PATTERNS` 定义） | `0.8` | 文件名以标准备份后缀结尾 |
| `.filename.bak` | 隐藏备份文件（以 `.` 开头且含 `.bak`） | `0.8` | `startsWith('.') && includes('.bak')` |
| `filename.py.tmp`, `config.json.bak` 等（仅从扩展名推断） | 无法解析完整原文件名时，尝试从中间扩展名提取 | `0.6` | 使用正则 `/\.([a-z0-9]+)(?:\.(?:bak\|backup\|old\|tmp\|temp))?$/i` 提取扩展名 |

> ✅ **说明**：
> - 置信度越高，表示系统越确信所推断的原始文件类型是正确的。
> - 模式优先级有先后顺序，例如特殊复合模式（`.py.bak`）优先于普通 `.bak` 后缀处理。
> - 只有当扩展名对应的语言在 `LANGUAGE_MAP` 中存在时，才会赋予高置信度（如 `0.95`）。

---

### 💡 示例解释

| 文件名 | 推断逻辑 | 置信度 |
|--------|---------|-------|
| `main.py.bak` | 匹配特殊复合模式，`.py` 是有效语言扩展 → `confidence=0.95` | 0.95 |
| `script.js~` | Emacs 风格备份 → `confidence=0.7` | 0.7 |
| `.main.ts.swp` | Vim 交换文件 → `confidence=0.9` | 0.9 |
| `#index.html#` | Vim 临时文件 → `confidence=0.9` | 0.9 |
| `config.json.temp` | 标准后缀 `.temp` → `confidence=0.8` | 0.8 |
| `data.txt.bak`（但 `.txt` 不是代码语言） | 即使模式匹配，若语言无效，则 fallback 到低置信路径 | 最高 0.6（仅靠扩展名） |

---

该表格可用于文档化或调试用途，帮助理解系统如何识别和还原各类备份文件。