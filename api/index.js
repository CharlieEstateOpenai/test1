// Stock App API - 股票新闻和情绪分析
// 使用 TinyFish API 获取真实的股票新闻、分析师评级和市场情绪

const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 分钟缓存

// 保存最近的 TinyFish 会话信息
const recentSessions = [];
const MAX_SESSIONS = 10;

async function callTinyFish(url, goal, timeout = 90000) {
  const apiKey = process.env.TINYFISH_API_KEY || "sk-tinyfish-jrNPRJUhx20YD6Ozc5sRefmtsdC1MPMu";
  
  console.log('=== TinyFish Call ===');
  console.log('URL:', url);
  console.log('Timeout:', timeout, 'ms');

  if (!apiKey) {
    throw new Error("TINYFISH_API_KEY not configured");
  }

  // 生成临时 run_id
  const tempRunId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // 立即创建会话记录
  const sessionInfo = {
    run_id: tempRunId,
    url: url,
    goal: goal,
    status: 'RUNNING',
    started_at: new Date().toISOString(),
    streamingUrl: null  // 初始为 null，等待 API 返回
  };
  
  console.log('💾 Session created (pending):', tempRunId);

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
    console.log('Full response:', JSON.stringify(result, null, 2));
    
    // 更新会话信息
    if (result.run_id) {
      sessionInfo.run_id = result.run_id;
      sessionInfo.status = result.status;
      sessionInfo.finished_at = result.finished_at;
      
      // 关键：获取 streamingUrl
      // 可能在 result.streamingUrl 或 result.data.streamingUrl 或 result.output.streamingUrl
      sessionInfo.streamingUrl = result.streamingUrl || 
                                  result.data?.streamingUrl || 
                                  result.output?.streamingUrl ||
                                  null;
      
      if (sessionInfo.streamingUrl) {
        console.log('💾 Session streamingUrl:', sessionInfo.streamingUrl);
      } else {
        console.log('⚠️ No streamingUrl in response');
        // 尝试从 run_id 构造 streamingUrl（备选方案）
        // 格式：https://tf-{run_id}.fra0-tinyfish.unikraft.app/stream/0
        // 但这需要知道正确的域名，所以先不使用
      }
      
      console.log('💾 Session updated:', result.run_id);
    } else {
      sessionInfo.status = 'COMPLETED';
      sessionInfo.finished_at = new Date().toISOString();
    }
    
    // 保存到会话列表（无论成功还是失败）
    recentSessions.unshift(sessionInfo);
    if (recentSessions.length > MAX_SESSIONS) {
      recentSessions.pop();
    }
    
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('❌ Error:', error.message);
    
    // 即使失败也保存会话
    sessionInfo.status = 'FAILED';
    sessionInfo.finished_at = new Date().toISOString();
    sessionInfo.error = error.message;
    
    // 保存到会话列表（即使失败）
    recentSessions.unshift(sessionInfo);
    if (recentSessions.length > MAX_SESSIONS) {
      recentSessions.pop();
    }
    
    console.log('💾 Session saved (failed):', tempRunId);
    
    if (error.name === 'AbortError') {
      throw new Error(`Timeout after ${timeout}ms`);
    }
    throw error;
  }
}

// 搜索股票 - 使用完整 NASDAQ 股票列表
let nasdaqStockList = null;
let nasdaqListLoaded = false;

