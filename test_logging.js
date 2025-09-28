// 简单的测试脚本来验证日志记录功能
const express = require('express');
const { Logger } = require('./dist/utils/logger');

const app = express();
const logger = new Logger('test-server', 'info');

// 添加修改后的日志中间件
app.use((req, res, next) => {
  // 存储原始响应方法
  const originalSend = res.send.bind(res);
  const originalJson = res.json.bind(res);
  const originalEnd = res.end.bind(res);

  // 存储请求开始时间
  const startTime = Date.now();

  // 重写响应方法以捕获响应数据
  res.send = (body) => {
    res.locals.responseBody = body;
    return originalSend(body);
  };

  res.json = (body) => {
    res.locals.responseBody = body;
    return originalJson(body);
  };

  res.end = (body) => {
    if (body) {
      res.locals.responseBody = body;
    }
    return originalEnd(body);
  };

  // 请求完成时记录响应
  res.on('finish', () => {
    try {
      const responseTime = Date.now() - startTime;
      const logData = {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        origin: req.get('Origin'),
        body: req.body
      };

      // 如果状态码表示错误，添加错误信息
      if (res.statusCode >= 400) {
        logData.error = res.statusMessage || 'Unknown error';
        if (res.locals.responseBody && typeof res.locals.responseBody === 'object') {
          logData.responseError = res.locals.responseBody.error || res.locals.responseBody.message;
        }
      }

      // 为调试添加响应体
      if (res.locals.responseBody) {
        logData.responseBody = res.locals.responseBody;
      }

      logger.info(`API ${req.method} ${req.path} - ${res.statusCode}`, logData);
    } catch (error) {
      console.error('Error in response logging middleware:', error);
    }
  });

  next();
});

// 测试路由
app.get('/api/test/success', (req, res) => {
  res.json({ success: true, message: 'Test successful' });
});

app.get('/api/test/error', (req, res) => {
  res.status(400).json({ success: false, error: 'Test error', message: 'This is a test error' });
});

app.get('/api/test/not-found', (req, res) => {
  res.status(404).json({ success: false, error: 'Not Found', message: 'Resource not found' });
});

const port = 3020;
app.listen(port, () => {
  console.log(`Test server running on port ${port}`);
  console.log('Test endpoints:');
  console.log('  GET /api/test/success - 200 response');
  console.log('  GET /api/test/error - 400 response');
  console.log('  GET /api/test/not-found - 404 response');
  console.log('\nMake requests to these endpoints to test logging functionality');
});