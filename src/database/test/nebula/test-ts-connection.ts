import { createClient } from '@nebula-contrib/nebula-nodejs';
import { ConfigService } from '../../../config/ConfigService';

async function testNebulaConnection() {
  try {
    // 获取配置
    const configService = ConfigService.getInstance();
    const config = configService.getAll();

    console.log('Nebula配置信息:');
    console.log(`Host: ${config.nebula.host}`);
    console.log(`Port: ${config.nebula.port}`);
    console.log(`Username: ${config.nebula.username}`);
    console.log(`Space: ${config.nebula.space}`);

    // 创建客户端连接（不指定space参数）
    const options: any = {
      servers: [`${config.nebula.host}:${config.nebula.port}`],
      userName: config.nebula.username,
      password: config.nebula.password,
      // 不在连接时指定space参数
    };

    console.log('\n正在连接到Nebula Graph...');
    const client: any = createClient(options);

    // 监听连接事件
    // 监听连接事件
    const readyHandler = async () => {
      console.log('连接成功!');

      try {
        console.log('已成功连接到Nebula Graph');

        // 激活离线的storaged容器
        console.log('\n激活离线的storaged容器...');
        try {
          await client.execute('ADD HOSTS "storaged0":9779, "storaged1":9779, "storaged2":9779;');
          console.log('已发送激活命令，等待storaged容器上线...');
          // 等待storaged容器上线
          await new Promise(resolve => setTimeout(resolve, 10000));
        } catch (error) {
          console.error('激活storaged容器时出错:', error);
        }

        // 检查storage主机状态
        console.log('\n检查storage主机状态:');
        try {
          const showHostsResult = await client.execute('SHOW HOSTS');
          console.log('Hosts状态:', showHostsResult);

          // 检查是否所有主机都已上线
          const hostsData = showHostsResult.data || [];
          const offlineHosts = hostsData.filter((host: any) => host.Status !== 'ONLINE');

          if (offlineHosts.length > 0) {
            console.warn('警告: 仍有离线的storage主机:', offlineHosts);
          } else {
            console.log('所有storage主机均已上线');
          }
        } catch (error) {
          console.error('检查storage主机状态时出错:', error);
        }

        // 首先创建配置中指定的space（如果不存在）
        console.log(`\n创建space: ${config.nebula.space}`);
        try {
          // 检查是否所有storage主机都已上线，如果未上线则等待一段时间
          let allHostsOnline = false;
          let retryCount = 0;
          const maxRetries = 5;

          while (!allHostsOnline && retryCount < maxRetries) {
            try {
              const showHostsResult = await client.execute('SHOW HOSTS');
              const hostsData = showHostsResult.data || [];
              const offlineHosts = hostsData.filter((host: any) => host.Status !== 'ONLINE');

              if (offlineHosts.length === 0) {
                allHostsOnline = true;
                console.log('所有storage主机均已上线，可以创建space');
              } else {
                console.log(
                  `仍有 ${offlineHosts.length} 个storage主机离线，等待中... (重试 ${retryCount + 1}/${maxRetries})`
                );
                retryCount++;
                await new Promise(resolve => setTimeout(resolve, 5000));
              }
            } catch (hostCheckError) {
              console.error('检查storage主机状态时出错:', hostCheckError);
              break; // 如果检查主机状态出错，则跳出循环
            }
          }

          if (!allHostsOnline) {
            console.warn('警告: 部分storage主机仍处于离线状态，可能会导致space创建失败');
          }

          await client.execute(
            `CREATE SPACE IF NOT EXISTS ${config.nebula.space} (vid_type=FIXED_STRING(32))`
          );
          // 等待space创建完成
          await new Promise(resolve => setTimeout(resolve, 5000));

          // 切换到配置中指定的space
          console.log(`\n切换到space: ${config.nebula.space}`);
          await client.execute(`USE ${config.nebula.space}`);
          console.log(`已切换到space: ${config.nebula.space}`);
        } catch (error) {
          console.error('创建或切换space时出错:', error);
          // 如果创建配置中指定的space失败，尝试使用默认space
          try {
            console.log('\n尝试使用默认space: codegraph');
            await client.execute('USE codegraph');
            console.log('已切换到默认space: codegraph');
          } catch (defaultSpaceError) {
            console.error('使用默认space时出错:', defaultSpaceError);
            throw error; // 仍然抛出原始错误
          }
        }

        // 查看当前存在的space列表
        console.log('\n查看当前存在的space列表:');
        try {
          const showSpacesResult = await client.execute('SHOW SPACES');
          console.log('Space列表:', showSpacesResult);
        } catch (error) {
          console.error('查看space列表时出错:', error);
        }

        // 使用配置中指定的space名称作为测试space
        const testSpaceName = config.nebula.space;
        console.log(`\n使用space进行测试: ${testSpaceName}`);

        // 确保space已正确切换
        try {
          console.log(`\n再次确认切换到space: ${testSpaceName}`);
          await client.execute(`USE ${testSpaceName}`);
          console.log(`已确认切换到space: ${testSpaceName}`);
        } catch (switchError) {
          console.error('切换space时出错:', switchError);
          throw switchError;
        }

        // 在新space中创建一个标签
        console.log('\n在新space中创建标签:');
        const createTagResult = await client.execute(
          'CREATE TAG IF NOT EXISTS test_tag(name string, created datetime)'
        );
        console.log('创建标签结果:', createTagResult);

        // 验证space是否创建成功
        console.log('\n验证space列表:');
        const showSpacesResult = await client.execute('SHOW SPACES');
        console.log('Space列表:', showSpacesResult);

        // 删除新创建的space
        console.log(`\n正在删除space: ${testSpaceName}`);
        const dropSpaceResult = await client.execute(`DROP SPACE IF EXISTS ${testSpaceName}`);
        console.log(`删除space结果:`, dropSpaceResult);

        console.log('\n测试完成!');
      } catch (error) {
        console.error('操作过程中发生错误:', error);
      } finally {
        // 确保连接被正确关闭
        try {
          if (client && typeof client.close === 'function') {
            await client.close();
            console.log('连接已关闭');
          }
        } catch (closeError) {
          console.error('关闭连接时出错:', closeError);
        }
        process.exit(0);
      }
    };

    const errorHandler = ({ error }: { error: any }) => {
      console.error('连接错误:', error);
      // 确保连接被正确关闭
      try {
        if (client && typeof client.close === 'function') {
          client.close();
        }
      } catch (closeError) {
        console.error('关闭连接时出错:', closeError);
      }
      process.exit(1);
    };

    client.on('ready', readyHandler);
    client.on('error', errorHandler);

    // 设置连接超时
    const connectionTimeout = setTimeout(() => {
      console.error('连接超时');
      // 确保连接被正确关闭
      try {
        if (client && typeof client.close === 'function') {
          client.close();
        }
      } catch (closeError) {
        console.error('关闭连接时出错:', closeError);
      }
      process.exit(1);
    }, 15000);

    // 确保定时器不会阻止进程退出
    connectionTimeout.unref();
  } catch (error) {
    console.error('测试过程中发生错误:', error);
    process.exit(1);
  }
}

// 执行测试
testNebulaConnection();
