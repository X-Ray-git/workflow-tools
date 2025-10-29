// ==UserScript==
// @name         ArXiv Abstract to PDF (First Visit Only)
// @name:zh-CN   ArXiv 摘要页首次访问自动跳转PDF
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Redirects arXiv abstract pages to PDF pages on the first visit, and does nothing on subsequent visits.
// @description:zh-CN 访问 arXiv 摘要页面时，如果是第一次访问，则自动跳转到 PDF 页面；如果已经访问过，则不执行任何操作。
// @author       Your Name
// @match        https://arxiv.org/abs/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // 定义日志前缀
    const LOG_PREFIX = '[ArXiv Auto PDF]:';

    // 存储访问记录的键名
    const visitedKey = 'arxivVisitedPages';

    // 获取当前页面 URL
    const currentUrl = window.location.href;

    // 安全检查：如果当前已是 PDF 页面，则终止脚本
    // (防止 @match 意外匹配或未来 URL 结构变化导致的重定向循环)
    if (currentUrl.includes('/pdf/')) {
        return;
    }

    // 获取已访问页面的存储数据
    let visitedPages;
    const visitedPagesStr = GM_getValue(visitedKey, '[]');

    try {
        visitedPages = JSON.parse(visitedPagesStr);
        // 确保数据格式正确（必须是数组）
        if (!Array.isArray(visitedPages)) {
            visitedPages = [];
        }
    } catch (e) {
        console.error(LOG_PREFIX, '解析访问记录失败。将重置访问列表。', e);
        visitedPages = []; // 解析失败时重置
    }

    // 检查当前 URL 是否已被访问
    if (visitedPages.includes(currentUrl)) {
        // 已访问：不执行任何操作
        console.log(LOG_PREFIX, '页面已访问，无需跳转。');
        return;
    } else {
        // 首次访问：执行跳转并记录
        console.log(LOG_PREFIX, '首次访问，准备跳转至 PDF。');

        // 将当前 URL 添加到访问记录
        visitedPages.push(currentUrl);
        try {
            GM_setValue(visitedKey, JSON.stringify(visitedPages));
        } catch (e) {
            console.error(LOG_PREFIX, '保存访问记录失败。', e);
            // 注意：即使保存失败，本次跳转依然会执行
        }

        // 执行重定向
        const pdfUrl = currentUrl.replace('/abs/', '/pdf/');
        window.location.href = pdfUrl;
    }
})();