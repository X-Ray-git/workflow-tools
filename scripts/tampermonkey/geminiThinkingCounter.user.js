// ==UserScript==
// @name         Gemini Thinking Counter (Multi-Account)
// @name:zh-CN   Gemini 思考计数器
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Counts Gemini's "Thinking" mode interactions. Supports multiple accounts. Resets daily at 13:17.
// @description:zh-CN 统计 Gemini 在 Thinking 模式下的对话次数。支持多账号独立计数、文件发送、编辑和重做，每天 13:17 自动重置。
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
    const RESET_HOUR = 13;
    const RESET_MINUTE = 17;
    const COOLDOWN_MS = 1000;

    // 基础存储键（将根据账号 ID 添加后缀）
    const BASE_KEY_COUNT = 'gemini_thinking_count';
    const BASE_KEY_LAST_RESET = 'gemini_last_reset_ts';

    // 内存变量
    let lastIncrementTime = 0;
    let currentAccountSuffix = '_default'; // 如果未找到邮箱，使用默认后缀

    /**
     * 尝试从 DOM 中查找当前用户的电子邮件地址以作为唯一 ID。
     * 策略：
     * 1. 搜索个人资料按钮上的特定 aria-label（Google 标准模式）。
     * 2. 搜索用户提供的隐藏 hover-card 结构。
     */
    function getAccountIdentifier() {
        // 用于提取邮箱的正则
        const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/;

        // 策略 1：检查带有 "Google Account" 或 "Google 帐号" aria-label 的元素
        const buttons = document.querySelectorAll('a[aria-label], button[aria-label], div[aria-label]');
        for (const btn of buttons) {
            const label = btn.getAttribute('aria-label');
            if (label && (label.includes('Google Account') || label.includes('Google 帐号'))) {
                const match = label.match(emailRegex);
                if (match) {
                    return match[1];
                }
            }
        }

        // 策略 2：检查特定的隐藏结构（基于用户提供的 fallback）
        const deepDivs = document.querySelectorAll('div');
        for (const div of deepDivs) {
            // 检查文本是否完全是邮箱地址
            if (div.innerText && div.innerText.includes('@') && emailRegex.test(div.innerText)) {
                // 启发式：正确的 div 通常有一个包含 "Google" 文本的父级
                const parent = div.parentElement;
                if (parent && parent.innerText.includes('Google')) {
                     const match = div.innerText.match(emailRegex);
                     if (match) return match[1];
                }
            }
        }

        return null;
    }

    /**
     * 获取基于当前账号的动态存储键
     */
    function getStorageKeys() {
        return {
            countKey: `${BASE_KEY_COUNT}${currentAccountSuffix}`,
            resetKey: `${BASE_KEY_LAST_RESET}${currentAccountSuffix}`
        };
    }

    /**
     * 获取逻辑上的“今天”的起始时间戳（即上一个 13:17）
     */
    function getLogicDayStart(dateObj) {
        const pivot = new Date(dateObj);
        pivot.setHours(RESET_HOUR, RESET_MINUTE, 0, 0);
        if (dateObj < pivot) {
            pivot.setDate(pivot.getDate() - 1);
        }
        return pivot.getTime();
    }

    /**
     * 检查重置条件并返回当前计数
     */
    function checkAndReset() {
        const now = new Date();
        const currentLogicStart = getLogicDayStart(now);
        const { countKey, resetKey } = getStorageKeys();

        const lastReset = GM_getValue(resetKey, 0);

        if (lastReset < currentLogicStart) {
            GM_setValue(countKey, 0);
            GM_setValue(resetKey, now.getTime());
            return 0;
        }
        return GM_getValue(countKey, 0);
    }

    /**
     * 增加计数并更新存储
     */
    function incrementCount() {
        const now = Date.now();

        // 防抖
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

    /**
     * 检查是否处于 Thinking 模式
     */
    function isThinkingMode() {
        const label = document.querySelector('bard-mode-switcher .input-area-switch-label span');
        if (!label) return false;
        return label.textContent.trim().includes('Pro');
    }

    /**
     * 检查是否有 @ 提及菜单打开（防止误触）
     */
    function isMentionMenuOpen() {
        const menu = document.querySelector('.at-mentions-menu-panel');
        return menu && menu.offsetParent !== null;
    }

    /**
     * 检查用户是否输入了内容（文本或文件）
     */
    function hasUserContent() {
        const editor = document.querySelector('.ql-editor.textarea');
        const hasText = editor && editor.innerText.trim().length > 0;
        const hasFile = document.querySelector('uploader-file-preview') !== null;
        return hasText || hasFile;
    }

    /**
     * 更新 UI 显示（输入框占位符）
     */
    function updateDisplay() {
        const count = checkAndReset();
        const editor = document.querySelector('.ql-editor.textarea');
        if (editor) {
            editor.setAttribute('data-placeholder', `Ask Gemini 3: ${count}`);
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

        // 发送按钮
        const sendBtn = target.closest('button[aria-label="Send message"], button.send-button');
        if (sendBtn && !sendBtn.disabled) {
            if (hasUserContent() && isThinkingMode()) {
                incrementCount();
            }
            return;
        }

        // 更新按钮
        const updateBtn = target.closest('button.update-button');
        if (updateBtn && !updateBtn.disabled) {
            if (isThinkingMode()) {
                incrementCount();
            }
            return;
        }

        // 重做按钮
        const redoBtn = target.closest('button[aria-label="Redo"], button[mattooltip="Redo"]');
        if (redoBtn && !redoBtn.disabled) {
            if (isThinkingMode()) {
                incrementCount();
            }
            return;
        }
    }

    // -------------------------------------------------------------------------
    // 初始化
    // -------------------------------------------------------------------------

    function init() {
        console.log(LOG_PREFIX, 'Script initialized.');

        // 1. 确定账号 ID
        // 由于头部可能异步加载，尝试多次
        let retryCount = 0;
        const accountInterval = setInterval(() => {
            const email = getAccountIdentifier();
            if (email) {
                currentAccountSuffix = `_user_${email}`;
                console.log(LOG_PREFIX, `Account identified: ${email}`);
                clearInterval(accountInterval);
                updateDisplay(); // 账号确认后立即更新显示
            } else {
                retryCount++;
                if (retryCount > 10) {
                    console.log(LOG_PREFIX, 'Could not identify account email. Using default storage.');
                    clearInterval(accountInterval);
                }
            }
        }, 1000);

        // 2. 监听存储变化（跨标签页同步）
        // 注意：这里使用 focus 事件来简单处理多标签页同步显示的问题，避免过度依赖 GM_addValueChangeListener 监听动态键
        window.addEventListener('focus', updateDisplay);

        // 3. 设置输入框观察器
        const initialInterval = setInterval(() => {
            if (document.querySelector('.ql-editor.textarea')) {
                updateDisplay();
                clearInterval(initialInterval);
            }
        }, 500);

        // 4. 绑定事件
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

        // 5. Mutation Observer 用于保持占位符显示
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.addedNodes.length) {
                    const editor = document.querySelector('.ql-editor.textarea');
                    // 仅当不匹配我们的格式时才更新
                    if (editor && !editor.getAttribute('data-placeholder').startsWith('Ask Gemini 3:')) {
                        updateDisplay();
                    }
                }
                if (mutation.type === 'attributes' && mutation.target.classList.contains('ql-editor')) {
                     const val = mutation.target.getAttribute('data-placeholder');
                     // 防止死循环：如果已经包含冒号（我们的格式）则不处理
                     if (val && !val.includes(':')) {
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