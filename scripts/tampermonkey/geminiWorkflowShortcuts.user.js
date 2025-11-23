// ==UserScript==
// @name         Gemini 快捷工作流
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Gemini 快捷键增强：Ctrl+O 新对话、Ctrl+Shift+N 临时对话、Ctrl+Shift+P Paper 对话、Ctrl+I 聚焦输入框、Ctrl+L 切换侧边栏。
// @author       Script Author
// @match        https://gemini.google.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const LOG_PREFIX = "[Gemini 快捷键]";

    /**
     * 查找并点击“新对话”按钮
     * @returns {boolean} 操作是否成功
     */
    function findAndClickNewChatButton() {
        const selectors = [
            'button[data-test-id="new-chat-button"]',
            'button[aria-label="New chat"]',
            'button[aria-label="新对话"]',
            function() {
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
     * 查找并点击“临时对话”按钮
     * @returns {boolean} 操作是否成功
     */
    function findAndClickTempChatButton() {
        const selectors = [
            'button[data-test-id="temp-chat-button"]',
            'button[aria-label="New temporary chat"]',
            'button[aria-label="Start temporary chat"]',
            'button[aria-label="临时对话"]',
            'button[aria-label="开始临时对话"]',
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
     * 查找并点击 "Paper" 按钮
     * @returns {boolean} 操作是否成功
     */
    function findAndClickPaperButton() {
        const findByText = function() {
            const botNames = document.querySelectorAll('span.bot-name');
            for (let span of botNames) {
                if (span.textContent && span.textContent.trim() === 'Paper') {
                    return span.closest('button');
                }
            }
            return null;
        };

        const paperButton = findByText();

        if (paperButton) {
            console.log(`${LOG_PREFIX} 正在点击 'Paper' 按钮。`);
            paperButton.click();
            return true;
        } else {
            console.error(`${LOG_PREFIX} 错误: 未能定位 'Paper' 按钮，请确认侧边栏已打开且该项存在。`);
            return false;
        }
    }

    /**
     * 关闭侧边栏
     */
    function closeSidebarByClick() {
        const chatApp = document.querySelector('chat-app');
        const menuButton = document.querySelector('button[data-test-id="side-nav-menu-button"]');

        if (chatApp && menuButton && chatApp.classList.contains('side-nav-open')) {
            console.log(`${LOG_PREFIX} 侧边栏已打开, 正在关闭。`);
            menuButton.click();
        } else if (chatApp && !chatApp.classList.contains('side-nav-open')) {
            // 侧边栏已关闭，无需操作
        } else {
            console.error(`${LOG_PREFIX} 错误: 未能定位 'side-nav-menu-button' 或 'chat-app' 元素。`);
        }
    }

    /**
     * 切换侧边栏状态（打开/关闭）
     */
    function toggleSidebar() {
        const menuButton = document.querySelector('button[data-test-id="side-nav-menu-button"]');
        const chatApp = document.querySelector('chat-app');

        if (menuButton) {
            if (chatApp) {
                const isOpening = !chatApp.classList.contains('side-nav-open');
                console.log(`${LOG_PREFIX} 正在${isOpening ? '打开' : '关闭'}侧边栏。`);
            }
            menuButton.click();
        } else {
            console.error(`${LOG_PREFIX} 错误: 未能定位 'side-nav-menu-button' 元素。`);
        }
    }

    /**
     * 聚焦主输入框
     */
    function focusOnInputField() {
        const inputSelector = 'div.ql-editor[aria-label="Enter a prompt here"], div.ql-editor[aria-label="在此处输入提示"]';
        const inputField = document.querySelector(inputSelector);

        if (inputField) {
            console.log(`${LOG_PREFIX} 正在聚焦输入框。`);
            inputField.focus();
        } else {
            console.error(`${LOG_PREFIX} 错误: 未能定位输入框。`);
        }
    }

    /**
     * 执行依赖侧边栏的工作流
     * 自动处理侧边栏的打开、点击目标、恢复状态及聚焦
     * @param {Function} clickActionFunc - 执行点击动作的函数，需返回 boolean
     * @param {string} actionName - 动作名称，用于日志记录
     */
    function executeSidebarWorkflow(clickActionFunc, actionName) {
        const chatApp = document.querySelector('chat-app');
        let sidebarWasClosed = false;

        // 若侧边栏未打开，先打开以加载列表
        if (chatApp && !chatApp.classList.contains('side-nav-open')) {
            console.log(`${LOG_PREFIX} 侧边栏已关闭，正在打开以查找 '${actionName}' 按钮。`);
            toggleSidebar();
            sidebarWasClosed = true;
        }

        const clickWorkflow = () => {
            const success = clickActionFunc();

            if (success) {
                console.log(`${LOG_PREFIX} '${actionName}' 按钮点击成功。`);
                // 点击成功后，清理界面（关闭侧边栏）并聚焦
                setTimeout(closeSidebarByClick, 100);
                setTimeout(focusOnInputField, 200);
            } else {
                console.error(`${LOG_PREFIX} '${actionName}' 工作流失败 (未找到按钮)。`);
                // 若因查找按钮而打开了侧边栏且未找到，则恢复原状
                if (sidebarWasClosed) {
                    toggleSidebar();
                }
            }
        };

        // 根据侧边栏初始状态设置等待时间，确保动画完成或 DOM 更新
        setTimeout(clickWorkflow, sidebarWasClosed ? 350 : 50);
    }

    // --- 事件监听 ---
    document.addEventListener('keydown', function(event) {
        const isCtrlOrMeta = event.ctrlKey || event.metaKey;

        // Ctrl+O / Cmd+O: 新对话
        if (isCtrlOrMeta && !event.shiftKey && event.code === 'KeyO') {
            console.log(`${LOG_PREFIX} 执行 '新对话' 工作流。`);
            event.preventDefault();
            event.stopPropagation();

            findAndClickNewChatButton();
            closeSidebarByClick();
            setTimeout(focusOnInputField, 100);
        }
        // Ctrl+I / Cmd+I: 聚焦输入框
        else if (isCtrlOrMeta && !event.shiftKey && event.code === 'KeyI') {
            event.preventDefault();
            event.stopPropagation();
            focusOnInputField();
        }
        // Ctrl+L / Cmd+L: 切换侧边栏
        else if (isCtrlOrMeta && !event.shiftKey && event.code === 'KeyL') {
            event.preventDefault();
            event.stopPropagation();
            toggleSidebar();
        }
        // Ctrl+Shift+N / Cmd+Shift+N: 临时对话
        else if (isCtrlOrMeta && event.shiftKey && event.code === 'KeyN') {
            console.log(`${LOG_PREFIX} 执行 '临时对话' 工作流。`);
            event.preventDefault();
            event.stopPropagation();
            executeSidebarWorkflow(findAndClickTempChatButton, '临时对话');
        }
        // Ctrl+Shift+P / Cmd+Shift+P: Paper 对话
        else if (isCtrlOrMeta && event.shiftKey && event.code === 'KeyP') {
            console.log(`${LOG_PREFIX} 执行 'Paper' 工作流。`);
            event.preventDefault();
            event.stopPropagation();
            executeSidebarWorkflow(findAndClickPaperButton, 'Paper');
        }
    });

    console.log(`${LOG_PREFIX} 脚本已加载。`);
})();