// ==UserScript==
// @name         Gemini Thinking Counter
// @name:zh-CN   Gemini 思考计数器
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Counts Gemini's "Thinking" mode interactions. Resets daily at 13:17. Supports file uploads and edits.
// @description:zh-CN 统计 Gemini 在 Thinking 模式下的对话次数。支持文件发送、编辑和重做，每天 13:17 自动重置。
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

    const STORAGE_KEY_COUNT = 'gemini_thinking_count';
    const STORAGE_KEY_LAST_RESET = 'gemini_last_reset_ts';

    // 内存变量，用于防抖
    let lastIncrementTime = 0;

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
     * 检查是否到达重置时间，并在必要时重置计数
     */
    function checkAndReset() {
        const now = new Date();
        const currentLogicStart = getLogicDayStart(now);
        const lastReset = GM_getValue(STORAGE_KEY_LAST_RESET, 0);

        if (lastReset < currentLogicStart) {
            GM_setValue(STORAGE_KEY_COUNT, 0);
            GM_setValue(STORAGE_KEY_LAST_RESET, now.getTime());
            return 0;
        }
        return GM_getValue(STORAGE_KEY_COUNT, 0);
    }

    /**
     * 增加计数并更新存储
     */
    function incrementCount() {
        const now = Date.now();

        // 防抖检查
        if (now - lastIncrementTime < COOLDOWN_MS) {
            console.log(LOG_PREFIX, 'Ignored duplicate event within cooldown.');
            return;
        }

        let count = checkAndReset();
        count++;

        GM_setValue(STORAGE_KEY_COUNT, count);
        GM_setValue(STORAGE_KEY_LAST_RESET, now);

        lastIncrementTime = now;

        console.log(LOG_PREFIX, `Count incremented. Current Total: ${count}`);
        updateDisplay();
    }

    /**
     * 检查当前是否处于 Thinking 模式
     */
    function isThinkingMode() {
        const label = document.querySelector('bard-mode-switcher .input-area-switch-label span');
        if (!label) return false;
        return label.textContent.trim().includes('Pro');
    }

    /**
     * 检查是否有 @ 提及菜单或类似的浮层打开
     * 用于防止在选择菜单项时回车误触发计数
     */
    function isMentionMenuOpen() {
        // cdk-overlay-pane 是 Angular Material 的浮层容器，at-mentions-menu-panel 是特定的类
        const menu = document.querySelector('.at-mentions-menu-panel');
        // 确保它存在且可见
        return menu && menu.offsetParent !== null;
    }

    /**
     * 检查输入框中是否有内容（文本或文件）
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
            // 如果菜单处于激活状态，则忽略回车键事件
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
            // 编辑模式下一般无需处理 @ 菜单逻辑
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

        // Listen for storage changes from other tabs to sync counter
        GM_addValueChangeListener(STORAGE_KEY_COUNT, (name, oldVal, newVal, remote) => {
            if (remote) {
                updateDisplay();
            }
        });

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