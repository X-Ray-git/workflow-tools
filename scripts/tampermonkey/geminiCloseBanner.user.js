// ==UserScript==
// @name         Gemini Auto-Close Announcement Banner
// @name:zh-CN   Gemini 自动关闭公告横幅
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Automatically clicks the close button on the Gemini announcement banner.
// @description:zh-CN 自动点击 Gemini 公告横幅的关闭按钮。
// @author       Script Author
// @match        https://gemini.google.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const LOG_PREFIX = '[Gemini 自动关闭]';
    const BUTTON_SELECTOR = 'announcement-banner button[aria-label="Close banner"]';

    /**
     * 查找并点击关闭按钮
     */
    function closeBanner() {
        const closeBtn = document.querySelector(BUTTON_SELECTOR);
        if (closeBtn) {
            closeBtn.click();
            console.log(`${LOG_PREFIX} 公告横幅已关闭。`);
        }
    }

    /**
     * 初始化 MutationObserver 以处理动态加载的内容
     */
    function initObserver() {
        const observer = new MutationObserver((mutations) => {
            let shouldCheck = false;

            // 检查是否有节点添加，避免在每次属性变更时都执行查询
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    shouldCheck = true;
                    break;
                }
            }

            if (shouldCheck) {
                closeBanner();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 初始化
    closeBanner();
    initObserver();
})();