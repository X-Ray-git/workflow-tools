// ==UserScript==
// @name         Gemini Thinking Counter (Multi-Account)
// @name:zh-CN   Gemini 思考计数器
// @namespace    http://tampermonkey.net/
// @version      1.6
// @description  Counts Gemini's "Thinking" mode interactions. Supports multiple accounts. 4-hour rolling reset based on custom account times.
// @description:zh-CN 统计 Gemini 在 Thinking 模式下的对话次数。支持多账号独立计数、文件发送、编辑和重做，基于各账号自定义基准时间每4小时自动重置。
// @author       Script Author
// @match        https://gemini.google.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const LOG_PREFIX = '[Gemini Thinking Counter]';

    // 配置常量
    const COOLDOWN_MS = 1000;

    // === 账号刷新配置区 ===
    // 保护隐私：使用邮箱的哈希值作为键，避免暴露真实邮箱。
    // 使用方法：运行脚本后，按 F12 打开控制台(Console)，找到 "Account identified. Hash: xxxxx" 的日志。
    // 将那个哈希值填入下方替换 "在此填入哈希值"。
    const ACCOUNT_REFRESH_CONFIG = {
        // "在此填入哈希值": { baseHour: 1, baseMinute: 15 }, 
        "default": { baseHour: 0, baseMinute: 0 } // 默认兜底时间
    };
    // === 配置区结束 ===

    // 基础存储键
    const BASE_KEY_COUNT = 'gemini_thinking_count';
    const BASE_KEY_LAST_RESET = 'gemini_last_reset_ts';

    // 内存变量
    let lastIncrementTime = 0;
    let currentAccountSuffix = '_default';

    /**
     * 简单的字符串哈希函数，用于隐藏真实邮箱
     */
    function getHash(str) {
        let hash = 0;
        for (let i = 0, len = str.length; i < len; i++) {
            let chr = str.charCodeAt(i);
            hash = (hash << 5) - hash + chr;
            hash |= 0; 
        }
        return hash.toString();
    }

    /**
     * 获取当前账号的配置时间
     */
    function getAccountConfig() {
        const hashMatch = currentAccountSuffix.match(/_user_(.+)/);
        const hash = hashMatch ? hashMatch[1] : null;
        return ACCOUNT_REFRESH_CONFIG[hash] || ACCOUNT_REFRESH_CONFIG["default"];
    }

    function getAccountIdentifier() {
        const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/;
        const buttons = document.querySelectorAll('a[aria-label], button[aria-label], div[aria-label]');
        for (const btn of buttons) {
            const label = btn.getAttribute('aria-label');
            if (label && (label.includes('Google Account') || label.includes('Google 帐号'))) {
                const match = label.match(emailRegex);
                if (match) return match[1];
            }
        }
        const deepDivs = document.querySelectorAll('div');
        for (const div of deepDivs) {
            if (div.innerText && div.innerText.includes('@') && emailRegex.test(div.innerText)) {
                const parent = div.parentElement;
                if (parent && parent.innerText.includes('Google')) {
                     const match = div.innerText.match(emailRegex);
                     if (match) return match[1];
                }
            }
        }
        return null;
    }

    function getStorageKeys() {
        return {
            countKey: `${BASE_KEY_COUNT}${currentAccountSuffix}`,
            resetKey: `${BASE_KEY_LAST_RESET}${currentAccountSuffix}`
        };
    }

    /**
     * 获取最近一次 4 小时周期的起点时间戳
     */
    function getLatestResetTime() {
        const now = new Date();
        const config = getAccountConfig();
        
        const baseTimeToday = new Date(now);
        baseTimeToday.setHours(config.baseHour, config.baseMinute, 0, 0);
        
        const WINDOW_MS = 4 * 60 * 60 * 1000;

        if (now.getTime() < baseTimeToday.getTime()) {
            const baseTimeYesterday = new Date(baseTimeToday);
            baseTimeYesterday.setDate(baseTimeYesterday.getDate() - 1);
            
            const timeDiff = now.getTime() - baseTimeYesterday.getTime();
            const cycles = Math.floor(timeDiff / WINDOW_MS);
            return baseTimeYesterday.getTime() + cycles * WINDOW_MS;
        } else {
            const timeDiff = now.getTime() - baseTimeToday.getTime();
            const cycles = Math.floor(timeDiff / WINDOW_MS);
            return baseTimeToday.getTime() + cycles * WINDOW_MS;
        }
    }

    function checkAndReset() {
        const nowMs = Date.now();
        const currentWindowStart = getLatestResetTime();
        const { countKey, resetKey } = getStorageKeys();

        const lastReset = GM_getValue(resetKey, 0);

        if (lastReset < currentWindowStart) {
            GM_setValue(countKey, 0);
            GM_setValue(resetKey, nowMs);
            return 0;
        }
        return GM_getValue(countKey, 0);
    }

    function incrementCount() {
        const now = Date.now();
        if (now - lastIncrementTime < COOLDOWN_MS) {
            console.log(LOG_PREFIX, 'Ignored duplicate event within cooldown.');
            return;
        }

        let count = checkAndReset();
        count++;

        const { countKey, resetKey } = getStorageKeys();
        GM_setValue(countKey, count);
        GM_setValue(resetKey, now);

        lastIncrementTime = now;

        console.log(LOG_PREFIX, `Count incremented for [${currentAccountSuffix}]. Current Total: ${count}`);
        updateDisplay();
    }

    function isThinkingMode() {
        const label = document.querySelector('bard-mode-switcher .input-area-switch-label span');
        if (!label) return false;
        return label.textContent.trim().includes('Pro');
    }

    function isMentionMenuOpen() {
        const menu = document.querySelector('.at-mentions-menu-panel');
        return menu && menu.offsetParent !== null;
    }

    function hasUserContent() {
        const editor = document.querySelector('.ql-editor.textarea');
        const hasText = editor && editor.innerText.trim().length > 0;
        const hasFile = document.querySelector('uploader-file-preview') !== null;
        return hasText || hasFile;
    }

    /**
     * 格式化时间戳为 HH:MM
     */
    function formatTime(timestamp) {
        const d = new Date(timestamp);
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }

    /**
     * 更新 UI 显示，包含下一次刷新时间
     */
    function updateDisplay() {
        const count = checkAndReset();
        const nextResetTs = getLatestResetTime() + (4 * 60 * 60 * 1000);
        const nextResetStr = formatTime(nextResetTs);

        const editor = document.querySelector('.ql-editor.textarea');
        if (editor) {
            editor.setAttribute('data-placeholder', `Ask Gemini 3: ${count} (${nextResetStr})`);
        }
    }

    // -------------------------------------------------------------------------
    // 事件处理
    // -------------------------------------------------------------------------

    function handleMainEnter(event) {
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
            if (isMentionMenuOpen()) {
                console.log(LOG_PREFIX, 'Enter ignored: Mention menu is active.');
                return;
            }
            if (hasUserContent() && isThinkingMode()) {
                incrementCount();
                setTimeout(updateDisplay, 100);
            }
        }
    }

    function handleUpdateEnter(event) {
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
            const textarea = event.target;
            if (textarea.value.trim().length > 0 && isThinkingMode()) {
                incrementCount();
            }
        }
    }

    function handleClick(event) {
        const target = event.target;
        const sendBtn = target.closest('button[aria-label="Send message"], button.send-button');
        if (sendBtn && !sendBtn.disabled) {
            if (hasUserContent() && isThinkingMode()) incrementCount();
            return;
        }
        const updateBtn = target.closest('button.update-button');
        if (updateBtn && !updateBtn.disabled) {
            if (isThinkingMode()) incrementCount();
            return;
        }
        const redoBtn = target.closest('button[aria-label="Redo"], button[mattooltip="Redo"]');
        if (redoBtn && !redoBtn.disabled) {
            if (isThinkingMode()) incrementCount();
            return;
        }
    }

    // -------------------------------------------------------------------------
    // 初始化
    // -------------------------------------------------------------------------

    function init() {
        console.log(LOG_PREFIX, 'Script initialized.');

        let retryCount = 0;
        const accountInterval = setInterval(() => {
            const email = getAccountIdentifier();
            if (email) {
                const accountHash = getHash(email);
                currentAccountSuffix = `_user_${accountHash}`;
                // 请在控制台中查看此 Hash 值并填入脚本顶部的配置中
                console.log(LOG_PREFIX, `Account identified. Hash: ${accountHash}`);
                clearInterval(accountInterval);
                updateDisplay(); 
            } else {
                retryCount++;
                if (retryCount > 10) {
                    console.log(LOG_PREFIX, 'Could not identify account email. Using default config.');
                    clearInterval(accountInterval);
                    updateDisplay();
                }
            }
        }, 1000);

        window.addEventListener('focus', updateDisplay);

        const initialInterval = setInterval(() => {
            if (document.querySelector('.ql-editor.textarea')) {
                updateDisplay();
                clearInterval(initialInterval);
            }
        }, 500);

        document.addEventListener('keydown', (e) => {
            const target = e.target;
            if (target.classList.contains('ql-editor') && target.classList.contains('textarea')) {
                handleMainEnter(e);
            }
            else if (target.tagName === 'TEXTAREA' && target.classList.contains('mat-mdc-input-element')) {
                handleUpdateEnter(e);
            }
        }, true);

        document.addEventListener('click', handleClick, true);

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.addedNodes.length) {
                    const editor = document.querySelector('.ql-editor.textarea');
                    if (editor && !editor.getAttribute('data-placeholder').startsWith('Ask Gemini 3:')) {
                        updateDisplay();
                    }
                }
                if (mutation.type === 'attributes' && mutation.target.classList.contains('ql-editor')) {
                     const val = mutation.target.getAttribute('data-placeholder');
                     // 兼容新的占位符格式
                     if (val && !val.startsWith('Ask Gemini 3:')) {
                         updateDisplay();
                     }
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-placeholder', 'class']
        });
    }

    init();

})();