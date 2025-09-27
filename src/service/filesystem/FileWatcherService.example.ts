import { DIContainer, TYPES } from '../../core/DIContainer';
import { FileWatcherService, FileWatcherOptions, FileWatcherCallbacks } from './FileWatcherService';
import { FileInfo } from './FileSystemTraversal';

// Example usage of the FileWatcherService
export class FileWatcherExample {
  private fileWatcherService: FileWatcherService;

  constructor() {
    const container = DIContainer.getInstance();
    this.fileWatcherService = container.get<FileWatcherService>(TYPES.FileWatcherService);
  }

  async startExample(): Promise<void> {
    // Define the paths to watch
    const watchOptions: FileWatcherOptions = {
      watchPaths: ['./src', './test'],
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/*.log'],
      ignoreInitial: true,
      followSymlinks: false,
      usePolling: false,
      awaitWriteFinish: true,
      awaitWriteFinishOptions: {
        stabilityThreshold: 2000,
        pollInterval: 100,
      },
    };

    // Define callbacks for file events
    const callbacks: FileWatcherCallbacks = {
      onFileAdded: (fileInfo: FileInfo) => {
        console.log(`File added: ${fileInfo.relativePath} (${fileInfo.language})`);
        // Process the new file (e.g., index it, parse it, etc.)
      },

      onFileChanged: (fileInfo: FileInfo) => {
        console.log(`File changed: ${fileInfo.relativePath} (${fileInfo.language})`);
        // Handle file changes (e.g., re-index, update analysis, etc.)
      },

      onFileDeleted: (filePath: string) => {
        console.log(`File deleted: ${filePath}`);
        // Clean up resources related to the deleted file
      },

      onDirectoryAdded: (dirPath: string) => {
        console.log(`Directory added: ${dirPath}`);
        // Handle new directory (e.g., scan for files, etc.)
      },

      onDirectoryDeleted: (dirPath: string) => {
        console.log(`Directory deleted: ${dirPath}`);
        // Clean up resources related to the deleted directory
      },

      onError: (error: Error) => {
        console.error('File watcher error:', error);
        // Handle errors (e.g., restart watcher, log to monitoring system, etc.)
      },

      onReady: () => {
        console.log('File watcher is ready and watching for changes');
        // Perform initial setup after watcher is ready
      },
    };

    // Set the callbacks
    this.fileWatcherService.setCallbacks(callbacks);

    try {
      // Start watching
      await this.fileWatcherService.startWatching(watchOptions);
      console.log('File watcher started successfully');

      // Example: Check if a path is being watched
      const isWatchingSrc = this.fileWatcherService.isWatchingPath('./src');
      console.log(`Watching ./src: ${isWatchingSrc}`);

      // Example: Get all watched paths
      const watchedPaths = this.fileWatcherService.getWatchedPaths();
      console.log('Watched paths:', watchedPaths);

      // In a real application, you would typically keep the watcher running
      // and handle the file events in your application logic

      // To stop watching (e.g., on application shutdown):
      // await this.fileWatcherService.stopWatching();
      // console.log('File watcher stopped');
    } catch (error) {
      console.error('Failed to start file watcher:', error);
      // Handle initialization error
    }
  }

  async stopExample(): Promise<void> {
    try {
      await this.fileWatcherService.stopWatching();
      console.log('File watcher stopped successfully');
    } catch (error) {
      console.error('Failed to stop file watcher:', error);
    }
  }
}

// Example of how to use the FileWatcherExample class
async function runExample() {
  const example = new FileWatcherExample();

  try {
    await example.startExample();

    // Keep the application running
    console.log('Press Ctrl+C to stop the file watcher...');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nReceived SIGINT, stopping file watcher...');
      await example.stopExample();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\nReceived SIGTERM, stopping file watcher...');
      await example.stopExample();
      process.exit(0);
    });
  } catch (error) {
    console.error('Error in file watcher example:', error);
    process.exit(1);
  }
}

// Uncomment to run the example
// runExample().catch(console.error);
