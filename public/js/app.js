const API_BASE = window.location.origin;
let currentSymbol = null;
let currentCompanyName = null;
let searchTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    
    // Real-time search suggestions
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        clearTimeout(searchTimeout);
        
        if (query.length < 2) {
            hideSearchResults();
            return;
        }
        
        // Debounce search
        searchTimeout = setTimeout(() => {
            fetchSearchSuggestions(query);
        }, 300);
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-section')) {
            hideSearchResults();
        }
    });
    
    // Check URL for symbol parameter
    const urlParams = new URLSearchParams(window.location.search);
    const symbolFromUrl = urlParams.get('symbol');
    if (symbolFromUrl) {
        searchInput.value = symbolFromUrl;
        loadStockDetail(symbolFromUrl.toUpperCase());
    }
});

async function handleSearch() {
    const searchInput = document.getElementById('searchInput');
    const query = searchInput.value.trim();
    
    if (!query) {
        showError('Please enter a stock symbol or company name');
        return;
    }

    hideSearchResults();
    showLoading();
    
    try {
        await loadStockDetail(query.toUpperCase());
    } catch (error) {
        console.error('Search error:', error);
        showError(error.message || 'Search failed. Please try again.');
    }
}

async function fetchSearchSuggestions(query) {
    try {
        const response = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        displaySearchResults(data.results || []);
    } catch (error) {
        console.error('Fetch suggestions error:', error);
    }
}

function displaySearchResults(results) {
    const container = document.getElementById('searchResults');
    
    if (results.length === 0) {
        container.innerHTML = '<div class="no-results">No stocks found</div>';
        container.classList.add('active');
        return;
    }
    
    container.innerHTML = results.map(result => `
        <div class="search-result-item" onclick="selectStock('${result.symbol}', '${result.name.replace(/'/g, "\\'")}')">
            <div class="search-result-symbol">${result.symbol}</div>
            <div class="search-result-name">${result.name}</div>
            ${result.exchange ? `<div class="search-result-exchange">${result.exchange}</div>` : ''}
        </div>
    `).join('');
    
    container.classList.add('active');
}

function selectStock(symbol, name) {
    const searchInput = document.getElementById('searchInput');
    searchInput.value = symbol;
    hideSearchResults();
    loadStockDetail(symbol);
}

function hideSearchResults() {
    const container = document.getElementById('searchResults');
    container.classList.remove('active');
}

async function loadStockDetail(symbol) {
    currentSymbol = symbol.toUpperCase();
    showLoading();
    
    try {
        // 1. 立即显示实时浏览器画面（等待状态）
        showLiveBrowserView('🚀 Starting TinyFish Browser...', 'Preparing to call API for stock data...');
        
        // 2. 先调用 TinyFish API 获取实时数据并获取 streaming_url
        const tinyFishPromise = callTinyFishForStock(currentSymbol);
        
        // 3. 同时获取其他数据
        const [priceData, ratingsData, profileData, metricsData, earningsData] = await Promise.all([
            fetchPrice(currentSymbol),
            fetchRatings(currentSymbol),
            fetchProfile(currentSymbol),
            fetchMetrics(currentSymbol),
            fetchEarnings(currentSymbol)
        ]);
        
        displayPrice(priceData);
        displayRatings(ratingsData);
        displayProfile(profileData);
        displayMetrics(metricsData);
        displayEarnings(earningsData);
        
        document.getElementById('stockDetail').style.display = 'block';
        hideLoading();
        
        // 4. 等待 TinyFish 完成后刷新会话列表
        await tinyFishPromise;
        await loadSessions();
        
    } catch (error) {
        console.error('Load detail error:', error);
        showError('Failed to load data. Please try again.');
    }
}

// 显示实时浏览器画面
function showLiveBrowserView(title, message) {
    const liveBrowserView = document.getElementById('liveBrowserView');
    if (liveBrowserView) {
        const timestamp = new Date().toLocaleTimeString('en-US');
        liveBrowserView.innerHTML = `
            <div class="loading-browser" style="padding: 40px; text-align: center; background: #f8f9fa; border-radius: 12px; border: 2px dashed #dee2e6;">
                <div class="spinner" style="width: 40px; height: 40px; border: 4px solid #e9ecef; border-top-color: #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 15px;"></div>
                <p style="color: #6c757d; font-weight: bold;">${title}</p>
                <p style="font-size: 0.85rem; color: #adb5bd; margin-top: 5px;">${message}</p>
                <p style="font-size: 0.75rem; color: #ced4da; margin-top: 10px;">🕐 ${timestamp}</p>
            </div>
        `;
    }
}

