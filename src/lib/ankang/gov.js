// src/lib/ankang/gov.js
export async function handleAnkangGov(ctx) {
  const { request } = ctx;
  const url = new URL(request.url);
  // 提取路由参数（比如栏目ID，适配不同栏目）
  const nodeId = url.pathname.split('/').pop().replace('.html', '');
  const targetUrl = `https://www.ankang.gov.cn/Node-${nodeId}.html`;

  // 1. 请求目标页面
  const response = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    return new Response('页面请求失败', { status: 500 });
  }

  // 2. 解析页面内容（需根据实际HTML结构调整选择器）
  let items = [];
  let pageTitle = '安康市政府专栏';

  // 使用 HTMLRewriter 解析列表项
  await new HTMLRewriter()
    // 解析页面标题
    .on('title', {
      text(text) {
        pageTitle = text.text;
      },
    })
    // 解析内容列表（需替换为目标页面实际的列表项选择器，示例用 .list-item）
    .on('.list-item', {
      element(el) {
        // 提取标题
        const title = el.querySelector('.title')?.textContent || '无标题';
        // 提取详情链接（处理相对路径）
        const linkPath = el.querySelector('a')?.getAttribute('href') || '';
        const link = linkPath.startsWith('http') ? linkPath : `https://www.ankang.gov.cn${linkPath}`;
        // 提取发布时间
        const pubDateText = el.querySelector('.publish-time')?.textContent || new Date().toUTCString();
        const pubDate = new Date(pubDateText).toUTCString() || new Date().toUTCString();
        // 提取描述
        const description = el.querySelector('.desc')?.textContent || '无描述';

        // 组装 RSS 项
        items.push({
          title: title.trim(),
          link: link,
          description: description.trim(),
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
      },
    })
    .transform(response).arrayBuffer();

  // 3. 组装 RSS 数据模板
  const data = {
    title: pageTitle,
    link: targetUrl,
    description: `${pageTitle} - 安康市政府官网订阅源`,
    language: 'zh-cn',
    category: 'ankang-gov',
    items: items,
  };

  // 返回 RSS 2.0 格式响应
  return ctx.render('rss2', data);
}
