# Vercel 环境变量配置说明

## 方法 1：通过 Vercel 控制台配置（推荐）

1. 访问 Vercel 项目设置：
   https://vercel.com/charlieestateopenais-projects/test3/settings/environment-variables

2. 添加以下环境变量：

   **变量名**: `TINYFISH_API_KEY`
   **变量值**: `sk-tinyfish-jrNPRJUhx20YD6Ozc5sRefmtsdC1MPMu`
   **环境**: 选择 `Production`, `Preview`, `Development` 全选

3. 保存后重新部署项目

## 方法 2：使用 Vercel CLI 配置

在终端运行以下命令：

```bash
cd e:\TinyFishChallenge\test0308
vercel env add TINYFISH_API_KEY sk-tinyfish-jrNPRJUhx20YD6Ozc5sRefmtsdC1MPMu
```

然后选择应用到所有环境（Production/Preview/Development）

## 方法 3：快速修复 - 直接在代码中硬编码（临时方案）

如果上述方法都不方便，可以暂时在 api/index.js 中直接设置 API 密钥

## 验证配置

配置完成后：
1. 在 Vercel 项目页面点击 "Redeploy"
2. 等待部署完成
3. 访问 https://test3-ten-dun.vercel.app
4. 搜索任意股票（如 AAPL）测试数据抓取
