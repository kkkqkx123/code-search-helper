# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a comprehensive codebase indexing and analysis system built with TypeScript, combining MCP (Model Context Protocol) services, REST APIs, and a web frontend. The system provides intelligent code search, semantic analysis, and graph-based code exploration capabilities using vector and graph databases.

## Core Technologies

- **Backend**: TypeScript, Express.js, Inversify (dependency injection)
- **MCP Protocol**: Model Context Protocol for AI assistant integration
- **Vector Database**: Qdrant for semantic search and embeddings
- **Graph Database**: Nebula Graph for code relationship analysis
- **Frontend**: Vanilla TypeScript + Vite (no frameworks)
- **AI Integration**: Multiple embedding providers (OpenAI, Ollama, Gemini, Mistral, SiliconFlow)
- **Code Analysis**: Tree-sitter parsing, LSP integration, Semgrep static analysis
- **Python Algorithm Service**: FastAPI microservice for advanced graph search and vector batch optimization algorithms

## Development Commands

### Backend Development

```bash
# Development with TypeScript compilation and hot reload
npm run dev

# Development with increased memory allocation
npm run dev:memory

# Production build
npm run build

# Start production server
npm run start

# Start production server with increased memory
npm run start:memory

# Type checking without compilation
npm run typecheck

# Linting and formatting
npm run lint
npm run lint:fix
npm run format
npm run format:check
```

### Testing

```bash
# Run all tests
npm run test

# Run specific test suites
npm run test:utils        # Utility functions tests
npm run test:api          # API layer tests
npm run test:mcp          # MCP protocol tests
npm run test:parser       # Code parser tests
npm run test:frontend     # Frontend tests (cd frontend && npm test)

# Performance testing
npm run test:performance
npm run test:performance:light
npm run test:performance:single

# Test with coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Run all comprehensive tests
npm run test:all
```

### Frontend Development

```bash
cd frontend

# Development server (port 3011)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm run test
npm run test:watch
```

### Python Algorithm Service Development

```bash
cd py-service

# Install Python dependencies
pip install -r requirements.txt

# Development server (port 8000)
uvicorn src.main:app --reload --port 8000

# Production with Docker Compose
docker-compose up -d

# Run Python tests
pytest tests/unit/
pytest tests/integration/
pytest tests/performance/

# Code formatting and linting
black src/
isort src/
mypy src/
flake8 src/
```

## Architecture Overview

### Backend Architecture

The system follows a modular, dependency-injected architecture using Inversify:

```
src/
├── main.ts                    # Application entry point with lifecycle management
├── core/
│   └── DIContainer.ts         # Dependency injection container setup
├── mcp/
│   └── MCPServer.ts           # MCP protocol server for AI assistant integration
├── api/
│   ├── ApiServer.ts           # REST API server (port 3010)
│   └── routes/                # API route handlers
├── database/
│   ├── common/                # Abstract database interfaces and utilities
│   ├── qdrant/                # Vector database operations and management
│   └── nebula/                # Graph database operations and management
├── embedders/                 # Multiple embedding provider implementations
├── service/
│   ├── parser/                # Tree-sitter code parsing with chunking strategies
│   ├── filesystem/            # File watching and change detection
│   ├── graph/                 # Graph analysis and query operations
│   ├── index/                 # Code indexing workflows
│   └── project/               # Project state management
├── config/                    # Configuration management system
└── utils/                     # Utilities (logging, error handling, path utils)

py-service/                    # Python Algorithm Microservice
├── src/
│   ├── main.py                # FastAPI application entry point
│   ├── api/routes/            # REST API endpoints
│   ├── core/                  # Core algorithm implementations
│   │   ├── fuzzy_match/       # Fuzzy matching algorithms
│   │   ├── graph_index/       # Graph indexing algorithms
│   │   ├── query_optimizer/   # Query optimization algorithms
│   │   └── batch_optimization/ # Vector batch optimization
│   ├── models/                # Pydantic data models
│   ├── services/              # Business logic services
│   ├── utils/                 # Utility functions
│   └── typescript-client/     # Generated TypeScript client
├── requirements.txt           # Python dependencies
├── docker-compose.yml         # Container orchestration
└── README.md                  # Python service documentation
```

### Key Backend Components

1. **Application Lifecycle**: Managed in `src/main.ts` with phases for initialization, service startup, and graceful shutdown

2. **Dependency Injection**: All services registered in `src/core/DIContainer.ts` with proper interface/implementation separation

