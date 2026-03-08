// Stock App API - 股票新闻和情绪分析
// 使用 TinyFish API 获取真实的股票新闻、分析师评级和市场情绪

const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 分钟缓存

async function callTinyFish(url, goal, timeout = 90000) {
  const apiKey = process.env.TINYFISH_API_KEY || "sk-tinyfish-jrNPRJUhx20YD6Ozc5sRefmtsdC1MPMu";
  
  console.log('=== TinyFish Call ===');
  console.log('URL:', url);
  console.log('Timeout:', timeout, 'ms');

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
    console.log('Status:', response.status);

    const text = await response.text();
    
    if (!response.ok) {
      console.error('Error:', response.status, text.substring(0, 300));
      throw new Error(`TinyFish error ${response.status}`);
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

// 搜索股票
async function searchStocks(query) {
  const cacheKey = `search_${query}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    console.log(`\n🔍 Searching for: ${query}...`);
    
    // 使用 Yahoo Finance 自动完成 API
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    const results = data.quotes?.map(quote => ({
      symbol: quote.symbol,
      name: quote.shortname || quote.longname || quote.symbol,
      exchange: quote.exchange,
      type: quote.quoteType,
      score: quote.score
    })) || [];
    
    console.log(`✅ Found ${results.length} stocks`);
    cache.set(cacheKey, { data: results, timestamp: Date.now() });
    return results;
  } catch (error) {
    console.error('Search error:', error.message);
    return [];
  }
}

// 获取公司简介
async function fetchCompanyProfile(symbol) {
  const cacheKey = `profile_${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    console.log(`\n🏢 Fetching company profile for ${symbol}...`);
    
    // 使用 Finviz 公司简介
    const url = `https://finviz.com/quote.ashx?t=${symbol}`;
    const goal = `Extract company information: sector, industry, description, employees, website, headquarter location. Return JSON: {"sector":"sector name","industry":"industry name","description":"company description","employees":00000,"website":"url","headquarters":"location"}`;

    const result = await callTinyFish(url, goal, 90000);
    const profile = result.result || result.output?.data || result.data || result.output || {};
    
    console.log('✅ Got company profile');
    cache.set(cacheKey, { data: profile, timestamp: Date.now() });
    return profile;
  } catch (error) {
    console.error('Profile fetch error:', error.message);
    return {
      sector: null,
      industry: null,
      description: null,
      error: error.message
    };
  }
}

// 获取分析师评级
async function fetchAnalystRatings(symbol) {
  const cacheKey = `ratings_${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    console.log(`\n📊 Fetching analyst ratings for ${symbol}...`);
    
    // 使用 TipRanks - 专业评级网站
    const url = `https://www.tipranks.com/stocks/${symbol.toLowerCase()}/analyst-forecast`;
    const goal = `Extract analyst ratings for ${symbol}. Find: 1. Consensus rating (Strong Buy/Buy/Hold/Sell/Strong Sell), 2. Total number of analysts, 3. Price targets (low, average, high), 4. List of recent ratings from different analysts with their names, firms, ratings, price targets and dates. Return JSON: {"consensus":"Strong Buy/Buy/Hold/Sell/Strong Sell","analyst_count":00,"price_target_low":000,"price_target_average":000,"price_target_high":000,"recent_ratings":[{"analyst":"name","firm":"firm name","rating":"Buy/Hold/Sell","target":000,"date":"date"}]}`;

    const result = await callTinyFish(url, goal, 120000);
    const ratings = result.result || result.output?.data || result.data || result.output || {};
    
    console.log('✅ Got analyst ratings');
    cache.set(cacheKey, { data: ratings, timestamp: Date.now() });
    return ratings;
  } catch (error) {
    console.error('Ratings fetch error:', error.message);
    // 备用：Yahoo Finance
    try {
      const url = `https://finance.yahoo.com/quote/${symbol}/recommendations`;
      const goal = `Extract analyst recommendations. Return JSON: {"consensus":"Buy/Hold/Sell","analyst_count":00,"recent_ratings":[{"firm":"name","rating":"Buy/Hold","date":"date"}]}`;
      const result = await callTinyFish(url, goal, 90000);
      return result.result || { consensus: null, error: error.message };
    } catch (e) {
      return { consensus: null, analyst_count: 0, error: error.message };
    }
  }
}

// 获取简单价格信息（使用 Yahoo Finance - 更快速）
async function fetchSimplePrice(symbol) {
  console.log(`\n=== fetchSimplePrice CALLED ===`);
  console.log('Symbol:', symbol);
  
  const cacheKey = `price_${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('✅ Cache HIT for:', cacheKey);
    return cached.data;
  }
  console.log('Cache MISS, fetching from API...');

  try {
    console.log(`\n💰 Fetching price for ${symbol} from Yahoo Finance...`);
    
    // 使用 Yahoo Finance - 更快速可靠
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1m`;
    const goal = `Extract the current stock price from this Yahoo Finance chart data for ${symbol}.

Look for the most recent price in the chart data and return ONLY this JSON:
{
  "symbol": "${symbol}",
  "price": number (the latest price from chart),
  "change": number (price change from previous close),
  "change_percent": number (percentage change),
  "currency": "USD"
}

Return ONLY the JSON object, nothing else.`;

    console.log('Calling TinyFish with URL:', url);
    const result = await callTinyFish(url, goal, 60000);
    console.log('TinyFish result:', JSON.stringify(result, null, 2));
    
    // TinyFish 返回格式：result.result 或 result.output.data
    const priceData = result.result || result.output?.data || result.data || result.output || {};
    
    console.log('✅ Got price from Yahoo:', priceData);
    cache.set(cacheKey, { data: priceData, timestamp: Date.now() });
    return priceData;
  } catch (error) {
    console.error('Price fetch error:', error.message);
    return {
      symbol: symbol,
      price: null,
      error: error.message
    };
  }
}

