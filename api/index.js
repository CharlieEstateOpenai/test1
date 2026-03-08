// Stock App API - 股票实时持仓和趋势分析
// 使用 TinyFish API 快速获取股票新闻和简单数据

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟缓存

// 常见股票的模拟数据（用于演示）
const STOCK_DATA = {
  'AAPL': {
    symbol: 'AAPL',
    company_name: 'Apple Inc.',
    current_price: 178.52,
    price_change: 2.34,
    price_change_percent: 1.33,
    market_cap: '2.8T',
    pe_ratio: 28.5,
    eps: 6.26,
    dividend_yield: '0.5%',
    volume: 52000000,
    avg_volume: 58000000,
    open: 176.50,
    high: 179.20,
    low: 176.10,
    previous_close: 176.18,
    fifty_two_week_high: 198.23,
    fifty_two_week_low: 143.90,
    beta: 1.28,
    sector: 'Technology',
    industry: 'Consumer Electronics'
  },
  'TSLA': {
    symbol: 'TSLA',
    company_name: 'Tesla Inc.',
    current_price: 248.73,
    price_change: -3.27,
    price_change_percent: -1.30,
    market_cap: '789B',
    pe_ratio: 65.2,
    eps: 3.81,
    dividend_yield: '0%',
    volume: 98000000,
    avg_volume: 105000000,
    open: 251.00,
    high: 253.50,
    low: 247.20,
    previous_close: 252.00,
    fifty_two_week_high: 299.29,
    fifty_two_week_low: 138.80,
    beta: 2.05,
    sector: 'Consumer Cyclical',
    industry: 'Auto Manufacturers'
  },
  'GOOGL': {
    symbol: 'GOOGL',
    company_name: 'Alphabet Inc.',
    current_price: 141.25,
    price_change: 1.85,
    price_change_percent: 1.33,
    market_cap: '1.8T',
    pe_ratio: 24.3,
    eps: 5.81,
    dividend_yield: '0%',
    volume: 25000000,
    avg_volume: 28000000,
    open: 139.50,
    high: 141.80,
    low: 139.20,
    previous_close: 139.40,
    fifty_two_week_high: 153.78,
    fifty_two_week_low: 102.21,
    beta: 1.05,
    sector: 'Technology',
    industry: 'Internet Content & Information'
  },
  'MSFT': {
    symbol: 'MSFT',
    company_name: 'Microsoft Corporation',
    current_price: 415.32,
    price_change: 5.67,
    price_change_percent: 1.38,
    market_cap: '3.1T',
    pe_ratio: 36.8,
    eps: 11.29,
    dividend_yield: '0.7%',
    volume: 22000000,
    avg_volume: 25000000,
    open: 410.00,
    high: 416.50,
    low: 409.20,
    previous_close: 409.65,
    fifty_two_week_high: 430.82,
    fifty_two_week_low: 309.45,
    beta: 0.92,
    sector: 'Technology',
    industry: 'Software'
  },
  'AMZN': {
    symbol: 'AMZN',
    company_name: 'Amazon.com Inc.',
    current_price: 178.25,
    price_change: 2.15,
    price_change_percent: 1.22,
    market_cap: '1.9T',
    pe_ratio: 62.5,
    eps: 2.85,
    dividend_yield: '0%',
    volume: 45000000,
    avg_volume: 50000000,
    open: 176.50,
    high: 179.00,
    low: 175.80,
    previous_close: 176.10,
    fifty_two_week_high: 189.77,
    fifty_two_week_low: 118.35,
    beta: 1.15,
    sector: 'Consumer Cyclical',
    industry: 'Internet Retail'
  },
  'META': {
    symbol: 'META',
    company_name: 'Meta Platforms Inc.',
    current_price: 495.50,
    price_change: 8.25,
    price_change_percent: 1.69,
    market_cap: '1.3T',
    pe_ratio: 33.2,
    eps: 14.92,
    dividend_yield: '0.4%',
    volume: 18000000,
    avg_volume: 20000000,
    open: 488.00,
    high: 497.20,
    low: 486.50,
    previous_close: 487.25,
    fifty_two_week_high: 531.49,
    fifty_two_week_low: 274.38,
    beta: 1.22,
    sector: 'Technology',
    industry: 'Internet Content & Information'
  },
  'NVDA': {
    symbol: 'NVDA',
    company_name: 'NVIDIA Corporation',
    current_price: 875.35,
    price_change: 15.80,
    price_change_percent: 1.84,
    market_cap: '2.2T',
    pe_ratio: 72.5,
    eps: 12.07,
    dividend_yield: '0.03%',
    volume: 42000000,
    avg_volume: 48000000,
    open: 860.00,
    high: 878.50,
    low: 858.20,
    previous_close: 859.55,
    fifty_two_week_high: 974.00,
    fifty_two_week_low: 403.25,
    beta: 1.68,
    sector: 'Technology',
    industry: 'Semiconductors'
  }
};

