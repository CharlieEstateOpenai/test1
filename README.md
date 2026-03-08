# 📈 股票实时持仓与趋势分析 Web 应用

基于 TinyFish API 的股票实时持仓数据查询和趋势分析 Web 应用。

## ✨ 功能特性

- 🔍 **股票搜索**：支持股票代码或公司名称搜索
- 📊 **实时持仓数据**：获取股票实时价格、市值、市盈率等 15+ 项指标
- 📈 **趋势图表**：可视化展示价格、市盈率、市值等历史趋势
- 📰 **新闻资讯**：整合相关新闻和分析师评级
- 🚀 **快速部署**：支持一键部署到 Vercel

## 🛠️ 技术栈

- **前端**：HTML5, CSS3, JavaScript, Chart.js
- **后端**：Node.js, Vercel Serverless Functions
- **API**：TinyFish Web Agent API
- **数据源**：Nasdaq, Bloomberg, Reuters, MarketWatch

## 📦 本地开发

1. 克隆仓库
```bash
git clone https://github.com/CharlieEstateOpenai/test0308-stock-app.git
cd test0308-stock-app
```

2. 安装依赖（可选，本项目无外部依赖）
```bash
npm install
```

3. 配置环境变量

复制 `.env.example` 为 `.env`：
```bash
cp .env.example .env
```

编辑 `.env` 文件，配置 TinyFish API：
```
TINYFISH_API_KEY=your_api_key_here
TINYFISH_API_URL=https://api.tinyfish.ai/v1
```

4. 本地开发
```bash
npm run dev
```

## 🚀 部署到 Vercel

### 方式一：一键部署（推荐）

点击以下按钮一键部署：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/CharlieEstateOpenai/test0308-stock-app)

### 方式二：手动部署

1. 安装 Vercel CLI
```bash
npm i -g vercel
```

2. 登录 Vercel
```bash
vercel login
```

3. 部署
```bash
vercel --prod
```

4. 配置环境变量

在 Vercel 项目设置中添加以下环境变量：
- `TINYFISH_API_KEY`
- `TINYFISH_API_URL` (可选，默认：https://api.tinyfish.ai/v1)

## 📱 API 接口

### 健康检查
```
GET /api/health
```

### 搜索股票
```
GET /api/search?q=AAPL
```

### 获取股票实时持仓数据
```
GET /api/stock/:symbol/position
```

### 获取股票历史数据
```
GET /api/stock/:symbol/history/:metric
```

参数：
- `symbol`: 股票代码（如：AAPL）
- `metric`: 指标类型（price, pe_ratio, market_cap 等）

### 获取多个指标历史数据
```
GET /api/stock/:symbol/metrics
```

### 获取股票新闻和评级
```
GET /api/stock/:symbol/news
```

## 📊 数据源

- **Nasdaq Official**: 纳斯达克官方新闻和市场数据
- **Bloomberg**: 彭博社财经新闻和分析
- **Reuters**: 路透社市场新闻
- **MarketWatch**: MarketWatch 实时市场数据

## ⚠️ 免责声明

- 数据延迟 15 分钟
- 仅供参考，不构成投资建议
- 投资有风险，入市需谨慎

## 📝 License

MIT License

## 👨‍💻 Author

CharlieEstateOpenai

---

**Powered by TinyFish API** 🐟