3. **Database Services**:
   - `QdrantService`: Vector database for semantic search (collections, embeddings, similarity search)
   - `NebulaService`: Graph database for code relationships (nodes, edges, traversals)

4. **Python Algorithm Service** (`py-service/`):
   - **FastAPI Microservice**: High-performance algorithm service running on port 8000
   - **Fuzzy Matching**: Advanced string matching algorithms for code search with similarity scoring
   - **Graph Search Optimization**: Query optimization and graph indexing algorithms
   - **Vector Batch Processing**: Intelligent batch size optimization for vector operations
   - **TypeScript Client**: Auto-generated client for seamless integration with main TypeScript backend
   - **Docker Support**: Containerized deployment with health checks and monitoring

5. **Code Parsing Pipeline**:
   - Tree-sitter based parsing with multiple chunking strategies (function, class, module, hierarchical)
   - Support for multiple languages (JavaScript, TypeScript, Python, Go, Rust, Java, C++)

6. **Embedding System**: Factory pattern supporting multiple providers with caching and fallback mechanisms

### Frontend Architecture

The frontend uses a lightweight, component-based architecture without frameworks:

```
frontend/src/
├── App.ts                     # Main application class managing lifecycle and routing
├── router/
│   └── router.ts              # Client-side hash-based routing
├── pages/                     # Page components (SPA structure)
├── services/
│   ├── api.ts                 # API client with intelligent caching
│   └── graphApi.ts            # Specialized graph API client
├── components/
│   └── graph/                 # Graph visualization components (Cytoscape.js)
├── types/
│   └── graph.ts               # Comprehensive graph type definitions
└── utils/
    └── EventManager.ts        # Centralized event management
```

### Graph System

The system provides comprehensive graph-based code analysis:

- **Node Types**: Files, functions, classes, imports, variables, modules
- **Edge Types**: Contains, imports, calls, extends, implements, references, modifies, uses
- **Query Types**: Related nodes, path finding, traversal, statistics, search, analysis
- **Visualization**: Interactive graph with Cytoscape.js

## Database Configuration

### Vector Database (Qdrant)
- Collections per project with UUID-based naming
- Configurable vector dimensions and distance metrics
- Batch operations for performance optimization
- Project-based data isolation

### Graph Database (Nebula Graph)
- Space per project for data isolation
- Automatic schema management for nodes and edges
- Connection monitoring and automatic reconnection
- Docker-based deployment (no manual configuration required)

### Database Console Access
```bash
# Connect to Nebula Graph
nebula-console -u root -p nebula --address=127.0.0.1 --port=9669 -e "SHOW SPACES;"
```

## Project Management System

The system uses a sophisticated project management approach:

- **Project ID Generation**: SHA-256 hashing of project paths for consistent identification
- **Data Mapping**: JSON-based mapping in `data/` directory for project-collection-space relationships
- **State Management**: Tracking of project indexing status, update times, and metadata
- **Multi-Database Coordination**: Synchronized operations across vector and graph databases

## Python Algorithm Service

The Python microservice provides advanced algorithmic capabilities for graph search and vector operations:

### Core Services

1. **Fuzzy Match Service** (`py-service/src/core/fuzzy_match/`):
   - Advanced string matching algorithms for code search
   - Levenshtein distance, Jaro-Winkler, and custom similarity metrics
   - Configurable thresholds and result ranking

2. **Graph Index Service** (`py-service/src/core/graph_index/`):
   - Hierarchical graph indexing for faster traversals
   - Compressed graph representations for memory efficiency
   - Incremental index updates for dynamic graphs

3. **Query Optimizer Service** (`py-service/src/core/query_optimizer/`):
   - Query plan optimization for graph traversals
   - Cost-based optimization using statistics
   - Parallel query execution strategies

4. **Batch Optimization Service** (`py-service/src/core/batch_optimization/`):
   - Intelligent batch size calculation for vector operations
   - Memory-aware processing based on system resources
   - Performance optimization for large-scale embeddings

### API Endpoints

```bash
# Fuzzy matching search
POST /api/v1/fuzzy-match/search
{
  "query": "functionName",
  "threshold": 0.8,
  "maxResults": 10
}

# Graph search with optimization
POST /api/v1/graph-search/query
{
  "query": "MATCH (n)-[r]->(m) WHERE n.type = 'function' RETURN n, r, m",
  "optimizationLevel": "high"
}

# Vector batch optimization
POST /api/v1/batch-optimization/calculate-size
{
  "item_count": 1000,
  "vector_dimension": 1536,
  "database_type": "qdrant"
}

# Health check
GET /health
```