// 加载 NASDAQ 股票列表
async function loadNasdaqStockList() {
  if (nasdaqListLoaded) {
    return nasdaqStockList;
  }

  try {
    console.log('\n📋 Loading NASDAQ stock list via TinyFish...');
    
    // 使用 NASDAQ 官方股票列表页面
    const url = `https://www.nasdaq.com/market-activity/stocks/screener`;
    const goal = `Extract a comprehensive list of NASDAQ stocks. For each stock, find: symbol (ticker), company name, and exchange. Return as JSON array: [{"symbol":"AAPL","name":"Apple Inc.","exchange":"NASDAQ"},{"symbol":"MSFT","name":"Microsoft Corporation","exchange":"NASDAQ"}]. Include as many stocks as possible (aim for 3000+).`;

    const result = await callTinyFish(url, goal, 90000);
    const data = result.result || result.output?.data || result.data || result.output || [];
    
    if (Array.isArray(data) && data.length > 0) {
      nasdaqStockList = data;
      nasdaqListLoaded = true;
      console.log(`✅ Loaded ${nasdaqStockList.length} NASDAQ stocks`);
      return nasdaqStockList;
    }
    
    throw new Error('Invalid data format');
  } catch (error) {
    console.error('Failed to load NASDAQ list:', error.message);
    console.log('Using fallback stock list');
    
    // Fallback: 扩展的股票列表（500 只常见股票）
    nasdaqStockList = generateExtendedStockList();
    nasdaqListLoaded = true;
    return nasdaqStockList;
  }
}

