const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Hello World!', timestamp: new Date().toISOString() });
});

app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'running', 
    version: '1.0.0',
    uptime: process.uptime()
  });
});

// Start server
app.listen(port, () => {
  console.log(`Test server running at http://localhost:${port}`);
});

module.exports = app;