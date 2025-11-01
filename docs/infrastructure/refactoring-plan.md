# Infrastructure to Service Layer Refactoring Plan

## Overview

This document outlines the plan to refactor infrastructure layer files that contain business logic and move them to the appropriate service layers. The goal is to maintain clean architectural separation where infrastructure provides generic technical components while services handle specific business logic.

## Current Issues

The infrastructure layer currently contains files with business logic that should be in service layers:

1. Database-specific operations in implementation classes
2. Business-specific monitoring and performance tracking
3. Database-specific error handling
4. Business-specific batching and optimization logic

## Refactoring Plan

### Phase 1: Move Database Implementation Classes

**Files to Move:**
- `src/infrastructure/implementations/NebulaInfrastructure.ts` → `src/database/nebula/NebulaDatabaseService.ts`
- `src/infrastructure/implementations/QdrantInfrastructure.ts` → `src/database/qdrant/QdrantDatabaseService.ts`
- `src/infrastructure/implementations/SqliteInfrastructure.ts` → `src/database/splite/SqliteDatabaseService.ts`

**Tasks:**
1. Rename classes to match new location (e.g., `NebulaInfrastructure` → `NebulaDatabaseService`)
2. Update imports and dependencies
3. Update inversify binding types
4. Update any references in the codebase

### Phase 2: Move Specialized Monitoring Classes

**Files to Move:**
- `src/infrastructure/monitoring/PerformanceMonitor.ts` → `src/service/monitoring/DatabasePerformanceMonitor.ts`
- `src/infrastructure/monitoring/VectorPerformanceMonitor.ts` → `src/service/monitoring/VectorPerformanceMonitor.ts`

**Tasks:**
1. Update class names and functionality to reflect service layer purpose
2. Update imports and dependencies
3. Update inversify binding types
4. Update any references in the codebase

### Phase 3: Move Error Handling Classes

**Files to Move:**
- `src/infrastructure/error/InfrastructureErrorHandler.ts` → `src/service/error/DatabaseErrorHandler.ts`

**Tasks:**
1. Rename and update class to reflect service layer purpose
2. Update imports and dependencies
3. Update inversify binding types
4. Update any references in the codebase

### Phase 4: Move Batch Optimization Classes

**Files to Move:**
- `src/infrastructure/batching/BatchOptimizer.ts` → `src/service/optimization/BatchOptimizerService.ts`

**Tasks:**
1. Rename and update class to reflect service layer purpose
2. Update imports and dependencies
3. Update inversify binding types
4. Update any references in the codebase

## Implementation Steps

### Step 1: Prepare Infrastructure Layer Cleanup

1. Create backup of current state
2. Update inversify container bindings
3. Update type definitions if necessary

### Step 2: Execute File Moves and Updates

For each file:
1. Create new file in target location
2. Update class names and imports
3. Update dependencies
4. Test compilation and fix any issues
5. Update all references in the codebase

### Step 3: Update Infrastructure Layer

1. Remove moved files from infrastructure
2. Clean up any remaining dependencies
3. Ensure infrastructure layer only contains generic components

### Step 4: Testing

1. Run unit tests to ensure no functionality is broken
2. Run integration tests to verify system behavior
3. Update tests as necessary

## Type Updates Required

The following inversify types will need to be updated:

- `TYPES.NebulaInfrastructure` → `TYPES.NebulaDatabaseService`
- `TYPES.QdrantInfrastructure` → `TYPES.QdrantDatabaseService`
- `TYPES.SqliteInfrastructure` → `TYPES.SqliteDatabaseService`
- `TYPES.PerformanceMonitor` → Update to use service version where appropriate
- And other corresponding type updates

## Risk Mitigation

1. Maintain backward compatibility during transition
2. Use feature flags if necessary
3. Thorough testing at each phase
4. Revert plan ready if critical issues arise

## Timeline

- Phase 1: 1 day
- Phase 2: 1 day
- Phase 3: 0.5 day
- Phase 4: 0.5 day
- Testing and validation: 1 day

Total estimated time: 4 days