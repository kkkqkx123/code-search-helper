import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3011
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // 将API服务分离为独立块
          if (id.includes('services/api.js')) {
            return 'api';
          }
          
          // 将图相关页面进一步细分
          if (id.includes('pages/GraphExplorerPage.js')) {
            return 'graph-explorer';
          }
          if (id.includes('pages/GraphAnalysisPage.js')) {
            return 'graph-analysis';
          }
          if (id.includes('pages/GraphManagementPage.js')) {
            return 'graph-management';
          }
          
          // 将图相关组件分离
          if (id.includes('components/graph/')) {
            return 'graph-components';
          }
          if (id.includes('services/graphApi.js')) {
            return 'graph-api';
          }
          
          // 将大型页面组件分离
          if (id.includes('pages/SearchPage.js')) {
            return 'search-page';
          }
          if (id.includes('pages/ProjectsPage.js')) {
            return 'projects-page';
          }
          if (id.includes('pages/QdrantCollectionViewPage.js')) {
            return 'qdrant-page';
          }
          if (id.includes('pages/IndexProjectPage.js')) {
            return 'index-project';
          }
          
          // 将组件分离
          if (id.includes('components/StorageStatusIndicator.js') ||
              id.includes('components/StorageActionButtons.js') ||
              id.includes('components/BatchOperationsPanel.js')) {
            return 'storage-components';
          }
          
          if (id.includes('components/HotReloadStatus.js') ||
              id.includes('components/HotReloadConfigModal.js')) {
            return 'hot-reload-components';
          }
          
          // 其他组件
          if (id.includes('components/UpdateProgressModal.js')) {
            return 'modal-components';
          }
        }
      }
    },
    // 提高chunk大小警告阈值，但仍然保持合理的分割
    chunkSizeWarningLimit: 600
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});