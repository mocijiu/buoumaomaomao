// ========== 聊天详情页面模块 ==========
const ChatModule = (function() {
    'use strict';

    // ========== 聊天页面状态 ==========
    let isChatOpen = false;
    let chatSourcePage = 'page9';
    let currentChatPersona = null;
    let messages = [];
    let playingVoiceId = null;
    let voiceWaveAnimationInterval = null;
    // 长按操作菜单状态
    let longPressTargetMsg = null;      // 当前长按的消息
    let longPressTimer = null;          // 长按定时器
    let isActionMenuOpen = false;       // 操作菜单是否打开
    // 引用回复状态
    let quotedMessage = null;           // 当前引用的消息

    // ========== DOM 元素缓存 ==========
    const elements = {
        chatBack: null,
        chatTitle: null,
        chatAvatarBtn: null,
        chatMessages: null,
        chatWelcome: null,
        chatWelcomeName: null,
        chatInput: null,
        chatAiBtn: null,
        chatInnerBtn: null,
        chatExtendBtn: null,
        chatSendBtn: null,
        innerThoughtModal: null,
        innerThoughtBackdrop: null,
        innerThoughtAvatar: null,
        innerThoughtName: null,
        innerThoughtMood: null,
        innerThoughtPartner: null,
        innerThoughtAppearance: null,
        innerThoughtInner: null,
        innerThoughtDark: null,
        innerThoughtCloseBtn: null
    };

    // ========== 外部依赖（由主程序注入） ==========
    let external = {
        PAGES: [],
        goToPage: null,
        elements: {},
        getIsWechatOpen: () => false,
        setIsWechatOpen: (val) => {}
    };

    // ========== 初始化 ==========
    function init(deps) {
        external = { ...external, ...deps };
        cacheElements();
        bindEvents();
        bindInnerThoughtModalEvents();
    }

    function cacheElements() {
        elements.chatBack = document.getElementById('chatBack');
        elements.chatTitle = document.getElementById('chatTitle');
        elements.chatAvatarBtn = document.getElementById('chatAvatarBtn');
        elements.chatMessages = document.getElementById('chatMessages');
        elements.chatWelcome = document.getElementById('chatWelcome');
        elements.chatWelcomeName = document.getElementById('chatWelcomeName');
        elements.chatInput = document.getElementById('chatInput');
        elements.chatAiBtn = document.getElementById('chatAiBtn');
        elements.chatInnerBtn = document.getElementById('chatInnerBtn');
        elements.chatExtendBtn = document.getElementById('chatExtendBtn');
        elements.chatSendBtn = document.getElementById('chatSendBtn');
        elements.innerThoughtModal = document.getElementById('innerThoughtModal');
        elements.innerThoughtBackdrop = document.getElementById('innerThoughtBackdrop');
        elements.innerThoughtAvatar = document.getElementById('innerThoughtAvatar');
        elements.innerThoughtName = document.getElementById('innerThoughtName');
        elements.innerThoughtMood = document.getElementById('innerThoughtMood');
        elements.innerThoughtPartner = document.getElementById('innerThoughtPartner');
        elements.innerThoughtAppearance = document.getElementById('innerThoughtAppearance');
        elements.innerThoughtInner = document.getElementById('innerThoughtInner');
        elements.innerThoughtDark = document.getElementById('innerThoughtDark');
        elements.innerThoughtCloseBtn = document.getElementById('innerThoughtCloseBtn');
        // 拓展面板元素
        elements.chatExtendBackdrop = document.getElementById('chatExtendBackdrop');
        elements.chatExtendPanel = document.getElementById('chatExtendPanel');
        elements.chatExtendGrid = document.getElementById('chatExtendGrid');
        // 长按操作菜单元素
        elements.chatActionMenu = document.getElementById('chatActionMenu');
        elements.chatQuoteBar = document.getElementById('chatQuoteBar');
        elements.chatQuoteSender = document.getElementById('chatQuoteSender');
        elements.chatQuoteText = document.getElementById('chatQuoteText');
        elements.chatQuoteClose = document.getElementById('chatQuoteClose');
    }

    // ========== 公开方法 ==========
    function openChat(persona, sourcePage = 'page9') {
        if (isChatOpen) return;
        isChatOpen = true;
        chatSourcePage = sourcePage;
        currentChatPersona = persona;
        clearQuote(); // 清除引用状态
        external.goToPage('page10');
        loadChatHistory();
        renderMessages();
        scrollToBottom();
        updateUI();
        applyChatBackground();
    }

    function closeChat() {
        if (!isChatOpen) return;
        isChatOpen = false;
        currentChatPersona = null;
        if (voiceWaveAnimationInterval) {
            clearInterval(voiceWaveAnimationInterval);
            voiceWaveAnimationInterval = null;
        }
        playingVoiceId = null;
        closeInnerThoughtModal();
        closeActionMenu();
        clearQuote();
        const chatContent = document.getElementById('chatContent');
        if (chatContent) {
            chatContent.style.backgroundImage = '';
        }
        external.goToPage(chatSourcePage);
    }

    function getCurrentPersona() {
        return currentChatPersona;
    }

    function isOpen() {
        return isChatOpen;
    }

    // ========== 事件绑定 ==========
    function bindEvents() {
        if (elements.chatBack) {
            elements.chatBack.addEventListener('click', (e) => {
                e.stopPropagation();
                closeChat();
            });
        }

        if (elements.chatAvatarBtn) {
            elements.chatAvatarBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.PhoneUI && typeof PhoneUI.openChatSettings === 'function') {
                    PhoneUI.openChatSettings('page10', currentChatPersona);
                }
            });
        }

        if (elements.chatAiBtn) {
            elements.chatAiBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                triggerAiReply();
            });
        }

        if (elements.chatInnerBtn) {
            elements.chatInnerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showInnerThought();
            });
        }

        if (elements.chatExtendBtn) {
            elements.chatExtendBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleExtend();
            });
        }

        // 拓展面板遮罩层点击关闭
        if (elements.chatExtendBackdrop) {
            elements.chatExtendBackdrop.addEventListener('click', (e) => {
                e.stopPropagation();
                closeExtendPanel();
            });
        }

        // 拓展面板网格项点击处理
        if (elements.chatExtendGrid) {
            elements.chatExtendGrid.addEventListener('click', (e) => {
                const item = e.target.closest('.chat-extend-item');
                if (item && !item.classList.contains('chat-extend-placeholder')) {
                    e.stopPropagation();
                    const action = item.dataset.action;
                    handleExtendAction(action);
                    closeExtendPanel();
                }
            });
        }

        // 操作菜单项点击处理
        if (elements.chatActionMenu) {
            elements.chatActionMenu.addEventListener('click', (e) => {
                const item = e.target.closest('.chat-action-item');
                if (item && !item.classList.contains('chat-action-placeholder')) {
                    e.stopPropagation();
                    const action = item.dataset.action;
                    handleActionMenuAction(action);
                    closeActionMenu();
                }
            });
        }

        // 引用栏关闭按钮
        if (elements.chatQuoteClose) {
            elements.chatQuoteClose.addEventListener('click', (e) => {
                e.stopPropagation();
                clearQuote();
            });
        }

        if (elements.chatSendBtn) {
            elements.chatSendBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                sendMessage();
            });
        }

        if (elements.chatInput) {
            elements.chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
        }
    }

    // ========== 核心功能 ==========
    function loadChatHistory() {
        if (!currentChatPersona) return;
        const key = `chat_history_${currentChatPersona.id}`;
        const saved = localStorage.getItem(key);
        messages = saved ? JSON.parse(saved) : [];
    }

    function saveChatHistory() {
        if (!currentChatPersona) return;
        const key = `chat_history_${currentChatPersona.id}`;
        localStorage.setItem(key, JSON.stringify(messages));
    }

    function sendMessage() {
        const text = elements.chatInput.value.trim();
        if (!text) return;

        const message = {
            id: 'msg_' + Date.now(),
            type: 'own',
            msgType: 'text',
            content: text,
            timestamp: Date.now(),
            // 如果有引用消息，添加引用信息
            ...(quotedMessage && {
                quote: {
                    msgId: quotedMessage.id,
                    sender: quotedMessage.type === 'own' ? '你' : (currentChatPersona?.name || '对方'),
                    text: quotedMessage.msgType === 'text' 
                        ? (typeof quotedMessage.content === 'string' ? quotedMessage.content : JSON.stringify(quotedMessage.content))
                        : `[${getMsgTypeLabel(quotedMessage.msgType)}]`
                }
            })
        };

        messages.push(message);
        saveChatHistory();
        renderMessages();
        scrollToBottom();

        elements.chatInput.value = '';
        elements.chatInput.focus();

        // 发送后清除引用
        clearQuote();
    }

    function sendMessageOfType(msgType, content) {
        const message = {
            id: 'msg_' + Date.now(),
            type: 'own',
            msgType: msgType,
            content: content,
            timestamp: Date.now(),
            // 如果有引用消息，添加引用信息
            ...(quotedMessage && {
                quote: {
                    msgId: quotedMessage.id,
                    sender: quotedMessage.type === 'own' ? '你' : (currentChatPersona?.name || '对方'),
                    text: quotedMessage.msgType === 'text' 
                        ? (typeof quotedMessage.content === 'string' ? quotedMessage.content : JSON.stringify(quotedMessage.content))
                        : `[${getMsgTypeLabel(quotedMessage.msgType)}]`
                }
            })
        };

        messages.push(message);
        saveChatHistory();
        renderMessages();
        scrollToBottom();

        // 发送后清除引用
        clearQuote();
    }

