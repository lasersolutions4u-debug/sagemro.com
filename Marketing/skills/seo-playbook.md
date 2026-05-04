# SEO 操作手册

---

## 一、当前状态诊断

### 1.1 技术短板

| 问题 | 影响 | 优先级 |
|------|------|--------|
| React SPA，爬虫看到空壳 `<div id="root">` | 百度/Google 无法索引内容 | 🔴 P0 |
| 所有页面共用同一个 `<title>` | 搜索结果展示无差异化 | 🔴 P0 |
| 无 sitemap.xml | 爬虫不知道有哪些页面 | 🟠 P1 |
| 无 robots.txt | 无爬虫抓取指引 | 🟡 P2 |
| 图片无 alt 文本 | 失去图片搜索流量 | 🟡 P2 |

### 1.2 修复方案

**P0：预渲染（推荐方案）**
```
npm install react-snap
```
在 `package.json` 的 build 后加 `&& react-snap`，生成静态 HTML 快照。Cloudflare Pages 原生支持直接部署。

**P0 备选：Cloudflare Workers HTMLRewriter**
```js
// 在 worker 中判断爬虫 UA
const crawlerUA = /baiduspider|googlebot|bingbot/i;
if (crawlerUA.test(request.headers.get('user-agent'))) {
  // 注入 SEO meta
}
```

**P0 最低成本：动态 `<title>`**
```jsx
// 在 index.html 中用占位符，或 React Helmet
<title>SAGEMRO - 钣金加工设备技术咨询与维修服务平台</title>
<meta name="description" content="AI小智提供激光切割、折弯、焊接等设备即时技术诊断，精准匹配工程师上门服务。">
```

**P1：sitemap.xml**
部署时生成静态 sitemap，包含所有 `/faq/*` 和 `/blog/*` 页面 URL。

---

## 二、关键词策略

### 2.1 关键词金字塔

```
第一层：品牌词（1-2个）
  "SAGEMRO"、"小智AI"
  
第二层：品类词（3-5个）
  "钣金加工设备维修"、"激光切割机维修"、"折弯机维修"
  
第三层：痛点词（20+个）
  "激光切割毛刺多怎么调"、"光纤激光器功率衰减"
  "折弯机角度不准"、"通快激光切割机故障代码"
  "切割头保养周期"、"等离子切割穿孔工艺"
  
第四层：长尾词（50+个）
  "3000W光纤切6mm碳钢参数"、"大族激光常见故障代码"
  "焊接机器人TCP校准方法"、"冷水机水温报警处理"
```

### 2.2 每篇文章的关键词布局

```
标题：包含一级目标关键词（H1）
第一段：自然出现目标关键词
H2 小标题：包含二级关键词或近义词
正文：关键词密度 1-2%，不堆砌
图片 alt：包含关键词
Meta description：包含关键词 + CTA（160字以内）
URL：英文短路径，如 /blog/laser-cutting-burr-fix
```

### 2.3 百度 SEO 特殊注意

- 百度更看重**域名年龄**和**备案状态**（sagemro.com 已有 ICP 备案）
- 百度对 SPA 的抓取能力弱于 Google，预渲染更重要
- 百度站长平台提交 sitemap，主动推送新页面
- 中文内容原创度检测严格，杜绝洗稿式 AI 改写
- 页面加载速度是百度移动搜索的排名因素

---

## 三、页面 SEO 清单

每个可索引页面的检查清单：

```
□ 唯一 <title>（50-60字）
□ <meta name="description">（120-160字）
□ 一个 <h1>
□ h2/h3 层级结构清晰
□ 图片有 alt 文本
□ URL 简短有语义
□ 页面内有 1-2 个内部链接
□ Open Graph 标签（og:title, og:description, og:image）
□ 移动端加载速度 <3s
□ 结构化数据（FAQ 页面用 FAQ Schema）
```

---

## 四、站外 SEO

### 4.1 外链建设

| 来源 | 做法 |
|------|------|
| 知乎回答 | 在相关回答中自然引用官网文章链接 |
| 行业论坛 | 钣金加工论坛、设备维修社区签名+互动 |
| 合作伙伴 | 设备品牌代理商网站互换链接 |
| 百度系产品 | 百家号文章文末带官网链接 |
| 公众号 | 技术文章末尾"阅读原文"跳转官网 |

### 4.2 本地 SEO（针对区域服务）

- 百度地图标注：济南钰峭机械有限公司
- 各城市 + 设备维修落地页（如 `/shanghai/laser-repair`）

---

## 五、效果追踪

| 指标 | 工具 |
|------|------|
| 百度收录页面数 | 百度站长平台 |
| Google 收录 | Google Search Console |
| 自然搜索点击 | 百度统计 / GA4 |
| 关键词排名 | SEMrush / 5118 |
| 页面加载速度 | PageSpeed Insights |
