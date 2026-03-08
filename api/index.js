// Stock App API - 股票实时持仓和趋势分析
// 使用 TinyFish API 调用权威财经数据源

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟缓存

// 数据源 URL
const DATA_SOURCES = {
  nasdaqNews: "https://www.nasdaq.com/news-and-insights/news",
  nasdaqMarket: "https://www.nasdaq.com/market-activity/news",
  bloomberg: "https://www.bloomberg.com/quote/IXIC:IND",
  reuters: "https://www.reuters.com/markets/us/nasdaq-composite",
  marketwatch: "https://www.marketwatch.com/investing/index/ixic"
};

async function callTinyFish(url, instructions, timeout = 60000) {
  const apiKey = process.env.TINYFISH_API_KEY || "sk-tinyfish-jrNPRJUhx20YD6Ozc5sRefmtsdC1MPMu";
  const apiUrl = process.env.TINYFISH_API_URL || "https://agent.tinyfish.ai/v1";

  if (!apiKey) {
    throw new Error("TINYFISH_API_KEY not configured");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    console.log(`Calling TinyFish API: ${url.substring(0, 80)}...`);
    
    const response = await fetch(`${apiUrl}/automation/run`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ 
        url: url,
        goal: instructions
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`TinyFish API error ${response.status}:`, errorText);
      throw new Error(`TinyFish API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`TinyFish API success`);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`TinyFish call error:`, error.message);
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
    return cached.data;
  }

  const searchUrl = `https://www.google.com/search?q=${symbol}+stock+price+market+cap+pe+ratio+dividend+yield`;
  
  const instructions = `Extract real-time stock data for ${symbol}.

Return as JSON object with these exact fields:
- symbol: stock ticker symbol
- company_name: full company name
- current_price: current stock price in USD
- price_change: price change amount
- price_change_percent: price change percentage
- market_cap: market capitalization
- pe_ratio: P/E ratio
- eps: earnings per share
- dividend_yield: dividend yield percentage
- volume: trading volume
- avg_volume: average trading volume
- open: opening price
- high: today's high
- low: today's low
- previous_close: previous closing price
- fifty_two_week_high: 52-week high
- fifty_two_week_low: 52-week low
- beta: beta coefficient
- sector: industry sector
- industry: specific industry

If any field is unavailable, use null. Return only the JSON object.`;

  try {
    const result = await callTinyFish(searchUrl, instructions, 45000);
    const data = result.data || result || {};
    cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    console.error(`Stock position fetch error:`, error.message);
    return null;
  }
}

// 获取股票历史指标数据
async function fetchStockHistory(symbol, metric = 'price', period = '1y') {
  const cacheKey = `history_${symbol}_${metric}_${period}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL * 10) {
    return cached.data;
  }

  const searchUrl = `https://www.google.com/search?q=${symbol}+stock+historical+${metric}+chart+${period}`;
  
  const instructions = `Extract historical ${metric} data for ${symbol} over the past ${period}.

Return as JSON array of objects with these fields:
- date: date in YYYY-MM-DD format
- value: numerical value of the metric
- volume: trading volume (if applicable)

Provide at least 12 data points for trend analysis. Return only the JSON array.`;

  try {
    const result = await callTinyFish(searchUrl, instructions, 45000);
    const data = result.data || result || [];
    cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    console.error(`Stock history fetch error:`, error.message);
    return [];
  }
}

// 获取多个指标的历史数据
async function fetchMultipleMetrics(symbol) {
  const metrics = ['price', 'pe_ratio', 'market_cap', 'revenue', 'net_income'];
  const results = {};
  
  for (const metric of metrics) {
    try {
      const history = await fetchStockHistory(symbol, metric, '1y');
      results[metric] = history;
    } catch (error) {
      results[metric] = [];
    }
  }
  
  return results;
}

// 获取股票新闻和分析师评级
async function fetchStockNews(symbol) {
  const searchUrl = `https://www.google.com/search?q=${symbol}+stock+news+analyst+rating+target+price`;
  
  const instructions = `Extract stock news and analyst ratings for ${symbol}.

Return as JSON object with:
- news: array of recent news articles with headline, source, date, summary
- analyst_ratings: array of analyst ratings with firm, rating, target_price, date
- consensus: { rating: "Buy/Hold/Sell", target_price: number }

Return the JSON object.`;

  try {
    const result = await callTinyFish(searchUrl, instructions, 45000);
    return result.data || result || { news: [], analyst_ratings: [], consensus: null };
  } catch (error) {
    console.error(`Stock news fetch error:`, error.message);
    return { news: [], analyst_ratings: [], consensus: null };
  }
}

export default async function handler(req, res) {
  const { method, url } = req;
  const path = url || '/';

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Health check
  if (path === '/api/health') {
    res.status(200).json({
      status: 'healthy',
      version: '1.0.0',
      time: new Date().toISOString(),
      data_sources: Object.keys(DATA_SOURCES)
    });
    return;
  }

  // 获取股票实时持仓数据 - GET /api/stock/:symbol/position
  if (path.match(/^\/api\/stock\/[A-Za-z0-9]+\/position$/)) {
    const symbol = path.split('/')[3];
    
    if (!symbol) {
      res.status(400).json({ error: '股票代码不能为空' });
      return;
    }

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
      res.status(500).json({ error: error.message });
    }
    return;
  }

  // 获取股票历史数据 - GET /api/stock/:symbol/history/:metric
  if (path.match(/^\/api\/stock\/[A-Za-z0-9]+\/history\/[A-Za-z_]+$/)) {
    const parts = path.split('/');
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

  // 获取股票多个指标历史数据 - GET /api/stock/:symbol/metrics
  if (path.match(/^\/api\/stock\/[A-Za-z0-9]+\/metrics$/)) {
    const symbol = path.split('/')[3];

    try {
      const metrics = await fetchMultipleMetrics(symbol.toUpperCase());
      
      res.status(200).json({
        symbol: symbol.toUpperCase(),
        data: metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
    return;
  }

  // 获取股票新闻和评级 - GET /api/stock/:symbol/news
  if (path.match(/^\/api\/stock\/[A-Za-z0-9]+\/news$/)) {
    const symbol = path.split('/')[3];

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

  // 搜索股票 - GET /api/search?q=:query
  if (path === '/api/search' && method === 'GET') {
    const query = new URL(`http://localhost${path}`).searchParams.get('q');
    
    if (!query) {
      res.status(400).json({ error: '搜索关键词不能为空' });
      return;
    }

    const searchUrl = `https://www.google.com/search?q=${query}+stock+ticker+symbol+company`;
    
    const instructions = `Find stock ticker symbols and company information for "${query}".

Return as JSON array with:
- symbol: stock ticker symbol
- company_name: full company name
- exchange: stock exchange (NASDAQ, NYSE, etc.)
- sector: industry sector
- market_cap: market capitalization (if available)

Return up to 10 results. Return only the JSON array.`;

    try {
      const result = await callTinyFish(searchUrl, instructions, 45000);
      const results = result.data || result || [];
      
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

  // 默认响应
  if (path === '/' || path === '/api') {
    res.status(200).json({
      name: 'Stock Real-time Position & Trend Analysis API',
      version: '1.0.0',
      description: '基于 TinyFish API 的股票实时持仓和趋势分析服务',
      data_sources: [
        { name: 'Nasdaq Official', url: DATA_SOURCES.nasdaqNews },
        { name: 'Bloomberg', url: DATA_SOURCES.bloomberg },
        { name: 'Reuters', url: DATA_SOURCES.reuters },
        { name: 'MarketWatch', url: DATA_SOURCES.marketwatch }
      ],
      endpoints: [
        { method: 'GET', path: '/api/health', description: 'Health check' },
        { method: 'GET', path: '/api/search?q=:query', description: '搜索股票' },
        { method: 'GET', path: '/api/stock/:symbol/position', description: '获取股票实时持仓数据' },
        { method: 'GET', path: '/api/stock/:symbol/history/:metric', description: '获取股票历史指标数据' },
        { method: 'GET', path: '/api/stock/:symbol/metrics', description: '获取多个指标历史数据' },
        { method: 'GET', path: '/api/stock/:symbol/news', description: '获取股票新闻和分析师评级' }
      ]
    });
    return;
  }

  res.status(404).json({ error: 'Not found', path });
}
