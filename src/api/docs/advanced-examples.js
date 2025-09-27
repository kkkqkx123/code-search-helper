// Advanced examples of using the Codebase Index API

// Base URL for the API
const BASE_URL = 'http://localhost:3000/api/v1';

// Function to search for snippets
async function searchSnippets(query, projectId, options = {}) {
  const params = new URLSearchParams({
    query,
    projectId,
    ...options,
  });

  try {
    const response = await fetch(`${BASE_URL}/snippets/search?${params}`);
    const result = await response.json();

    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error searching snippets:', error);
    throw error;
  }
}

// Function to get a snippet by ID
async function getSnippetById(snippetId, projectId) {
  try {
    const response = await fetch(`${BASE_URL}/snippets/${snippetId}?projectId=${projectId}`);
    const result = await response.json();

    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error getting snippet:', error);
    throw error;
  }
}

// Function to check for duplicate snippets
async function checkForDuplicates(content, projectId) {
  try {
    const response = await fetch(`${BASE_URL}/snippets/check-duplicates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content, projectId }),
    });

    const result = await response.json();

    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error checking duplicates:', error);
    throw error;
  }
}

// Function to get snippet processing status
async function getSnippetProcessingStatus(projectId) {
  try {
    const response = await fetch(`${BASE_URL}/snippets/status/${projectId}`);
    const result = await response.json();

    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error getting processing status:', error);
    throw error;
  }
}

// Function to detect cross-references
async function detectCrossReferences(snippetId, projectId) {
  try {
    const response = await fetch(`${BASE_URL}/snippets/${snippetId}/references/${projectId}`);
    const result = await response.json();

    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error detecting cross-references:', error);
    throw error;
  }
}

// Function to analyze dependencies
async function analyzeDependencies(snippetId, projectId) {
  try {
    const response = await fetch(`${BASE_URL}/snippets/${snippetId}/dependencies/${projectId}`);
    const result = await response.json();

    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error analyzing dependencies:', error);
    throw error;
  }
}

// Function to detect overlaps
async function detectOverlaps(snippetId, projectId) {
  try {
    const response = await fetch(`${BASE_URL}/snippets/${snippetId}/overlaps/${projectId}`);
    const result = await response.json();

    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error detecting overlaps:', error);
    throw error;
  }
}

// Function to get system health status
async function getSystemHealth() {
  try {
    const response = await fetch(`${BASE_URL}/monitoring/health`);
    const result = await response.json();

    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error getting system health:', error);
    throw error;
  }
}

// Function to get system metrics
async function getSystemMetrics() {
  try {
    const response = await fetch(`${BASE_URL}/monitoring/metrics`);
    const result = await response.json();

    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error getting system metrics:', error);
    throw error;
  }
}

// Function to get performance report
async function getPerformanceReport(options = {}) {
  const params = new URLSearchParams(options);

  try {
    const response = await fetch(`${BASE_URL}/monitoring/performance?${params}`);
    const result = await response.json();

    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error getting performance report:', error);
    throw error;
  }
}

// Advanced example: Find related snippets
async function findRelatedSnippets(snippetId, projectId) {
  try {
    // First get the snippet
    const snippet = await getSnippetById(snippetId, projectId);

    // Then find references to this snippet
    const references = await detectCrossReferences(snippetId, projectId);

    // Also analyze dependencies
    const dependencies = await analyzeDependencies(snippetId, projectId);

    // Get overlapping snippets
    const overlaps = await detectOverlaps(snippetId, projectId);

    return {
      snippet,
      references,
      dependencies,
      overlaps,
    };
  } catch (error) {
    console.error('Error finding related snippets:', error);
    throw error;
  }
}

// Advanced example: Code deduplication analysis
async function analyzeCodeDeduplication(projectId) {
  try {
    // Get processing status
    const status = await getSnippetProcessingStatus(projectId);

    // Search for common patterns
    const commonPatterns = await searchSnippets('function', projectId, { limit: 100 });

    // Check for duplicates among common patterns
    const duplicates = [];
    for (const pattern of commonPatterns) {
      const duplicateCheck = await checkForDuplicates(pattern.content, projectId);
      if (duplicateCheck.isDuplicate) {
        duplicates.push({
          snippet: pattern,
          hash: duplicateCheck.contentHash,
        });
      }
    }

    return {
      status,
      duplicates,
      duplicateRate: duplicates.length / commonPatterns.length,
    };
  } catch (error) {
    console.error('Error analyzing code deduplication:', error);
    throw error;
  }
}

// Advanced example: Dependency analysis across project
async function analyzeProjectDependencies(projectId) {
  try {
    // Get processing status
    const status = await getSnippetProcessingStatus(projectId);

    // Search for all snippets
    const allSnippets = await searchSnippets('', projectId, { limit: 1000 });

    // Analyze dependencies for each snippet
    const dependencyMap = new Map();
    const complexityMap = new Map();

    for (const snippet of allSnippets) {
      const dependencies = await analyzeDependencies(snippet.id, projectId);
      dependencyMap.set(snippet.id, dependencies);
      complexityMap.set(snippet.id, dependencies.complexity);
    }

    // Find most complex snippets
    const sortedByComplexity = Array.from(complexityMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Find most depended-on snippets
    const dependencyCount = new Map();
    for (const [snippetId, deps] of dependencyMap) {
      for (const depId of deps.dependsOn) {
        dependencyCount.set(depId, (dependencyCount.get(depId) || 0) + 1);
      }
    }

    const mostDependedOn = Array.from(dependencyCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return {
      status,
      totalSnippets: allSnippets.length,
      mostComplex: sortedByComplexity,
      mostDependedOn,
      dependencyMap,
    };
  } catch (error) {
    console.error('Error analyzing project dependencies:', error);
    throw error;
  }
}

// Example usage
async function example() {
  try {
    // Search for snippets
    const searchResults = await searchSnippets('example function', 'project_123', { limit: 5 });
    console.log('Search results:', searchResults);

    // Get a specific snippet
    if (searchResults.length > 0) {
      const snippet = await getSnippetById(searchResults[0].id, 'project_123');
      console.log('Snippet:', snippet);
    }

    // Check for duplicates
    const duplicateCheck = await checkForDuplicates(
      'function example() { return true; }',
      'project_123'
    );
    console.log('Duplicate check:', duplicateCheck);

    // Get processing status
    const status = await getSnippetProcessingStatus('project_123');
    console.log('Processing status:', status);

    // Advanced usage: Find related snippets
    if (searchResults.length > 0) {
      const related = await findRelatedSnippets(searchResults[0].id, 'project_123');
      console.log('Related snippets:', related);
    }

    // Advanced usage: Code deduplication analysis
    const deduplication = await analyzeCodeDeduplication('project_123');
    console.log('Deduplication analysis:', deduplication);

    // Advanced usage: Dependency analysis
    const dependencies = await analyzeProjectDependencies('project_123');
    console.log('Dependency analysis:', dependencies);

    // Get system health
    const health = await getSystemHealth();
    console.log('System health:', health);

    // Get system metrics
    const metrics = await getSystemMetrics();
    console.log('System metrics:', metrics);

    // Get performance report
    const performance = await getPerformanceReport();
    console.log('Performance report:', performance);
  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Run the example
example();
