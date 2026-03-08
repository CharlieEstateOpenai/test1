// Stock App API - 股票实时持仓和趋势分析
// 使用 TinyFish API 调用权威财经数据源

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟缓存

async function callTinyFish(url, goal, timeout = 90000) {
  const apiKey = process.env.TINYFISH_API_KEY || "sk-tinyfish-jrNPRJUhx20YD6Ozc5sRefmtsdC1MPMu";
  
  console.log('=== TinyFish API Call Start ===');
  console.log('URL:', url);
  console.log('Goal:', goal);

  if (!apiKey) {
    throw new Error("TINYFISH_API_KEY not configured");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    console.log('Calling TinyFish API...');
    
    const response = await fetch('https://agent.tinyfish.ai/v1/automation/run', {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ 
        url: url,
        goal: goal
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    console.log('Response status:', response.status);

    // 先获取文本，检查是否为 JSON
    const text = await response.text();
    console.log('Response text length:', text.length);
    console.log('Response preview:', text.substring(0, 200));

    if (!response.ok) {
      console.error('TinyFish API error:', response.status, text);
      throw new Error(`TinyFish API error ${response.status}`);
    }

    // 检查是否是 HTML 错误页面
    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
      console.error('Received HTML instead of JSON');
      throw new Error('TinyFish API returned HTML instead of JSON');
    }

    try {
      const result = JSON.parse(text);
      console.log('TinyFish API success, result keys:', Object.keys(result));
      console.log('=== TinyFish API Call End ===\n');
      return result;
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message);
      console.error('Response text:', text.substring(0, 500));
      throw new Error('Invalid JSON response from TinyFish API');
    }
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('TinyFish call error:', error.message);
    if (error.name === 'AbortError') {
      throw new Error('TinyFish API request timeout');
    }
    throw error;
  }
}

// 获取股票实时持仓数据
async function fetchStockPosition(symbol) {
  const cacheKey = `position_${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('Cache hit for:', cacheKey);
    return cached.data;
  }

  const searchUrl = `https://www.google.com/search?q=${symbol}+stock+price`;
  const goal = `Find the current stock price and basic information for ${symbol}. Return ONLY a JSON object with: symbol, company_name, current_price, price_change, price_change_percent, market_cap, pe_ratio. Example: {"symbol":"AAPL","company_name":"Apple Inc.","current_price":175.50,"price_change":2.30,"price_change_percent":1.33,"market_cap":"2.8T","pe_ratio":28.5}`;
  
  try {
    console.log(`Fetching stock data for ${symbol} from TinyFish...`);
    const result = await callTinyFish(searchUrl, goal, 90000);
    
    console.log('TinyFish raw result:', JSON.stringify(result, null, 2));
    
    // 尝试从各种可能的字段中提取数据
    let data = null;
    
    if (result.output?.data) {
      data = result.output.data;
    } else if (result.data) {
      data = result.data;
    } else if (result.output) {
      // 如果 output 是字符串，尝试解析
      if (typeof result.output === 'string') {
        try {
          data = JSON.parse(result.output);
        } catch (e) {
          console.warn('Output is string but not JSON:', result.output.substring(0, 200));
          data = { company_name: result.output };
        }
      } else {
        data = result.output;
      }
    } else {
      // 最后尝试整个 result
      data = result;
    }
    
    console.log('Extracted data:', data);
    
    // 确保至少有 symbol 或 company_name
    if (!data || (!data.symbol && !data.company_name && !data.current_price)) {
      console.warn('No valid data extracted, using fallback');
      // 返回一个基本的结构，让前端能显示
      data = {
        symbol: symbol,
        company_name: `${symbol} Corporation`,
        current_price: null,
        message: '数据提取中，请稍后重试'
      };
    }
    
    cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    console.error(`Stock position fetch error:`, error.message);
    // 错误时也返回基本结构
    return {
      symbol: symbol,
      company_name: `${symbol} Corporation`,
      current_price: null,
      error: error.message
    };
  }
}

// 获取股票历史数据
async function fetchStockHistory(symbol, metric = 'price', period = '1y') {
  const searchUrl = `https://finance.yahoo.com/quote/${symbol}/history`;
  const goal = `Extract historical ${metric} data for ${symbol}. Return JSON array with objects containing: date (YYYY-MM-DD), value (number). Provide at least 10 data points.`;
  
  try {
    const result = await callTinyFish(searchUrl, goal, 60000);
    const data = result.output?.data || result.data || result.output || [];
    console.log('Stock history data:', Array.isArray(data) ? `${data.length} items` : data);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Stock history fetch error:`, error.message);
    return [];
  }
}

// 获取股票新闻
async function fetchStockNews(symbol) {
  const searchUrl = `https://finance.yahoo.com/quote/${symbol}/news`;
  const goal = `Extract news and analyst ratings for ${symbol}. Return JSON with: news (array with headline, source, date, summary), analyst_ratings (array with firm, rating, target_price).`;
  
  try {
    const result = await callTinyFish(searchUrl, goal, 60000);
    const data = result.output?.data || result.data || result.output || {};
    return data;
  } catch (error) {
    console.error(`Stock news fetch error:`, error.message);
    return { news: [], analyst_ratings: [] };
  }
}

// 搜索股票
async function searchStocks(query) {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}+stock+ticker`;
  const goal = `Find stock ticker symbols for "${query}". Return JSON array with: symbol, company_name, exchange. Return up to 10 results.`;
  
  try {
    const result = await callTinyFish(searchUrl, goal, 60000);
    const data = result.output?.data || result.data || result.output || [];
    console.log('Search results:', Array.isArray(data) ? `${data.length} items` : data);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Search error:`, error.message);
    return [];
  }
}

