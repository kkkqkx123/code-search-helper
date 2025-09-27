# Codebase Index API Documentation

## Overview

The Codebase Index API provides RESTful endpoints for indexing, searching, and analyzing code snippets within codebases. This API allows developers to integrate codebase indexing capabilities into their applications.

## Base URL

```
http://localhost:3000/api/v1
```

## Authentication

Currently, the API does not require authentication. In production environments, API keys or OAuth tokens may be required.

## Error Handling

All API responses follow a consistent format:

```json
{
  "success": true|false,
  "data": {...}|null,
  "error": "Error message if success is false"
}
```

## Rate Limiting

The API implements rate limiting to prevent abuse. Current limits are:
- 1000 requests per hour per IP address

## API Endpoints

### Snippets

#### Search Snippets

```
GET /snippets/search
```

Search for code snippets across indexed codebases.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| query | string | Yes | Search query |
| projectId | string | No | Project ID to search within |
| limit | integer | No | Maximum number of results (default: 10) |
| offset | integer | No | Offset for pagination (default: 0) |
| sortBy | string | No | Field to sort by |
| sortOrder | string | No | Sort order (asc or desc) |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "snippet_1",
      "content": "function example() { ... }",
      "filePath": "/path/to/file.js",
      "startLine": 10,
      "endLine": 20,
      "language": "javascript",
      "score": 0.95,
      "metadata": {
        "projectId": "project_123",
        "createdAt": "2023-01-01T00:00Z"
      }
    }
  ]
}
```

#### Get Snippet by ID

```
GET /snippets/{snippetId}
```

Retrieve a specific snippet by its ID.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| snippetId | string | Yes | Snippet ID |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "snippet_1",
    "content": "function example() { ... }",
    "filePath": "/path/to/file.js",
    "startLine": 10,
    "endLine": 20,
    "language": "javascript",
    "metadata": {
      "projectId": "project_123",
      "createdAt": "2023-01-01T00:00:00Z",
      "updatedAt": "2023-01-01T00:00:00Z"
    }
  }
}
```

#### Get Snippet Processing Status

```
GET /snippets/status/{projectId}
```

Get the processing status for snippets in a project.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |

**Response:**

```json
{
  "success": true,
  "data": {
    "totalSnippets": 150,
    "processedSnippets": 142,
    "duplicateSnippets": 8,
    "processingRate": 45.2
  }
}
```

#### Check for Duplicate Snippets

```
POST /snippets/check-duplicates
```

Check if a snippet already exists in the codebase.

**Request Body:**

```json
{
  "content": "function example() { ... }",
  "projectId": "project_123"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "isDuplicate": true,
    "contentHash": "abc123..."
  }
}
```

#### Detect Cross-References

```
GET /snippets/{snippetId}/references/{projectId}
```

Find cross-references to a specific snippet.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| snippetId | string | Yes | Snippet ID |
| projectId | string | Yes | Project ID |

**Response:**

```json
{
  "success": true,
  "data": [
    "ref_snippet_1_1",
    "ref_snippet_1_2"
  ]
}
```

#### Analyze Dependencies

```
GET /snippets/{snippetId}/dependencies/{projectId}
```

Analyze dependencies for a specific snippet.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| snippetId | string | Yes | Snippet ID |
| projectId | string | Yes | Project ID |

**Response:**

```json
{
  "success": true,
  "data": {
    "dependsOn": [
      "dep_snippet_1_1",
      "dep_snippet_1_2"
    ],
    "usedBy": [
      "user_snippet_1_1"
    ],
    "complexity": 5
  }
}
```

#### Detect Overlaps

```
GET /snippets/{snippetId}/overlaps/{projectId}
```

Detect overlapping snippets.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| snippetId | string | Yes | Snippet ID |
| projectId | string | Yes | Project ID |

**Response:**

```json
{
  "success": true,
  "data": [
    "overlap_snippet_1_1"
  ]
}
```

### Monitoring

#### Health Check

```
GET /monitoring/health
```

Get system health status.

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2023-01-01T00:00:00Z",
    "components": {
      "database": "healthy",
      "indexing": "healthy",
      "search": "healthy"
    }
  }
}
```

#### Metrics

```
GET /monitoring/metrics
```

Get system metrics.

**Response:**

```json
{
  "success": true,
  "data": {
    "cpuUsage": 45.2,
    "memoryUsage": 1024,
    "diskUsage": 5120,
    "activeConnections": 10,
    "uptime": 3600
 }
}
```

#### Performance Report

```
GET /monitoring/performance
```

Get performance report.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| start | string | No | Start date (ISO format) |
| end | string | No | End date (ISO format) |

**Response:**

```json
{
  "success": true,
  "data": {
    "averageResponseTime": 150,
    "peakResponseTime": 300,
    "requestsPerSecond": 50,
    "errorRate": 0.01
 }
}
```

## Example Usage

### Search for Snippets

```bash
curl "http://localhost:3000/api/v1/snippets/search?query=example&projectId=project_123"
```

### Get Snippet by ID

```bash
curl "http://localhost:3000/api/v1/snippets/snippet_1?projectId=project_123"
```

### Check for Duplicates

```bash
curl -X POST "http://localhost:3000/api/v1/snippets/check-duplicates" \
  -H "Content-Type: application/json" \
  -d '{"content":"function example() { ... }","projectId":"project_123"}'
```

## SDKs

Currently, no official SDKs are available. However, you can use any HTTP client library to interact with the API.

## Support

For support, please open an issue on our GitHub repository or contact our support team.