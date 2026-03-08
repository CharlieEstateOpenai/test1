const API_BASE = window.location.origin;
let currentSymbol = null;
let trendChart = null;
let currentMetric = 'price';

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    // 图表标签切换
    document.querySelectorAll('.chart-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentMetric = tab.dataset.metric;
            if (currentSymbol) {
                loadHistoricalData(currentSymbol, currentMetric);
            }
        });
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
        // 先搜索股票
        const searchResponse = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);
        const searchData = await searchResponse.json();
        
        if (!searchResponse.ok) {
            throw new Error(searchData.error || '搜索失败');
        }

        if (searchData.results && searchData.results.length > 0) {
            // 显示搜索结果
            displaySearchResults(searchData.results);
            hideLoading();
        } else {
            // 如果没有搜索结果，尝试直接作为股票代码查询
            await loadStockDetail(query.toUpperCase());
        }
    } catch (error) {
        console.error('Search error:', error);
        showError(error.message || '搜索失败，请稍后重试');
    }
}

function displaySearchResults(results) {
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = '';
    
    results.forEach(result => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `
            <div style="display: flex; align-items: center; flex: 1;">
                <span class="result-symbol">${result.symbol || 'N/A'}</span>
                <span class="result-name">${result.company_name || result.name || 'Unknown'}</span>
            </div>
            <span class="result-exchange">${result.exchange || 'NASDAQ'}</span>
        `;
        
        item.addEventListener('click', () => {
            if (result.symbol) {
                loadStockDetail(result.symbol);
            }
        });
        
        resultsContainer.appendChild(item);
    });
}

async function loadStockDetail(symbol) {
    currentSymbol = symbol.toUpperCase();
    hideError();
    hideSearchResults();
    showLoading();
    
    try {
        // 并行加载所有数据
        const [positionData, metricsData, newsData] = await Promise.all([
            fetchStockPosition(currentSymbol),
            fetchStockMetrics(currentSymbol),
            fetchStockNews(currentSymbol)
        ]);
        
        if (!positionData || !Object.keys(positionData).length) {
            throw new Error('未找到该股票数据');
        }
        
        displayStockDetail(positionData);
        displayMetrics(metricsData);
        displayNews(newsData);
        
        document.getElementById('stockDetail').style.display = 'block';
        hideLoading();
    } catch (error) {
        console.error('Load stock detail error:', error);
        showError(error.message || '加载股票数据失败');
    }
}

async function fetchStockPosition(symbol) {
    const response = await fetch(`${API_BASE}/api/stock/${symbol}/position`);
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '获取持仓数据失败');
    }
    const data = await response.json();
    return data.data;
}

async function fetchStockMetrics(symbol) {
    const response = await fetch(`${API_BASE}/api/stock/${symbol}/metrics`);
    if (!response.ok) {
        return { price: [], pe_ratio: [], market_cap: [] };
    }
    const data = await response.json();
    return data.data;
}

async function fetchStockNews(symbol) {
    const response = await fetch(`${API_BASE}/api/stock/${symbol}/news`);
    if (!response.ok) {
        return { news: [], analyst_ratings: [], consensus: null };
    }
    const data = await response.json();
    return data.data;
}

function displayStockDetail(data) {
    document.getElementById('stockSymbol').textContent = data.symbol || currentSymbol;
    document.getElementById('stockName').textContent = data.company_name || 'Unknown Company';
    
    const currentPrice = document.getElementById('currentPrice');
    const priceChange = document.getElementById('priceChange');
    
    if (data.current_price) {
        currentPrice.textContent = formatCurrency(data.current_price);
        
        const change = data.price_change || 0;
        const changePercent = data.price_change_percent || 0;
        const isPositive = change >= 0;
        
        priceChange.textContent = `${isPositive ? '+' : ''}${formatCurrency(change)} (${isPositive ? '+' : ''}${changePercent}%)`;
        priceChange.className = `price-change ${isPositive ? '' : 'negative'}`;
        currentPrice.style.color = isPositive ? '#2ecc71' : '#e74c3c';
        priceChange.style.color = isPositive ? '#2ecc71' : '#e74c3c';
    }
    
    // 更新持仓网格
    updatePositionItem('marketCap', formatMarketCap(data.market_cap));
    updatePositionItem('peRatio', data.pe_ratio ? data.pe_ratio.toFixed(2) : 'N/A');
    updatePositionItem('eps', data.eps ? formatCurrency(data.eps) : 'N/A');
    updatePositionItem('dividendYield', data.dividend_yield ? `${data.dividend_yield}%` : 'N/A');
    updatePositionItem('volume', formatNumber(data.volume));
    updatePositionItem('avgVolume', formatNumber(data.avg_volume));
    updatePositionItem('open', data.open ? formatCurrency(data.open) : 'N/A');
    updatePositionItem('previousClose', data.previous_close ? formatCurrency(data.previous_close) : 'N/A');
    updatePositionItem('high', data.high ? formatCurrency(data.high) : 'N/A');
    updatePositionItem('low', data.low ? formatCurrency(data.low) : 'N/A');
    updatePositionItem('fiftyTwoWeekHigh', data.fifty_two_week_high ? formatCurrency(data.fifty_two_week_high) : 'N/A');
    updatePositionItem('fiftyTwoWeekLow', data.fifty_two_week_low ? formatCurrency(data.fifty_two_week_low) : 'N/A');
    updatePositionItem('beta', data.beta ? data.beta.toFixed(2) : 'N/A');
    updatePositionItem('industry', data.industry || 'N/A');
    updatePositionItem('sector', data.sector || 'N/A');
}