// 获取社交媒体情绪 - 使用 Yahoo Finance 评论
async function fetchEarningsData(symbol) {
  const cacheKey = `earnings_${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    console.log(`\n💰 Fetching earnings data for ${symbol}...`);
    
    // 使用 Yahoo Finance 财报数据
    const url = `https://finance.yahoo.com/quote/${symbol}/earnings`;
    const goal = `Extract earnings data: next earnings date, EPS estimate, revenue estimate, recent earnings history. Return JSON: {"next_earnings_date":"date","eps_estimate":0.00,"revenue_estimate":"000B","eps_actual":0.00,"eps_surprise":"00%","last_quarter_revenue":"000B"}`;

    const result = await callTinyFish(url, goal, 90000);
    const earnings = result.result || result.output?.data || result.data || result.output || {};
    
    console.log('✅ Got earnings data');
    cache.set(cacheKey, { data: earnings, timestamp: Date.now() });
    return earnings;
  } catch (error) {
    console.error('Earnings fetch error:', error.message);
    return {
      next_earnings_date: null,
      eps_estimate: null,
      revenue_estimate: null,
      error: error.message
    };
  }
}

// 获取关键指标摘要
async function fetchKeyMetrics(symbol) {
  const cacheKey = `metrics_${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    console.log(`\n📈 Fetching key metrics for ${symbol} from Yahoo...`);
    
    // 使用 Yahoo Finance 关键统计 - 数据最全
    const url = `https://finance.yahoo.com/quote/${symbol}/key-statistics`;
    const goal = `Extract key statistics: market cap, PE ratio, EPS, dividend yield, beta, 52 week high/low. Return JSON: {"market_cap":"000B","pe_ratio":00,"eps":0.00,"dividend_yield":"0.00%","beta":0.00,"52_week_high":000,"52_week_low":000}`;

    const result = await callTinyFish(url, goal, 60000);
    const metrics = result.result || result.output?.data || result.data || result.output || {};
    
    console.log('✅ Got key metrics from Yahoo');
    cache.set(cacheKey, { data: metrics, timestamp: Date.now() });
    return metrics;
  } catch (error) {
    console.error('Metrics fetch error:', error.message);
    // 备用：Macrotrends
    try {
      const url = `https://www.macrotrends.net/stocks/charts/${symbol}/${symbol.toLowerCase()}`;
      const goal = `Extract market cap and PE ratio. Return JSON: {"market_cap":"000B","pe_ratio":00}`;
      const result = await callTinyFish(url, goal, 60000);
      return result.result || { error: error.message };
    } catch (e) {
      return { error: error.message };
    }
  }
}

