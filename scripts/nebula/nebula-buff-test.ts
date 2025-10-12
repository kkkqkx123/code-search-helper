import { Container } from 'inversify';
import { TYPES } from '../../src/types';
import { NebulaQueryService } from '../../src/database/nebula/query/NebulaQueryService';
import { DatabaseLoggerService } from '../../src/database/common/DatabaseLoggerService';
import { NebulaConfigService } from '../../src/config/service/NebulaConfigService';
import { LoggerService } from '../../src/utils/LoggerService';
import { ErrorHandlerService } from '../../src/utils/ErrorHandlerService';
import { PerformanceMonitor } from '../../src/database/common/PerformanceMonitor';
import { ConfigService } from '../../src/config/ConfigService';
import { EnvironmentConfigService } from '../../src/config/service/EnvironmentConfigService';
import { QdrantConfigService } from '../../src/config/service/QdrantConfigService';
import { EmbeddingConfigService } from '../../src/config/service/EmbeddingConfigService';
import { LoggingConfigService } from '../../src/config/service/LoggingConfigService';
import { MonitoringConfigService } from '../../src/config/service/MonitoringConfigService';
import { FileProcessingConfigService } from '../../src/config/service/FileProcessingConfigService';
import { BatchProcessingConfigService } from '../../src/config/service/BatchProcessingConfigService';
import { RedisConfigService } from '../../src/config/service/RedisConfigService';
import { ProjectConfigService } from '../../src/config/service/ProjectConfigService';
import { IndexingConfigService } from '../../src/config/service/IndexingConfigService';
import { LSPConfigService } from '../../src/config/service/LSPConfigService';
import { SemgrepConfigService } from '../../src/config/service/SemgrepConfigService';
import { TreeSitterConfigService } from '../../src/config/service/TreeSitterConfigService';
import { ProjectNamingConfigService } from '../../src/config/service/ProjectNamingConfigService';

async function testNebulaConnectionFix() {
    console.log('Testing Nebula Connection Fix...');

    // 创建依赖注入容器并注册服务
    const container = new Container();

    // 注册基础服务
    container.bind<LoggerService>(TYPES.LoggerService).to(LoggerService).inSingletonScope();
    container.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();
    container.bind<DatabaseLoggerService>(TYPES.DatabaseLoggerService).to(DatabaseLoggerService).inSingletonScope();
    container.bind<PerformanceMonitor>(TYPES.PerformanceMonitor).to(PerformanceMonitor).inSingletonScope();

    // 注册配置服务
    container.bind<EnvironmentConfigService>(TYPES.EnvironmentConfigService).to(EnvironmentConfigService).inSingletonScope();
    container.bind<QdrantConfigService>(TYPES.QdrantConfigService).to(QdrantConfigService).inSingletonScope();
    container.bind<EmbeddingConfigService>(TYPES.EmbeddingConfigService).to(EmbeddingConfigService).inSingletonScope();
    container.bind<LoggingConfigService>(TYPES.LoggingConfigService).to(LoggingConfigService).inSingletonScope();
    container.bind<MonitoringConfigService>(TYPES.MonitoringConfigService).to(MonitoringConfigService).inSingletonScope();
    container.bind<FileProcessingConfigService>(TYPES.FileProcessingConfigService).to(FileProcessingConfigService).inSingletonScope();
    container.bind<BatchProcessingConfigService>(TYPES.BatchProcessingConfigService).to(BatchProcessingConfigService).inSingletonScope();
    container.bind<RedisConfigService>(TYPES.RedisConfigService).to(RedisConfigService).inSingletonScope();
    container.bind<ProjectConfigService>(TYPES.ProjectConfigService).to(ProjectConfigService).inSingletonScope();
    container.bind<IndexingConfigService>(TYPES.IndexingConfigService).to(IndexingConfigService).inSingletonScope();
    container.bind<LSPConfigService>(TYPES.LSPConfigService).to(LSPConfigService).inSingletonScope();
    container.bind<SemgrepConfigService>(TYPES.SemgrepConfigService).to(SemgrepConfigService).inSingletonScope();
    container.bind<TreeSitterConfigService>(TYPES.TreeSitterConfigService).to(TreeSitterConfigService).inSingletonScope();
    container.bind<ProjectNamingConfigService>(TYPES.ProjectNamingConfigService).to(ProjectNamingConfigService).inSingletonScope();
    container.bind<NebulaConfigService>(TYPES.NebulaConfigService).to(NebulaConfigService).inSingletonScope();
    container.bind<ConfigService>(TYPES.ConfigService).to(ConfigService).inSingletonScope();

    // 注册Nebula服务
    container.bind<NebulaQueryService>(TYPES.NebulaQueryService).to(NebulaQueryService).inSingletonScope();

    try {
        // 初始化配置服务
        const configServiceInstance = container.get<ConfigService>(TYPES.ConfigService);
        await configServiceInstance.initialize();

        // 获取必要的服务
        const queryService = container.get<NebulaQueryService>(TYPES.NebulaQueryService);
        const configService = container.get<NebulaConfigService>(TYPES.NebulaConfigService);
        const logger = container.get<DatabaseLoggerService>(TYPES.DatabaseLoggerService);

        console.log('Services initialized successfully');

        // 获取配置
        const config = configService.loadConfig();
        console.log('Nebula config loaded:', {
            host: config.host,
            port: config.port,
            username: config.username
        });

        // 测试简单的查询
        console.log('Testing simple query...');
        const simpleResult = await queryService.executeQuery('YIELD 1 AS test');
        console.log('Simple query result:', simpleResult);

        // 测试创建空间的查询，这是之前出现问题的查询
        const testSpaceName = 'project_test_space_buffer_fix';
        const createSpaceQuery = `CREATE SPACE IF NOT EXISTS \`${testSpaceName}\` (partition_num = 10, replica_factor = 1, vid_type = "FIXED_STRING(32)")`;

        console.log('Testing CREATE SPACE query...');
        console.log('Query length:', createSpaceQuery.length);

        // 检查查询字符串是否完整
        if (createSpaceQuery.includes('project_test_space_buffer_fix')) {
            console.log('Query string appears to be intact');
        } else {
            console.error('Query string seems to be corrupted');
            return;
        }

        // 执行创建空间的查询
        const createResult = await queryService.executeQuery(createSpaceQuery);
        console.log('CREATE SPACE query result:', createResult);

        // 清理：删除测试空间
        console.log('Cleaning up test space...');
        const dropResult = await queryService.executeQuery(`DROP SPACE IF EXISTS \`${testSpaceName}\``);
        console.log('DROP SPACE query result:', dropResult);

        console.log('All tests completed successfully!');
    } catch (error) {
        console.error('Test failed with error:', error);
    } finally {
        // 退出程序
        process.exit(0);
    }
}

// 运行测试
testNebulaConnectionFix();