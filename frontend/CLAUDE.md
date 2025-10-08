# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the frontend for a codebase index and search system built with TypeScript and Vite. The application provides a web interface for searching, indexing, and analyzing code repositories using MCP (Model Context Protocol) services. It features graph-based code exploration and analysis capabilities.

## Key Technologies

- **Frontend**: Vanilla TypeScript with Vite for build tooling
- **Visualization**: Cytoscape.js for graph visualization
- **Testing**: Jest with jsdom environment
- **Styling**: Plain CSS (component-scoped)
- **Build**: TypeScript compilation + Vite bundling

## Development Commands

```bash
# Development server (runs on port 3011)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch
```

## Architecture Overview

### Core Application Structure
- **Entry Point**: `src/App.ts` - Main application class that manages lifecycle and page switching
- **Routing**: `src/router/router.ts` - Client-side routing with hash-based navigation
- **API Layer**: `src/services/api.ts` - Centralized API client with caching mechanisms

### Page-Based Architecture
The application uses a multi-page SPA structure with the following pages:
- **SearchPage** (`src/pages/SearchPage.ts`): Code search functionality with pagination and filtering
- **IndexProjectPage** (`src/pages/IndexProjectPage.ts`): Project indexing configuration and execution
- **ProjectsPage** (`src/pages/ProjectsPage.ts`): Management of indexed projects
- **GraphExplorerPage** (`src/pages/GraphExplorerPage.ts`): Interactive graph exploration
- **GraphAnalysisPage** (`src/pages/GraphAnalysisPage.ts`): Graph analysis and querying tools
- **GraphManagementPage** (`src/pages/GraphManagementPage.ts`): Graph space management operations

### Graph System
- **Types**: `src/types/graph.ts` - Comprehensive type definitions for nodes, edges, queries, and results
- **API**: `src/services/graphApi.ts` - Specialized API client for graph operations
- **Components**: Graph visualization components in `src/components/graph/`

### Utility Systems
- **EventManager**: `src/utils/EventManager.ts` - Centralized event management system
- **API Client**: Features intelligent caching for search results, projects, and embedders

## Configuration Files

- **Vite Config**: `vite.config.ts` - Development server on port 3011, sourcemaps enabled
- **TypeScript**: Strict mode enabled with path aliases (`@/*` maps to `src/*`)
- **Jest**: Configured for TypeScript with jsdom environment and coverage reporting

## API Integration

The frontend communicates with a backend service running on `localhost:3010` by default. The API client includes:
- Intelligent caching with TTL for different data types
- Fallback to cached data when API requests fail
- Pagination support for search results
- Project management operations

## Graph Features

The application provides comprehensive graph-based code analysis:
- **Node Types**: Files, functions, classes, imports, variables, modules
- **Edge Types**: Contains, imports, calls, extends, implements, references, modifies, uses
- **Query Types**: Related nodes, path finding, traversal, statistics, search, analysis
- **Visualization**: Interactive graph with Cytoscape.js

## Development Notes

- All TypeScript files use `.ts` extension (no JSX)
- CSS is component-scoped and organized in `src/styles/`
- The application uses hash-based routing for navigation
- Event-driven architecture with centralized event management
- Comprehensive error handling and fallback mechanisms
- Chinese UI with English code comments