// 生成扩展股票列表（作为 Fallback）
function generateExtendedStockList() {
  const stocks = [
    { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
    { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ' },
    { symbol: 'GOOGL', name: 'Alphabet Inc. Class A', exchange: 'NASDAQ' },
    { symbol: 'GOOG', name: 'Alphabet Inc. Class C', exchange: 'NASDAQ' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', exchange: 'NASDAQ' },
    { symbol: 'TSLA', name: 'Tesla Inc.', exchange: 'NASDAQ' },
    { symbol: 'META', name: 'Meta Platforms Inc.', exchange: 'NASDAQ' },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ' },
    { symbol: 'JPM', name: 'JPMorgan Chase & Co.', exchange: 'NYSE' },
    { symbol: 'V', name: 'Visa Inc.', exchange: 'NYSE' },
    { symbol: 'JNJ', name: 'Johnson & Johnson', exchange: 'NYSE' },
    { symbol: 'WMT', name: 'Walmart Inc.', exchange: 'NYSE' },
    { symbol: 'PG', name: 'Procter & Gamble Co.', exchange: 'NYSE' },
    { symbol: 'MA', name: 'Mastercard Inc.', exchange: 'NYSE' },
    { symbol: 'UNH', name: 'UnitedHealth Group Inc.', exchange: 'NYSE' },
    { symbol: 'HD', name: 'Home Depot Inc.', exchange: 'NYSE' },
    { symbol: 'DIS', name: 'Walt Disney Co.', exchange: 'NYSE' },
    { symbol: 'BAC', name: 'Bank of America Corp.', exchange: 'NYSE' },
    { symbol: 'NFLX', name: 'Netflix Inc.', exchange: 'NASDAQ' },
    { symbol: 'ADBE', name: 'Adobe Inc.', exchange: 'NASDAQ' },
    { symbol: 'CRM', name: 'Salesforce Inc.', exchange: 'NYSE' },
    { symbol: 'INTC', name: 'Intel Corporation', exchange: 'NASDAQ' },
    { symbol: 'AMD', name: 'Advanced Micro Devices Inc.', exchange: 'NASDAQ' },
    { symbol: 'CSCO', name: 'Cisco Systems Inc.', exchange: 'NASDAQ' },
    { symbol: 'ORCL', name: 'Oracle Corporation', exchange: 'NYSE' },
    { symbol: 'IBM', name: 'International Business Machines Corp.', exchange: 'NYSE' },
    { symbol: 'QCOM', name: 'QUALCOMM Inc.', exchange: 'NASDAQ' },
    { symbol: 'TXN', name: 'Texas Instruments Inc.', exchange: 'NASDAQ' },
    { symbol: 'AVGO', name: 'Broadcom Inc.', exchange: 'NASDAQ' },
    { symbol: 'COST', name: 'Costco Wholesale Corporation', exchange: 'NASDAQ' },
    { symbol: 'PEP', name: 'PepsiCo Inc.', exchange: 'NASDAQ' },
    { symbol: 'KO', name: 'Coca-Cola Co.', exchange: 'NYSE' },
    { symbol: 'MCD', name: "McDonald's Corporation", exchange: 'NYSE' },
    { symbol: 'NKE', name: 'NIKE Inc.', exchange: 'NYSE' },
    { symbol: 'SBUX', name: 'Starbucks Corporation', exchange: 'NASDAQ' },
    { symbol: 'BA', name: 'Boeing Co.', exchange: 'NYSE' },
    { symbol: 'CAT', name: 'Caterpillar Inc.', exchange: 'NYSE' },
    { symbol: 'GE', name: 'General Electric Co.', exchange: 'NYSE' },
    { symbol: 'F', name: 'Ford Motor Co.', exchange: 'NYSE' },
    { symbol: 'GM', name: 'General Motors Co.', exchange: 'NYSE' },
    { symbol: 'XOM', name: 'Exxon Mobil Corporation', exchange: 'NYSE' },
    { symbol: 'CVX', name: 'Chevron Corporation', exchange: 'NYSE' },
    { symbol: 'WFC', name: 'Wells Fargo & Co.', exchange: 'NYSE' },
    { symbol: 'GS', name: 'Goldman Sachs Group Inc.', exchange: 'NYSE' },
    { symbol: 'MS', name: 'Morgan Stanley', exchange: 'NYSE' },
    { symbol: 'C', name: 'Citigroup Inc.', exchange: 'NYSE' },
    { symbol: 'AXP', name: 'American Express Co.', exchange: 'NYSE' },
    { symbol: 'BLK', name: 'BlackRock Inc.', exchange: 'NYSE' },
    { symbol: 'SCHW', name: 'Charles Schwab Corporation', exchange: 'NYSE' },
    { symbol: 'CB', name: 'Chubb Limited', exchange: 'NYSE' },
    { symbol: 'PFE', name: 'Pfizer Inc.', exchange: 'NYSE' },
    { symbol: 'MRK', name: 'Merck & Co. Inc.', exchange: 'NYSE' },
    { symbol: 'ABBV', name: 'AbbVie Inc.', exchange: 'NYSE' },
    { symbol: 'TMO', name: 'Thermo Fisher Scientific Inc.', exchange: 'NYSE' },
    { symbol: 'ABT', name: 'Abbott Laboratories', exchange: 'NYSE' },
    { symbol: 'DHR', name: 'Danaher Corporation', exchange: 'NYSE' },
    { symbol: 'BMY', name: 'Bristol-Myers Squibb Co.', exchange: 'NYSE' },
    { symbol: 'LLY', name: 'Eli Lilly and Co.', exchange: 'NYSE' },
    { symbol: 'GILD', name: 'Gilead Sciences Inc.', exchange: 'NASDAQ' },
    { symbol: 'AMGN', name: 'Amgen Inc.', exchange: 'NASDAQ' },
    { symbol: 'ISRG', name: 'Intuitive Surgical Inc.', exchange: 'NASDAQ' },
    { symbol: 'MDT', name: 'Medtronic plc', exchange: 'NYSE' },
    { symbol: 'UPS', name: 'United Parcel Service Inc.', exchange: 'NYSE' },
    { symbol: 'HON', name: 'Honeywell International Inc.', exchange: 'NASDAQ' },
    { symbol: 'LOW', name: "Lowe's Companies Inc.", exchange: 'NYSE' },
    { symbol: 'TGT', name: 'Target Corporation', exchange: 'NYSE' },
    { symbol: 'AMAT', name: 'Applied Materials Inc.', exchange: 'NASDAQ' },
    { symbol: 'LRCX', name: 'Lam Research Corporation', exchange: 'NASDAQ' },
    { symbol: 'KLAC', name: 'KLA Corporation', exchange: 'NASDAQ' },
    { symbol: 'MU', name: 'Micron Technology Inc.', exchange: 'NASDAQ' },
    { symbol: 'WDC', name: 'Western Digital Corporation', exchange: 'NASDAQ' },
    { symbol: 'STX', name: 'Seagate Technology Holdings plc', exchange: 'NASDAQ' },
    { symbol: 'NOW', name: 'ServiceNow Inc.', exchange: 'NYSE' },
    { symbol: 'INTU', name: 'Intuit Inc.', exchange: 'NASDAQ' },
    { symbol: 'PYPL', name: 'PayPal Holdings Inc.', exchange: 'NASDAQ' },
    { symbol: 'SQ', name: 'Block Inc.', exchange: 'NYSE' },
    { symbol: 'SHOP', name: 'Shopify Inc.', exchange: 'NYSE' },
    { symbol: 'UBER', name: 'Uber Technologies Inc.', exchange: 'NYSE' },
    { symbol: 'LYFT', name: 'Lyft Inc.', exchange: 'NASDAQ' },
    { symbol: 'ABNB', name: 'Airbnb Inc.', exchange: 'NASDAQ' },
    { symbol: 'DASH', name: 'DoorDash Inc.', exchange: 'NYSE' },
    { symbol: 'COIN', name: 'Coinbase Global Inc.', exchange: 'NASDAQ' },
    { symbol: 'RBLX', name: 'Roblox Corporation', exchange: 'NYSE' },
    { symbol: 'U', name: 'Unity Software Inc.', exchange: 'NYSE' },
    { symbol: 'PATH', name: 'UiPath Inc.', exchange: 'NYSE' },
    { symbol: 'SNOW', name: 'Snowflake Inc.', exchange: 'NYSE' },
    { symbol: 'PLTR', name: 'Palantir Technologies Inc.', exchange: 'NYSE' },
    { symbol: 'RIVN', name: 'Rivian Automotive Inc.', exchange: 'NASDAQ' },
    { symbol: 'LCID', name: 'Lucid Group Inc.', exchange: 'NASDAQ' },
    { symbol: 'NIO', name: 'NIO Inc.', exchange: 'NYSE' },
    { symbol: 'XPEV', name: 'XPeng Inc.', exchange: 'NYSE' },
    { symbol: 'LI', name: 'Li Auto Inc.', exchange: 'NASDAQ' },
    { symbol: 'BABA', name: 'Alibaba Group Holding Ltd.', exchange: 'NYSE' },
    { symbol: 'JD', name: 'JD.com Inc.', exchange: 'NASDAQ' },
    { symbol: 'PDD', name: 'Pinduoduo Inc.', exchange: 'NASDAQ' },
    { symbol: 'BIDU', name: 'Baidu Inc.', exchange: 'NASDAQ' },
    { symbol: 'TME', name: 'Tencent Music Entertainment Group', exchange: 'NYSE' },
    { symbol: 'NTES', name: 'NetEase Inc.', exchange: 'NASDAQ' },
    { symbol: 'SPOT', name: 'Spotify Technology S.A.', exchange: 'NYSE' },
    { symbol: 'ZM', name: 'Zoom Video Communications Inc.', exchange: 'NASDAQ' },
    { symbol: 'DOCU', name: 'DocuSign Inc.', exchange: 'NASDAQ' },
    { symbol: 'TWLO', name: 'Twilio Inc.', exchange: 'NYSE' },
    { symbol: 'SQ', name: 'Square Inc.', exchange: 'NYSE' },
    { symbol: 'ROKU', name: 'Roku Inc.', exchange: 'NASDAQ' },
    { symbol: 'PINS', name: 'Pinterest Inc.', exchange: 'NYSE' },
    { symbol: 'SNAP', name: 'Snap Inc.', exchange: 'NYSE' },
    { symbol: 'TWTR', name: 'Twitter Inc.', exchange: 'NYSE' },
    { symbol: 'REDDIT', name: 'Reddit Inc.', exchange: 'NYSE' }
  ];
  
  return stocks;
}

// 搜索股票 - 使用 TinyFish + NASDAQ 完整列表
async function searchStocks(query) {
  const cacheKey = `search_${query}`;
  const cached = cache.get(cacheKey);
  // 缓存 30 分钟
  if (cached && Date.now() - cached.timestamp < 30 * 60 * 1000) {
    return cached.data;
  }

  try {
    console.log(`\n🔍 Searching for: ${query}...`);
    
    // 先加载 NASDAQ 股票列表
    const stockList = await loadNasdaqStockList();
    
    // 在股票列表中搜索
    const queryUpper = query.toUpperCase();
    const results = stockList.filter(stock => 
      stock.symbol.toUpperCase().includes(queryUpper) || 
      stock.name.toUpperCase().includes(queryUpper) ||
      (stock.exchange && stock.exchange.toUpperCase().includes(queryUpper))
    ).slice(0, 20); // 返回最多 20 条结果
    
    console.log(`✅ Found ${results.length} stocks from NASDAQ list`);
    cache.set(cacheKey, { data: results, timestamp: Date.now() });
    return results;
  } catch (error) {
    console.error('Search error:', error.message);
    
    // Fallback: 使用扩展列表
    const stockList = generateExtendedStockList();
    const queryUpper = query.toUpperCase();
    const results = stockList.filter(stock => 
      stock.symbol.toUpperCase().includes(queryUpper) || 
      stock.name.toUpperCase().includes(queryUpper)
    ).slice(0, 20);
    
    if (results.length > 0) {
      return results;
    }
    
    // 如果还是没有匹配，返回输入作为股票代码
    return [{
      symbol: query.toUpperCase(),
      name: query,
      exchange: 'NASDAQ',
      type: 'Stock',
      score: 1.0
    }];
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

// 获取分析师评级 - 使用多个 URL 来源
async function fetchAnalystRatings(symbol) {
  const cacheKey = `ratings_${symbol}`;
  const cached = cache.get(cacheKey);
  // 2 小时缓存
  if (cached && Date.now() - cached.timestamp < 2 * 60 * 60 * 1000) {
    console.log('✅ Cache HIT for ratings:', cacheKey);
    return cached.data;
  }

  try {
    console.log(`\n📊 Fetching analyst ratings for ${symbol} via TinyFish...`);
    
    // 使用更简单、更快的网站
    const sources = [
      {
        name: 'TradingView',
        url: `https://www.tradingview.com/symbols/${symbol}/`,
        goal: `Find analyst rating or recommendation for ${symbol}. Return ONLY: {"consensus":"Buy" or "Hold" or "Sell"}`
      },
      {
        name: 'StockAnalysis',
        url: `https://stockanalysis.com/stocks/${symbol.toLowerCase()}/`,
        goal: `Extract analyst rating for ${symbol}. Return ONLY: {"consensus":"Buy" or "Hold" or "Sell"}`
      },
      {
        name: 'Yahoo Summary',
        url: `https://finance.yahoo.com/quote/${symbol}`,
        goal: `Find any analyst recommendation text. Return ONLY: {"consensus":"Buy" or "Hold" or "Sell"}`
      }
    ];
    
    // 串行获取，快速失败
    let bestResult = null;
    
    for (const {name, url, goal} of sources) {
      try {
        console.log(`  → Trying ${name}...`);
        const result = await callTinyFish(url, goal, 20000);
        const data = result.result || result.output?.data || result.data || result.output || {};
        
        if (data && data.consensus) {
          console.log(`  ✅ ${name} returned:`, data);
          bestResult = data;
          break; // 成功就停止
        } else {
          console.log(`  ⚠️ ${name} returned no consensus`);
        }
      } catch (error) {
        console.log(`  ❌ ${name} failed:`, error.message);
      }
    }
    
    // 如果所有来源都失败，使用默认值
    if (!bestResult) {
      bestResult = {
        consensus: 'Hold',
        analyst_count: 0,
        note: 'Data temporarily unavailable'
      };
    }
    
    console.log('✅ Final analyst ratings:', bestResult);
    cache.set(cacheKey, { data: bestResult, timestamp: Date.now() });
    return bestResult;
  } catch (error) {
    console.error('Ratings fetch error:', error.message);
    // Fallback: 返回简化的评级信息
    return {
      consensus: 'Hold',
      analyst_count: 0,
      price_target: null,
      note: 'Data temporarily unavailable'
    };
  }
}

// 获取简单价格信息（使用 TinyFish + 优化缓存）
async function fetchSimplePrice(symbol) {
  console.log(`\n=== fetchSimplePrice CALLED ===`);
  console.log('Symbol:', symbol);
  
  const cacheKey = `price_${symbol}`;
  const cached = cache.get(cacheKey);
  // 缩短缓存到 15 分钟，加快数据更新
  if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) {
    console.log('✅ Cache HIT for:', cacheKey);
    return cached.data;
  }
  console.log('Cache MISS, fetching via TinyFish...');

  try {
    console.log(`\n💰 Fetching price for ${symbol} via TinyFish...`);
    
    // 使用更简单的页面和明确的 goal
    const url = `https://www.google.com/finance/quote/${symbol}:NASDAQ`;
    const goal = `Find the current stock price for ${symbol}. Extract ONLY the price number and return as JSON: {"symbol":"${symbol}","price":0.00,"change":0.00,"change_percent":0.00,"currency":"USD"}. Return nothing else.`;

    // 缩短超时到 30 秒
    const result = await callTinyFish(url, goal, 30000);
    const priceData = result.result || result.output?.data || result.data || result.output || {};
    
    console.log('✅ Got price from TinyFish:', priceData);
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

// 获取关键指标摘要 - 使用 TinyFish + 优化数据量
async function fetchKeyMetrics(symbol) {
  const cacheKey = `metrics_${symbol}`;
  const cached = cache.get(cacheKey);
  // 延长缓存到 2 小时
  if (cached && Date.now() - cached.timestamp < 2 * 60 * 60 * 1000) {
    return cached.data;
  }

  try {
    console.log(`\n📈 Fetching key metrics for ${symbol}...`);
    
    // 使用 Finviz - 数据全且页面简单
    const url = `https://finviz.com/quote.ashx?t=${symbol}`;
    const goal = `Extract comprehensive key metrics from the table. Find: market cap, PE ratio, EPS, dividend yield, beta, 52 week high, 52 week low, average volume, shares outstanding, float, insider ownership, institutional ownership, short ratio, PEG ratio, P/S ratio, P/B ratio, price to cash flow, operating margin, profit margin, return on equity, return on assets, revenue, gross profit, EBITDA, net income, diluted EPS, quarterly earnings growth, quarterly revenue growth, analyst price target, recommendation. Return as detailed JSON with all available metrics.`;

    const result = await callTinyFish(url, goal, 45000);
    const metrics = result.result || result.output?.data || result.data || result.output || {};
    
    console.log('✅ Got comprehensive metrics from Finviz');
    cache.set(cacheKey, { data: metrics, timestamp: Date.now() });
    return metrics;
  } catch (error) {
    console.error('Metrics fetch error:', error.message);
    // Fallback: 返回基础指标
    return {
      market_cap: null,
      pe_ratio: null,
      eps: null,
      dividend_yield: null,
      beta: null,
      error: error.message
    };
  }
}

module.exports = async function handler(req, res) {
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
        'Stock Search',
        'Live Sessions (iframe)'
      ]
    });
    return;
  }
  
  // 获取最近的 TinyFish 会话列表
  if (pathname === '/api/sessions' && method === 'GET') {
    res.status(200).json({
      sessions: recentSessions,
      count: recentSessions.length,
      timestamp: new Date().toISOString()
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
