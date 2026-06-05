// ==UserScript==
// @name         Workflow 快捷键 (Gemini & ChatGPT)
// @namespace    http://tampermonkey.net/
// @version      1.6
// @description  工作流快捷键增强：支持 Gemini 和 ChatGPT。Ctrl+O 新对话、Ctrl+I 聚焦输入框、Ctrl+L 切换侧边栏，支持自定义快捷提示词。
// @author       Script Author
// @match        https://gemini.google.com/*
// @match        https://chatgpt.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const LOG_PREFIX = "[Workflow 快捷键]";

    // --- 存储管理 ---
    const STORAGE_KEY = 'workflow_custom_shortcuts';

    function loadConfig() {
        const config = GM_getValue(STORAGE_KEY, []);
        console.log(`${LOG_PREFIX} 加载配置:`, config);
        return config;
    }

    function saveConfig(config) {
        GM_setValue(STORAGE_KEY, config);
        console.log(`${LOG_PREFIX} 保存配置:`, config);
    }

    // --- 样式注入 ---
    // 自动适配深色/浅色模式 (基于 Gemini 的 body 属性或其他特征，这里采用简单的媒体查询+类名判断策略)
    // 实际运行时，会在打开模态框时检测页面主题并添加对应类名
    GM_addStyle(`
        #gemini-shortcut-settings-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.5);
            z-index: 99999;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: 'Google Sans', Roboto, Arial, sans-serif;
            opacity: 0;
            transition: opacity 0.2s;
            pointer-events: none;
        }
        #gemini-shortcut-settings-overlay.visible {
            opacity: 1;
            pointer-events: auto;
        }
        #gemini-shortcut-settings-modal {
            width: 800px;
            max-width: 90%;
            max-height: 85vh;
            background: #fff;
            border-radius: 24px;
            box-shadow: 0 4px 24px rgba(0,0,0,0.2);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            color: #1f1f1f;
        }
        /* Dark Mode Styles */
        body.dark-theme #gemini-shortcut-settings-modal {
            background: #1e1e1e;
            color: #e3e3e3;
            box-shadow: 0 4px 24px rgba(0,0,0,0.6);
        }

        /* Header */
        .settings-header {
            padding: 24px;
            border-bottom: 1px solid #e0e0e0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        body.dark-theme .settings-header {
            border-bottom-color: #444;
        }
        .settings-title {
            font-size: 22px;
            font-weight: 500;
            margin: 0;
        }
        .close-btn {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: inherit;
            padding: 0 8px;
        }

        /* Content */
        .settings-content {
            padding: 24px;
            overflow-y: auto;
            flex: 1;
            background: #f5f5f5; /* Light background for contrast */
        }
        body.dark-theme .settings-content {
            background: #1e1e1e; /* Dark background matches modal */
        }

        .shortcut-item {
            display: grid;
            grid-template-columns: 180px 1fr 60px; /* Fixed - Flexible - Fixed */
            gap: 24px;
            align-items: start;
            margin-bottom: 16px;
            padding: 24px;
            border-radius: 12px;
            background: #fff;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        body.dark-theme .shortcut-item {
            background: #2d2d2d;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }

        /* Left Column: Shortcut & Switch */
        .left-col {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        /* Middle Column: Prompt */
        .mid-col {
            display: flex;
            flex-direction: column;
            gap: 8px;
            height: 100%;
        }

        /* Right Column: Delete */
        .right-col {
            display: flex;
            justify-content: flex-end;
            padding-top: 28px; /* Align with input */
        }

        .input-label {
            font-size: 13px;
            font-weight: 500;
            color: #5f6368;
            margin-bottom: 6px;
            display: block;
        }
        body.dark-theme .input-label {
            color: #aaa;
        }

        .shortcut-input-wrapper {
             position: relative;
        }

        input[type="text"], textarea {
            width: 100%;
            padding: 12px;
            border: 1px solid #dadce0;
            border-radius: 8px;
            font-family: inherit;
            font-size: 14px;
            background: #fff;
            color: inherit;
            box-sizing: border-box;
            transition: border-color 0.2s;
        }
        input[type="text"]:focus, textarea:focus {
            border-color: #1a73e8;
            outline: none;
        }
        body.dark-theme input[type="text"], body.dark-theme textarea {
            background: #3c4043;
            border-color: #5f6368;
            color: #e3e3e3;
        }
        body.dark-theme input[type="text"]:focus, body.dark-theme textarea:focus {
            border-color: #8ab4f8;
        }

        textarea {
            resize: vertical;
            min-height: 80px;
            height: 100%;
        }

        /* Toggle Switch Style for New Chat */
        .switch-wrapper {
            display: flex;
            align-items: center;
            gap: 12px;
            cursor: pointer;
            user-select: none;
        }
        .switch-label {
            font-size: 13px;
            color: #5f6368;
        }
        body.dark-theme .switch-label {
            color: #aaa;
        }

        /* The Switch */
        .toggle-switch {
            position: relative;
            width: 36px;
            height: 20px;
            background: #dadce0;
            border-radius: 20px;
            transition: background 0.2s;
        }
        .toggle-switch::after {
            content: '';
            position: absolute;
            top: 2px;
            left: 2px;
            width: 16px;
            height: 16px;
            background: #fff;
            border-radius: 50%;
            transition: transform 0.2s;
            box-shadow: 0 1px 2px rgba(0,0,0,0.2);
        }

        input[type="checkbox"] {
            display: none;
        }
        input[type="checkbox"]:checked + .toggle-switch {
            background: #1a73e8;
        }
        input[type="checkbox"]:checked + .toggle-switch::after {
            transform: translateX(16px);
        }
        body.dark-theme .toggle-switch {
            background: #5f6368;
        }
        body.dark-theme input[type="checkbox"]:checked + .toggle-switch {
            background: #8ab4f8;
        }

        .delete-btn {
            background: transparent;
            color: #5f6368;
            border: 1px solid transparent;
            border-radius: 50%;
            width: 32px;
            height: 32px;
            padding: 0;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            line-height: 1;
            transition: background 0.2s, color 0.2s;
        }
        .delete-btn:hover {
            background: #fee2e2;
            color: #d93025;
        }
        body.dark-theme .delete-btn {
            color: #aaa;
        }
        body.dark-theme .delete-btn:hover {
            background: #5c2b2b;
            color: #ff8a80;
        }

        .conflict-warning {
            color: #d93025;
            font-size: 12px;
            margin-top: 4px;
            display: none;
        }
        body.dark-theme .conflict-warning {
            color: #ff8a80;
        }

        /* Footer */
        .settings-footer {
            padding: 16px 24px;
            border-top: 1px solid #e0e0e0;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            background: #fff;
        }
        body.dark-theme .settings-footer {
            border-top-color: #444;
            background: #1e1e1e;
        }
        .btn {
            padding: 10px 24px;
            border-radius: 20px;
            border: none;
            font-weight: 500;
            cursor: pointer;
            font-size: 14px;
        }
        .btn-primary {
            background: #1a73e8;
            color: white;
        }
        .btn-secondary {
            background: #f1f3f4;
            color: #1f1f1f;
        }
        body.dark-theme .btn-primary {
            background: #8ab4f8;
            color: #202124;
        }
        body.dark-theme .btn-secondary {
            background: #3c4043;
            color: #e3e3e3;
        }

        .add-btn-wrapper {
            display: flex;
            justify-content: center;
            padding: 0 24px 20px 24px;
        }
        .btn-add {
            background: transparent;
            border: 1px dashed #999;
            color: #666;
            width: 100%;
            padding: 12px;
            border-radius: 12px;
        }
        body.dark-theme .btn-add {
            border-color: #666;
            color: #aaa;
        }
        
        .settings-info {
            padding: 12px 24px;
            background: #e8f0fe;
            color: #1a73e8;
            font-size: 13px;
            line-height: 1.5;
            border-bottom: 1px solid #e0e0e0;
        }
        body.dark-theme .settings-info {
            background: #1e293b;
            color: #8ab4f8;
            border-bottom-color: #444;
        }
    `);

    // --- 站点适配器 (Site Adapters) ---
    class GeminiAdapter {
        findAndClickNewChatButton() {
            const selectors = [
                '[data-test-id="new-chat-button"] a[aria-label="New chat"]',
                '[data-test-id="new-chat-button"] a[href="/app"]',
                'side-nav-action-button[data-test-id="new-chat-button"] a',
                '[aria-label="New chat"]',
                '[aria-label="新对话"]',
                '[data-test-id="new-chat-button"]',
                'button[data-test-id="new-chat-button"]',
                function() {
                    const elements = document.querySelectorAll('gem-nav-list-item .title-text, side-nav-action-button .gds-body-m, side-nav-action-button span');
                    for (let el of elements) {
                        const text = el.textContent ? el.textContent.trim().toLowerCase() : '';
                        if (text === 'new chat' || text === '新对话') {
                            return el.closest('a') || el.closest('a, button, gem-nav-list-item, side-nav-action-button');
                        }
                    }
                    return null;
                }
            ];
            let newChatButton = null;
            for (let selector of selectors) {
                newChatButton = (typeof selector === 'function') ? selector() : document.querySelector(selector);
                if (newChatButton) break;
            }
            if (newChatButton) {
                if (newChatButton.disabled || newChatButton.getAttribute('aria-disabled') === 'true') return false;
                newChatButton.click();
                return true;
            }
            return false;
        }

        findAndClickTempChatButton() {
            const selectors = [
                'button[aria-label="Temporary chat"]', 'button[data-test-id="temp-chat-button"]',
                'button[aria-label="New temporary chat"]', 'button[aria-label="Start temporary chat"]',
                'button[aria-label="临时对话"]', 'button[aria-label="开始临时对话"]',
                'button.temp-chat-button.mat-unthemed'
            ];
            let btn = null;
            for (let s of selectors) {
                btn = (typeof s === 'function') ? s() : document.querySelector(s);
                if (btn) break;
            }
            if (btn && !btn.disabled) {
                btn.click();
                return true;
            }
            return false;
        }

        isSidebarOpen() {
            const sideNav = document.querySelector('bard-sidenav');
            if (sideNav && !sideNav.classList.contains('collapsed')) return true;
            const chatApp = document.querySelector('chat-app');
            if (chatApp && chatApp.classList.contains('side-nav-open')) return true;
            return false;
        }

        getSidebarToggleButton() {
            const closeBtn = document.querySelector('button[aria-label="Close sidebar"].close-sidenav-button');
            if (closeBtn) return closeBtn;
            return document.querySelector('button[data-test-id="side-nav-sparkle-button"][aria-label="Open sidebar"]')
                || document.querySelector('button[data-test-id="side-nav-menu-button"]');
        }

        closeSidebarByClick() {
            if (this.isSidebarOpen()) {
                const btn = this.getSidebarToggleButton();
                if (btn) btn.click();
            }
        }

        toggleSidebar() {
            const btn = this.getSidebarToggleButton();
            if (btn) btn.click();
        }

        getInputField() {
            const inputSelector = 'div.ql-editor[aria-label="Enter a prompt for Gemini"], div.ql-editor[aria-label="Enter a prompt here"], div.ql-editor[aria-label="在此处输入提示"], div[role="textbox"][contenteditable="true"]';
            return document.querySelector(inputSelector);
        }

        focusOnInputField() {
            const inputField = this.getInputField();
            if (inputField) inputField.focus();
        }

        insertTextToInput(text) {
            const inputField = this.getInputField();
            if (!inputField) return;
            inputField.focus();
            setTimeout(() => {
                const success = document.execCommand('insertText', false, text);
                if (!success || inputField.textContent.trim() === '') {
                     inputField.innerText = text;
                     inputField.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, 50);
        }

        executeSidebarWorkflow(clickActionFunc, actionName) {
            let sidebarWasClosed = false;
            if (!this.isSidebarOpen()) {
                this.toggleSidebar();
                sidebarWasClosed = true;
            }
            const clickWorkflow = () => {
                if (clickActionFunc()) {
                    setTimeout(() => this.closeSidebarByClick(), 100);
                    setTimeout(() => this.focusOnInputField(), 200);
                } else {
                    if (sidebarWasClosed) this.toggleSidebar();
                }
            };
            setTimeout(clickWorkflow, sidebarWasClosed ? 350 : 50);
        }

        executeCustomWorkflow(prompt, newChat) {
            console.log(`${LOG_PREFIX} [Gemini] 执行自定义 Prompt, 新对话: ${newChat}`);
            if (newChat) {
                const success = this.findAndClickNewChatButton();
                if (success) {
                    this.closeSidebarByClick();
                    setTimeout(() => this.insertTextToInput(prompt), 600);
                }
            } else {
                this.focusOnInputField();
                this.insertTextToInput(prompt);
            }
        }
    }

    class ChatGPTAdapter {
        findAndClickNewChatButton() {
            const selectors = [
                '[data-testid="new-chat-button"]',
                'a[href="/"]',
                'a[href="/?model=auto"]'
            ];
            let btn = null;
            for (let s of selectors) {
                btn = document.querySelector(s);
                // ensure it actually looks like a new chat button
                if (btn && btn.textContent && (btn.textContent.includes('New chat') || btn.textContent.includes('新对话'))) break;
                // or if it's SVG only, we trust data-testid
                if (btn && s.includes('data-testid')) break;
            }
            if (!btn) {
                // Fallback: icon button based
                const allLinks = document.querySelectorAll('a[href="/"]');
                if (allLinks.length > 0) btn = allLinks[0];
            }
            if (btn) {
                btn.click();
                return true;
            }
            return false;
        }

        findAndClickTempChatButton() {
            const selectors = [
                '[aria-label="开启临时聊天"]',
                '[aria-label="开启临时对话"]',
                '[aria-label="关闭临时聊天"]',
                '[aria-label="关闭临时对话"]',
                '[aria-label="Temporary chat"]'
            ];
            for (let sel of selectors) {
                const btn = document.querySelector(sel);
                if (btn && btn.offsetWidth > 0 && !btn.closest('[inert]')) {
                    btn.click();
                    return true;
                }
            }

            if (window.location.search.includes('temporary-chat=true')) {
                // If already in temporary chat, just reload to clear
                window.location.href = '/?temporary-chat=true';
                return false; 
            }
            
            // Fallback to URL navigation
            console.log(`${LOG_PREFIX} Navigating to ChatGPT Temporary Chat...`);
            window.location.href = '/?temporary-chat=true';
            return false;
        }

        isSidebarOpen() {
            const closeBtn = document.querySelector('[data-testid="close-sidebar-button"], [aria-label="Close sidebar"], [aria-label="关闭侧边栏"], [aria-label="关闭边栏"]');
            if (!closeBtn) return false;
            if (closeBtn.getAttribute('aria-expanded') === 'true') return true;
            if (closeBtn.getAttribute('aria-expanded') === 'false') return false;
            return !closeBtn.closest('[inert]') && closeBtn.offsetWidth > 0;
        }

        getSidebarToggleButton() {
            const selectors = [
                '[data-testid="close-sidebar-button"], [data-testid="open-sidebar-button"]',
                '[aria-label="Close sidebar"], [aria-label="Open sidebar"]',
                '[aria-label="关闭侧边栏"], [aria-label="打开侧边栏"], [aria-label="关闭边栏"], [aria-label="打开边栏"]'
            ];
            for (let sel of selectors) {
                const elements = document.querySelectorAll(sel);
                for (let el of elements) {
                    if (!el.closest('[inert]') && el.offsetWidth > 0) {
                        return el;
                    }
                }
            }
            return null;
        }

        closeSidebarByClick() {
            if (this.isSidebarOpen()) {
                const btn = this.getSidebarToggleButton();
                if (btn) btn.click();
            }
        }

        toggleSidebar() {
            const btn = this.getSidebarToggleButton();
            if (btn) btn.click();
        }

        getInputField() {
            return document.getElementById('prompt-textarea');
        }

        focusOnInputField() {
            const inputField = this.getInputField();
            if (inputField) inputField.focus();
        }

        insertTextToInput(text) {
            const inputField = this.getInputField();
            if (!inputField) return;
            inputField.focus();
            
            // ChatGPT uses ProseMirror (contenteditable)
            setTimeout(() => {
                const success = document.execCommand('insertText', false, text);
                if (!success || inputField.textContent.trim() === '') {
                    // Fallback for React/ProseMirror if execCommand fails
                    const p = document.createElement('p');
                    p.textContent = text;
                    inputField.innerHTML = '';
                    inputField.appendChild(p);
                    inputField.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, 50);
        }

        executeCustomWorkflow(prompt, newChat) {
            console.log(`${LOG_PREFIX} [ChatGPT] 执行自定义 Prompt, 新对话: ${newChat}`);
            if (newChat) {
                const success = this.findAndClickNewChatButton();
                if (success) {
                    this.closeSidebarByClick();
                    setTimeout(() => this.insertTextToInput(prompt), 800);
                }
            } else {
                this.focusOnInputField();
                this.insertTextToInput(prompt);
            }
        }
    }

    // Initialize adapter based on host
    const siteAdapter = location.hostname.includes('chatgpt.com') ? new ChatGPTAdapter() : new GeminiAdapter();

    // --- 设置页面 UI ---

    function createSettingsUI() {
        if (document.getElementById('gemini-shortcut-settings-overlay')) return;

        // 1. Overlay
        const overlay = document.createElement('div');
        overlay.id = 'gemini-shortcut-settings-overlay';

        // 2. Modal Container
        const modal = document.createElement('div');
        modal.id = 'gemini-shortcut-settings-modal';

        // --- Header ---
        const header = document.createElement('div');
        header.className = 'settings-header';

        const title = document.createElement('h2');
        title.className = 'settings-title';
        title.textContent = '自定义快捷键设置';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-btn';
        closeBtn.textContent = '×';
        closeBtn.onclick = closeSettings;

        header.appendChild(title);
        header.appendChild(closeBtn);

        // --- Content ---
        const infoMsg = document.createElement('div');
        infoMsg.className = 'settings-info';
        infoMsg.innerHTML = '提示词支持使用变量：<br><code style="background:rgba(128,128,128,0.2);padding:2px 4px;border-radius:4px;margin-top:4px;display:inline-block;">{{clipboard}}</code> : 注入系统剪贴板的纯文本内容';

        const content = document.createElement('div');
        content.className = 'settings-content';
        content.id = 'settings-list';

        // --- Add Button Wrapper ---
        const addBtnWrapper = document.createElement('div');
        addBtnWrapper.className = 'add-btn-wrapper';

        const addBtn = document.createElement('button');
        addBtn.className = 'btn btn-add';
        addBtn.id = 'add-shortcut-btn';
        addBtn.textContent = '+ 添加新快捷键';
        addBtn.onclick = () => addShortcutItemUI();

        addBtnWrapper.appendChild(addBtn);

        // --- Footer ---
        const footer = document.createElement('div');
        footer.className = 'settings-footer';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.id = 'cancel-settings-btn';
        cancelBtn.textContent = '取消';
        cancelBtn.onclick = closeSettings;

        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn btn-primary';
        saveBtn.id = 'save-settings-btn';
        saveBtn.textContent = '保存';
        saveBtn.onclick = saveAndCloseSettings;

        footer.appendChild(cancelBtn);
        footer.appendChild(saveBtn);

        // Assemble Modal
        modal.appendChild(header);
        modal.appendChild(infoMsg);
        modal.appendChild(content);
        modal.appendChild(addBtnWrapper);
        modal.appendChild(footer);

        // Assemble Overlay
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

    function openSettings() {
        createSettingsUI(); // Ensure it exists
        const overlay = document.getElementById('gemini-shortcut-settings-overlay');
        const list = document.getElementById('settings-list');
        list.textContent = ''; // Clear current list

        // Check theme
        const isDark = document.body.classList.contains('dark-theme') ||
                       document.body.getAttribute('data-theme') === 'dark' ||
                       getComputedStyle(document.body).backgroundColor === 'rgb(30, 31, 32)' || // Gemini dark bg
                       window.matchMedia('(prefers-color-scheme: dark)').matches; // System preference fallback

        if (isDark) {
            document.body.classList.add('dark-theme'); // Helper class for our CSS
        } else {
            document.body.classList.remove('dark-theme');
        }

        const config = loadConfig();
        config.forEach(item => addShortcutItemUI(item));
        if (config.length === 0) {
            // Optional: Add one empty item if empty? Or just leave button.
        }

        overlay.classList.add('visible');
    }

    function closeSettings() {
        const overlay = document.getElementById('gemini-shortcut-settings-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => {
                if(overlay.parentNode) overlay.parentNode.removeChild(overlay);
            }, 200);
        }
    }

    function saveAndCloseSettings() {
        const list = document.getElementById('settings-list');
        const items = list.querySelectorAll('.shortcut-item');
        const newConfig = [];

        items.forEach(item => {
            const keyInput = item.querySelector('.shortcut-key-input');
            const promptInput = item.querySelector('.shortcut-prompt-input');
            const newChatInput = item.querySelector('.shortcut-newchat-input');

            // Extract stored key data
            const keyData = JSON.parse(keyInput.dataset.key || 'null');
            const prompt = promptInput.value;
            const newChat = newChatInput.checked;

            if (keyData && prompt) {
                newConfig.push({
                    key: keyData.key,
                    code: keyData.code,
                    ctrlKey: keyData.ctrlKey,
                    shiftKey: keyData.shiftKey,
                    altKey: keyData.altKey,
                    metaKey: keyData.metaKey,
                    prompt: prompt,
                    newChat: newChat
                });
            }
        });

        saveConfig(newConfig);
        closeSettings();
    }

    function formatShortcutString(e) {
        const keys = [];
        if (e.ctrlKey) keys.push('Ctrl');
        if (e.metaKey) keys.push('Cmd');
        if (e.altKey) keys.push('Alt');
        if (e.shiftKey) keys.push('Shift');

        // Don't show modifier keys alone
        if (['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) {
             return keys.join(' + ');
        }

        keys.push(e.key.toUpperCase());
        return keys.join(' + ');
    }

    function isSystemConflict(e) {
        // Simple heuristic for common conflicts
        // e.g. Ctrl+C, Ctrl+V, Cmd+W, Cmd+Q
        const key = e.key.toLowerCase();
        const isCtrlOrCmd = e.ctrlKey || e.metaKey;

        if (isCtrlOrCmd) {
             if (['c', 'v', 'x', 'a', 'z', 'w', 'q', 't', 'r'].includes(key)) return true;
        }
        return false;
    }

    function addShortcutItemUI(data = null) {
        const list = document.getElementById('settings-list');
        const item = document.createElement('div');
        item.className = 'shortcut-item';

        const keyDisplay = data ? formatShortcutString({
            key: data.key,
            ctrlKey: data.ctrlKey,
            metaKey: data.metaKey,
            altKey: data.altKey,
            shiftKey: data.shiftKey
        }) : '';

        // --- Create Elements Safely (Avoid HTML Injection) ---

        // 1. LEFT COLUMN: Shortcut & Switch
        const colLeft = document.createElement('div');
        colLeft.className = 'left-col';

        // Shortcut Input
        const labelKey = document.createElement('span');
        labelKey.className = 'input-label';
        labelKey.textContent = '快捷键';

        const wrapperKey = document.createElement('div');
        wrapperKey.className = 'shortcut-input-wrapper';

        const keyInput = document.createElement('input');
        keyInput.type = 'text';
        keyInput.className = 'shortcut-key-input';
        keyInput.value = keyDisplay;
        keyInput.placeholder = '点击录入...';
        keyInput.readOnly = true;
        if (data) {
            keyInput.dataset.key = JSON.stringify(data);
        }

        const warning = document.createElement('div');
        warning.className = 'conflict-warning';
        warning.textContent = '⚠️ 冲突';

        wrapperKey.appendChild(keyInput);
        wrapperKey.appendChild(warning);

        // New Chat Toggle Switch
        const labelCheckbox = document.createElement('label');
        labelCheckbox.className = 'switch-wrapper';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'shortcut-newchat-input';
        if (data && data.newChat) checkbox.checked = true;

        const toggleSwitch = document.createElement('div');
        toggleSwitch.className = 'toggle-switch';

        const spanCheckbox = document.createElement('span');
        spanCheckbox.className = 'switch-label';
        spanCheckbox.textContent = '新建对话';

        labelCheckbox.appendChild(checkbox);
        labelCheckbox.appendChild(toggleSwitch);
        labelCheckbox.appendChild(spanCheckbox);

        colLeft.appendChild(labelKey);
        colLeft.appendChild(wrapperKey);
        colLeft.appendChild(labelCheckbox);


        // 2. MIDDLE COLUMN: Prompt
        const colMid = document.createElement('div');
        colMid.className = 'mid-col';

        const labelPrompt = document.createElement('span');
        labelPrompt.className = 'input-label';
        labelPrompt.textContent = '提示词 (Prompt)';

        const textarea = document.createElement('textarea');
        textarea.className = 'shortcut-prompt-input';
        textarea.placeholder = '输入自动填充的提示词...';
        if (data && data.prompt) {
            textarea.value = data.prompt; // Safe assignment
        }

        colMid.appendChild(labelPrompt);
        colMid.appendChild(textarea);


        // 3. RIGHT COLUMN: Delete Button
        const colRight = document.createElement('div');
        colRight.className = 'right-col';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.title = '删除此快捷键';
        // Using strict DOM methods for icon
        deleteBtn.textContent = '×'; // Simple text X is safest and clean

        colRight.appendChild(deleteBtn);


        // Append all columns
        item.appendChild(colLeft);
        item.appendChild(colMid);
        item.appendChild(colRight);

        // Handle Shortcut Recording
        keyInput.addEventListener('focus', () => {
            keyInput.classList.add('recording');
            keyInput.value = '请按键...';
        });

        keyInput.addEventListener('blur', () => {
             keyInput.classList.remove('recording');
             if (!keyInput.dataset.key) keyInput.value = '';
             else {
                 // Restore display
                 const d = JSON.parse(keyInput.dataset.key);
                 keyInput.value = formatShortcutString(d);
             }
        });

        keyInput.addEventListener('keydown', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Ignore standalone modifiers
            if (['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) return;

            const shortcutData = {
                key: e.key,
                code: e.code,
                ctrlKey: e.ctrlKey,
                shiftKey: e.shiftKey,
                altKey: e.altKey,
                metaKey: e.metaKey
            };

            keyInput.dataset.key = JSON.stringify(shortcutData);
            keyInput.value = formatShortcutString(e);

            // Conflict check
            if (isSystemConflict(e)) {
                warning.style.display = 'block';
            } else {
                warning.style.display = 'none';
            }

            keyInput.blur();
        });

        // Handle Delete
        item.querySelector('.delete-btn').onclick = () => {
            item.remove();
        };

        list.appendChild(item);
    }


    // --- 主逻辑 ---

    document.addEventListener('keydown', function(event) {
        const isCtrlOrMeta = event.ctrlKey || event.metaKey;

        // 1. Check for Settings Shortcut: Command/Ctrl + Shift + ,
        if (isCtrlOrMeta && event.shiftKey && event.key === ',') {
            event.preventDefault();
            event.stopPropagation();
            openSettings();
            return;
        }

        // 2. Check Custom Shortcuts
        const config = loadConfig();
        for (const item of config) {
            // Match Modifiers
            const matchCtrl = !!item.ctrlKey === event.ctrlKey;
            const matchMeta = !!item.metaKey === event.metaKey;
            const matchShift = !!item.shiftKey === event.shiftKey;
            const matchAlt = !!item.altKey === event.altKey;

            // Match Key (using code for layout independence or key for char match)
            // Using `code` is safer for position, `key` is safer for character.
            // Config saves both. Let's strictly compare `code` if available (from new config),
            // fallback to `key` (normalized).

            let matchKey = false;
            if (item.code && event.code) {
                 matchKey = item.code === event.code;
            } else {
                 matchKey = item.key.toLowerCase() === event.key.toLowerCase();
            }

            if (matchCtrl && matchMeta && matchShift && matchAlt && matchKey) {
                event.preventDefault();
                event.stopPropagation();
                
                (async () => {
                    let finalPrompt = item.prompt;
                    if (finalPrompt && finalPrompt.includes('{{clipboard}}')) {
                        try {
                            const clipText = await navigator.clipboard.readText();
                            finalPrompt = finalPrompt.replace(/\{\{clipboard\}\}/g, clipText);
                        } catch (err) {
                            console.error(`${LOG_PREFIX} 无法读取剪贴板:`, err);
                        }
                    }
                    siteAdapter.executeCustomWorkflow(finalPrompt, item.newChat);
                })();

                return;
            }
        }

        // 3. Existing Hardcoded Shortcuts (Preserved Utilities)

        // Ctrl+O / Cmd+O: 新对话
// Ctrl+O / Cmd+O: 新对话
        if (isCtrlOrMeta && !event.shiftKey && event.code === 'KeyO') {
            console.log(`${LOG_PREFIX} 执行 '新对话' 工作流。`);
            event.preventDefault();
            event.stopPropagation();

            const success = siteAdapter.findAndClickNewChatButton();

            if (success) {
                // 页面导航后聚焦输入框
                setTimeout(() => {
                    siteAdapter.focusOnInputField();
                }, 800);
            }
        }
        // Ctrl+I / Cmd+I: 聚焦输入框
        else if (isCtrlOrMeta && !event.shiftKey && event.code === 'KeyI') {
            event.preventDefault();
            event.stopPropagation();
            siteAdapter.focusOnInputField();
        }
        // Ctrl+L / Cmd+L: 切换侧边栏
        else if (isCtrlOrMeta && !event.shiftKey && event.code === 'KeyL') {
            event.preventDefault();
            event.stopPropagation();
            siteAdapter.toggleSidebar();
        }
        // Ctrl+Shift+N / Cmd+Shift+N: 临时对话
        else if (isCtrlOrMeta && event.shiftKey && event.code === 'KeyN') {
            console.log(`${LOG_PREFIX} 执行 '临时对话' 工作流。`);
            event.preventDefault();
            event.stopPropagation();
            // 临时对话按钮在页面顶栏，不在侧边栏中，直接点击即可
            siteAdapter.findAndClickTempChatButton();
            setTimeout(() => siteAdapter.focusOnInputField(), 300);
        }
    });

    console.log(`${LOG_PREFIX} 脚本已加载 (v1.6)。按 Cmd/Ctrl+Shift+, 打开设置。`);
})();