// 调用 TinyFish API 获取股票数据
async function callTinyFishForStock(symbol) {
    try {
        console.log(`🚀 Calling TinyFish for ${symbol}...`);
        
        const response = await fetch(`${API_BASE}/api/stock/${symbol}/price`);
        const data = await response.json();
        
        console.log('TinyFish response:', data);
        
        // 等待一小段时间让 API 保存会话
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return data;
    } catch (error) {
        console.error('TinyFish call error:', error);
        return null;
    }
}

async function fetchPrice(symbol) {
    const response = await fetch(`${API_BASE}/api/stock/${symbol}/price`);
    const data = await response.json();
    return data.data || {};
}

async function fetchRatings(symbol) {
    const response = await fetch(`${API_BASE}/api/stock/${symbol}/ratings`);
    const data = await response.json();
    return data.data || {};
}

async function fetchProfile(symbol) {
    const response = await fetch(`${API_BASE}/api/stock/${symbol}/profile`);
    const data = await response.json();
    return data.data || {};
}

async function fetchMetrics(symbol) {
    const response = await fetch(`${API_BASE}/api/stock/${symbol}/metrics`);
    const data = await response.json();
    return data.data || {};
}

async function fetchEarnings(symbol) {
    const response = await fetch(`${API_BASE}/api/stock/${symbol}/earnings`);
    const data = await response.json();
    return data.data || {};
}

function displayPrice(data) {
    document.getElementById('stockSymbol').textContent = data.symbol || currentSymbol;
    document.getElementById('stockName').textContent = data.company_name || data.name || currentCompanyName || 'Stock';
    currentCompanyName = data.company_name || data.name || currentCompanyName;
    
    const currentPrice = document.getElementById('currentPrice');
    const priceChange = document.getElementById('priceChange');
    
    const price = data.price || data.current_price || data.last_price;
    const change = data.change || data.price_change;
    const changePercent = data.change_percent || data.price_change_percent;
    
    if (price !== null && price !== undefined) {
        const priceNum = typeof price === 'number' ? price : parseFloat(price);
        if (!isNaN(priceNum)) {
            currentPrice.textContent = `$${priceNum.toFixed(2)}`;
            
            const changeNum = typeof change === 'number' ? change : (change ? parseFloat(change) : 0);
            const changePercentNum = typeof changePercent === 'number' ? changePercent : (changePercent ? parseFloat(changePercent) : 0);
            const isPositive = changeNum >= 0;
            
            const changeDisplay = !isNaN(changeNum) ? changeNum.toFixed(2) : '0.00';
            const percentDisplay = !isNaN(changePercentNum) ? changePercentNum.toFixed(2) : '0.00';
            
            priceChange.textContent = `${isPositive ? '+' : ''}$${changeDisplay} (${isPositive ? '+' : ''}${percentDisplay}%)`;
            priceChange.className = `price-change ${isPositive ? '' : 'negative'}`;
            return;
        }
    }
    
    currentPrice.textContent = 'N/A';
    priceChange.textContent = 'N/A';
}

function displayRatings(data) {
    const container = document.getElementById('analystRatings');
    
    if (data.error || (!data.consensus && !data.price_target_average)) {
        container.innerHTML = '<div class="no-data">No analyst ratings available</div>';
        return;
    }
    
    let html = '';
    
    // Consensus
    if (data.consensus) {
        const consensusClass = data.consensus.toLowerCase().includes('buy') ? 'consensus-buy' : 
                               data.consensus.toLowerCase().includes('sell') ? 'consensus-sell' : 'consensus-hold';
        
        html += `
            <div class="rating-consensus">
                <span class="consensus-badge ${consensusClass}">${data.consensus}</span>
                ${data.analyst_count ? `<span class="analyst-count">${data.analyst_count} analysts</span>` : ''}
            </div>
        `;
    }
    
    // Price Targets
    if (data.price_target_low || data.price_target_average || data.price_target_high) {
        html += `
            <div class="price-targets">
                ${data.price_target_low ? `
                <div class="target-item">
                    <span class="target-label">Low</span>
                    <span class="target-value">$${parseFloat(data.price_target_low).toFixed(2)}</span>
                </div>
                ` : ''}
                ${data.price_target_average ? `
                <div class="target-item">
                    <span class="target-label">Average</span>
                    <span class="target-value">$${parseFloat(data.price_target_average).toFixed(2)}</span>
                </div>
                ` : ''}
                ${data.price_target_high ? `
                <div class="target-item">
                    <span class="target-label">High</span>
                    <span class="target-value">$${parseFloat(data.price_target_high).toFixed(2)}</span>
                </div>
                ` : ''}
            </div>
        `;
    }
    
    container.innerHTML = html || '<div class="no-data">No analyst ratings available</div>';
}