### TypeScript Integration

The service includes a generated TypeScript client (`py-service/src/typescript-client/GraphSearchPythonClient.ts`) for seamless integration:

```typescript
import { GraphSearchPythonClient } from './py-service/src/typescript-client/GraphSearchPythonClient';

// Usage in services
const pythonClient = new GraphSearchPythonClient();
const searchResults = await pythonClient.fuzzySearch({
  query: "functionName",
  threshold: 0.8
});
```

### Dependencies and Requirements

- **Python 3.11+**: Required for modern type annotations and performance
- **FastAPI**: High-performance async web framework
- **NetworkX**: Graph algorithms and network analysis
- **scikit-learn**: Machine learning algorithms for similarity matching
- **NumPy/Pandas**: Data processing and numerical operations
- **Torch/Transformers**: Optional ML models for advanced embeddings
- **Redis**: Optional caching layer for performance

### Monitoring and Metrics

- **Prometheus Integration**: Performance metrics at `http://localhost:8000/metrics`
- **Health Checks**: Comprehensive service health monitoring
- **Performance Tracking**: Query execution time and algorithm performance
- **Resource Monitoring**: Memory and CPU usage tracking

## Configuration System

The configuration system uses a factory pattern with service-specific config managers:
- `EmbeddingConfigService`: AI provider configuration and validation
- `QdrantConfigService`: Vector database settings
- `NebulaConfigService`: Graph database settings
- `LSPConfigService`: Language server protocol settings
- `TreeSitterConfigService`: Parser configurations

## Development Notes

### Code Organization Principles
- **Single Responsibility**: Each module has a clear, focused purpose
- **Dependency Injection**: Loose coupling with interface-based design
- **Error Handling**: Comprehensive error handling with dedicated error services
- **Logging**: Structured logging with multiple levels and file-based output
- **Event Management**: Event-driven architecture for loose coupling

### Testing Strategy
- **Unit Tests**: Comprehensive Jest-based testing for all modules
- **Integration Tests**: Cross-module functionality testing
- **Performance Tests**: Memory usage and execution time monitoring
- **Mocking**: Proper mocking for external dependencies (databases, APIs)

### Memory Management
- **Development**: Use `npm run dev:memory` for increased heap size
- **Production**: Use `npm run start:memory` for production with memory optimization
- **Performance Testing**: Dedicated scripts with garbage collection monitoring

### API Integration
- **Backend API**: `http://localhost:3010` (REST endpoints)
- **Python Algorithm Service**: `http://localhost:8000` (FastAPI algorithms service)
- **Frontend Dev**: `http://localhost:3011` (Vite dev server)
- **MCP Protocol**: Stdio-based communication with AI assistants
- **Caching**: Intelligent caching in frontend API client with TTL
- **Python Service**: Auto-generated TypeScript client for seamless integration

### File Watching and Indexing
- **Change Detection**: Automatic file system monitoring with Chokidar
- **Incremental Updates**: Smart re-indexing of changed files only
- **Project State**: Persistent tracking of indexed content and metadata

## Environment Requirements

- **Node.js**: 18.0+ (required for TypeScript and modern features)
- **Python**: 3.10+ (required for Python Algorithm Service)
- **Databases**: Qdrant and Nebula Graph running in Docker
- **Memory**: Minimum 2GB RAM for development, 4GB for production workloads
- **Development**: Modern IDE with TypeScript and ESLint support
- **Python Tools**: pip, pytest, black, mypy for Python development

## Common Development Workflows

1. **Adding New Embedding Provider**: Implement `BaseEmbedder` interface, register in `EmbedderFactory`, update configuration schema

2. **Adding New Language Support**: Add Tree-sitter parser configuration, implement chunking strategies, update language configurations

3. **Extending Graph Schema**: Define new node/edge types in `NebulaTypes.ts`, update space creation logic

4. **Adding New API Endpoints**: Create route handlers, register in `ApiServer`, add corresponding frontend API methods

5. **Database Migration**: Use versioned schema updates with backward compatibility checks

## Performance Considerations

- **Batch Operations**: Always use batch inserts/updates for database operations
- **Connection Pooling**: Database connections managed with pooling and monitoring
- **Caching**: Multi-level caching for embeddings, search results, and API responses
- **Memory Monitoring**: Built-in performance monitoring for heap usage and GC events