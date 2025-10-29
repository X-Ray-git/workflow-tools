// ==UserScript==
// @name         Gemini 快捷工作流 (新对话、关侧栏、聚焦输入框、切换侧栏)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  使用 Ctrl+O (或 Command+O) 开启新对话、关闭侧栏并聚焦输入框。使用 Ctrl+I (或 Command+I) 直接聚焦输入框。使用 Ctrl+L (或 Command+L) 切换侧边栏。
// @author       Script Author
// @match        https://gemini.google.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const LOG_PREFIX = "[Gemini 快捷键]";

    /**
     * 查找并点击 "新对话" 按钮。
     * @returns {boolean} - 如果按钮被找到并点击，则返回 true，否则返回 false。
     */
    function findAndClickNewChatButton() {
        const selectors = [
            'button[data-test-id="new-chat-button"]',
            'button[aria-label="New chat"]',
            'button[aria-label="新对话"]', // 兼容中文界面
            function() { // 通过文本内容查找
                const buttons = document.querySelectorAll('side-nav-action-button button .gds-body-m');
                for (let button of buttons) {
                    const text = button.textContent ? button.textContent.trim().toLowerCase() : '';
                    if (text === 'new chat' || text === '新对话') {
                        return button.closest('button');
                    }
                }
                return null;
            }
        ];

        let newChatButton = null;
        for (let selector of selectors) {
            if (typeof selector === 'function') {
                newChatButton = selector();
            } else {
                newChatButton = document.querySelector(selector);
            }
            if (newChatButton) break;
        }

        if (newChatButton) {
            if (newChatButton.disabled) {
                console.warn(`${LOG_PREFIX} '新对话' 按钮被禁用。`);
                return false;
            }
            console.log(`${LOG_PREFIX} 正在点击 '新对话' 按钮。`);
            newChatButton.click();
            return true;
        } else {
            console.error(`${LOG_PREFIX} 错误: 未能定位 '新对话' 按钮。`);
            return false;
        }
    }

    /**
     * 通过模拟点击汉堡菜单按钮来关闭侧边栏。
     */
    function closeSidebarByClick() {
        const chatApp = document.querySelector('chat-app');
        const menuButton = document.querySelector('button[data-test-id="side-nav-menu-button"]');

        // 仅当侧边栏确实是打开状态时才点击按钮
        if (chatApp && menuButton && chatApp.classList.contains('side-nav-open')) {
            console.log(`${LOG_PREFIX} 侧边栏已打开, 正在关闭。`);
            menuButton.click();
        } else if (chatApp && !chatApp.classList.contains('side-nav-open')) {
            console.log(`${LOG_PREFIX} 侧边栏已关闭, 无需操作。`);
        } else {
            console.error(`${LOG_PREFIX} 错误: 未能定位 'side-nav-menu-button' 或 'chat-app' 元素。`);
        }
    }

    /**
     * 通过模拟点击汉堡菜单按钮来切换侧边栏（打开/关闭）。
     */
    function toggleSidebar() {
        const menuButton = document.querySelector('button[data-test-id="side-nav-menu-button"]');
        const chatApp = document.querySelector('chat-app'); // 用于日志记录

        if (menuButton) {
            if (chatApp) {
                const isOpening = !chatApp.classList.contains('side-nav-open');
                console.log(`${LOG_PREFIX} 正在${isOpening ? '打开' : '关闭'}侧边栏。`);
            } else {
                console.log(`${LOG_PREFIX} 正在点击菜单按钮 (无法检测 'chat-app' 状态)。`);
            }
            menuButton.click();
        } else {
            console.error(`${LOG_PREFIX} 错误: 未能定位 'side-nav-menu-button' 元素。`);
        }
    }


    /**
     * 查找主文本输入字段并将光标聚焦于此。
     */
    function focusOnInputField() {
        // 这个选择器会定位到作为文本区域的可编辑 div 元素
        const inputSelector = 'div.ql-editor[aria-label="Enter a prompt here"], div.ql-editor[aria-label="在此处输入提示"]';
        const inputField = document.querySelector(inputSelector);

        if (inputField) {
            console.log(`${LOG_PREFIX} 正在聚焦输入框。`);
            inputField.focus();
        } else {
            console.error(`${LOG_PREFIX} 错误: 未能定位输入框。`);
        }
    }

    // --- 主事件监听器 ---
    document.addEventListener('keydown', function(event) {
        const isCtrlOrMeta = event.ctrlKey || event.metaKey;

        // 快捷键: Ctrl+O (Windows/Linux) 或 Command+O (Mac)
        // 确保 Shift 键没有被按下
        if (isCtrlOrMeta && !event.shiftKey && event.code === 'KeyO') {
            console.log(`${LOG_PREFIX} 检测到 (Ctrl/Cmd)+O, 执行 '新对话' 工作流。`);
            event.preventDefault();
            event.stopPropagation();

            // 步骤 1: 尝试点击 "新对话" 按钮
            findAndClickNewChatButton();

            // 步骤 2: 关闭侧边栏
            closeSidebarByClick();

            // 步骤 3: 稍作延迟后聚焦输入框，确保UI更新完毕
            setTimeout(focusOnInputField, 100);

            console.log(`${LOG_PREFIX} '新对话' 工作流执行完毕。`);
        }
        // 快捷键: Ctrl+I (Windows/Linux) 或 Command+I (Mac)
        else if (isCtrlOrMeta && event.code === 'KeyI') {
            console.log(`${LOG_PREFIX} 检测到 (Ctrl/Cmd)+I, 正在聚焦输入框。`);
            event.preventDefault();
            event.stopPropagation();

            // 直接调用聚焦函数
            focusOnInputField();
        }
        // 快捷键: Ctrl+L (Windows/Linux) 或 Command+L (Mac)
        else if (isCtrlOrMeta && event.code === 'KeyL') {
            console.log(`${LOG_PREFIX} 检测到 (Ctrl/Cmd)+L, 正在切换侧边栏。`);
            event.preventDefault();
            event.stopPropagation();

            // 调用切换侧边栏函数
            toggleSidebar();
        }
    });

    console.log(`${LOG_PREFIX} 脚本 (v1.0) 已加载。快捷键: (Ctrl/Cmd)+O, (Ctrl/Cmd)+I, (Ctrl/Cmd)+L`);
})();