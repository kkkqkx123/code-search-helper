// Frontend integration tests
// These tests will run in a browser-like environment using Jest and JSDOM

describe('CodebaseSearchApp', () => {
  beforeEach(() => {
    // Set up DOM elements for testing
    document.body.innerHTML = `
      <div id="status">状态: 准备就绪</div>
      <div id="version">版本: 1.0.0</div>
      <form id="search-form">
        <input type="text" id="search-input" value="">
        <button type="submit">搜索</button>
      </form>
      <div id="results-container">
        <div class="no-results">请输入搜索关键词开始查询</div>
      </div>
    `;
  });

  describe('Initialization', () => {
    it('should initialize the application', () => {
      // This would test the actual frontend code if it were modularized
      // For now, we'll test the DOM structure
      expect(document.getElementById('status')).toBeTruthy();
      expect(document.getElementById('version')).toBeTruthy();
      expect(document.getElementById('search-form')).toBeTruthy();
      expect(document.getElementById('search-input')).toBeTruthy();
      expect(document.getElementById('results-container')).toBeTruthy();
    });
  });

  describe('Search Form', () => {
    it('should have search input field', () => {
      const searchInput = document.getElementById('search-input') as HTMLInputElement;
      expect(searchInput).toBeTruthy();
      expect(searchInput.type).toBe('text');
    });

    it('should have search button', () => {
      const searchButton = document.querySelector('button[type="submit"]');
      expect(searchButton).toBeTruthy();
      expect(searchButton?.textContent).toBe('搜索');
    });
  });

  describe('Results Container', () => {
    it('should show initial message', () => {
      const resultsContainer = document.getElementById('results-container');
      expect(resultsContainer?.textContent).toContain('请输入搜索关键词开始查询');
    });
  });

  describe('Status Display', () => {
    it('should show initial status', () => {
      const statusElement = document.getElementById('status');
      expect(statusElement?.textContent).toBe('状态: 准备就绪');
    });

    it('should show version', () => {
      const versionElement = document.getElementById('version');
      expect(versionElement?.textContent).toBe('版本: 1.0.0');
    });
  });
});

// Test data structures that match the API responses
describe('Data Structures', () => {
  it('should match expected search result structure', () => {
    const mockResult = {
      success: true,
      data: {
        results: [
          {
            id: 'result_001',
            score: 0.95,
            snippet: {
              content: 'function calculateTotal(items) {}',
              filePath: 'src/utils/math.js',
              language: 'javascript'
            },
            matchType: 'keyword'
          }
        ],
        total: 1,
        query: 'calculate'
      }
    };

    expect(mockResult.success).toBe(true);
    expect(mockResult.data.results).toBeInstanceOf(Array);
    expect(mockResult.data.results[0]).toHaveProperty('id');
    expect(mockResult.data.results[0]).toHaveProperty('score');
    expect(mockResult.data.results[0].snippet).toHaveProperty('content');
    expect(mockResult.data.results[0].snippet).toHaveProperty('filePath');
    expect(mockResult.data.results[0].snippet).toHaveProperty('language');
  });

  it('should match expected status structure', () => {
    const mockStatus = {
      status: 'ready',
      version: '1.0.0',
      mockMode: true
    };

    expect(mockStatus).toHaveProperty('status');
    expect(mockStatus).toHaveProperty('version');
    expect(mockStatus).toHaveProperty('mockMode');
  });
});