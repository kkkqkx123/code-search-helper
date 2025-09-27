# FileWatcherService

The FileWatcherService provides real-time file system monitoring capabilities using Chokidar. It integrates with the existing FileSystemTraversal service to provide comprehensive file watching functionality with proper error handling and resource management.

## Features

- Real-time file system monitoring using Chokidar
- Event handlers for file creation, modification, and deletion
- Directory monitoring (addition and deletion)
- Integration with FileSystemTraversal for file analysis
- Configurable ignore patterns and file filters
- Proper error handling and resource cleanup
- Support for multiple watch paths
- Configurable polling and stability options

## Installation

The FileWatcherService uses Chokidar, which is already included in the project dependencies:

```bash
npm install chokidar
```

## Usage

### Basic Usage

```typescript
import { DIContainer, TYPES } from '../../core/DIContainer';
import { FileWatcherService, FileWatcherOptions, FileWatcherCallbacks } from './FileWatcherService';

// Get the FileWatcherService instance from the DI container
const container = DIContainer.getInstance();
const fileWatcherService = container.get<FileWatcherService>(TYPES.FileWatcherService);

// Define watch options
const watchOptions: FileWatcherOptions = {
  watchPaths: ['./src'],
  ignored: ['**/node_modules/**', '**/.git/**'],
  ignoreInitial: true,
  awaitWriteFinish: true
};

// Define event callbacks
const callbacks: FileWatcherCallbacks = {
  onFileAdded: (fileInfo) => {
    console.log('File added:', fileInfo.relativePath);
  },
  onFileChanged: (fileInfo) => {
    console.log('File changed:', fileInfo.relativePath);
  },
  onFileDeleted: (filePath) => {
    console.log('File deleted:', filePath);
  },
  onError: (error) => {
    console.error('File watcher error:', error);
  }
};

// Set callbacks and start watching
fileWatcherService.setCallbacks(callbacks);
await fileWatcherService.startWatching(watchOptions);
```

### Advanced Usage

```typescript
import { FileWatcherService, FileWatcherOptions, FileWatcherCallbacks } from './FileWatcherService';
import { FileInfo } from './FileSystemTraversal';

const watchOptions: FileWatcherOptions = {
  watchPaths: ['./src', './test'],
  ignored: [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/*.log'
  ],
  ignoreInitial: true,
  followSymlinks: false,
  usePolling: false,
  awaitWriteFinish: true,
  awaitWriteFinishOptions: {
    stabilityThreshold: 2000,
    pollInterval: 100
  }
};

const callbacks: FileWatcherCallbacks = {
  onFileAdded: (fileInfo: FileInfo) => {
    // Process new file
    console.log(`File added: ${fileInfo.relativePath} (${fileInfo.language})`);
    // Index the file, parse it, etc.
  },

  onFileChanged: (fileInfo: FileInfo) => {
    // Handle file changes
    console.log(`File changed: ${fileInfo.relativePath} (${fileInfo.language})`);
    // Re-index, update analysis, etc.
  },

  onFileDeleted: (filePath: string) => {
    // Clean up resources
    console.log(`File deleted: ${filePath}`);
    // Remove from index, clean up cache, etc.
  },

  onDirectoryAdded: (dirPath: string) => {
    // Handle new directory
    console.log(`Directory added: ${dirPath}`);
    // Scan for files, etc.
  },

  onDirectoryDeleted: (dirPath: string) => {
    // Clean up directory resources
    console.log(`Directory deleted: ${dirPath}`);
    // Remove related data, etc.
  },

  onError: (error: Error) => {
    // Handle errors
    console.error('File watcher error:', error);
    // Restart watcher, log to monitoring system, etc.
  },

  onReady: () => {
    // Watcher is ready
    console.log('File watcher is ready');
    // Perform initial setup
  }
};

fileWatcherService.setCallbacks(callbacks);
await fileWatcherService.startWatching(watchOptions);
```

### Stopping the Watcher

```typescript
// Stop watching all paths
await fileWatcherService.stopWatching();

// Check if a specific path is being watched
const isWatching = fileWatcherService.isWatchingPath('./src');

// Get all watched paths
const watchedPaths = fileWatcherService.getWatchedPaths();
```

## API Reference

### FileWatcherOptions

```typescript
interface FileWatcherOptions {
  watchPaths: string[];           // Paths to watch
  ignored?: string[];             // Patterns to ignore
  ignoreInitial?: boolean;        // Ignore initial scan events
  followSymlinks?: boolean;       // Follow symbolic links
  cwd?: string;                   // Current working directory
  disableGlobbing?: boolean;      // Disable glob pattern matching
  usePolling?: boolean;           // Use polling instead of native events
  interval?: number;              // Polling interval (ms)
  binaryInterval?: number;         // Polling interval for binary files (ms)
  alwaysStat?: boolean;           // Always stat files
  depth?: number;                 // Recursion depth
  awaitWriteFinish?: boolean;     // Wait for write operations to finish
  awaitWriteFinishOptions?: {     // Options for write finish detection
    stabilityThreshold: number;   // Time to wait for file stability (ms)
    pollInterval: number;         // Polling interval during stability check (ms)
  };
}
```

### FileWatcherCallbacks

```typescript
interface FileWatcherCallbacks {
  onFileAdded?: (fileInfo: FileInfo) => void;
  onFileChanged?: (fileInfo: FileInfo) => void;
  onFileDeleted?: (filePath: string) => void;
  onDirectoryAdded?: (dirPath: string) => void;
  onDirectoryDeleted?: (dirPath: string) => void;
  onError?: (error: Error) => void;
  onReady?: () => void;
}
```

### FileWatcherService Methods

#### `setCallbacks(callbacks: FileWatcherCallbacks): void`
Set the event callbacks for the file watcher.

#### `startWatching(options: FileWatcherOptions): Promise<void>`
Start watching the specified paths with the given options.

#### `stopWatching(): Promise<void>`
Stop watching all paths and clean up resources.

#### `isWatchingPath(watchPath: string): boolean`
Check if a specific path is being watched.

#### `getWatchedPaths(): string[]`
Get an array of all currently watched paths.

## Integration with FileSystemTraversal

The FileWatcherService integrates with the FileSystemTraversal service to provide comprehensive file analysis:

- File type detection based on extensions
- Binary file detection and filtering
- File size validation
- Hash calculation for change detection
- Language detection for supported file types
- Pattern matching for include/exclude rules

## Error Handling

The FileWatcherService includes comprehensive error handling:

- Permission errors are caught and logged
- Large file errors are handled gracefully
- Invalid paths are detected and reported
- Watcher errors are propagated through callbacks
- All errors are logged using the LoggerService
- Errors are reported through the ErrorHandlerService

## Resource Management

The service includes proper resource management:

- Watchers are properly closed on stop
- Memory is cleaned up when paths are unwatched
- File handles are properly managed
- Event listeners are cleaned up on shutdown

## Configuration

The FileWatcherService can be configured through:

1. **FileWatcherOptions**: Runtime configuration for watcher behavior
2. **TraversalOptions**: Configuration for file analysis and filtering
3. **Environment variables**: Logging level and format through LoggerService

## Example

See `FileWatcherService.example.ts` for a complete example of how to use the FileWatcherService in your application.

## Dependencies

- Chokidar: File system watcher
- Winston: Logging (through LoggerService)
- Inversify: Dependency injection
- FileSystemTraversal: File analysis and traversal