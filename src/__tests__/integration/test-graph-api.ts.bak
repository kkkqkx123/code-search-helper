import axios from 'axios';

// 测试Graph API端点
async function testGraphAPI() {
  const baseUrl = 'http://localhost:3010/api/v1/graph';
  
  console.log('开始测试Graph API端点...');
  
  try {
    // 测试健康检查端点
    console.log('\n1. 测试健康检查端点...');
    const healthResponse = await axios.get(`${baseUrl}/stats/health`);
    console.log('健康检查响应:', healthResponse.data);
    
    // 测试项目空间创建端点
    console.log('\n2. 测试项目空间创建端点...');
    try {
      const createResponse = await axios.post(`${baseUrl}/space/test-project/create`, {
        partitionNum: 10,
        replicaFactor: 1
      });
      console.log('创建空间响应:', createResponse.data);
    } catch (error) {
      console.log('创建空间可能失败（如果Nebula服务未运行）:', (error as any).response?.data || (error as any).message);
    }
    
    // 测试获取空间信息端点
    console.log('\n3. 测试获取空间信息端点...');
    try {
      const infoResponse = await axios.get(`${baseUrl}/space/test-project/info`);
      console.log('空间信息响应:', infoResponse.data);
    } catch (error) {
      console.log('获取空间信息可能失败（如果Nebula服务未运行）:', (error as any).response?.data || (error as any).message);
    }
    
    // 测试自定义查询端点
    console.log('\n4. 测试自定义查询端点...');
    try {
      const queryResponse = await axios.post(`${baseUrl}/query`, {
        query: 'SHOW SPACES',
        projectId: 'test-project'
      });
      console.log('查询响应:', queryResponse.data);
    } catch (error) {
      console.log('查询可能失败（如果Nebula服务未运行）:', (error as any).response?.data || (error as any).message);
    }
    
    console.log('\nGraph API端点测试完成');
  } catch (error) {
    console.error('测试过程中发生错误:', error);
  }
}

// 运行测试
testGraphAPI();