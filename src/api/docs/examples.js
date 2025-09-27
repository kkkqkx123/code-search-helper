// Example usage of the Codebase Index API

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
  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Run the example
example();
