// src/lib/ankang/gov.js
import { renderRss2 } from '../../utils/util'; // 复用项目内置的RSS渲染工具

// 核心处理逻辑
let deal = async (ctx) => {
  const { nodeId } = ctx.req.param();
  const targetUrl = `https://www.ankang.gov.cn/Node-${nodeId}.html`;

  // 1. 请求目标页面（添加防爬头）
  const response = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://www.ankang.gov.cn/',
    },
  });

  if (!response.ok) {
    return ctx.html('页面请求失败', 500);
  }

  // 2. 解析页面内容（适配安康政府网实际HTML结构）
  let items = [];
  let pageTitle = '安康市政府专栏';

  // 使用HTMLRewriter解析（核心：替换为目标页面真实的选择器）
  await new HTMLRewriter()
    // 解析页面标题
    .on('title', {
      text(text) {
        pageTitle = text.text.trim();
      },
    })
    // 解析政务列表项（需根据目标页面调整选择器，示例用常见的政务列表结构）
    .on('.list-group-item', { // 替换为目标页面的列表项选择器
      element(el) {
        // 提取标题
        const titleEl = el.querySelector('a');
        const title = titleEl?.textContent || '无标题';
        // 提取链接（处理相对路径）
        const linkPath = titleEl?.getAttribute('href') || '';
        const link = linkPath.startsWith('http') 
          ? linkPath 
          : `https://www.ankang.gov.cn${linkPath}`;
        // 提取发布时间（替换为目标页面的时间选择器）
        const pubDateText = el.querySelector('.publish-time')?.textContent || new Date().toUTCString();
        const pubDate = new Date(pubDateText).toUTCString() || new Date().toUTCString();
        // 提取描述
        const description = el.querySelector('.desc')?.textContent || title;

        // 组装RSS项（对齐项目模板规范）
        items.push({
          title: title.trim(),
          link: link,
          description: description.trim(),
          pubDate: pubDate,
          guid: link, // 用链接作为唯一标识
          author: '安康市政府',
          category: '政务信息',
        });
      },
    })
    .transform(response).arrayBuffer();

  // 3. 组装RSS数据（对齐项目模板）
  const data = {
    title: pageTitle,
    link: targetUrl,
    description: `${pageTitle} - 安康市政府官网订阅源`,
    language: 'zh-cn',
    items: items,
  };

  // 4. 返回RSS2.0格式响应（复用项目工具）
  ctx.header('Content-Type', 'application/xml');
  return ctx.body(renderRss2(data));
};

// 注册路由（和其他插件保持一致的setup方法）
let setup = (route) => {
  route.get('/ankang/gov/:nodeId', deal); // 路由：/rss/ankang/gov/1466
};

// 导出包含setup的对象（关键：和其他插件格式统一）
export default { setup };
