// ==UserScript==
// @name         Gemini 快捷工作流 (新对话、临时对话、关侧栏、聚焦输入框、切换侧栏)
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  使用 Ctrl+O (或 Command+O) 开启新对话、关闭侧栏并聚焦输入框。使用 Ctrl+Shift+N (或 Command+Shift+N) 开启临时对话、关闭侧栏并聚焦输入框。使用 Ctrl+I (或 Command+I) 直接聚焦输入框。使用 Ctrl+L (或 Command+L) 切换侧边栏。
// @author       Script Author (Modified by Gemini)
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
     * 查找并点击 "临时对话" 按钮。
     * @returns {boolean} - 如果按钮被找到并点击，则返回 true，否则返回 false。
     */
    function findAndClickTempChatButton() {
        // 基于用户提供的选择器和猜测的 aria-label
        const selectors = [
            'button[data-test-id="temp-chat-button"]', // 猜测的 test-id
            'button[aria-label="New temporary chat"]',
            'button[aria-label="Start temporary chat"]',
            'button[aria-label="临时对话"]',
            'button[aria-label="开始临时对话"]',
            // 使用用户选择器中的关键类名 (移除了 .temp-chat-on, 因为它可能表示状态)
            'button.temp-chat-button.mat-unthemed'
        ];

        let tempChatButton = null;
        for (let selector of selectors) {
            if (typeof selector === 'function') {
                tempChatButton = selector();
            } else {
                tempChatButton = document.querySelector(selector);
            }
            if (tempChatButton) {
                console.log(`${LOG_PREFIX} 找到了 '临时对话' 按钮 (使用选择器: ${selector})`);
                break;
            }
        }

        if (tempChatButton) {
            if (tempChatButton.disabled) {
                console.warn(`${LOG_PREFIX} '临时对话' 按钮被禁用。`);
                return false;
            }
            console.log(`${LOG_PREFIX} 正在点击 '临时对话' 按钮。`);
            tempChatButton.click();
            return true;
        } else {
            console.error(`${LOG_PREFIX} 错误: 未能定位 '临时对话' 按钮。`);
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
        else if (isCtrlOrMeta && !event.shiftKey && event.code === 'KeyI') {
            console.log(`${LOG_PREFIX} 检测到 (Ctrl/Cmd)+I, G正在聚焦输入框。`);
            event.preventDefault();
            event.stopPropagation();

            // 直接调用聚焦函数
            focusOnInputField();
        }
        // 快捷键: Ctrl+L (Windows/Linux) 或 Command+L (Mac)
        else if (isCtrlOrMeta && !event.shiftKey && event.code === 'KeyL') {
            console.log(`${LOG_PREFIX} 检测到 (Ctrl/Cmd)+L, 正在切换侧边栏。`);
            event.preventDefault();
            event.stopPropagation();

            // 调用切换侧边栏函数
            toggleSidebar();
        }
        // 快捷键: Ctrl+Shift+N (Windows/Linux) 或 Command+Shift+N (Mac)
        else if (isCtrlOrMeta && event.shiftKey && event.code === 'KeyN') {
            console.log(`${LOG_PREFIX} 检测到 (Ctrl/Cmd)+Shift+N, 执行 '临时对话' 工作流。`);
            event.preventDefault();
            event.stopPropagation();

            // 步骤 1: 检查侧边栏是否打开，如果未打开，则打开它
            const chatApp = document.querySelector('chat-app');
            let sidebarWasClosed = false;
            if (chatApp && !chatApp.classList.contains('side-nav-open')) {
                console.log(`${LOG_PREFIX} 侧边栏已关闭, 正在打开以查找 '临时对话' 按钮。`);
                toggleSidebar(); // 'toggleSidebar' 会打开它
                sidebarWasClosed = true;
            }

            // 步骤 2: 尝试点击 "临时对话" 按钮
            // 需要一个更长的延迟，以等待侧边栏完全打开 (如果它刚才被触发打开)
            const clickTempChatWorkflow = () => {
                const success = findAndClickTempChatButton();

                if (success) {
                    console.log(`${LOG_PREFIX} '临时对话' 按钮点击成功。`);
                    // 步骤 3: 关闭侧边栏 (模仿 Ctrl+O 的工作流)
                    // 再次延迟，确保 '临时对话' 点击已生效
                    setTimeout(closeSidebarByClick, 100); //

                    // 步骤 4: 稍作延迟后聚焦输入框
                    setTimeout(focusOnInputField, 200); //
                } else {
                    console.error(`${LOG_PREFIX} '临时对话' 工作流失败 (未找到按钮)。`);
                    // 如果我们打开了侧边栏但失败了，将其关掉
                    if (sidebarWasClosed) {
                        console.log(`${LOG_PREFIX} 正在关闭未找到按钮的侧边栏。`);
                        // 再次调用 toggleSidebar 来关闭它
                        toggleSidebar();
                    }
                }
                 console.log(`${LOG_PREFIX} '临时对话' 工作流执行完毕。`);
            };

            // *** 关键修改 ***
            // 如果侧边栏是关闭的，等待 350ms (增加) 让它打开
            // 如果侧边栏已经打开，给予 50ms 延迟
            setTimeout(clickTempChatWorkflow, sidebarWasClosed ? 350 : 50);
        }
    });

    console.log(`${LOG_PREFIX} 脚本 (v1.2) 已加载。快捷键: (Ctrl/Cmd)+O, (Ctrl/Cmd)+Shift+N, (Ctrl/Cmd)+I, (Ctrl/Cmd)+L`);
})();