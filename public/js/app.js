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
    } catch (error) {
        console.error('Load detail error:', error);
        showError('Failed to load data. Please try again.');
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

function displaySentiment(data) {
    const container = document.getElementById('socialSentiment');
    
    if (data.error || (!data.posts || data.posts.length === 0)) {
        container.innerHTML = '<div class="no-data">No social sentiment data available</div>';
        return;
    }
    
    const sentimentClass = data.sentiment_label === 'Positive' ? 'sentiment-positive' :
                          data.sentiment_label === 'Negative' ? 'sentiment-negative' : 'sentiment-neutral';
    
    let html = `
        <div class="sentiment-summary">
            <span class="sentiment-badge ${sentimentClass}">${data.sentiment_label}</span>
            <span class="sentiment-score">Score: ${data.sentiment_score?.toFixed(2) || '0.00'}</span>
        </div>
    `;
    
    if (data.posts && data.posts.length > 0) {
        html += '<div class="social-posts">';
        data.posts.forEach(post => {
            html += `
                <div class="post-item">
                    <div class="post-title">${post.title || post.headline || 'No title'}</div>
                    <div class="post-meta">
                        ${post.upvotes !== undefined ? `<span>👍 ${post.upvotes}</span>` : ''}
                        ${post.comments !== undefined ? `<span>💬 ${post.comments}</span>` : ''}
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }
    
    container.innerHTML = html || '<div class="no-data">No social sentiment data available</div>';
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

function displayNews(data) {
    const container = document.getElementById('newsList');
    
    if (data.error || (!data.news || data.news.length === 0)) {
        container.innerHTML = '<div class="no-data">No recent news available</div>';
        return;
    }
    
    let html = '<div class="news-list">';
    
    data.news.forEach((item, index) => {
        html += `
            <div class="news-item">
                <h4 class="news-headline">${item.headline || item.title || 'No title'}</h4>
                <div class="news-meta">
                    <span class="news-source">${item.source || 'Unknown'}</span>
                    <span class="news-date">${item.date || item.time_published || 'Unknown'}</span>
                </div>
                ${item.summary ? `<p class="news-summary">${item.summary}</p>` : ''}
                ${item.url ? `<a href="${item.url}" target="_blank" class="news-link">Read more →</a>` : ''}
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html || '<div class="no-data">No recent news available</div>';
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
async function loadSessions() {
    try {
        const response = await fetch(`${API_BASE}/api/sessions`);
        const data = await response.json();
        
        const container = document.getElementById('sessionsContainer');
        
        if (!data.sessions || data.sessions.length === 0) {
            container.innerHTML = '<div class="no-sessions">No active sessions. Search for a stock to start a session.</div>';
            return;
        }
        
        container.innerHTML = data.sessions.map(session => {
            const statusClass = session.status === 'COMPLETED' ? 'completed' : 
                               session.status === 'RUNNING' ? 'running' : 'failed';
            
            return `
                <div class="session-card">
                    <iframe 
                        src="${session.stream_url}" 
                        class="session-iframe"
                        title="TinyFish Session ${session.run_id}"
                        allow="fullscreen"
                    ></iframe>
                    <div class="session-info">
                        <div class="session-id">
                            <strong>Run ID:</strong> ${session.run_id}
                        </div>
                        <div style="margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
                            <span class="session-status ${statusClass}">${session.status || 'Unknown'}</span>
                            <span style="font-size: 0.85rem; color: #666;">
                                ${session.started_at ? new Date(session.started_at).toLocaleTimeString() : 'N/A'}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading sessions:', error);
        const container = document.getElementById('sessionsContainer');
        container.innerHTML = '<div class="no-sessions">Failed to load sessions</div>';
    }
}

// Auto-load sessions on page load
window.addEventListener('DOMContentLoaded', () => {
    // Load sessions every 10 seconds
    loadSessions();
    setInterval(loadSessions, 10000);
});
