const API_BASE = window.location.origin;
let currentSymbol = null;

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
});

async function handleSearch() {
    const searchInput = document.getElementById('searchInput');
    const query = searchInput.value.trim();
    
    if (!query) {
        showError('请输入股票代码或公司名称');
        return;
    }

    showLoading();
    
    try {
        console.log('Searching for:', query);
        await loadStockDetail(query.toUpperCase());
    } catch (error) {
        console.error('Search error:', error);
        showError(error.message || '搜索失败，请稍后重试');
    }
}

async function loadStockDetail(symbol) {
    currentSymbol = symbol.toUpperCase();
    hideError();
    hideSearchResults();
    showLoading();
    
    try {
        console.log('Loading data for:', symbol);
        
        // 并行加载所有数据
        const [priceData, ratingsData, sentimentData, metricsData, newsData] = await Promise.all([
            fetchPrice(currentSymbol),
            fetchRatings(currentSymbol),
            fetchSentiment(currentSymbol),
            fetchMetrics(currentSymbol),
            fetchNews(currentSymbol)
        ]);
        
        console.log('All data loaded');
        
        displayPrice(priceData);
        displayRatings(ratingsData);
        displaySentiment(sentimentData);
        displayMetrics(metricsData);
        displayNews(newsData);
        
        document.getElementById('stockDetail').style.display = 'block';
        hideLoading();
    } catch (error) {
        console.error('Load detail error:', error);
        showError(error.message || '加载数据失败');
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

async function fetchSentiment(symbol) {
    const response = await fetch(`${API_BASE}/api/stock/${symbol}/sentiment`);
    const data = await response.json();
    return data.data || {};
}

async function fetchMetrics(symbol) {
    const response = await fetch(`${API_BASE}/api/stock/${symbol}/metrics`);
    const data = await response.json();
    return data.data || {};
}

async function fetchNews(symbol) {
    const response = await fetch(`${API_BASE}/api/stock/${symbol}/news`);
    const data = await response.json();
    return data.data || {};
}

function displayPrice(data) {
    document.getElementById('stockSymbol').textContent = data.symbol || currentSymbol;
    document.getElementById('stockName').textContent = 'Stock';
    
    const currentPrice = document.getElementById('currentPrice');
    const priceChange = document.getElementById('priceChange');
    
    if (data.price) {
        currentPrice.textContent = `$${data.price.toFixed(2)}`;
        
        const change = data.change || 0;
        const changePercent = data.change_percent || 0;
        const isPositive = change >= 0;
        
        priceChange.textContent = `${isPositive ? '+' : ''}$${change.toFixed(2)} (${isPositive ? '+' : ''}${changePercent}%)`;
        priceChange.className = `price-change ${isPositive ? '' : 'negative'}`;
        currentPrice.style.color = isPositive ? '#2ecc71' : '#e74c3c';
        priceChange.style.color = isPositive ? '#2ecc71' : '#e74c3c';
    } else {
        currentPrice.textContent = 'N/A';
        priceChange.textContent = '';
    }
}

function displayRatings(data) {
    const container = document.getElementById('analystRatings');
    
    if (data.error || (!data.consensus && !data.recent_ratings)) {
        container.innerHTML = '<p class="no-data">暂无分析师评级数据</p>';
        return;
    }
    
    let html = '';
    
    if (data.consensus) {
        const consensusClass = data.consensus.toLowerCase().includes('buy') ? 'rating-buy' : 
                               data.consensus.toLowerCase().includes('sell') ? 'rating-sell' : 'rating-hold';
        
        html += `
            <div class="rating-summary">
                <div class="consensus-badge ${consensusClass}">${data.consensus}</div>
                ${data.analyst_count ? `<span class="analyst-count">${data.analyst_count} 位分析师</span>` : ''}
            </div>
        `;
    }
    
    if (data.price_target_average) {
        html += `
            <div class="price-targets">
                <div class="target-item">
                    <span class="target-label">平均目标价</span>
                    <span class="target-value">$${data.price_target_average.toFixed(2)}</span>
                </div>
                ${data.price_target_low ? `
                <div class="target-item">
                    <span class="target-label">最低</span>
                    <span class="target-value">$${data.price_target_low.toFixed(2)}</span>
                </div>
                ` : ''}
                ${data.price_target_high ? `
                <div class="target-item">
                    <span class="target-label">最高</span>
                    <span class="target-value">$${data.price_target_high.toFixed(2)}</span>
                </div>
                ` : ''}
            </div>
        `;
    }
    
    if (data.recent_ratings && data.recent_ratings.length > 0) {
        html += '<div class="recent-ratings">';
        data.recent_ratings.slice(0, 5).forEach(rating => {
            const ratingClass = rating.rating?.toLowerCase().includes('buy') ? 'rating-buy' : 
                               rating.rating?.toLowerCase().includes('sell') ? 'rating-sell' : 'rating-hold';
            
            html += `
                <div class="rating-item">
                    <div class="rating-firm">${rating.firm || 'Unknown'}</div>
                    <div class="rating-info">
                        <span class="rating-badge ${ratingClass}">${rating.rating || 'N/A'}</span>
                        ${rating.target ? `<span class="rating-target">$${rating.target}</span>` : ''}
                        ${rating.date ? `<span class="rating-date">${rating.date}</span>` : ''}
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }
    
    container.innerHTML = html || '<p class="no-data">暂无数据</p>';
}

function displaySentiment(data) {
    const container = document.getElementById('socialSentiment');
    
    if (data.error || (!data.posts || data.posts.length === 0)) {
        container.innerHTML = '<p class="no-data">暂无社交媒体情绪数据</p>';
        return;
    }
    
    const sentimentClass = data.sentiment_label === 'Positive' ? 'sentiment-positive' :
                          data.sentiment_label === 'Negative' ? 'sentiment-negative' : 'sentiment-neutral';
    
    let html = `
        <div class="sentiment-summary">
            <div class="sentiment-badge ${sentimentClass}">${data.sentiment_label}</div>
            <span class="sentiment-score">分数：${data.sentiment_score?.toFixed(2) || '0.00'}</span>
        </div>
    `;
    
    if (data.posts && data.posts.length > 0) {
        html += '<div class="social-posts">';
        data.posts.forEach(post => {
            const postClass = post.sentiment === 'positive' ? 'post-positive' :
                            post.sentiment === 'negative' ? 'post-negative' : 'post-neutral';
            
            html += `
                <div class="post-item ${postClass}">
                    <div class="post-title">${post.title || '无标题'}</div>
                    <div class="post-meta">
                        <span>👍 ${post.upvotes || 0}</span>
                        <span>💬 ${post.comments || 0}</span>
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }
    
    container.innerHTML = html;
}

function displayMetrics(data) {
    const container = document.getElementById('keyMetrics');
    
    if (data.error || Object.keys(data).length === 0) {
        container.innerHTML = '<p class="no-data">暂无关键指标数据</p>';
        return;
    }
    
    const metrics = [
        { label: '市值', key: 'market_cap', format: 'string' },
        { label: '市盈率 (PE)', key: 'pe_ratio', format: 'number' },
        { label: '远期 PE', key: 'forward_pe', format: 'number' },
        { label: '每股收益 (EPS)', key: 'eps', format: 'currency' },
        { label: '股息率', key: 'dividend_yield', format: 'string' },
        { label: 'Beta', key: 'beta', format: 'number' },
        { label: '52 周高点', key: '52_week_high', format: 'currency' },
        { label: '52 周低点', key: '52_week_low', format: 'currency' },
        { label: '平均成交量', key: 'avg_volume', format: 'number' }
    ];
    
    let html = '<div class="metrics-grid">';
    
    metrics.forEach(metric => {
        const value = data[metric.key];
        let displayValue = 'N/A';
        
        if (value !== null && value !== undefined) {
            if (metric.format === 'currency') {
                displayValue = `$${typeof value === 'number' ? value.toFixed(2) : value}`;
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
    
    html += '</div>';
    container.innerHTML = html;
}

function displayNews(data) {
    const container = document.getElementById('newsList');
    
    if (data.error || (!data.news || data.news.length === 0)) {
        container.innerHTML = '<p class="no-data">暂无新闻</p>';
        return;
    }
    
    let html = '<div class="news-items">';
    
    data.news.forEach((item, index) => {
        html += `
            <div class="news-item">
                <h4 class="news-headline">${item.headline || '无标题'}</h4>
                <div class="news-meta">
                    <span class="news-source">${item.source || 'Unknown'}</span>
                    <span class="news-date">${item.date || 'Unknown'}</span>
                </div>
                ${item.summary ? `<p class="news-summary">${item.summary}</p>` : ''}
                ${item.url ? `<a href="${item.url}" target="_blank" class="news-link">阅读全文 →</a>` : ''}
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
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

function hideSearchResults() {
    document.getElementById('searchResults').innerHTML = '';
}

function retrySearch() {
    if (currentSymbol) {
        loadStockDetail(currentSymbol);
    } else {
        handleSearch();
    }
}
