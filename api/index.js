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

// 获取股票新闻（多个来源）
async function fetchStockNews(symbol) {
  const cacheKey = `news_${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    console.log(`\n📰 Fetching news for ${symbol}...`);
    
    // 使用 Yahoo Finance 新闻页面
    const url = `https://finance.yahoo.com/quote/${symbol}/news`;
    const goal = `Get 10 latest news headlines for ${symbol} stock from this page.

Return JSON array with:
[
  {
    "headline": "news title",
    "source": "news source name",
    "date": "YYYY-MM-DD or relative time",
    "summary": "1-2 sentence summary",
    "url": "news article URL"
  }
]

Return only the JSON array, nothing else.`;

    const result = await callTinyFish(url, goal, 90000);
    const news = result.output?.data || result.data || result.output || [];
    
    const newsData = {
      news: Array.isArray(news) ? news.slice(0, 10) : [],
      source: 'Yahoo Finance',
      fetched_at: new Date().toISOString()
    };
    
    console.log(`✅ Got ${newsData.news.length} news items`);
    cache.set(cacheKey, { data: newsData, timestamp: Date.now() });
    return newsData;
  } catch (error) {
    console.error('News fetch error:', error.message);
    return {
      news: [],
      source: 'Yahoo Finance',
      error: error.message,
      fetched_at: new Date().toISOString()
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
    
    const url = `https://finance.yahoo.com/quote/${symbol}/analysis`;
    const goal = `Extract analyst ratings and recommendations for ${symbol}.

Find:
1. Consensus rating (Buy/Hold/Sell)
2. Number of analysts
3. Price targets (low, average, high)
4. Recent rating changes from major firms

Return JSON:
{
  "consensus": "Buy/Hold/Sell",
  "analyst_count": number,
  "price_target_low": number,
  "price_target_average": number,
  "price_target_high": number,
  "recent_ratings": [
    {"firm": "firm name", "rating": "Buy/Hold/Sell", "target": number, "date": "date"}
  ]
}`;

    const result = await callTinyFish(url, goal, 90000);
    const ratings = result.output?.data || result.data || result.output || {};
    
    console.log('✅ Got analyst ratings');
    cache.set(cacheKey, { data: ratings, timestamp: Date.now() });
    return ratings;
  } catch (error) {
    console.error('Ratings fetch error:', error.message);
    return {
      consensus: null,
      analyst_count: 0,
      error: error.message
    };
  }
}

// 获取简单价格信息（快速）
async function fetchSimplePrice(symbol) {
  const cacheKey = `price_${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    console.log(`\n💰 Fetching price for ${symbol}...`);
    
    const url = `https://www.google.com/search?q=${symbol}+stock+price`;
    const goal = `Find the current stock price for ${symbol}. Return ONLY JSON: {"symbol":"${symbol}","price":000.00,"change":00.00,"change_percent":0.00}`;

    const result = await callTinyFish(url, goal, 60000);
    const priceData = result.output?.data || result.data || result.output || {};
    
    console.log('✅ Got price:', priceData);
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

// 获取社交媒体情绪（Reddit）
async function fetchSocialSentiment(symbol) {
  const cacheKey = `social_${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    console.log(`\n💬 Fetching social sentiment for ${symbol}...`);
    
    const url = `https://www.reddit.com/search/?q=${symbol}%20stock`;
    const goal = `Find recent discussions about ${symbol} stock on Reddit.

Extract top 5 posts with:
- title
- sentiment (positive/negative/neutral)
- upvotes
- comments_count

Return JSON array:
[
  {
    "title": "post title",
    "sentiment": "positive/negative/neutral",
    "upvotes": number,
    "comments": number,
    "url": "reddit post URL"
  }
]`;

    const result = await callTinyFish(url, goal, 90000);
    const posts = result.output?.data || result.data || result.output || [];
    
    // 计算情绪分数
    let sentimentScore = 0;
    if (Array.isArray(posts)) {
      const sentimentMap = { positive: 1, neutral: 0, negative: -1 };
      const total = posts.reduce((sum, post) => {
        return sum + (sentimentMap[post.sentiment] || 0);
      }, 0);
      sentimentScore = total / posts.length;
    }
    
    const sentimentData = {
      posts: Array.isArray(posts) ? posts.slice(0, 5) : [],
      sentiment_score: sentimentScore,
      sentiment_label: sentimentScore > 0.2 ? 'Positive' : sentimentScore < -0.2 ? 'Negative' : 'Neutral',
      source: 'Reddit'
    };
    
    console.log('✅ Got social sentiment:', sentimentData.sentiment_label);
    cache.set(cacheKey, { data: sentimentData, timestamp: Date.now() });
    return sentimentData;
  } catch (error) {
    console.error('Social sentiment error:', error.message);
    return {
      posts: [],
      sentiment_score: 0,
      sentiment_label: 'Unknown',
      error: error.message
    };
  }
}

// 搜索股票（使用 Google）
async function searchStocks(query) {
  try {
    console.log(`\n🔍 Searching for: ${query}`);
    
    const url = `https://www.google.com/search?q=${query}+stock+ticker`;
    const goal = `Find stock ticker symbols related to "${query}".

Return JSON array:
[
  {
    "symbol": "ticker symbol",
    "company_name": "company name",
    "exchange": "NASDAQ/NYSE/etc"
  }
]

Return up to 10 results.`;

    const result = await callTinyFish(url, goal, 90000);
    const results = result.output?.data || result.data || result.output || [];
    
    console.log('Search results:', Array.isArray(results) ? results.length : 0);
    return Array.isArray(results) ? results : [];
  } catch (error) {
    console.error('Search error:', error.message);
    return [];
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
    console.log(`\n📈 Fetching key metrics for ${symbol}...`);
    
    const url = `https://finance.yahoo.com/quote/${symbol}/key-statistics`;
    const goal = `Extract key statistics for ${symbol}:

Return JSON:
{
  "market_cap": "market cap value",
  "pe_ratio": number,
  "forward_pe": number,
  "eps": number,
  "dividend_yield": "percentage",
  "beta": number,
  "52_week_high": number,
  "52_week_low": number,
  "avg_volume": number
}`;

    const result = await callTinyFish(url, goal, 90000);
    const metrics = result.output?.data || result.data || result.output || {};
    
    console.log('✅ Got key metrics');
    cache.set(cacheKey, { data: metrics, timestamp: Date.now() });
    return metrics;
  } catch (error) {
    console.error('Metrics fetch error:', error.message);
    return {
      error: error.message
    };
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

  // 获取新闻
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
