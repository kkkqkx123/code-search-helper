import { ProjectStateListenerManager } from '../listeners/ProjectStateListenerManager';
import { LoggerService } from '../../../utils/LoggerService';
import { IndexService } from '../../index/IndexService';
import { ProjectState, StorageStatus } from '../ProjectStateManager';

// Mock dependencies
jest.mock('../../../utils/LoggerService');
jest.mock('../../index/IndexService');

describe('ProjectStateListenerManager', () => {
  let listenerManager: ProjectStateListenerManager;
  let loggerService: jest.Mocked<LoggerService>;
  let indexService: jest.Mocked<IndexService>;
  let projectStates: Map<string, ProjectState>;
  let updateProjectStatus: jest.Mock;
  let updateProjectIndexingProgress: jest.Mock;
  let updateProjectLastIndexed: jest.Mock;
  let updateProjectMetadata: jest.Mock;
  let updateVectorStatus: jest.Mock;
  let updateGraphStatus: jest.Mock;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    loggerService = new LoggerService() as jest.Mocked<LoggerService>;
    indexService = {
      on: jest.fn(),
      emit: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      once: jest.fn(),
      off: jest.fn(),
      eventNames: jest.fn(),
      listenerCount: jest.fn(),
      listeners: jest.fn(),
      prependListener: jest.fn(),
      prependOnceListener: jest.fn(),
      rawListeners: jest.fn(),
      removeAllListeners: jest.fn(),
      setMaxListeners: jest.fn(),
      getMaxListeners: jest.fn(),
      getIndexStatus: jest.fn(),
    } as any as jest.Mocked<IndexService>;

    // Create mock functions
    updateProjectStatus = jest.fn().mockResolvedValue(undefined);
    updateProjectIndexingProgress = jest.fn().mockResolvedValue(undefined);
    updateProjectLastIndexed = jest.fn().mockResolvedValue(undefined);
    updateProjectMetadata = jest.fn().mockResolvedValue(undefined);
    updateVectorStatus = jest.fn().mockResolvedValue(undefined);
    updateGraphStatus = jest.fn().mockResolvedValue(undefined);

    // Create project states map
    projectStates = new Map<string, ProjectState>();

    // Create listener manager instance
    listenerManager = new ProjectStateListenerManager(
      loggerService,
      indexService,
      projectStates,
      updateProjectStatus,
      updateProjectIndexingProgress,
      updateProjectLastIndexed,
      updateProjectMetadata,
      updateVectorStatus,
      updateGraphStatus
    );
  });

  // Helper function to create a mock project state
  const createMockProjectState = (overrides: Partial<ProjectState> = {}): ProjectState => {
    return {
      projectId: overrides.projectId || 'test-project-id',
      projectPath: overrides.projectPath || '/test/project',
      name: overrides.name || 'Test Project',
      description: overrides.description || 'A test project',
      status: overrides.status || 'inactive',
      vectorStatus: overrides.vectorStatus || {
        status: 'pending',
        progress: 0,
        lastUpdated: new Date()
      },
      graphStatus: overrides.graphStatus || {
        status: 'pending',
        progress: 0,
        lastUpdated: new Date()
      },
      createdAt: overrides.createdAt || new Date(),
      updatedAt: overrides.updatedAt || new Date(),
      hotReload: overrides.hotReload || {
        enabled: false,
        config: {
          debounceInterval: 500,
          watchPatterns: ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'],
          ignorePatterns: ['node_modules/**', 'dist/**', 'build/**']
        }
      },
      settings: {
        autoIndex: overrides.settings?.autoIndex ?? true,
        watchChanges: overrides.settings?.watchChanges ?? true,
        ...overrides.settings
      },
      metadata: overrides.metadata || {}
    };
  };

  describe('setupIndexSyncListeners', () => {
    it('should set up event listeners for indexing events', () => {
      // Call the method
      listenerManager.setupIndexSyncListeners();

      // Verify that indexService.on was called for each event
      expect(indexService.on).toHaveBeenCalledWith('indexingStarted', expect.any(Function));
      expect(indexService.on).toHaveBeenCalledWith('indexingProgress', expect.any(Function));
      expect(indexService.on).toHaveBeenCalledWith('indexingCompleted', expect.any(Function));
      expect(indexService.on).toHaveBeenCalledWith('indexingError', expect.any(Function));
    });

    it('should handle missing on method gracefully', () => {
      // Mock indexService without on method
      const indexServiceWithoutOn = {
        ...indexService,
        on: undefined
      } as any;

      // Create listener manager with indexService without on method
      const listenerManagerWithoutOn = new ProjectStateListenerManager(
        loggerService,
        indexServiceWithoutOn,
        projectStates,
        updateProjectStatus,
        updateProjectIndexingProgress,
        updateProjectLastIndexed,
        updateProjectMetadata,
        updateVectorStatus,
        updateGraphStatus
      );

      // Call the method - should not throw
      expect(() => listenerManagerWithoutOn.setupIndexSyncListeners()).not.toThrow();
    });
  });

  describe('handleIndexingStarted', () => {
    beforeEach(() => {
      // Set up event listeners
      listenerManager.setupIndexSyncListeners();
    });

    it('should update project status to indexing when indexing starts', async () => {
      const projectId = 'test-project-id';

      // Call the event handler
      await (indexService.on as jest.Mock).mock.calls.find(call => call[0] === 'indexingStarted')![1](projectId);

      // Verify that update functions were called
      expect(updateProjectStatus).toHaveBeenCalledWith(projectId, 'indexing');
      expect(updateVectorStatus).toHaveBeenCalledWith(projectId, {
        status: 'indexing',
        progress: 0
      });
      expect(updateGraphStatus).toHaveBeenCalledWith(projectId, {
        status: 'indexing',
        progress: 0
      });
    });

    it('should log error when updating project status fails', async () => {
      const projectId = 'test-project-id';
      const error = new Error('Update failed');

      // Mock updateProjectStatus to throw
      updateProjectStatus.mockRejectedValue(error);

      // Call the event handler
      await (indexService.on as jest.Mock).mock.calls.find(call => call[0] === 'indexingStarted')![1](projectId);

      // Verify error was logged
      expect(loggerService.error).toHaveBeenCalledWith(
        'Failed to update project status to indexing',
        { projectId, error }
      );
    });
  });

  describe('handleIndexingProgress', () => {
    beforeEach(() => {
      // Set up event listeners
      listenerManager.setupIndexSyncListeners();
    });

    it('should update project indexing progress', async () => {
      const projectId = 'test-project-id';
      const progress = 50;

      // Add a project state to the map
      projectStates.set(projectId, createMockProjectState({
        projectId,
        vectorStatus: { status: 'indexing', progress: 0, lastUpdated: new Date() },
        graphStatus: { status: 'pending', progress: 0, lastUpdated: new Date() }
      }));

      // Call the event handler
      await (indexService.on as jest.Mock).mock.calls.find(call => call[0] === 'indexingProgress')![1](projectId, progress);

      // Verify that update functions were called
      expect(updateProjectIndexingProgress).toHaveBeenCalledWith(projectId, progress);
      expect(updateVectorStatus).toHaveBeenCalledWith(projectId, {
        status: 'indexing',
        progress: progress
      });
      expect(updateGraphStatus).not.toHaveBeenCalled();
    });

    it('should update both vector and graph status when both are indexing', async () => {
      const projectId = 'test-project-id';
      const progress = 50;

      // Add a project state to the map with both vector and graph indexing
      projectStates.set(projectId, createMockProjectState({
        projectId,
        vectorStatus: { status: 'indexing', progress: 0, lastUpdated: new Date() },
        graphStatus: { status: 'indexing', progress: 0, lastUpdated: new Date() }
      }));

      // Call the event handler
      await (indexService.on as jest.Mock).mock.calls.find(call => call[0] === 'indexingProgress')![1](projectId, progress);

      // Verify that update functions were called
      expect(updateProjectIndexingProgress).toHaveBeenCalledWith(projectId, progress);
      expect(updateVectorStatus).toHaveBeenCalledWith(projectId, {
        status: 'indexing',
        progress: progress
      });
      expect(updateGraphStatus).toHaveBeenCalledWith(projectId, {
        status: 'indexing',
        progress: progress
      });
    });

    it('should log warning when project state not found', async () => {
      const projectId = 'non-existent-project-id';
      const progress = 50;

      // Call the event handler
      await (indexService.on as jest.Mock).mock.calls.find(call => call[0] === 'indexingProgress')![1](projectId, progress);

      // Verify warning was logged
      expect(loggerService.warn).toHaveBeenCalledWith(
        `Project state not found for indexing progress: ${projectId}`
      );
    });

    it('should log error when updating progress fails', async () => {
      const projectId = 'test-project-id';
      const progress = 50;
      const error = new Error('Update failed');

      // Add a project state to the map
      projectStates.set(projectId, createMockProjectState({
        projectId,
        vectorStatus: { status: 'indexing', progress: 0, lastUpdated: new Date() },
        graphStatus: { status: 'pending', progress: 0, lastUpdated: new Date() }
      }));

      // Mock updateProjectIndexingProgress to throw
      updateProjectIndexingProgress.mockRejectedValue(error);

      // Call the event handler
      await (indexService.on as jest.Mock).mock.calls.find(call => call[0] === 'indexingProgress')![1](projectId, progress);

      // Verify error was logged
      expect(loggerService.error).toHaveBeenCalledWith(
        'Failed to update project indexing progress',
        { projectId, progress, error }
      );
    });
  });

  describe('handleIndexingCompleted', () => {
    beforeEach(() => {
      // Set up event listeners
      listenerManager.setupIndexSyncListeners();
    });

    it('should update project status to active when indexing completes', async () => {
      const projectId = 'test-project-id';

      // Call the event handler
      await (indexService.on as jest.Mock).mock.calls.find(call => call[0] === 'indexingCompleted')![1](projectId);

      // Verify that update functions were called
      expect(updateProjectStatus).toHaveBeenCalledWith(projectId, 'active');
      expect(updateProjectLastIndexed).toHaveBeenCalledWith(projectId);
      expect(updateVectorStatus).toHaveBeenCalledWith(projectId, {
        status: 'completed',
        progress: 100
      });
      expect(updateGraphStatus).toHaveBeenCalledWith(projectId, {
        status: 'completed',
        progress: 100
      });
    });

    it('should log error when updating project status fails', async () => {
      const projectId = 'test-project-id';
      const error = new Error('Update failed');

      // Mock updateProjectStatus to throw
      updateProjectStatus.mockRejectedValue(error);

      // Call the event handler
      await (indexService.on as jest.Mock).mock.calls.find(call => call[0] === 'indexingCompleted')![1](projectId);

      // Verify error was logged
      expect(loggerService.error).toHaveBeenCalledWith(
        'Failed to update project status to active',
        { projectId, error }
      );

      // Verify that updateProjectLastIndexed was still called
      expect(updateProjectLastIndexed).toHaveBeenCalledWith(projectId);
    });

    it('should log error when updating last indexed time fails', async () => {
      const projectId = 'test-project-id';
      const error = new Error('Update failed');

      // Mock updateProjectLastIndexed to throw
      updateProjectLastIndexed.mockRejectedValue(error);

      // Call the event handler
      await (indexService.on as jest.Mock).mock.calls.find(call => call[0] === 'indexingCompleted')![1](projectId);

      // Verify error was logged
      expect(loggerService.error).toHaveBeenCalledWith(
        'Failed to update project last indexed time',
        { projectId, error: error }
      );
    });
  });

  describe('handleIndexingError', () => {
    beforeEach(() => {
      // Set up event listeners
      listenerManager.setupIndexSyncListeners();
    });

    it('should update project status to error when indexing fails', async () => {
      const projectId = 'test-project-id';
      const error = new Error('Indexing failed');

      // Call the event handler
      await (indexService.on as jest.Mock).mock.calls.find(call => call[0] === 'indexingError')![1](projectId, error);

      // Verify that update functions were called
      expect(updateProjectStatus).toHaveBeenCalledWith(projectId, 'error');
      expect(updateProjectMetadata).toHaveBeenCalledWith(projectId, { lastError: error.message });
      expect(updateVectorStatus).toHaveBeenCalledWith(projectId, {
        status: 'error',
        progress: 0
      });
      expect(updateGraphStatus).toHaveBeenCalledWith(projectId, {
        status: 'error',
        progress: 0
      });
    });

    it('should log error when updating project status fails', async () => {
      const projectId = 'test-project-id';
      const error = new Error('Indexing failed');
      const updateError = new Error('Update failed');

      // Mock updateProjectStatus to throw
      updateProjectStatus.mockRejectedValue(updateError);

      // Call the event handler
      await (indexService.on as jest.Mock).mock.calls.find(call => call[0] === 'indexingError')![1](projectId, error);

      // Verify error was logged
      expect(loggerService.error).toHaveBeenCalledWith(
        'Failed to update project status to error',
        { projectId, error: updateError }
      );

      // Verify that updateProjectMetadata was still called
      expect(updateProjectMetadata).toHaveBeenCalledWith(projectId, { lastError: error.message });
    });

    it('should log error when updating metadata fails', async () => {
      const projectId = 'test-project-id';
      const error = new Error('Indexing failed');
      const metadataError = new Error('Metadata update failed');

      // Mock updateProjectStatus and updateProjectMetadata to throw
      updateProjectStatus.mockRejectedValue(new Error('Status update failed'));
      updateProjectMetadata.mockRejectedValue(metadataError);

      // Call the event handler
      await (indexService.on as jest.Mock).mock.calls.find(call => call[0] === 'indexingError')![1](projectId, error);

      // Verify error was logged
      expect(loggerService.error).toHaveBeenCalledWith(
        'Failed to update project metadata',
        { projectId, error: metadataError }
      );
    });
  });

  describe('updateProjectStatesReference', () => {
    it('should update the project states reference', () => {
      const newProjectStates = new Map<string, ProjectState>();

      // Call the method
      listenerManager.updateProjectStatesReference(newProjectStates);

      // Verify that the reference was updated
      // This is a private property, so we can't directly test it
      // But we can verify that the method doesn't throw
      expect(() => listenerManager.updateProjectStatesReference(newProjectStates)).not.toThrow();
    });
  });
});