export default async function handler(req, res) {
  const { method, url } = req;
  const urlObj = new URL(`http://localhost${url || '/'}`);
  const pathname = urlObj.pathname;
  
  console.log('\n=== API Request ===');
  console.log('Method:', method, '| Path:', pathname);

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
      version: '4.0.0',
      time: new Date().toISOString(),
      tinyfish_configured: !!process.env.TINYFISH_API_KEY,
      features: [
        'Stock News (Yahoo Finance)',
        'Analyst Ratings',
        'Simple Price Lookup',
        'Social Media Sentiment (Reddit)',
        'Key Metrics',
        'Stock Search'
      ]
    });
    return;
  }

  // 搜索股票
  if (pathname === '/api/search' && method === 'GET') {
    const query = urlObj.searchParams.get('q');
    
    if (!query) {
      res.status(400).json({ error: 'Search query is required' });
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

  // 获取公司简介
  if (pathname.match(/^\/api\/stock\/[A-Za-z0-9]+\/profile$/)) {
    const symbol = pathname.split('/')[3];

    try {
      const profile = await fetchCompanyProfile(symbol.toUpperCase());
      res.status(200).json({
        symbol: symbol.toUpperCase(),
        data: profile,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
    return;
  }

  // 获取财报数据
  if (pathname.match(/^\/api\/stock\/[A-Za-z0-9]+\/earnings$/)) {
    const symbol = pathname.split('/')[3];

    try {
      const earnings = await fetchEarningsData(symbol.toUpperCase());
      res.status(200).json({
        symbol: symbol.toUpperCase(),
        data: earnings,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
    return;
  }

  // 获取分析师评级
  if (pathname.match(/^\/api\/stock\/[A-Za-z0-9]+\/ratings$/)) {
    const symbol = pathname.split('/')[3];

    try {
      const ratings = await fetchAnalystRatings(symbol.toUpperCase());
      res.status(200).json({
        symbol: symbol.toUpperCase(),
        data: ratings,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
    return;
  }

  // 获取简单价格
  if (pathname.match(/^\/api\/stock\/[A-Za-z0-9]+\/price$/)) {
    const symbol = pathname.split('/')[3];

    try {
      const price = await fetchSimplePrice(symbol.toUpperCase());
      res.status(200).json({
        symbol: symbol.toUpperCase(),
        data: price,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
    return;
  }

  // 获取社交媒体情绪
  if (pathname.match(/^\/api\/stock\/[A-Za-z0-9]+\/sentiment$/)) {
    const symbol = pathname.split('/')[3];

    try {
      const sentiment = await fetchSocialSentiment(symbol.toUpperCase());
      res.status(200).json({
        symbol: symbol.toUpperCase(),
        data: sentiment,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
    return;
  }

  // 获取关键指标
  if (pathname.match(/^\/api\/stock\/[A-Za-z0-9]+\/metrics$/)) {
    const symbol = pathname.split('/')[3];

    try {
      const metrics = await fetchKeyMetrics(symbol.toUpperCase());
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

  // 默认响应
  if (pathname === '/' || pathname === '/api') {
    res.status(200).json({
      name: 'Stock News & Sentiment API',
      version: '4.0.0',
      description: '基于 TinyFish API 的股票新闻、分析师评级和情绪分析服务',
      features: [
        '📰 实时股票新闻（Yahoo Finance）',
        '📊 分析师评级汇总',
        '💰 简单价格查询',
        '💬 社交媒体情绪分析（Reddit）',
        '📈 关键财务指标',
        '🔍 股票搜索'
      ],
      endpoints: [
        { method: 'GET', path: '/api/health', description: 'Health check' },
        { method: 'GET', path: '/api/search?q=:query', description: '搜索股票' },
        { method: 'GET', path: '/api/stock/:symbol/news', description: '获取股票新闻' },
        { method: 'GET', path: '/api/stock/:symbol/ratings', description: '获取分析师评级' },
        { method: 'GET', path: '/api/stock/:symbol/price', description: '获取简单价格' },
        { method: 'GET', path: '/api/stock/:symbol/sentiment', description: '获取社交媒体情绪' },
        { method: 'GET', path: '/api/stock/:symbol/metrics', description: '获取关键指标' }
      ],
      notes: [
        '所有数据来自 TinyFish API 实时抓取',
        '无模拟数据，全部为真实数据',
        '数据延迟取决于 TinyFish 抓取速度',
        '建议缓存结果以提高性能'
      ]
    });
    return;
  }

  res.status(404).json({ error: 'Not found', path: pathname });
}