function displayProfile(data) {
    const container = document.getElementById('companyProfile');
    
    if (data.error || (!data.sector && !data.industry && !data.description)) {
        container.innerHTML = '<div class="no-data">No company profile available</div>';
        return;
    }
    
    let html = '';
    
    if (data.sector || data.industry) {
        html += '<div class="metrics-grid" style="margin-bottom: 16px;">';
        if (data.sector) {
            html += `
                <div class="metric-item">
                    <span class="metric-label">Sector</span>
                    <span class="metric-value">${data.sector}</span>
                </div>
            `;
        }
        if (data.industry) {
            html += `
                <div class="metric-item">
                    <span class="metric-label">Industry</span>
                    <span class="metric-value">${data.industry}</span>
                </div>
            `;
        }
        html += '</div>';
    }
    
    if (data.description) {
        html += `
            <div style="margin-bottom: 16px; padding: 16px; background: #f8f9fa; border-radius: 6px;">
                <h4 style="margin-bottom: 8px; font-size: 0.95rem; color: #666;">About</h4>
                <p style="line-height: 1.6; color: #333;">${data.description}</p>
            </div>
        `;
    }
    
    if (data.employees || data.website || data.headquarters) {
        html += '<div class="metrics-grid">';
        if (data.employees) {
            html += `
                <div class="metric-item">
                    <span class="metric-label">Employees</span>
                    <span class="metric-value">${data.employees.toLocaleString()}</span>
                </div>
            `;
        }
        if (data.website) {
            html += `
                <div class="metric-item">
                    <span class="metric-label">Website</span>
                    <span class="metric-value" style="font-size: 0.9rem;">${data.website}</span>
                </div>
            `;
        }
        if (data.headquarters) {
            html += `
                <div class="metric-item">
                    <span class="metric-label">Headquarters</span>
                    <span class="metric-value">${data.headquarters}</span>
                </div>
            `;
        }
        html += '</div>';
    }
    
    container.innerHTML = html || '<div class="no-data">No company profile available</div>';
}

function displayEarnings(data) {
    const container = document.getElementById('earningsData');
    
    if (data.error || (!data.next_earnings_date && !data.eps_estimate && !data.revenue_estimate)) {
        container.innerHTML = '<div class="no-data">No earnings data available</div>';
        return;
    }
    
    let html = '<div class="metrics-grid">';
    
    if (data.next_earnings_date) {
        html += `
            <div class="metric-item" style="grid-column: span 2;">
                <span class="metric-label">Next Earnings Date</span>
                <span class="metric-value">${data.next_earnings_date}</span>
            </div>
        `;
    }
    
    if (data.eps_estimate) {
        html += `
            <div class="metric-item">
                <span class="metric-label">EPS Estimate</span>
                <span class="metric-value">$${parseFloat(data.eps_estimate).toFixed(2)}</span>
            </div>
        `;
    }
    
    if (data.eps_actual) {
        html += `
            <div class="metric-item">
                <span class="metric-label">Last EPS Actual</span>
                <span class="metric-value">$${parseFloat(data.eps_actual).toFixed(2)}</span>
            </div>
        `;
    }
    
    if (data.eps_surprise) {
        const surpriseClass = parseFloat(data.eps_surprise) >= 0 ? '' : 'negative';
        html += `
            <div class="metric-item">
                <span class="metric-label">EPS Surprise</span>
                <span class="metric-value ${surpriseClass}">${data.eps_surprise}</span>
            </div>
        `;
    }
    
    if (data.revenue_estimate) {
        html += `
            <div class="metric-item">
                <span class="metric-label">Revenue Estimate</span>
                <span class="metric-value">${data.revenue_estimate}</span>
            </div>
        `;
    }
    
    if (data.last_quarter_revenue) {
        html += `
            <div class="metric-item">
                <span class="metric-label">Last Quarter Revenue</span>
                <span class="metric-value">${data.last_quarter_revenue}</span>
            </div>
        `;
    }
    
    html += '</div>';
    container.innerHTML = html || '<div class="no-data">No earnings data available</div>';
}

