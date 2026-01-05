// src/lib/ankang/gov.js
// 手动实现 RSS2.0 渲染（避免依赖缺失问题）
function renderRss2(data) {
  const items = data.items.map(item => `
    <item>
      <title><![CDATA[${item.title}]]></title>
      <link>${item.link}</link>
      <description><![CDATA[${item.description}]]></description>
      <pubDate>${item.pubDate}</pubDate>
      <guid>${item.guid}</guid>
      <author><![CDATA[${item.author}]]></author>
      <category><![CDATA[${item.category}]]></category>
      <enclosure url="${item.enclosure.url}" type="${item.enclosure.type}" length="${item.enclosure.length}"/>
      <source url="${item.source.url}"><![CDATA[${item.source.title}]]></source>
    </item>
  `).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
      <channel>
        <title><![CDATA[${data.title}]]></title>
        <link>${data.link}</link>
        <description><![CDATA[${data.description}]]></description>
        <language>${data.language}</language>
        <category><![CDATA[${data.category}]]></category>
        ${items}
      </channel>
    </rss>`;
}

// 核心处理逻辑
let deal = async (ctx) => {
  const { nodeId } = ctx.req.param();
  const targetUrl = `https://www.ankang.gov.cn/Node-${nodeId}.html`;

  // 1. 请求目标页面（添加完整请求头，避免被拦截）
  const response = await fetch(targetUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Referer': 'https://www.ankang.gov.cn/',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    },
  });

  // 2. 处理请求失败场景
  if (!response.ok) {
    ctx.status = 500;
    ctx.header('Content-Type', 'text/plain; charset=utf-8');
    return ctx.body('安康政府页面请求失败，状态码：' + response.status);
  }

  // 3. 初始化解析变量
  let items = [];
  let pageTitle = '安康市政府专栏';
  let pageDesc = '安康市政府官网政务信息订阅源';

  // 4. 使用 HTMLRewriter 解析页面（适配实际选择器）
  await new HTMLRewriter()
    // 解析页面标题
    .on('title', {
      text(text) {
        pageTitle = text.text.trim() || pageTitle;
      }
    })
    // 解析页面描述
    .on('meta[name="description"]', {
      element(el) {
        const desc = el.getAttribute('content');
        if (desc) pageDesc = desc.trim();
      }
    })
    // 解析每一条政务信息（核心：.list-li 匹配实际列表项）
    .on('.list-li', {
      element(el) {
        // 提取标题
        const titleEl = el.querySelector('.list-title');
        const title = titleEl ? titleEl.textContent.trim() : '无标题';
        
        // 提取链接（处理相对路径）
        const linkEl = el.querySelector('a');
        const linkPath = linkEl ? linkEl.getAttribute('href') : '';
        const link = linkPath.startsWith('http') 
          ? linkPath 
          : `https://www.ankang.gov.cn${linkPath}`;
        
        // 提取发布时间（适配中文日期格式）
        const timeEl = el.querySelector('.list-time');
        const pubDateText = timeEl ? timeEl.textContent.trim() : new Date().toLocaleDateString();
        // 兼容处理：2025-03-20 → UTC 格式
        const pubDate = pubDateText.includes('-') 
          ? new Date(pubDateText).toUTCString() 
          : new Date().toUTCString();
        
        // 提取描述
        const descEl = el.querySelector('.list-desc');
        const description = descEl ? descEl.textContent.trim() : title;

        // 组装单条 RSS 项
        items.push({
          title: title,
          link: link,
          description: description,
          pubDate: pubDate,
          guid: link, // 用链接作为唯一标识
          author: '安康市政府',
          category: '政务信息',
          enclosure: {
            url: 'https://www.ankang.gov.cn/favicon.ico',
            type: 'image/x-icon',
            length: 0,
          },
          source: {
            title: '安康市政府官网',
            url: 'https://www.ankang.gov.cn',
          },
        });
      }
    })
    .transform(response)
    .text(); // 关键：用 text() 解析，而非 arrayBuffer()

  // 5. 处理列表为空的情况
  if (items.length === 0) {
    items.push({
      title: '暂无政务信息',
      link: targetUrl,
      description: '该栏目暂无公开的政务信息',
      pubDate: new Date().toUTCString(),
      guid: targetUrl,
      author: '安康市政府',
      category: '政务信息',
      enclosure: {
        url: 'https://www.ankang.gov.cn/favicon.ico',
        type: 'image/x-icon',
        length: 0,
      },
      source: {
        title: '安康市政府官网',
        url: 'https://www.ankang.gov.cn',
      },
    });
  }

  // 6. 组装 RSS 数据
  const rssData = {
    title: pageTitle,
    link: targetUrl,
    description: `${pageTitle} - ${pageDesc}`,
    language: 'zh-cn',
    category: 'ankang-gov',
    items: items,
  };

  // 7. 返回 RSS 响应
  ctx.header('Content-Type', 'application/xml; charset=utf-8');
  return ctx.body(renderRss2(rssData));
};

// 8. 注册路由（适配项目插件规范）
let setup = (route) => {
  route.get('/ankang/gov/:nodeId', deal);
};

// 9. 导出插件（和其他平台保持一致）
export default { setup };