// 历史数据生成器（用于演示）
function generateHistoryData(symbol, metric, days = 30) {
  const basePrices = {
    'AAPL': 175,
    'TSLA': 245,
    'GOOGL': 140,
    'MSFT': 410,
    'AMZN': 175,
    'META': 490,
    'NVDA': 870
  };
  
  const base = basePrices[symbol] || 100;
  const data = [];
  const now = new Date();
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // 生成随机波动
    const randomFactor = 1 + (Math.random() - 0.5) * 0.1;
    const trend = 1 + (days - i) * 0.002; // 轻微上涨趋势
    
    let value;
    if (metric === 'price') {
      value = base * randomFactor * trend;
    } else if (metric === 'pe_ratio') {
      value = 25 + Math.random() * 20;
    } else if (metric === 'market_cap') {
      value = base * 1e9 * randomFactor * trend;
    } else {
      value = base * randomFactor;
    }
    
    data.push({
      date: date.toISOString().split('T')[0],
      value: parseFloat(value.toFixed(2))
    });
  }
  
  return data;
}

async function callTinyFish(url, goal, timeout = 60000) {
  const apiKey = process.env.TINYFISH_API_KEY || "sk-tinyfish-jrNPRJUhx20YD6Ozc5sRefmtsdC1MPMu";
  
  console.log('=== TinyFish API Call ===');
  console.log('URL:', url);
  console.log('Goal:', goal.substring(0, 100) + '...');

  if (!apiKey) {
    throw new Error("TINYFISH_API_KEY not configured");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log('⏰ Timeout');
    controller.abort();
  }, timeout);

  try {
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

    const text = await response.text();
    console.log('Response length:', text.length);

    if (!response.ok) {
      console.error('API error:', response.status, text.substring(0, 300));
      throw new Error(`TinyFish API error ${response.status}`);
    }

    if (text.trim().startsWith('<')) {
      throw new Error('Received HTML instead of JSON');
    }

    const result = JSON.parse(text);
    console.log('✅ Success');
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('❌ Error:', error.message);
    if (error.name === 'AbortError') {
      throw new Error(`Timeout after ${timeout}ms`);
    }
    throw error;
  }
}

// 使用 TinyFish 快速获取股票新闻
async function fetchStockNews(symbol) {
  const cacheKey = `news_${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const searchUrl = `https://finance.yahoo.com/quote/${symbol}/news`;
  const goal = `Get 5 latest news headlines for ${symbol} stock. Return JSON array: [{"headline":"title","source":"source","date":"YYYY-MM-DD","summary":"brief"}]`;
  
  try {
    console.log(`\n📰 Fetching news for ${symbol}...`);
    const result = await callTinyFish(searchUrl, goal, 60000);
    
    const news = result.output?.data || result.data || result.output || [];
    console.log('News count:', Array.isArray(news) ? news.length : 0);
    
    const newsData = {
      news: Array.isArray(news) ? news.slice(0, 5) : [],
      analyst_ratings: [],
      consensus: null
    };
    
    cache.set(cacheKey, { data: newsData, timestamp: Date.now() });
    return newsData;
  } catch (error) {
    console.error('News fetch error:', error.message);
    return { news: [], analyst_ratings: [], consensus: null };
  }
}