async function triggerAiReply() {
        if (!currentChatPersona) return;

        const savedConfig = JSON.parse(localStorage.getItem('last_api_config') || 'null');
        if (!savedConfig || !savedConfig.url || !savedConfig.key) {
            alert('请先在 API 设置中配置 API 网址和密钥');
            return;
        }

        const chatSettingsKey = currentChatPersona.id ? `chat_settings_${currentChatPersona.id}` : 'chat_settings';
        const chatSettings = JSON.parse(localStorage.getItem(chatSettingsKey) || '{}');
        const contextCount = chatSettings.contextCount || 10;
        const innerThoughtEnabled = chatSettings.innerThoughtEnabled !== false;
        const timeAwareEnabled = chatSettings.timeAwareEnabled !== false;

        const apiUrl = savedConfig.url.replace(/\/+$/, '');
        const finalUrl = apiUrl.endsWith('/v1/chat/completions') ? apiUrl : (apiUrl.endsWith('/v1') ? apiUrl + '/chat/completions' : apiUrl + '/v1/chat/completions');

        const history = messages.slice(-contextCount).map(m => ({
            role: m.type === 'own' ? 'user' : 'assistant',
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
        }));

        const personaDetail = currentChatPersona.desc || '';
        const personaName = currentChatPersona.name || '角色';

        let systemPrompt = `你现在正在扮演 ${personaName}。你的人设背景是：${personaDetail}。请严格以第一人称、绝对贴合该人设的语气进行回复。绝对不要在任何回复中暴露你是一个人工智能、语言模型或AI助手，你要让用户感觉自己是在和一位真实的微信好友交流。不要使用"作为AI"、"我理解"、"我可以帮您"等暴露身份的措辞。回复要自然、真实、有温度，像真正的朋友聊天一样。`;

        if (timeAwareEnabled) {
            const now = new Date();
            const month = now.getMonth() + 1;
            const day = now.getDate();
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            const weekdays = ['星期天', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
            const weekday = weekdays[now.getDay()];
            const timeStr = `${month}月${day}日 ${weekday} ${hours}:${minutes}`;
            systemPrompt += `\n当前时间是 ${timeStr}。请结合当前时间信息和我聊日常。`;
        }

        if (innerThoughtEnabled) {
            // 绝对的枷锁：禁止AI偷懒，禁止AI用代码块，格式必须严丝合缝！
            systemPrompt += `\n
你正在和用户聊天，且用户开启了你的"心声模式"。
**绝对禁止在回复中使用 \`\`\`json 等任何 Markdown 代码块标记。请直接输出纯文本内容！**
请严格遵守以下三段式结构输出，不要输出任何额外的说明或废话，格式必须完全一样：
你的日常聊天回复内容。
[短心声]：你脑海中一闪而过的简短想法（不超过15字）。
[心声详情]：必须是一个严格的 JSON 纯文本（不要加引号外的格式），请根据聊天的上下文和环境，发挥你的想象力生成具体、生动、符合人设的描述内容，绝对禁止将字段留空或使用默认值！
JSON 格式必须为：{"心情":"...","外貌":"你今日的穿着打扮描写","动作":"你当下的具体肢体动作描写","身体状态":"你当前的身体和精神状态","表层心声":"你脑海中直接浮现的短浅想法","阴暗心声":"你内心隐藏的极端阴暗面或担忧","内心吐槽":"你内心对当前现状或自我吐槽的无语感"}
`;
        }

        history.unshift({
            role: 'system',
            content: systemPrompt
        });

        const loadingMsg = {
            id: 'msg_loading_' + Date.now(),
            type: 'other',
            msgType: 'text',
            content: '...',
            timestamp: Date.now(),
            isLoading: true
        };
        messages.push(loadingMsg);
        renderMessages();
        scrollToBottom();

        try {
            const response = await fetch(finalUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${savedConfig.key}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: savedConfig.model || 'gpt-3.5-turbo',
                    messages: history,
                    temperature: savedConfig.temp || 0.7
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            let aiContent = data.choices?.[0]?.message?.content || '...';

            let innerThoughtData = null;
            if (innerThoughtEnabled) {
                const parsed = parseInnerThoughtResponse(aiContent);
                if (parsed) {
                    aiContent = parsed.reply;
                    innerThoughtData = parsed.innerThought;
                }
            }

            messages = messages.filter(m => m.id !== loadingMsg.id);

            const aiMessage = {
                id: 'msg_' + Date.now(),
                type: 'other',
                msgType: 'text',
                content: aiContent,
                timestamp: Date.now(),
                innerThought: innerThoughtData
            };
            messages.push(aiMessage);
            saveChatHistory();
            renderMessages();
            scrollToBottom();

        } catch (err) {
            console.error('AI 回复失败:', err);
            messages = messages.filter(m => m.id !== loadingMsg.id);
            const errorMsg = {
                id: 'msg_' + Date.now(),
                type: 'other',
                msgType: 'text',
                content: '暂时离开，有事请留言',
                timestamp: Date.now()
            };
            messages.push(errorMsg);
            saveChatHistory();
            renderMessages();
            scrollToBottom();
        }
    }

            // ========== 终极兜底版：无论AI怎么乱输出，都能强行提取内容 ==========
    function parseInnerThoughtResponse(content) {
        let detailStr = null;
        let detail = {};
        let shortThought = '';

        // 1. 去除可能存在的 Markdown 代码块标记，防止 JSON.parse 被包在 ```json 里
        let cleanContent = content.replace(/```json\s*/g, '').replace(/\s*```/g, '');

        // 2. 提取 [心声详情] 后的 JSON 字符串 (抗干扰匹配)
        const detailMatch = cleanContent.match(/\[心声详情[：:]\s*(\{[\s\S]*\})/);
        if (detailMatch && detailMatch[1]) {
            detailStr = detailMatch[1].trim();
            try {
                // 激进清洗：删除多余的换行和反斜杠
                let safeJson = detailStr.replace(/\n/g, " ").replace(/\r/g, "").replace(/\\/g, "\\\\");
                // 如果 AI 在 JSON 末尾加了非法逗号，用正则强行删掉
                safeJson = safeJson.replace(/,(\s*[}\]])/g, '$1');
                detail = JSON.parse(safeJson);
            } catch (e) {
                console.warn("JSON 解析彻底失败，采用最后的手段【强拆】...");
                // 如果 JSON 彻底坏了，用暴力正则挨个抓取字段内容
                const moodMatch = detailStr.match(/"心情"\s*:\s*"([^"]*)"/);
                const appearanceMatch = detailStr.match(/"外貌"\s*:\s*"([^"]*)"/);
                const actionMatch = detailStr.match(/"动作"\s*:\s*"([^"]*)"/);
                const physicalMatch = detailStr.match(/"身体状态"\s*:\s*"([^"]*)"/);
                const surfaceMatch = detailStr.match(/"表层心声"\s*:\s*"([^"]*)"/);
                const darkMatch = detailStr.match(/"阴暗心声"\s*:\s*"([^"]*)"/);
                const innerMatch = detailStr.match(/"内心吐槽"\s*:\s*"([^"]*)"/);
                
                detail = {
                    心情: moodMatch ? moodMatch[1] : '平静',
                    外貌: appearanceMatch ? appearanceMatch[1] : '日常穿着',
                    动作: actionMatch ? actionMatch[1] : '自然站立',
                    身体状态: physicalMatch ? physicalMatch[1] : '状态良好',
                    表层心声: surfaceMatch ? surfaceMatch[1] : '内心平静',
                    阴暗心声: darkMatch ? darkMatch[1] : '无',
                    内心吐槽: innerMatch ? innerMatch[1] : '...'
                };
            }
        }

        // 3. 提取短心声 (给气泡上的粉色爱心)
        const shortMatch = cleanContent.match(/\[短心声[：:]\s*([\s\S]*?)(?=\[心声详情|$)/);
        if (shortMatch) shortThought = shortMatch[1].trim();

        // ==========================================================
        // 4. 强力抽取聊天气泡：直接一刀切断所有标记后缀！
        // ==========================================================
        let reply = cleanContent;
        
        // 直接找到第一个破坏纯文本的「短心声」或「心声详情」，一刀切断！
        const thoughtIndex = reply.search(/\[短心声|\[心声详情/);
        if (thoughtIndex !== -1) {
            reply = reply.substring(0, thoughtIndex).trim();
        }

        // 如果最后截出来是空的，说明 AI 没输出有效对话
        if (!reply || reply.trim() === '') return null;

        return {
            reply: reply.trim(),
            innerThought: {
                short: shortThought,
                detail: detail
            }
        };
    }

    function renderMessages() {
        if (!elements.chatMessages || !elements.chatWelcome) return;

        if (messages.length === 0) {
            elements.chatMessages.innerHTML = '';
            elements.chatWelcome.style.display = 'flex';
            elements.chatMessages.style.display = 'none';
            return;
        }

        elements.chatWelcome.style.display = 'none';
        elements.chatMessages.style.display = 'flex';

        elements.chatMessages.innerHTML = messages.map(msg => renderMessageHtml(msg)).join('');

        bindMessageEvents();
    }

    function renderMessageHtml(msg) {
        const isOwn = msg.type === 'own';
        const timeStr = formatTime(msg.timestamp);

        const charAvatar = currentChatPersona?.avatar
            ? `<img src="${currentChatPersona.avatar}" alt="${currentChatPersona.name || 'Char'}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
            : `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;

        // 用户头像：优先使用 window.userProfile.avatar，否则使用默认占位符
        const userAvatar = (window.userProfile && window.userProfile.avatar)
            ? `<img src="${window.userProfile.avatar}" alt="我" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
            : `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;

        const avatarHtml = isOwn
            ? `<div class="chat-message-avatar">${userAvatar}</div>`
            : `<div class="chat-message-avatar">${charAvatar}</div>`;

        const chatSettingsKey = currentChatPersona?.id ? `chat_settings_${currentChatPersona.id}` : 'chat_settings';
        const chatSettings = JSON.parse(localStorage.getItem(chatSettingsKey) || '{}');
        const showInnerThought = !isOwn && msg.msgType === 'text' && chatSettings.innerThoughtEnabled !== false;

        // 获取字体颜色和透明度设置
        const fontColor = chatSettings.fontColor || '#3A5072';
        const fontOpacity = chatSettings.fontOpacity !== undefined ? chatSettings.fontOpacity : 1;
        const fontStyle = `color: ${fontColor}; opacity: ${fontOpacity};`;

        // 获取气泡背景颜色和透明度设置
        const charBubbleColor = chatSettings.charBubbleColor || '#D5DCE0';
        const charBubbleOpacity = chatSettings.charBubbleOpacity !== undefined ? chatSettings.charBubbleOpacity : 1;
        const userBubbleColor = chatSettings.userBubbleColor || '#FAF5F0';
        const userBubbleOpacity = chatSettings.userBubbleOpacity !== undefined ? chatSettings.userBubbleOpacity : 1;

        const bubbleBgColor = isOwn ? userBubbleColor : charBubbleColor;
        const bubbleBgOpacity = isOwn ? userBubbleOpacity : charBubbleOpacity;
        // 将十六进制颜色转换为 rgba
        function hexToRgba(hex, alpha) {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        const bubbleBgStyle = `background: ${hexToRgba(bubbleBgColor, bubbleBgOpacity)};`;

        let bubbleHtml = '';

        if (msg.isLoading) {
            bubbleHtml = `<div class="chat-message-bubble text loading" style="${fontStyle}">...</div>`;
        } else {
            const msgType = msg.msgType || 'text';
            const content = msg.content;

            switch (msgType) {
                case 'text':
                    bubbleHtml = `<div class="chat-message-bubble text" style="${fontStyle} ${bubbleBgStyle}">${escapeHtml(content)}</div>`;
                    break;
                case 'redPacket':
                    bubbleHtml = renderRedPacketBubble(content);
                    break;
                case 'transfer':
                    bubbleHtml = renderTransferBubble(content);
                    break;
                case 'voice':
                    bubbleHtml = renderVoiceBubble(content, msg.id);
                    break;
                case 'image':
                    bubbleHtml = renderImageBubble(content, msg.id);
                    break;
                default:
                    bubbleHtml = `<div class="chat-message-bubble text" style="${fontStyle} ${bubbleBgStyle}">${escapeHtml(String(content))}</div>`;
            }
        }

        const transcriptHtml = msg.transcript ? `<div class="voice-transcript">${escapeHtml(msg.transcript)}</div>` : '';
        const imageDescHtml = msg.imageDescription ? `<div class="image-description">${escapeHtml(msg.imageDescription)}</div>` : '';

        // 引用回复显示
        let quoteHtml = '';
        if (msg.quote) {
            const q = msg.quote;
            quoteHtml = `
                <div class="chat-message-quote" style="
                    display: flex; align-items: center; gap: 8px;
                    padding: 8px 10px;
                    background: var(--quote-text-bg);
                    border-radius: 12px;
                    margin-bottom: 6px;
                    border-left: 3px solid var(--quote-bar-color);
                    max-width: 100%;
                ">
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 11px; font-weight: 600; color: var(--text-primary); margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${escapeHtml(q.sender)}
                        </div>
                        <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${escapeHtml(q.text)}
                        </div>
                    </div>
                </div>
            `;
        }

        let innerThoughtHtml = '';
        if (showInnerThought && msg.innerThought) {
            const myProfile = JSON.parse(localStorage.getItem('my_profile_data') || '{}');
            const partnerName = myProfile.name || '伴侣';
            innerThoughtHtml = `<span class="inner-thought-indicator" data-msg-id="${msg.id}" data-partner-name="${escapeHtml(partnerName)}" title="点击查看内心想法">❤️</span>`;
        }

        return `
            <div class="chat-message ${isOwn ? 'own' : 'other'}" data-msg-id="${msg.id}">
                ${avatarHtml}
                <div class="chat-message-bubble-wrapper">
                    ${innerThoughtHtml}
                    ${quoteHtml}
                    ${bubbleHtml}
                    ${transcriptHtml}
                    ${imageDescHtml}
                </div>
                <div class="chat-message-time">${timeStr}</div>
            </div>
        `;
    }

    function renderRedPacketBubble(content) {
        const data = typeof content === 'object' ? content : { title: '微信红包', amount: '8.88', subtitle: '恭喜发财，大吉大利' };
        return `
            <div class="chat-message-bubble red-packet">
                <div class="red-packet-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 12V7H5v7"></path>
                        <path d="M3 12h18"></path>
                        <path d="M7 12v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-8"></path>
                        <path d="M9 12h6"></path>
                    </svg>
                </div>
                <div class="red-packet-content">
                    <div class="red-packet-title">${escapeHtml(data.title || '微信红包')}</div>
                    <div class="red-packet-subtitle">${escapeHtml(data.subtitle || '恭喜发财，大吉大利')}</div>
                </div>
                <div class="red-packet-amount">¥${escapeHtml(data.amount || '8.88')}</div>
            </div>
        `;
    }

    function renderTransferBubble(content) {
        const data = typeof content === 'object' ? content : { title: '转账', amount: '100.00', subtitle: '转账给好友' };
        return `
            <div class="chat-message-bubble transfer">
                <div class="transfer-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="1" x2="12" y2="23"></line>
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                    </svg>
                </div>
                <div class="transfer-content">
                    <div class="transfer-title">${escapeHtml(data.title || '转账')}</div>
                    <div class="transfer-subtitle">${escapeHtml(data.subtitle || '转账给好友')}</div>
                </div>
                <div class="transfer-amount">¥${escapeHtml(data.amount || '100.00')}</div>
            </div>
        `;
    }

    function renderVoiceBubble(content, msgId) {
        const data = typeof content === 'object' ? content : { duration: '5"', waveData: [20,45,70,55,85,35,65] };
        const isPlaying = playingVoiceId === msgId;
        const playingClass = isPlaying ? ' playing' : '';
        const waveBars = (data.waveData || [20,45,70,55,85,35,65]).map((h, i) =>
            `<div class="voice-wave-bar" style="height:${h}%; animation-delay:${i*80}ms;"></div>`
        ).join('');

        return `
            <div class="chat-message-bubble voice${playingClass}" data-voice-id="${msgId}">
                <div class="voice-play-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                </div>
                <div class="voice-wave">${waveBars}</div>
                <div class="voice-duration">${escapeHtml(data.duration || '5"')}</div>
            </div>
        `;
    }

    function renderImageBubble(content, msgId) {
        const data = typeof content === 'object' ? content : { url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjQThEMBVEIiBzdHJva2Utd2lkdGg9IjEuNSI+PHJlY3QgeD0iMiIgeT0iMiIgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiByeD0iNSIgcnk9IjUiLz48cGF0aCBkPSJNNyAxMmw1IDUgMTAtMTAiLz48L3N2Zz4=' };
        const imgUrl = data.url || '';
        return `
            <div class="chat-message-bubble image" data-image-id="${msgId}">
                ${imgUrl.startsWith('data:') || imgUrl.startsWith('http')
                    ? `<img src="${escapeHtml(imgUrl)}" alt="图片" loading="lazy">`
                    : `<div class="image-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M7 12l5 5 10-10"></path></svg></div>`
                }
            </div>
        `;
    }

    function bindMessageEvents() {
        if (!elements.chatMessages) return;

        elements.chatMessages.querySelectorAll('.chat-message-bubble.voice').forEach(bubble => {
            bubble.addEventListener('click', handleVoiceClick);
        });

        elements.chatMessages.querySelectorAll('.chat-message-bubble.image').forEach(bubble => {
            setupImageLongPress(bubble);
        });

        // 为所有消息气泡添加长按事件（显示操作菜单）
        elements.chatMessages.querySelectorAll('.chat-message-bubble').forEach(bubble => {
            setupMessageLongPress(bubble);
        });

        elements.chatMessages.querySelectorAll('.inner-thought-indicator').forEach(indicator => {
            indicator.addEventListener('click', (e) => {
                e.stopPropagation();
                openInnerThoughtModalFromIndicator(indicator);
            });
        });
    }

    function handleVoiceClick(e) {
        const bubble = e.currentTarget;
        const msgId = bubble.dataset.voiceId;
        const msg = messages.find(m => m.id === msgId);
        if (!msg) return;

        if (playingVoiceId === msgId) {
            stopVoicePlayback(msgId);
        } else {
            startVoicePlayback(msgId, msg);
        }
    }

    function startVoicePlayback(msgId, msg) {
        if (playingVoiceId && playingVoiceId !== msgId) {
            stopVoicePlayback(playingVoiceId);
        }

        playingVoiceId = msgId;
        const bubble = elements.chatMessages.querySelector(`[data-voice-id="${msgId}"]`);
        if (bubble) {
            bubble.classList.add('playing');
        }

        const duration = parseDuration(msg.content?.duration || '3"') * 1000;

        setTimeout(() => {
            stopVoicePlayback(msgId);
            const transcript = generateMockTranscript(msg);
            msg.transcript = transcript;
            saveChatHistory();
            renderMessages();
            scrollToBottom();
        }, duration);
    }

    function stopVoicePlayback(msgId) {
        playingVoiceId = null;
        const bubble = elements.chatMessages.querySelector(`[data-voice-id="${msgId}"]`);
        if (bubble) {
            bubble.classList.remove('playing');
        }
    }

    function parseDuration(str) {
        const match = str.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : 3;
    }

    function generateMockTranscript(msg) {
        const transcripts = [
            '好的，收到啦~',
            '嗯嗯，我知道了',
            '这个主意不错呢',
            '待会儿再聊吧',
            '哈哈，你说得太对了',
            '我明白了，没问题'
        ];
        return transcripts[Math.floor(Math.random() * transcripts.length)];
    }

    function setupImageLongPress(bubble) {
        let pressTimer = null;
        let isLongPress = false;
        const msgId = bubble.dataset.imageId;
        const msg = messages.find(m => m.id === msgId);
        if (!msg || msg.type === 'own') return;

        const startPress = (e) => {
            isLongPress = false;
            pressTimer = setTimeout(() => {
                isLongPress = true;
                handleImageLongPress(msgId, bubble);
            }, 600);
        };

        const endPress = () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        };

        bubble.addEventListener('mousedown', startPress);
        bubble.addEventListener('mouseup', endPress);
        bubble.addEventListener('mouseleave', endPress);
        bubble.addEventListener('touchstart', startPress, { passive: true });
        bubble.addEventListener('touchend', endPress);
        bubble.addEventListener('touchcancel', endPress);
    }

    async function handleImageLongPress(msgId, bubble) {
        const msg = messages.find(m => m.id === msgId);
        if (!msg || msg.imageDescription) return;

        const descEl = document.createElement('div');
        descEl.className = 'image-description';
        descEl.textContent = '正在分析图片...';

        const wrapper = bubble.closest('.chat-message-bubble-wrapper');
        if (wrapper) {
            const timeEl = wrapper.querySelector('.chat-message-time');
            wrapper.insertBefore(descEl, timeEl);
        }

        try {
            const description = await generateMockImageDescription(msg);
            msg.imageDescription = description;
            saveChatHistory();
            renderMessages();
            scrollToBottom();
        } catch (err) {
            console.error('生成图片描述失败:', err);
            descEl.textContent = '描述生成失败，请重试';
        }
    }

    function generateMockImageDescription(msg) {
        const descriptions = [
            '这是一张温馨的生活照片，画面中阳光洒在桌面上，有一杯还在冒热气的咖啡，旁边放着一本翻开的书，看起来是一个慵懒的午后时光。',
            '图片里是一只圆滚滚的橘猫正躺在阳台上晒太阳，肚皮朝天，四只爪子松弛地垂着，表情十分享受，旁边还有几片绿植的叶子在风中轻轻摇曳。',
            '这是一张手绘风格的插画，色调柔和清新，描绘了一个女孩坐在窗边看书的场景，窗外是淡蓝色的天空和几朵白云，整体氛围很治愈。',
            '照片拍摄的是一道精致的下午茶甜点，粉色的马卡龙、切面漂亮的水果塔、还有一壶薄荷茶，摆盘很有层次感，背景虚化处理得很高级。',
            '这是一张风景照，远处是连绵的青山，近处是一片金黄的稻田，天空湛蓝清澈，几只鸟儿飞过，给人一种宁静开阔的感觉。'
        ];
        return descriptions[Math.floor(Math.random() * descriptions.length)];
    }

    // ========== 长按消息操作菜单 ==========
    function setupMessageLongPress(bubble) {
        // 跳过语音和图片气泡（它们有自己的长按逻辑）
        if (bubble.classList.contains('voice') || bubble.classList.contains('image')) {
            return;
        }

        let pressTimer = null;
        const msgId = bubble.closest('.chat-message')?.dataset.msgId;
        if (!msgId) return;

        const startPress = (e) => {
            // 防止在输入框等交互元素上触发
            if (e.target.closest('input, button, a, textarea')) return;
            
            pressTimer = setTimeout(() => {
                showActionMenu(msgId, bubble);
            }, 500); // 500ms 长按触发
        };

        const endPress = () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
            // 移除高亮
            bubble.classList.remove('long-press-highlight');
        };

        const startHighlight = () => {
            bubble.classList.add('long-press-highlight');
        };

        const endHighlight = () => {
            bubble.classList.remove('long-press-highlight');
        };

        bubble.addEventListener('mousedown', startPress);
        bubble.addEventListener('mouseup', endPress);
        bubble.addEventListener('mouseleave', endPress);
        bubble.addEventListener('touchstart', (e) => {
            startHighlight();
            startPress(e);
        }, { passive: true });
        bubble.addEventListener('touchend', endPress);
        bubble.addEventListener('touchcancel', endPress);
    }

    function showActionMenu(msgId, bubble) {
        const msg = messages.find(m => m.id === msgId);
        if (!msg) return;

        longPressTargetMsg = msg;
        isActionMenuOpen = true;

        // 触觉反馈（如果支持）
        if (navigator.vibrate) {
            navigator.vibrate(10);
        }

        // 计算菜单位置
        const menu = elements.chatActionMenu;
        if (!menu) return;

        const rect = bubble.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const menuWidth = 280; // 估算菜单宽度

        // 水平居中于气泡，但限制在视口内
        let left = rect.left + rect.width / 2 - menuWidth / 2;
        const minLeft = 16;
        const maxLeft = viewportWidth - menuWidth - 16;
        left = Math.max(minLeft, Math.min(maxLeft, left));

        // 垂直位置：气泡上方 12px
        const top = rect.top - 12;

        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
        menu.hidden = false;

        // 强制重绘并显示动画
        menu.offsetHeight;
        menu.classList.add('visible');

        // 添加点击外部关闭监听
        setTimeout(() => {
            document.addEventListener('click', handleActionMenuOutsideClick);
        }, 0);
    }

    function closeActionMenu() {
        const menu = elements.chatActionMenu;
        if (!menu) return;

        menu.classList.remove('visible');
        isActionMenuOpen = false;
        longPressTargetMsg = null;

        // 移除点击外部关闭监听
        document.removeEventListener('click', handleActionMenuOutsideClick);

        setTimeout(() => {
            if (menu && !menu.classList.contains('visible')) {
                menu.hidden = true;
            }
        }, 200);
    }

    function handleActionMenuOutsideClick(e) {
        const menu = elements.chatActionMenu;
        if (menu && !menu.contains(e.target)) {
            closeActionMenu();
        }
    }

    function handleActionMenuAction(action) {
        if (!longPressTargetMsg) return;

        switch (action) {
            case 'regenerate':
                handleRegenerate(longPressTargetMsg);
                break;
            case 'delete':
                handleDeleteMessage(longPressTargetMsg);
                break;
            case 'quote':
                handleQuote(longPressTargetMsg);
                break;
            case 'format':
                // 预留功能
                console.log('修改格式功能待实现');
                break;
        }
    }

    // 重新生成（仅对 AI 消息有效）
    function handleRegenerate(msg) {
        if (msg.type !== 'other') {
            console.log('只能重新生成 AI 回复');
            return;
        }
        // 删除当前消息并触发 AI 重新回复
        const msgIndex = messages.findIndex(m => m.id === msg.id);
        if (msgIndex !== -1) {
            messages.splice(msgIndex, 1);
            saveChatHistory();
            renderMessages();
            scrollToBottom();
            // 触发 AI 重新回复
            triggerAiReply();
        }
    }

    // 删除消息
    function handleDeleteMessage(msg) {
        const msgIndex = messages.findIndex(m => m.id === msg.id);
        if (msgIndex !== -1) {
            messages.splice(msgIndex, 1);
            saveChatHistory();
            renderMessages();
            scrollToBottom();
        }
    }

    // 引用消息
    function handleQuote(msg) {
        quotedMessage = msg;
        showQuoteBar(msg);
        // 聚焦输入框
        if (elements.chatInput) {
            elements.chatInput.focus();
        }
    }

    function showQuoteBar(msg) {
        const quoteBar = elements.chatQuoteBar;
        const quoteSender = elements.chatQuoteSender;
        const quoteText = elements.chatQuoteText;
        if (!quoteBar || !quoteSender || !quoteText) return;

        const isOwn = msg.type === 'own';
        const senderName = isOwn ? '你' : (currentChatPersona?.name || '对方');
        
        // 处理不同类型消息的内容显示
        let displayText = '';
        if (msg.msgType === 'text') {
            displayText = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        } else if (msg.msgType === 'redPacket') {
            displayText = `[红包] ${msg.content?.title || '微信红包'}`;
        } else if (msg.msgType === 'transfer') {
            displayText = `[转账] ${msg.content?.amount || '0.00'}元`;
        } else if (msg.msgType === 'voice') {
            displayText = `[语音] ${msg.content?.duration || '5"'}`
        } else if (msg.msgType === 'image') {
            displayText = '[图片]';
        } else {
            displayText = String(msg.content || '');
        }

        // 截断过长文本
        if (displayText.length > 80) {
            displayText = displayText.substring(0, 80) + '...';
        }

        quoteSender.textContent = senderName;
        quoteText.textContent = displayText;
        quoteBar.hidden = false;
    }

    function clearQuote() {
        quotedMessage = null;
        const quoteBar = elements.chatQuoteBar;
        if (quoteBar) {
            quoteBar.hidden = true;
        }
    }

    // 重写发送消息，支持引用
    function sendMessage() {
        const text = elements.chatInput.value.trim();
        if (!text) return;

        const message = {
            id: 'msg_' + Date.now(),
            type: 'own',
            msgType: 'text',
            content: text,
            timestamp: Date.now(),
            // 如果有引用消息，添加引用信息
            ...(quotedMessage && {
                quote: {
                    msgId: quotedMessage.id,
                    sender: quotedMessage.type === 'own' ? '你' : (currentChatPersona?.name || '对方'),
                    text: quotedMessage.msgType === 'text' 
                        ? (typeof quotedMessage.content === 'string' ? quotedMessage.content : JSON.stringify(quotedMessage.content))
                        : `[${getMsgTypeLabel(quotedMessage.msgType)}]`
                }
            })
        };

        messages.push(message);
        saveChatHistory();
        renderMessages();
        scrollToBottom();

        elements.chatInput.value = '';
        elements.chatInput.focus();

        // 发送后清除引用
        clearQuote();
    }

    function getMsgTypeLabel(type) {
        const labels = {
            'text': '文本',
            'redPacket': '红包',
            'transfer': '转账',
            'voice': '语音',
            'image': '图片'
        };
        return labels[type] || '消息';
    }

    function updateUI() {
        if (!currentChatPersona) return;
        const name = currentChatPersona.name || '名字';

        const chatSettingsKey = currentChatPersona.id ? `chat_settings_${currentChatPersona.id}` : 'chat_settings';
        const chatSettings = JSON.parse(localStorage.getItem(chatSettingsKey) || '{}');
        const remark = chatSettings.remark || '';

        const displayName = remark ? `${remark}` : name;

        if (elements.chatTitle) elements.chatTitle.textContent = displayName;
        if (elements.chatWelcomeName) elements.chatWelcomeName.textContent = name;
        if (elements.chatAvatarBtn) {
            const icon = elements.chatAvatarBtn.querySelector('.chat-avatar-icon');
            if (icon) {
                if (currentChatPersona.avatar) {
                    icon.innerHTML = `<img src="${currentChatPersona.avatar}" alt="${name}" style="width:32px;height:32px;object-fit:cover;border-radius:50%;">`;
                } else {
                    icon.textContent = '🌸';
                }
            }
        }
    }

    function applyChatBackground() {
        const chatSettingsKey = currentChatPersona.id ? `chat_settings_${currentChatPersona.id}` : 'chat_settings';
        const chatSettings = JSON.parse(localStorage.getItem(chatSettingsKey) || '{}');
        const chatContent = document.getElementById('chatContent');
        if (chatContent && chatSettings.chatBg) {
            chatContent.style.backgroundImage = `url(${chatSettings.chatBg})`;
            chatContent.style.backgroundSize = 'cover';
            chatContent.style.backgroundPosition = 'center';
            chatContent.style.backgroundRepeat = 'no-repeat';
        } else if (chatContent) {
            chatContent.style.backgroundImage = '';
        }
    }

    function scrollToBottom() {
        if (!elements.chatMessages) return;
        const el = elements.chatMessages;
        el.scrollTop = 0;
        el.scrollTop = el.scrollHeight;
        requestAnimationFrame(() => {
            el.scrollTop = el.scrollHeight;
        });
        setTimeout(() => { el.scrollTop = el.scrollHeight; }, 150);
        setTimeout(() => { el.scrollTop = el.scrollHeight; }, 400);
        setTimeout(() => { el.scrollTop = el.scrollHeight; }, 800);
    }

    function formatTime(timestamp) {
        const date = new Date(timestamp);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ========== 心声模态框功能 ==========

    function openInnerThoughtModalFromIndicator(indicator) {
        const msgId = indicator.dataset.msgId;
        const partnerName = indicator.dataset.partnerName;
        const msg = messages.find(m => m.id === msgId);
        const persona = currentChatPersona; // 获取当前聊天的人设
        if (!persona || !msg || !msg.innerThought) return;

        const detail = msg.innerThought.detail;

        // 1. 渲染个人资料（从人设中读取）
        const avatar = persona.avatar || '';
        document.getElementById('thoughtAvatar').src = avatar;
        document.getElementById('thoughtName').textContent = persona.name || '角色';
        document.getElementById('thoughtWechat').textContent = persona.wechat || '未设置微信号';
        
        // 新增的 4 个信息（如果为空则显示占位符 -）
        document.getElementById('thoughtGender').textContent = persona.gender || '-';
        document.getElementById('thoughtAge').textContent = persona.age || '-';
        document.getElementById('thoughtAddress').textContent = persona.address || '-';
        document.getElementById('thoughtBirthday').textContent = persona.birthday || '-';

        // 2. 渲染心声细节（从 AI 中读取）
        document.getElementById('thoughtAppearance').textContent = detail.外貌 || '日常穿着';
        document.getElementById('thoughtAction').textContent = detail.动作 || '自然站立';
        document.getElementById('thoughtPhysical').textContent = detail.身体状态 || '状态正常';
        document.getElementById('thoughtSurface').textContent = detail.表层心声 || '平静如常';
        document.getElementById('thoughtDark').textContent = detail.阴暗心声 || '无';
        document.getElementById('thoughtInner').textContent = detail.内心吐槽 || '...';

        if (elements.innerThoughtModal) {
            elements.innerThoughtModal.hidden = false;
            elements.innerThoughtModal.offsetHeight;
        }
    }

    function closeInnerThoughtModal() {
        if (elements.innerThoughtModal) {
            elements.innerThoughtModal.hidden = true;
        }
    }

    function bindInnerThoughtModalEvents() {
        if (elements.innerThoughtBackdrop) {
            elements.innerThoughtBackdrop.addEventListener('click', closeInnerThoughtModal);
        }
    }

    function showInnerThought() {
        const lastAiMsg = [...messages].reverse().find(m =>
            m.type === 'other' && m.msgType === 'text' && m.innerThought
        );
        if (lastAiMsg) {
            const indicator = elements.chatMessages.querySelector(`.inner-thought-indicator[data-msg-id="${lastAiMsg.id}"]`);
            if (indicator) {
                openInnerThoughtModalFromIndicator(indicator);
            }
        } else {
            console.log('暂无心声内容');
        }
    }

    // ========== 拓展功能面板 ==========
    function toggleExtend() {
        const isOpen = elements.chatExtendPanel && !elements.chatExtendPanel.hidden;
        
        if (isOpen) {
            closeExtendPanel();
        } else {
            openExtendPanel();
        }
    }

    function openExtendPanel() {
        if (!elements.chatExtendPanel || !elements.chatExtendBackdrop || !elements.chatExtendBtn) return;
        
        elements.chatExtendPanel.hidden = false;
        elements.chatExtendBackdrop.hidden = false;
        
        // 强制重绘以触发动画
        elements.chatExtendPanel.offsetHeight;
        elements.chatExtendBackdrop.offsetHeight;
        
        elements.chatExtendPanel.classList.add('visible');
        elements.chatExtendBackdrop.classList.add('visible');
        elements.chatExtendBtn.classList.add('active');
    }

    function closeExtendPanel() {
        if (!elements.chatExtendPanel || !elements.chatExtendBackdrop || !elements.chatExtendBtn) return;
        
        elements.chatExtendPanel.classList.remove('visible');
        elements.chatExtendBackdrop.classList.remove('visible');
        elements.chatExtendBtn.classList.remove('active');
        
        // 等待动画结束后隐藏
        setTimeout(() => {
            if (elements.chatExtendPanel && !elements.chatExtendPanel.classList.contains('visible')) {
                elements.chatExtendPanel.hidden = true;
                elements.chatExtendBackdrop.hidden = true;
            }
        }, 300);
    }

    function handleExtendAction(action) {
        // 定义各功能对应的消息内容
        const actionContents = {
            emoji: { type: 'text', content: '[表情]' },
            redPacket: { title: '微信红包', amount: '8.88', subtitle: '恭喜发财，大吉大利' },
            transfer: { title: '转账', amount: '100.00', subtitle: '转账给好友' },
            offline: { type: 'text', content: '[线下面基]' },
            file: { url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjQThEMBVEIiBzdHJva2Utd2lkdGg9IjEuNSI+PHJlY3QgeD0iMiIgeT0iMiIgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiByeD0iNSIgcnk9IjUiLz48cGF0aCBkPSJNNyAxMmw1IDUgMTAtMTAiLz48L3N2Zz4=' },
            companion: { type: 'text', content: '[陪伴模式]' }
        };

        const content = actionContents[action];
        if (content) {
            if (action === 'redPacket' || action === 'transfer') {
                sendMessageOfType(action, content);
            } else if (action === 'file') {
                sendMessageOfType('image', content);
            } else {
                sendMessageOfType('text', content.content);
            }
        }
    }

    function openPersonaProfile() {
        console.log('[占位符] openPersonaProfile() - 查看人设资料待实现');
    }

    // 清空聊天记录（仅清空显示，不删除记忆）
    function clearChatHistory() {
        messages = [];
        if (elements.chatMessages) {
            elements.chatMessages.innerHTML = '';
        }
        if (elements.chatWelcome) {
            elements.chatWelcome.style.display = 'flex';
        }
        if (elements.chatMessages) {
            elements.chatMessages.style.display = 'none';
        }
    }

    return {
        init,
        openChat,
        closeChat,
        getCurrentPersona,
        isOpen,
        sendMessage,
        sendMessageOfType,
        triggerAiReply,
        showInnerThought,
        toggleExtend,
        updateUI,
        clearChatHistory
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatModule;
} else if (typeof window !== 'undefined') {
    window.ChatModule = ChatModule;
}