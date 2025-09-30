// API Client Tests
// These tests validate the functionality of the ApiClient class

import { ApiClient } from '../services/api';

// Mock fetch globally
global.fetch = jest.fn();

describe('ApiClient', () => {
  let apiClient: ApiClient;
  const mockApiUrl = 'http://localhost:3010';
  
  beforeEach(() => {
    apiClient = new ApiClient(mockApiUrl);
    (fetch as jest.Mock).mockClear();
  });

  describe('Constructor', () => {
    it('should create an instance with default URL', () => {
      const client = new ApiClient();
      // We can't easily access private properties, but we can test behavior
      expect(client).toBeInstanceOf(ApiClient);
    });

    it('should create an instance with custom URL', () => {
      const customUrl = 'http://custom-url:3000';
      const client = new ApiClient(customUrl);
      expect(client).toBeInstanceOf(ApiClient);
    });
  });

  describe('getStatus', () => {
    it('should call the status endpoint and return data', async () => {
      const mockResponse = { status: 'ready', version: '1.0.0' };
      (fetch as jest.Mock).mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce(mockResponse)
      });

      const result = await apiClient.getStatus();

      expect(fetch).toHaveBeenCalledWith(`${mockApiUrl}/api/status`);
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors when fetching status', async () => {
      const errorMessage = 'Network error';
      (fetch as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

      await expect(apiClient.getStatus()).rejects.toThrow(errorMessage);
    });
  });

  describe('search', () => {
    const mockQuery = 'test query';
    const mockSearchResult = {
      success: true,
      data: {
        results: [{ id: '1', score: 0.95, content: 'test content' }],
        total: 1
      }
    };

    it('should call the search endpoint with correct parameters', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce(mockSearchResult)
      });

      const options = { maxResults: 20, minScore: 0.5, page: 1, pageSize: 10 };
      await apiClient.search(mockQuery, 'project1', options);

      expect(fetch).toHaveBeenCalledWith(`${mockApiUrl}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: mockQuery,
          options: {
            projectId: 'project1',
            maxResults: 20,
            minScore: 0.5,
            page: 1,
            pageSize: 10
          }
        })
      });
    });

    it('should return search results', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce(mockSearchResult)
      });

      const result = await apiClient.search(mockQuery);

      expect(result).toEqual(mockSearchResult);
    });

    it('should handle search errors', async () => {
      const errorMessage = 'Search failed';
      (fetch as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

      await expect(apiClient.search(mockQuery)).rejects.toThrow(errorMessage);
    });

    it('should use cache when available and valid', async () => {
      // Set up mock to return a result
      (fetch as jest.Mock).mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce(mockSearchResult)
      });

      // First call to populate cache
      await apiClient.search(mockQuery);
      
      // Clear mock to verify cache is used
      (fetch as jest.Mock).mockClear();

      // Second call should use cache
      const result = await apiClient.search(mockQuery);

      expect(fetch).not.toHaveBeenCalled();
      expect(result).toEqual(mockSearchResult);
    });

    it('should bypass cache when useCache is false', async () => {
      // Set up mock to return a result
      (fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue(mockSearchResult)
      });

      // First call to populate cache
      await apiClient.search(mockQuery);
      
      // Clear mock call history
      (fetch as jest.Mock).mockClear();

      // Second call with useCache: false should call fetch again
      await apiClient.search(mockQuery, undefined, { useCache: false });

      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('createProjectIndex', () => {
    it('should call the create project index endpoint with correct parameters', async () => {
      const mockProjectPath = '/path/to/project';
      const mockOptions = {
        embedder: 'openai',
        batchSize: 10,
        maxFiles: 100
      };
      const mockResponse = { success: true, jobId: 'job123' };
      
      (fetch as jest.Mock).mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce(mockResponse)
      });

      const result = await apiClient.createProjectIndex(mockProjectPath, mockOptions);

      expect(fetch).toHaveBeenCalledWith(`${mockApiUrl}/api/v1/indexing/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath: mockProjectPath,
          options: mockOptions
        })
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors when creating project index', async () => {
      const errorMessage = 'Failed to create index';
      (fetch as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

      await expect(
        apiClient.createProjectIndex('/path/to/project', {
          embedder: 'openai',
          batchSize: 10,
          maxFiles: 100
        })
      ).rejects.toThrow(errorMessage);
    });
  });

  describe('getProjects', () => {
    const mockProjects = [
      { id: '1', name: 'Project 1', path: '/path/1' },
      { id: '2', name: 'Project 2', path: '/path/2' }
    ];

    it('should call the projects endpoint and return data', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce({ success: true, data: mockProjects })
      });

      const result = await apiClient.getProjects();

      expect(fetch).toHaveBeenCalledWith(`${mockApiUrl}/api/v1/projects`);
      expect(result).toEqual({ success: true, data: mockProjects });
    });

    it('should use cache when available and valid', async () => {
      // Set up mock to return projects
      (fetch as jest.Mock).mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce({ success: true, data: mockProjects })
      });

      // First call to populate cache
      await apiClient.getProjects();
      
      // Clear mock to verify cache is used
      (fetch as jest.Mock).mockClear();

      // Second call should use cache
      const result = await apiClient.getProjects();

      expect(fetch).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true, data: mockProjects });
    });

    it('should bypass cache when forceRefresh is true', async () => {
      // Set up mock to return projects
      (fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({ success: true, data: mockProjects })
      });

      // First call to populate cache
      await apiClient.getProjects();
      
      // Clear mock call history
      (fetch as jest.Mock).mockClear();

      // Second call with forceRefresh: true should call fetch again
      await apiClient.getProjects(true);

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle errors when fetching projects', async () => {
      const errorMessage = 'Failed to fetch projects';
      (fetch as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

      await expect(apiClient.getProjects()).rejects.toThrow(errorMessage);
    });
  });

  describe('reindexProject', () => {
    it('should call the reindex endpoint with correct project ID', async () => {
      const mockProjectId = 'project123';
      const mockResponse = { success: true, jobId: 'job456' };
      
      (fetch as jest.Mock).mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce(mockResponse)
      });

      const result = await apiClient.reindexProject(mockProjectId);

      expect(fetch).toHaveBeenCalledWith(`${mockApiUrl}/api/v1/projects/${mockProjectId}/reindex`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors when reindexing project', async () => {
      const errorMessage = 'Failed to reindex project';
      (fetch as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

      await expect(apiClient.reindexProject('project123')).rejects.toThrow(errorMessage);
    });
  });

  describe('deleteProject', () => {
    it('should call the delete endpoint with correct project ID', async () => {
      const mockProjectId = 'project123';
      const mockResponse = { success: true };
      
      (fetch as jest.Mock).mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce(mockResponse)
      });

      const result = await apiClient.deleteProject(mockProjectId);

      expect(fetch).toHaveBeenCalledWith(`${mockApiUrl}/api/v1/projects/${mockProjectId}`, {
        method: 'DELETE'
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors when deleting project', async () => {
      const errorMessage = 'Failed to delete project';
      (fetch as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

      await expect(apiClient.deleteProject('project123')).rejects.toThrow(errorMessage);
    });
  });

  describe('getAvailableEmbedders', () => {
    const mockEmbedders = [
      { id: 'openai', name: 'OpenAI Embedder' },
      { id: 'ollama', name: 'Ollama Embedder' }
    ];

    it('should call the embedders endpoint and return data', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce({ success: true, data: mockEmbedders })
      });

      const result = await apiClient.getAvailableEmbedders();

      expect(fetch).toHaveBeenCalledWith(`${mockApiUrl}/api/v1/indexing/embedders`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      expect(result).toEqual({ success: true, data: mockEmbedders });
    });

    it('should use cache when available and valid', async () => {
      // Set up mock to return embedders
      (fetch as jest.Mock).mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce({ success: true, data: mockEmbedders })
      });

      // First call to populate cache
      await apiClient.getAvailableEmbedders();
      
      // Clear mock to verify cache is used
      (fetch as jest.Mock).mockClear();

      // Second call should use cache
      const result = await apiClient.getAvailableEmbedders();

      expect(fetch).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true, data: mockEmbedders });
    });

    it('should bypass cache when forceRefresh is true', async () => {
      // Set up mock to return embedders
      (fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({ success: true, data: mockEmbedders })
      });

      // First call to populate cache
      await apiClient.getAvailableEmbedders();
      
      // Clear mock call history
      (fetch as jest.Mock).mockClear();

      // Second call with forceRefresh: true should call fetch again
      await apiClient.getAvailableEmbedders(true);

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle errors when fetching embedders', async () => {
      const errorMessage = 'Failed to fetch embedders';
      (fetch as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

      await expect(apiClient.getAvailableEmbedders()).rejects.toThrow(errorMessage);
    });
  });

  describe('Cache Management', () => {
    const mockData = { success: true, data: [{ id: '1', name: 'Test' }] };

    beforeEach(() => {
      // Populate caches with mock data
      (apiClient as any).embeddersCache.data = mockData.data;
      (apiClient as any).embeddersCache.lastUpdated = Date.now();
      
      (apiClient as any).projectsCache.data = mockData.data;
      (apiClient as any).projectsCache.lastUpdated = Date.now();
      
      (apiClient as any).searchCache['test|key'] = {
        data: mockData,
        lastUpdated: Date.now()
      };
    });

    it('should clear embedders cache', () => {
      apiClient.clearEmbeddersCache();
      
      expect((apiClient as any).embeddersCache.data).toBeNull();
      expect((apiClient as any).embeddersCache.lastUpdated).toBeNull();
    });

    it('should clear search cache', () => {
      apiClient.clearSearchCache();
      
      expect((apiClient as any).searchCache).toEqual({});
    });

    it('should clear projects cache', () => {
      apiClient.clearProjectsCache();
      
      expect((apiClient as any).projectsCache.data).toBeNull();
      expect((apiClient as any).projectsCache.lastUpdated).toBeNull();
    });

    it('should clear all caches', () => {
      apiClient.clearAllCache();
      
      expect((apiClient as any).embeddersCache.data).toBeNull();
      expect((apiClient as any).embeddersCache.lastUpdated).toBeNull();
      expect((apiClient as any).searchCache).toEqual({});
      expect((apiClient as any).projectsCache.data).toBeNull();
      expect((apiClient as any).projectsCache.lastUpdated).toBeNull();
    });
  });
});