export default async function handler(req, res) {
  const { method, url } = req;
  
  // 解析 URL，去掉查询字符串
  const urlObj = new URL(`http://localhost${url || '/'}`);
  const pathname = urlObj.pathname;
  
  console.log('Request URL:', url);
  console.log('Parsed pathname:', pathname);
  console.log('Method:', method);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Health check
  if (pathname === '/api/health') {
    res.status(200).json({
      status: 'healthy',
      version: '2.0.0',
      time: new Date().toISOString(),
      tinyfish_configured: !!process.env.TINYFISH_API_KEY
    });
    return;
  }

  // 搜索股票 - GET /api/search?q=:query
  if (pathname === '/api/search' && method === 'GET') {
    const query = urlObj.searchParams.get('q');
    
    if (!query) {
      res.status(400).json({ error: '搜索关键词不能为空' });
      return;
    }

    console.log('\n=== Search API Called ===');
    console.log('Query:', query);

    try {
      const results = await searchStocks(query);
      console.log('Search completed, results:', results.length);
      
      res.status(200).json({
        query,
        results: results,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Search error:', error.message);
      res.status(200).json({
        query,
        results: [],
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    return;
  }

  // 获取股票实时持仓数据 - GET /api/stock/:symbol/position
  if (pathname.match(/^\/api\/stock\/[A-Za-z0-9]+\/position$/)) {
    const symbol = pathname.split('/')[3];
    
    console.log('\n=== Stock Position API Called ===');
    console.log('Symbol:', symbol);

    try {
      const position = await fetchStockPosition(symbol.toUpperCase());
      
      if (!position || !Object.keys(position).length) {
        res.status(404).json({ error: '未找到该股票数据', symbol });
        return;
      }

      res.status(200).json({
        symbol: symbol.toUpperCase(),
        data: position,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Position fetch error:', error.message);
      res.status(500).json({ error: error.message });
    }
    return;
  }

  // 获取股票历史数据 - GET /api/stock/:symbol/history/:metric
  if (pathname.match(/^\/api\/stock\/[A-Za-z0-9]+\/history\/[A-Za-z_]+$/)) {
    const parts = pathname.split('/');
    const symbol = parts[3];
    const metric = parts[5] || 'price';

    console.log('\n=== Stock History API Called ===');
    console.log('Symbol:', symbol, 'Metric:', metric);

    try {
      const history = await fetchStockHistory(symbol.toUpperCase(), metric, '1y');
      
      res.status(200).json({
        symbol: symbol.toUpperCase(),
        metric,
        period: '1y',
        data: history,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('History fetch error:', error.message);
      res.status(500).json({ error: error.message });
    }
    return;
  }

  // 获取股票新闻 - GET /api/stock/:symbol/news
  if (pathname.match(/^\/api\/stock\/[A-Za-z0-9]+\/news$/)) {
    const symbol = pathname.split('/')[3];

    try {
      const news = await fetchStockNews(symbol.toUpperCase());
      
      res.status(200).json({
        symbol: symbol.toUpperCase(),
        data: news,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('News fetch error:', error.message);
      res.status(500).json({ error: error.message });
    }
    return;
  }

  // 默认响应
  if (pathname === '/' || pathname === '/api') {
    res.status(200).json({
      name: 'Stock Real-time Position & Trend Analysis API',
      version: '2.0.0',
      description: '基于 TinyFish API 的股票实时持仓和趋势分析服务',
      endpoints: [
        { method: 'GET', path: '/api/health', description: 'Health check' },
        { method: 'GET', path: '/api/search?q=:query', description: '搜索股票' },
        { method: 'GET', path: '/api/stock/:symbol/position', description: '获取股票实时持仓数据' },
        { method: 'GET', path: '/api/stock/:symbol/history/:metric', description: '获取股票历史指标数据' },
        { method: 'GET', path: '/api/stock/:symbol/news', description: '获取股票新闻' }
      ]
    });
    return;
  }

  res.status(404).json({ error: 'Not found', path: pathname });
}