function displayMetrics(data) {
    const container = document.getElementById('keyMetrics');
    
    if (data.error || Object.keys(data).length === 0 || !data.market_cap) {
        container.innerHTML = '<div class="no-data">No key metrics available</div>';
        return;
    }
    
    // 定义指标，按类别分组 - 只显示常见且有数据的指标
    const metricsByCategory = {
        'Valuation': [
            { label: 'Market Cap', key: 'market_cap', format: 'string' },
            { label: 'P/E Ratio', key: 'pe_ratio', format: 'number' },
            { label: 'EPS', key: 'eps', format: 'currency' },
            { label: 'Dividend Yield', key: 'dividend_yield', format: 'percent' }
        ],
        'Trading Info': [
            { label: 'Beta', key: 'beta', format: 'number' },
            { label: '52W High', key: '52_week_high', format: 'currency' },
            { label: '52W Low', key: '52_week_low', format: 'currency' },
            { label: 'Avg Volume', key: 'avg_volume', format: 'number' }
        ]
    };
    
    let html = '<div class="metrics-sections">';
    let hasAnyMetrics = false;
    
    // 为每个类别创建卡片
    Object.entries(metricsByCategory).forEach(([category, metrics]) => {
        const categoryMetrics = metrics.filter(m => {
            const value = data[m.key];
            // 严格检查：必须有值且不是 N/A、null、undefined、空字符串
            return value !== null && value !== undefined && value !== 'N/A' && value !== '' && value !== 'null';
        });
        
        // 只显示有至少一个有效指标的类别
        if (categoryMetrics.length === 0) return;
        
        hasAnyMetrics = true;
        
        html += `
            <div class="metric-category">
                <h4 class="metric-category-title">${category}</h4>
                <div class="metrics-grid">
        `;
        
        categoryMetrics.forEach(metric => {
            const value = data[metric.key];
            let displayValue = 'N/A';
            
            if (value !== null && value !== undefined && value !== '') {
                if (metric.format === 'currency') {
                    displayValue = `$${typeof value === 'number' ? value.toFixed(2) : value}`;
                } else if (metric.format === 'percent') {
                    // 处理百分比格式
                    if (typeof value === 'number') {
                        displayValue = `${value > 1 ? (value / 100).toFixed(2) : value.toFixed(2)}%`;
                    } else {
                        displayValue = value.includes('%') ? value : `${value}%`;
                    }
                } else if (metric.format === 'number') {
                    displayValue = typeof value === 'number' ? value.toFixed(2) : value;
                } else {
                    displayValue = value;
                }
            }
            
            html += `
                <div class="metric-item">
                    <span class="metric-label">${metric.label}</span>
                    <span class="metric-value">${displayValue}</span>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    // 如果没有任何有效指标，显示提示
    if (!hasAnyMetrics) {
        container.innerHTML = '<div class="no-data">No key metrics available</div>';
    } else {
        container.innerHTML = html;
    }
}

function showLoading() {
    document.getElementById('loadingSection').style.display = 'block';
    document.getElementById('errorSection').style.display = 'none';
    document.getElementById('searchResults').innerHTML = '';
    document.getElementById('stockDetail').style.display = 'none';
}

function hideLoading() {
    document.getElementById('loadingSection').style.display = 'none';
}

function showError(message) {
    hideLoading();
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorSection').style.display = 'block';
}

function hideError() {
    document.getElementById('errorSection').style.display = 'none';
}

function retrySearch() {
    if (currentSymbol) {
        loadStockDetail(currentSymbol);
    } else {
        handleSearch();
    }
}

function handleAddToWatchlist() {
    if (!currentSymbol) {
        alert('Please search for a stock first');
        return;
    }
    
    // Get watchlist from localStorage
    const watchlist = JSON.parse(localStorage.getItem('stockWatchlist') || '[]');
    
    // Check if already in watchlist
    if (watchlist.find(item => item.symbol === currentSymbol)) {
        alert(`${currentSymbol} is already in your watchlist`);
        return;
    }
    
    // Add to watchlist
    const companyName = document.getElementById('stockName').textContent;
    watchlist.push({
        symbol: currentSymbol,
        name: companyName,
        addedAt: new Date().toISOString()
    });
    
    localStorage.setItem('stockWatchlist', JSON.stringify(watchlist));
    
    // Update button
    const btn = document.getElementById('addToWatchlistBtn');
    btn.textContent = '✅ Added to Watchlist';
    btn.style.background = '#16a34a';
    
    setTimeout(() => {
        btn.textContent = '⭐ Add to Watchlist';
        btn.style.background = '';
    }, 2000);
    
    alert(`${currentSymbol} added to your watchlist!`);
}

function navigateTo(page) {
    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    const activeLink = document.querySelector(`.nav-link[onclick="navigateTo('${page}')"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
}

// Load TinyFish Sessions
let pollingTimer = null;

async function loadSessions() {
    try {
        const response = await fetch(`${API_BASE}/api/sessions`);
        const data = await response.json();
        
        const liveBrowserView = document.getElementById('liveBrowserView');
        
        if (!data.sessions || data.sessions.length === 0) {
            if (liveBrowserView) {
                liveBrowserView.innerHTML = `
                    <div class="loading-browser" style="padding: 40px; text-align: center; background: #f8f9fa; border-radius: 12px; border: 2px dashed #dee2e6;">
                        <p style="color: #6c757d;">等待会话数据...</p>
                    </div>
                `;
            }
            return;
        }
        
        // 显示所有会话的实时画面
        if (liveBrowserView) {
            // 显示所有会话（包括失败的）
            const allSessions = data.sessions;
            
            if (allSessions.length === 0) {
                // 没有会话，显示等待状态
                liveBrowserView.innerHTML = `
                    <div class="loading-browser" style="padding: 40px; text-align: center; background: #f8f9fa; border-radius: 12px; border: 2px dashed #dee2e6;">
                        <p style="color: #6c757d;">Waiting for session data...</p>
                    </div>
                `;
            } else {
                // 显示所有会话的 iframe（即使失败）
                let allSessionsHtml = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 15px;">';
                
                allSessions.forEach((session, index) => {
                    // 使用原始 URL 或 current_url
                    const displayUrl = session.current_url || session.url;
                    const statusClass = session.status === 'COMPLETED' ? 'completed' : 
                                       session.status === 'RUNNING' ? 'running' : 'failed';
                    
                    allSessionsHtml += `
                        <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                            <div style="padding: 10px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div style="flex: 1;">
                                        <strong style="font-size: 0.9rem;">🔴 Session ${index + 1}</strong>
                                        <div style="font-size: 0.75rem; opacity: 0.9; margin-top: 2px; word-break: break-all;">
                                            ${session.run_id}
                                        </div>
                                    </div>
                                    <span class="session-status ${statusClass}" style="background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: bold;">
                                        ${session.status || 'Unknown'}
                                    </span>
                                </div>
                            </div>
                            <iframe 
                                src="${displayUrl}" 
                                title="TinyFish Session ${session.run_id}"
                                width="100%" 
                                height="350" 
                                frameborder="0"
                                allowfullscreen
                                style="display: block; background: #000;"
                                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                            ></iframe>
                            <div style="padding: 8px; background: #f8f9fa; font-size: 0.75rem; color: #555;">
                                <div style="margin-bottom: 4px;"><strong>📍 URL:</strong></div>
                                <div style="word-break: break-all; font-family: monospace; background: #fff; padding: 4px; border-radius: 3px; font-size: 0.7rem; margin-bottom: 4px;">${displayUrl}</div>
                                <div style="display: flex; justify-content: space-between;">
                                    <span>${session.started_at ? new Date(session.started_at).toLocaleTimeString('en-US') : 'N/A'}</span>
                                    ${session.status === 'FAILED' && session.error ? `<span style="color: #dc3545;" title="${session.error.substring(0, 100)}">⚠️ Failed</span>` : ''}
                                </div>
                            </div>
                        </div>
                    `;
                });
                
                allSessionsHtml += '</div>';
                
                // 添加提示信息
                allSessionsHtml += `
                    <div style="margin-top: 15px; padding: 12px; background: #e3f2fd; border-radius: 12px; border-left: 4px solid #2196f3;">
                        <strong style="color: #1976d2;">📊 Total ${allSessions.length} active sessions</strong>
                        <p style="margin: 5px 0 0 0; font-size: 0.8rem; color: #555;">
                            Each iframe displays the page TinyFish is visiting. Even failed sessions will show the original URL.
                        </p>
                    </div>
                `;
                
                liveBrowserView.innerHTML = allSessionsHtml;
            }
        }
    } catch (error) {
        console.error('Error loading sessions:', error);
        const liveBrowserView = document.getElementById('liveBrowserView');
        if (liveBrowserView) {
            liveBrowserView.innerHTML = `
                <div class="loading-browser" style="padding: 40px; text-align: center; background: #f8f9fa; border-radius: 12px; border: 2px dashed #dee2e6;">
                    <p style="color: #dc3545; font-weight: bold;">❌ 加载失败</p>
                    <p style="font-size: 0.85rem; color: #6c757d;">${error.message}</p>
                </div>
            `;
        }
    }
}

// Auto-load sessions on page load
window.addEventListener('DOMContentLoaded', () => {
    // Load sessions every 3 seconds for more real-time updates
    loadSessions();
    setInterval(loadSessions, 3000);
});