function updatePositionItem(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function displayMetrics(metricsData) {
    // 默认显示价格趋势
    loadHistoricalData(currentSymbol, 'price');
}

async function loadHistoricalData(symbol, metric) {
    try {
        const response = await fetch(`${API_BASE}/api/stock/${symbol}/history/${metric}`);
        if (!response.ok) {
            throw new Error('获取历史数据失败');
        }
        
        const result = await response.json();
        const data = result.data || [];
        
        if (data.length === 0) {
            showChartMessage('暂无历史数据');
            return;
        }
        
        renderChart(data, metric);
    } catch (error) {
        console.error('Load historical data error:', error);
        showChartMessage('加载历史数据失败');
    }
}

function renderChart(data, metric) {
    const ctx = document.getElementById('trendChart').getContext('2d');
    
    if (trendChart) {
        trendChart.destroy();
    }
    
    const labels = data.map(item => {
        const date = new Date(item.date);
        return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    });
    
    const values = data.map(item => item.value);
    
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(102, 126, 234, 0.3)');
    gradient.addColorStop(1, 'rgba(102, 126, 234, 0.01)');
    
    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: getMetricLabel(metric),
                data: values,
                borderColor: '#667eea',
                backgroundColor: gradient,
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#667eea',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed.y;
                            if (metric === 'market_cap') {
                                return formatMarketCap(value);
                            } else if (metric === 'price') {
                                return formatCurrency(value);
                            } else {
                                return value.toFixed(2);
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        callback: function(value) {
                            if (metric === 'market_cap') {
                                return formatMarketCap(value).replace('$', '');
                            } else if (metric === 'price') {
                                return '$' + value;
                            }
                            return value;
                        }
                    }
                }
            }
        }
    });
}

function getMetricLabel(metric) {
    const labels = {
        price: '价格',
        pe_ratio: '市盈率',
        market_cap: '市值',
        revenue: '营收',
        net_income: '净利润'
    };
    return labels[metric] || metric;
}

function showChartMessage(message) {
    const container = document.querySelector('.chart-container');
    container.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666; font-size: 1.2rem;">${message}</div>`;
}

function displayNews(newsData) {
    const newsContent = document.getElementById('newsContent');
    
    if ((!newsData.news || newsData.news.length === 0) && 
        (!newsData.analyst_ratings || newsData.analyst_ratings.length === 0)) {
        newsContent.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">暂无相关新闻和评级数据</p>';
        return;
    }
    
    let html = '';
    
    // 分析师评级
    if (newsData.analyst_ratings && newsData.analyst_ratings.length > 0) {
        html += '<h4 style="margin-bottom: 15px; color: #333;">📊 分析师评级</h4>';
        newsData.analyst_ratings.slice(0, 5).forEach(rating => {
            const ratingClass = getRatingClass(rating.rating);
            html += `
                <div class="analyst-rating">
                    <div>
                        <div style="font-weight: 600;">${rating.firm || 'Unknown Firm'}</div>
                        <div style="font-size: 0.85rem; color: #666;">${rating.date || ''}</div>
                    </div>
                    <div style="text-align: right;">
                        <span class="rating-badge ${ratingClass}">${rating.rating || 'N/A'}</span>
                        <div style="font-size: 0.85rem; color: #666; margin-top: 5px;">
                            目标价：${rating.target_price ? formatCurrency(rating.target_price) : 'N/A'}
                        </div>
                    </div>
                </div>
            `;
        });
    }
    
    // 新闻
    if (newsData.news && newsData.news.length > 0) {
        html += '<h4 style="margin: 25px 0 15px; color: #333;">📰 最新新闻</h4>';
        newsData.news.slice(0, 5).forEach(news => {
            html += `
                <div class="news-item">
                    <h4>${news.headline || '无标题'}</h4>
                    <div class="meta">
                        <span>${news.source || 'Unknown'}</span>
                        <span style="margin: 0 10px;">•</span>
                        <span>${news.date || 'Unknown'}</span>
                    </div>
                    <p>${news.summary || '无摘要'}</p>
                </div>
            `;
        });
    }
    
    newsContent.innerHTML = html;
}

function getRatingClass(rating) {
    if (!rating) return 'rating-hold';
    const r = rating.toLowerCase();
    if (r.includes('buy') || r.includes('outperform') || r.includes('overweight')) {
        return 'rating-buy';
    } else if (r.includes('sell') || r.includes('underperform')) {
        return 'rating-sell';
    }
    return 'rating-hold';
}

function formatCurrency(value) {
    if (value === null || value === undefined) return 'N/A';
    return '$' + parseFloat(value).toFixed(2);
}

function formatMarketCap(value) {
    if (value === null || value === undefined) return 'N/A';
    const num = parseFloat(value);
    if (num >= 1e12) {
        return '$' + (num / 1e12).toFixed(2) + 'T';
    } else if (num >= 1e9) {
        return '$' + (num / 1e9).toFixed(2) + 'B';
    } else if (num >= 1e6) {
        return '$' + (num / 1e6).toFixed(2) + 'M';
    }
    return '$' + num.toFixed(2);
}

function formatNumber(value) {
    if (value === null || value === undefined) return 'N/A';
    return parseFloat(value).toLocaleString();
}

function showLoading() {
    document.getElementById('loadingSection').style.display = 'block';
    document.getElementById('errorSection').style.display = 'none';
    document.getElementById('searchResults').innerHTML = '';
}

function hideLoading() {
    document.getElementById('loadingSection').style.display = 'none';
}

function showError(message) {
    hideLoading();
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorSection').style.display = 'block';
    document.getElementById('stockDetail').style.display = 'none';
}

function hideError() {
    document.getElementById('errorSection').style.display = 'none';
}

function hideSearchResults() {
    document.getElementById('searchResults').innerHTML = '';
}

function retrySearch() {
    handleSearch();
}
