# 嵌入器配置

## 概述

嵌入器配置包括各种嵌入模型提供商的配置参数，用于将文本转换为向量表示。

## 主要配置项

### 嵌入提供商选择

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `EMBEDDING_PROVIDER` | `siliconflow` | 默认嵌入模型提供商，可选值：`openai`, `ollama`, `gemini`, `mistral`, `siliconflow`, `custom1`, `custom2`, `custom3` |
| `SKIP_UNAVAILABLE_PROVIDER_CHECKS` | `true` | 是否跳过不可用提供商检查以减少不必要的网络请求 |

## OpenAI嵌入器配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `OPENAI_API_KEY` | `your-openai-api-key-here` | OpenAI API密钥 |
| `OPENAI_BASE_URL` | `https://api.openai.com` | OpenAI API基础URL |
| `OPENAI_MODEL` | `text-embedding-ada-002` | OpenAI嵌入模型名称 |
| `OPENAI_DIMENSIONS` | `1536` | OpenAI嵌入向量维度 |

## Ollama嵌入器配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama服务基础URL |
| `OLLAMA_MODEL` | `nomic-embed-text` | Ollama嵌入模型名称 |
| `OLLAMA_DIMENSIONS` | `768` | Ollama嵌入向量维度 |

## Gemini嵌入器配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `GEMINI_API_KEY` | `your-gemini-api-key-here` | Gemini API密钥 |
| `GEMINI_BASE_URL` | `https://generativelanguage.googleapis.com` | Gemini API基础URL |
| `GEMINI_MODEL` | `embedding-001` | Gemini嵌入模型名称 |
| `GEMINI_DIMENSIONS` | `768` | Gemini嵌入向量维度 |

## Mistral嵌入器配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `MISTRAL_API_KEY` | `your-mistral-api-key-here` | Mistral API密钥 |
| `MISTRAL_BASE_URL` | `https://api.mistral.ai` | Mistral API基础URL |
| `MISTRAL_MODEL` | `mistral-embed` | Mistral嵌入模型名称 |
| `MISTRAL_DIMENSIONS` | `1024` | Mistral嵌入向量维度 |

## SiliconFlow嵌入器配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `SILICONFLOW_API_KEY` | `your-siliconflow-api-key-here` | SiliconFlow API密钥 |
| `SILICONFLOW_BASE_URL` | `https://api.siliconflow.cn/v1` | SiliconFlow API基础URL |
| `SILICONFLOW_MODEL` | `BAAI/bge-m3` | SiliconFlow嵌入模型名称 |
| `SILICONFLOW_DIMENSIONS` | `1024` | SiliconFlow嵌入向量维度 |

## 自定义嵌入器配置

### Custom1配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `CUSTOM_CUSTOM1_API_KEY` | `your-custom1-api-key-here` | Custom1 API密钥 |
| `CUSTOM_CUSTOM1_BASE_URL` | (空) | Custom1 API基础URL |
| `CUSTOM_CUSTOM1_MODEL` | `your-custom1-model-here` | Custom1嵌入模型名称 |
| `CUSTOM_CUSTOM1_DIMENSIONS` | `768` | Custom1嵌入向量维度 |

### Custom2配置

| 配置项 | 默认值 | 说明 |
|--------|------|
| `CUSTOM_CUSTOM2_API_KEY` | `your-custom2-api-key-here` | Custom2 API密钥 |
| `CUSTOM_CUSTOM2_BASE_URL` | (空) | Custom2 API基础URL |
| `CUSTOM_CUSTOM2_MODEL` | `your-custom2-model-here` | Custom2嵌入模型名称 |
| `CUSTOM_CUSTOM2_DIMENSIONS` | `768` | Custom2嵌入向量维度 |

### Custom3配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `CUSTOM_CUSTOM3_API_KEY` | `your-custom3-api-key-here` | Custom3 API密钥 |
| `CUSTOM_CUSTOM3_BASE_URL` | (空) | Custom3 API基础URL |
| `CUSTOM_CUSTOM3_MODEL` | `your-custom3-model-here` | Custom3嵌入模型名称 |
| `CUSTOM_CUSTOM3_DIMENSIONS` | `768` | Custom3嵌入向量维度 |

## 使用这些配置项的文件

### 1. 嵌入器配置服务
- **文件**: `src/config/service/EmbeddingConfigService.ts`
- **用途**: 管理嵌入器提供商的配置参数

### 2. 嵌入器工厂
- **文件**: `src/embedders/EmbedderFactory.ts`
- **用途**: 根据配置创建相应的嵌入器实例

### 3. 索引逻辑服务
- **文件**: `src/service/index/IndexingLogicService.ts`
- **用途**: 使用嵌入器配置确定向量维度

## 配置验证

嵌入器配置会在应用程序启动时验证提供商的可用性，确保API密钥和模型配置正确。

## 示例配置

```bash
# 使用OpenAI嵌入器
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=text-embedding-ada-002
OPENAI_DIMENSIONS=1536

# 使用Ollama嵌入器
EMBEDDING_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=nomic-embed-text
OLLAMA_DIMENSIONS=768

# 使用SiliconFlow嵌入器（默认）
EMBEDDING_PROVIDER=siliconflow
SILICONFLOW_API_KEY=your-siliconflow-api-key
SILICONFLOW_MODEL=BAAI/bge-m3
SILICONFLOW_DIMENSIONS=1024