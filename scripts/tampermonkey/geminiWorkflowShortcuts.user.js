// ==UserScript==
// @name         Gemini 快捷工作流 (Custom Prompt Edition)
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Gemini 快捷键增强：Ctrl+O 新对话、Ctrl+Shift+N 临时对话、Ctrl+Shift+P 论文预设Prompt对话、Ctrl+I 聚焦输入框、Ctrl+L 切换侧边栏。
// @author       Script Author
// @match        https://gemini.google.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const LOG_PREFIX = "[Gemini 快捷键]";

    // 预设论文分析提示词
    const PAPER_PROMPT = `请必须使用更简单易懂的语言来解释这篇论文，不要太长、不要包含太复杂的内容，并且使用中文。
除了解释以外，如果原文当中有 limitation 或者 future work 的章节，你也需要把这些观点补充在你的回答当中，如果没有相关内容，则告诉我文中没有写即可。

你需要在回答的一开始告诉我这篇论文是否是以下类别，通过一个两列表格以及勾叉符号来表示，第一列填写下列类别名称，第二列填写✅或者❌表示论文是否是该类别：

是否是RL
是否是纯文本NLP
是否是多模态multimodal
是否是医学相关
是否是思维链CoT或者系统二System2
是否是专注于缩短思维链ShortCoT
是否是专注于隐藏层的思维链Latent/SoftCot
是否是工具使用Toolcall/Agent（包括RAG）
是否是专注于基于细节提示增强模型回答问题正确率的研究（hint）
是否是专注于提高模型记忆能力的研究（Mem）
是否是专注于并行推理或并行训练（parallel）
是否是专注于让模型同时扮演出题和答题角色并多轮迭代共同提升（bootstrap/self-play）
是否是专注于将使用模型来模拟环境的世界模型（Sim/World）
是否是专注于将文字通过渲染成图片后作为视觉模态信息处理（TextAsImage）
是否专注于将RLVR的奖励变为soft/smooth而且dense的奖励（包括过程奖励PRM）

你需要告诉我，这篇论文是属于哪一类，直接告诉我类别即可（可以是组合）：
1、Benchmark
2、综述论文
3、分析型论文：依靠大量实验对一个问题中的理论进行研究
4、方法型论文：为问题提出新的解决方法。

你需要告诉我这篇论文是否提出了自己的数据集，以及它是否训练了自己的模型，或者只是简单地使用提示工程方法，或者这两者都不是重点。

你需要告诉我这篇论文使用了多大规模的计算资源。

如果原文中有提到，请直接告诉我论文原文中所说的设备型号、设备数量、计算时长。如果原文没有提到，告知我。
同时，告诉我这篇论文属于以下哪种类型的计算量级别：预训练级别、继续预训练级别、SFT级别/DPO级别、RL/GRPO级别、仅推理级别，并告诉我他是否采用了参数高效的微调方法，例如 lora、低比特量化等。

你需要首先将论文的标题放在一个单独的、可复制的代码块，也就是 \`\`\`text 当中，写在回答的最开头。标题需要格外注意大小写问题，部分论文使用了 \\textsc{} 格式，这会导致标题全部都是大写字母，此时，应当根据字号、语义进一步区分其中真正的大写和小写字母，并且返回的结果中包含处理好大小写后的结果。`;

    /**
     * 查找并点击“新对话”按钮
     * @returns {boolean} 操作是否成功
     */
    function findAndClickNewChatButton() {
        const selectors = [
            // 策略 1: 查找特定 test-id 容器内的链接 (针对新版 UI)
            'side-nav-action-button[data-test-id="new-chat-button"] a',

            // 策略 2: 直接点击特定 test-id 的容器
            '[data-test-id="new-chat-button"]',

            // 策略 3: 通用 aria-label 匹配 (兼容多种标签)
            '[aria-label="New chat"]',
            '[aria-label="新对话"]',

            // 策略 4: 旧版 button 选择器
            'button[data-test-id="new-chat-button"]',

            // 策略 5: 基于文本内容的兜底查找
            function() {
                // 查找 side-nav-action-button 下的文本容器
                const elements = document.querySelectorAll('side-nav-action-button .gds-body-m, side-nav-action-button span');
                for (let el of elements) {
                    const text = el.textContent ? el.textContent.trim().toLowerCase() : '';
                    if (text === 'new chat' || text === '新对话') {
                        // 返回最近的可点击父元素
                        return el.closest('a, button, side-nav-action-button');
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
            // 检查 disabled 属性
            if (newChatButton.disabled || newChatButton.getAttribute('aria-disabled') === 'true') {
                console.warn(`${LOG_PREFIX} '新对话' 按钮被禁用。`);
                return false;
            }
            console.log(`${LOG_PREFIX} 正在点击 '新对话' 按钮:`, newChatButton);
            newChatButton.click();
            return true;
        } else {
            console.error(`${LOG_PREFIX} 错误: 未能定位 '新对话' 按钮。`);
            return false;
        }
    }

    /**
     * 查找并点击“临时对话”按钮
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
     * 关闭侧边栏
     */
    function closeSidebarByClick() {
        const chatApp = document.querySelector('chat-app');
        const menuButton = document.querySelector('button[data-test-id="side-nav-menu-button"]');

        if (chatApp && menuButton && chatApp.classList.contains('side-nav-open')) {
            console.log(`${LOG_PREFIX} 侧边栏已打开, 正在关闭。`);
            menuButton.click();
        }
    }

    /**
     * 切换侧边栏状态
     */
    function toggleSidebar() {
        const menuButton = document.querySelector('button[data-test-id="side-nav-menu-button"]');
        if (menuButton) {
            menuButton.click();
        }
    }

    /**
     * 聚焦主输入框
     * @returns {HTMLElement|null} 返回输入框元素
     */
    function getInputField() {
        const inputSelector = 'div.ql-editor[aria-label="Enter a prompt here"], div.ql-editor[aria-label="在此处输入提示"], div[role="textbox"][contenteditable="true"]';
        return document.querySelector(inputSelector);
    }

    /**
     * 聚焦输入框
     */
    function focusOnInputField() {
        const inputField = getInputField();
        if (inputField) {
            console.log(`${LOG_PREFIX} 正在聚焦输入框。`);
            inputField.focus();
        }
    }

    /**
     * 将文本插入输入框
     * Gemini 使用 contenteditable div，需通过 execCommand 或 DOM 事件模拟输入
     */
    function insertTextToInput(text) {
        const inputField = getInputField();
        if (!inputField) {
            console.error(`${LOG_PREFIX} 无法找到输入框，无法粘贴文本。`);
            return;
        }

        inputField.focus();

        // 稍微延迟以确保焦点状态
        setTimeout(() => {
            // 尝试使用 execCommand (兼容性最好)
            const success = document.execCommand('insertText', false, text);

            // 如果 execCommand 失败，强制修改 DOM 并触发 input 事件
            if (!success || inputField.textContent.trim() === '') {
                 console.log(`${LOG_PREFIX} execCommand 未生效，尝试 DOM 注入...`);
                 inputField.innerText = text;
                 inputField.dispatchEvent(new Event('input', { bubbles: true }));
            }
            console.log(`${LOG_PREFIX} 文本已填充。`);
        }, 50);
    }

    /**
     * 执行依赖侧边栏的工作流
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
                setTimeout(closeSidebarByClick, 100);
                setTimeout(focusOnInputField, 200);
            } else {
                console.error(`${LOG_PREFIX} '${actionName}' 工作流失败 (未找到按钮)。`);
                if (sidebarWasClosed) {
                    toggleSidebar();
                }
            }
        };

        setTimeout(clickWorkflow, sidebarWasClosed ? 350 : 50);
    }

    /**
     * 执行 Paper 工作流：新对话 -> 填充 Prompt
     */
    function executePaperWorkflow() {
        console.log(`${LOG_PREFIX} 执行 'Paper' 工作流 (新对话 + 预设 Prompt)。`);

        // 1. 点击新对话
        const success = findAndClickNewChatButton();

        if (success) {
            // 2. 关闭侧边栏 (如果它是开着的)
            closeSidebarByClick();

            // 3. 等待 UI 刷新后填入文本
            setTimeout(() => {
                insertTextToInput(PAPER_PROMPT);
            }, 600);
        }
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
            event.preventDefault();
            event.stopPropagation();
            executePaperWorkflow();
        }
    });

    console.log(`${LOG_PREFIX} 脚本已加载。`);
})();