// 获取股票实时数据（使用缓存的模拟数据 + TinyFish 新闻）
async function fetchStockPosition(symbol) {
  const cacheKey = `position_${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('Cache hit:', cacheKey);
    return cached.data;
  }

  try {
    console.log(`\n💰 Fetching position for ${symbol}...`);
    
    // 优先使用模拟数据（快速、可靠）
    let data = STOCK_DATA[symbol.toUpperCase()];
    
    if (!data) {
      // 对于不在列表中的股票，使用通用模板
      data = {
        symbol: symbol.toUpperCase(),
        company_name: `${symbol.toUpperCase()} Corporation`,
        current_price: 100 + Math.random() * 100,
        price_change: (Math.random() - 0.5) * 10,
        price_change_percent: (Math.random() - 0.5) * 5,
        market_cap: `${(Math.random() * 500).toFixed(1)}B`,
        pe_ratio: 15 + Math.random() * 30,
        eps: 2 + Math.random() * 8,
        dividend_yield: `${(Math.random() * 3).toFixed(2)}%`,
        volume: Math.floor(Math.random() * 100000000),
        avg_volume: Math.floor(Math.random() * 100000000),
        open: 100 + Math.random() * 100,
        high: 100 + Math.random() * 100,
        low: 100 + Math.random() * 100,
        previous_close: 100 + Math.random() * 100,
        fifty_two_week_high: 150 + Math.random() * 100,
        fifty_two_week_low: 80 + Math.random() * 50,
        beta: 0.8 + Math.random() * 1.5,
        sector: 'Technology',
        industry: 'Software'
      };
    }
    
    // 添加一个小标记，说明数据来源
    data._source = 'Demo Data (TinyFish for news only)';
    
    console.log('✅ Position data ready');
    cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    console.error('Position fetch error:', error.message);
    return null;
  }
}

// 获取历史数据（模拟数据）
async function fetchStockHistory(symbol, metric = 'price', period = '1y') {
  console.log(`\n📈 Fetching history for ${symbol}, metric: ${metric}`);
  return generateHistoryData(symbol, metric, 30);
}

// 搜索股票
async function searchStocks(query) {
  console.log(`\n🔍 Searching for: ${query}`);
  
  const results = [];
  const queryUpper = query.toUpperCase();
  
  // 在模拟数据中搜索
  for (const [symbol, data] of Object.entries(STOCK_DATA)) {
    if (symbol.includes(queryUpper) || data.company_name.toUpperCase().includes(queryUpper)) {
      results.push({
        symbol: data.symbol,
        company_name: data.company_name,
        exchange: 'NASDAQ',
        sector: data.sector,
        market_cap: data.market_cap
      });
    }
  }
  
  console.log('Search results:', results.length);
  return results;
}

export default async function handler(req, res) {
  const { method, url } = req;
  const urlObj = new URL(`http://localhost${url || '/'}`);
  const pathname = urlObj.pathname;
  
  console.log('\n=== API Request ===');
  console.log('Method:', method);
  console.log('Path:', pathname);

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
      version: '3.0.0',
      time: new Date().toISOString(),
      tinyfish_configured: !!process.env.TINYFISH_API_KEY,
      demo_stocks: Object.keys(STOCK_DATA)
    });
    return;
  }

  // 搜索股票
  if (pathname === '/api/search' && method === 'GET') {
    const query = urlObj.searchParams.get('q');
    
    if (!query) {
      res.status(400).json({ error: '搜索关键词不能为空' });
      return;
    }

    try {
      const results = await searchStocks(query);
      res.status(200).json({
        query,
        results,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
    return;
  }

  // 获取股票实时持仓数据
  if (pathname.match(/^\/api\/stock\/[A-Za-z0-9]+\/position$/)) {
    const symbol = pathname.split('/')[3];
    
    try {
      const position = await fetchStockPosition(symbol.toUpperCase());
      
      if (!position) {
        res.status(404).json({ error: '未找到该股票数据', symbol });
        return;
      }

      res.status(200).json({
        symbol: symbol.toUpperCase(),
        data: position,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
    return;
  }

  // 获取股票历史数据
  if (pathname.match(/^\/api\/stock\/[A-Za-z0-9]+\/history\/[A-Za-z_]+$/)) {
    const parts = pathname.split('/');
    const symbol = parts[3];
    const metric = parts[5] || 'price';

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
      res.status(500).json({ error: error.message });
    }
    return;
  }

  // 获取股票新闻
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
      res.status(500).json({ error: error.message });
    }
    return;
  }

  // 默认响应
  if (pathname === '/' || pathname === '/api') {
    res.status(200).json({
      name: 'Stock Real-time Position & Trend Analysis API',
      version: '3.0.0',
      description: '基于 TinyFish API 的股票实时持仓和趋势分析服务（演示版）',
      features: [
        '使用 TinyFish API 获取实时新闻',
        '快速获取股票价格和指标',
        '历史趋势图表',
        '支持 7 个热门股票 + 任意股票代码'
      ],
      demo_stocks: Object.keys(STOCK_DATA),
      endpoints: [
        { method: 'GET', path: '/api/health', description: 'Health check' },
        { method: 'GET', path: '/api/search?q=:query', description: '搜索股票' },
        { method: 'GET', path: '/api/stock/:symbol/position', description: '获取股票实时持仓数据' },
        { method: 'GET', path: '/api/stock/:symbol/history/:metric', description: '获取股票历史指标数据' },
        { method: 'GET', path: '/api/stock/:symbol/news', description: '获取股票新闻（使用 TinyFish）' }
      ]
    });
    return;
  }

  res.status(404).json({ error: 'Not found', path: pathname });
}
