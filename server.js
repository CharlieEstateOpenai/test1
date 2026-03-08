const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  // API 路由处理
  if (req.url.startsWith('/api/')) {
    const apiHandler = require('./api/index.js');
    
    // 创建 Mock 的 Vercel 请求对象
    const mockReq = {
      url: req.url,
      method: req.method,
      headers: req.headers
    };
    
    let responseBody = '';
    const headers = {};
    const mockRes = {
      setHeader: (key, value) => {
        headers[key] = value;
        return mockRes;
      },
      status: (code) => {
        res.statusCode = code;
        return mockRes;
      },
      json: (data) => {
        Object.entries(headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      },
      end: (data) => {
        Object.entries(headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
        res.end(data);
      }
    };
    
    try {
      await apiHandler.default(mockReq, mockRes);
    } catch (error) {
      console.error('API Error:', error);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }
  
  // 静态文件处理
  let filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.statusCode = 404;
        res.end('File not found');
      } else {
        res.statusCode = 500;
        res.end('Server error');
      }
      return;
    }
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.statusCode = 200;
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`API endpoints available at http://localhost:${PORT}/api/`);
});
