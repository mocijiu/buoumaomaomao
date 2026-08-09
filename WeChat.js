// ========== WeChat 页面模块 ==========
const WeChatModule = (function() {
    'use strict';

    // ========== WeChat 页面状态 ==========
    let isWechatOpen = false;
    let wechatSourcePage = 'page3';
    let currentWechatTab = 'wechat';

    // ========== DOM 元素缓存 ==========
    const elements = {
        wechatBack: null,
        wechatTitle: null,
        wechatAddBtn: null,
        tabWechat: null,
        tabContacts: null,
        tabMoments: null,
        tabMe: null,
        wechatContent: null,
        contactsAddModal: null,
        contactsAddModalBackdrop: null,
        modalAddFriend: null,
        modalGroupChat: null,
        // 我的页面相关
        meNameInput: null,
        meIdInput: null,
        meWalletCard: null,
        meMomentsCard: null,
        mePersonaCard: null
    };

    // ========== 外部依赖（由主程序注入） ==========
    let external = {
        PAGES: [],
        getCurrentPageIndex: () => 0,
        goToPage: null,
        elements: {},
        getIsSettingsOpen: () => false,
        setIsSettingsOpen: (val) => {},
        openChat: null,
        getSavedPersonas: () => []
    };

    // ========== 初始化 ==========
    function init(deps) {
        external = { ...external, ...deps };
        cacheElements();
        bindEvents();
    }

    function cacheElements() {
        elements.wechatBack = document.getElementById('wechatBack');
        elements.wechatTitle = document.getElementById('wechatTitle');
        elements.wechatAddBtn = document.getElementById('wechatAddBtn');
        elements.tabWechat = document.getElementById('tabWechat');
        elements.tabContacts = document.getElementById('tabContacts');
        elements.tabMoments = document.getElementById('tabMoments');
        elements.tabMe = document.getElementById('tabMe');
        elements.wechatContent = document.getElementById('wechatContent');
        elements.contactsAddModal = document.getElementById('contactsAddModal');
        elements.contactsAddModalBackdrop = document.querySelector('.contacts-add-modal-backdrop');
        elements.modalAddFriend = document.getElementById('modalAddFriend');
        elements.modalGroupChat = document.getElementById('modalGroupChat');
        // 我的页面元素（动态渲染后获取）
        elements.meNameInput = null;
        elements.meIdInput = null;
        elements.meWalletCard = null;
        elements.meMomentsCard = null;
        elements.mePersonaCard = null;
    }

    // ========== 公开方法 ==========
    function openWechat(sourcePage = 'page3') {
        if (isWechatOpen) return;
        isWechatOpen = true;
        wechatSourcePage = sourcePage;
        if (sourcePage === 'page5') {
            external.setIsSettingsOpen(false);
        }
        external.goToPage('page9');
        switchWechatTab('wechat');
    }

    function closeWechat() {
        if (!isWechatOpen) return;
        isWechatOpen = false;
        external.goToPage(wechatSourcePage);
    }

    function switchWechatTab(tabName) {
        currentWechatTab = tabName;

        const tabs = {
            wechat: elements.tabWechat,
            contacts: elements.tabContacts,
            moments: elements.tabMoments,
            me: elements.tabMe
        };

        Object.entries(tabs).forEach(([name, tab]) => {
            if (tab) {
                tab.classList.toggle('active', name === tabName);
            }
        });

        const tabLabels = {
            wechat: 'WeChat',
            contacts: '通讯录',
            moments: '朋友圈',
            me: '我'
        };

        // 更新顶部标题
        if (elements.wechatTitle) {
            elements.wechatTitle.textContent = tabLabels[tabName];
        }

        // 处理右侧加号按钮显示/隐藏及点击事件
        if (elements.wechatAddBtn) {
            // 先移除之前的事件监听器（通过克隆节点替换）
            const newAddBtn = elements.wechatAddBtn.cloneNode(true);
            elements.wechatAddBtn.parentNode.replaceChild(newAddBtn, elements.wechatAddBtn);
            elements.wechatAddBtn = newAddBtn;

            const showAddBtn = tabName === 'contacts' || tabName === 'moments';
            elements.wechatAddBtn.style.display = showAddBtn ? 'flex' : 'none';

            if (showAddBtn) {
                elements.wechatAddBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (tabName === 'contacts') {
                        showContactsAddModal();
                    } else if (tabName === 'moments') {
                        handlePostMoment();
                    }
                });
            }
        }

        // 渲染对应标签页内容
        renderTabContent(tabName);

        console.log('切换到:', tabLabels[tabName]);
    }

    // 渲染标签页内容
    function renderTabContent(tabName) {
        if (!elements.wechatContent) return;

        const allPersonas = external.getSavedPersonas();
        // 获取 Char 人设（AI扮演的人设，用于通讯录和聊天列表）
        const charPersonas = external.getCharPersonas ? external.getCharPersonas() : allPersonas.filter(p => p.id !== 'user_profile');
        // 获取当前用户信息（从 window.userProfile）
        const currentUser = window.userProfile || { name: '微信用户', wechat: 'wxid_未设置', avatar: '' };

        switch (tabName) {
            case 'wechat':
                // WeChat 聊天列表 - 显示有聊天记录的联系人
                renderChatList(charPersonas);
                break;

            case 'contacts':
                // 通讯录列表 - 显示 Char 人设
                renderContactsList(charPersonas);
                break;

            case 'moments':
                // 朋友圈空状态
                elements.wechatContent.innerHTML = `
                    <div class="wechat-empty" id="wechatEmpty">
                        <p class="wechat-empty-text">暂无朋友圈动态</p>
                    </div>
                `;
                break;

            case 'me':
                // 我的页面 - 个人主页
                renderMePage(currentUser);
                break;
        }
    }

    // 渲染我的页面
    function renderMePage(user) {
        if (!elements.wechatContent) return;

        const userName = user?.name || '微信用户';
        const userWechat = user?.wechat || 'wxid_未设置';
        const userAvatar = user?.avatar || '';

        elements.wechatContent.innerHTML = `
            <div class="me-content">
                <!-- 顶部个人资料区 -->
                <div class="me-profile">
                    <div class="me-avatar">
                        ${userAvatar
                            ? `<img src="${escapeHtml(userAvatar)}" alt="${escapeHtml(userName)}">`
                            : `<svg class="me-avatar-placeholder" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:#FFFFFF;width:100%;height:100%;">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                              </svg>`}
                    </div>
                    <div class="me-info">
                        <div class="me-name-row">
                            <span class="me-label">微信名</span>
                            <input type="text" class="me-name-input" id="meNameInput" value="${escapeHtml(userName)}" placeholder="微信名" autocomplete="off">
                            <svg class="me-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                        <div class="me-id-row">
                            <span class="me-label">微信号</span>
                            <input type="text" class="me-id-input" id="meIdInput" value="${escapeHtml(userWechat)}" placeholder="微信号" autocomplete="off" readonly>
                            <svg class="me-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                    </div>
                </div>

                <!-- 功能卡片区 -->
                <div class="me-cards">
                    <div class="me-card" id="meWalletCard">
                        <span class="me-card-text">我的钱包</span>
                        <svg class="me-card-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </div>
                    <div class="me-card" id="meMomentsCard">
                        <span class="me-card-text">我的朋友圈</span>
                        <svg class="me-card-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </div>
                    <div class="me-card" id="mePersonaCard">
                        <span class="me-card-text">我的人设</span>
                        <svg class="me-card-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </div>
                </div>
            </div>
        `;

        // 缓存我的页面元素
        cacheMeElements();

        // 绑定我的页面事件
        bindMeEvents(user);
    }

    // 缓存我的页面元素
    function cacheMeElements() {
        elements.meNameInput = document.getElementById('meNameInput');
        elements.meIdInput = document.getElementById('meIdInput');
        elements.meWalletCard = document.getElementById('meWalletCard');
        elements.meMomentsCard = document.getElementById('meMomentsCard');
        elements.mePersonaCard = document.getElementById('mePersonaCard');
    }

    // 绑定我的页面事件
    function bindMeEvents(user) {
        // 微信名编辑
        if (elements.meNameInput) {
            elements.meNameInput.addEventListener('blur', () => {
                handleNameChange(elements.meNameInput.value.trim(), user);
            });
            elements.meNameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    elements.meNameInput.blur();
                }
            });
        }

        // 微信号编辑（点击弹窗修改）
        if (elements.meIdInput) {
            elements.meIdInput.addEventListener('click', (e) => {
                e.preventDefault();
                handleIdChange(user);
            });
        }

        // 我的钱包点击
        if (elements.meWalletCard) {
            elements.meWalletCard.addEventListener('click', () => {
                handleWalletClick();
            });
        }

        // 我的朋友圈点击
        if (elements.meMomentsCard) {
            elements.meMomentsCard.addEventListener('click', () => {
                handleMomentsClick();
            });
        }

        // 我的人设点击
        if (elements.mePersonaCard) {
            elements.mePersonaCard.addEventListener('click', () => {
                handlePersonaClick();
            });
        }
    }

    // 处理微信名修改
    function handleNameChange(newName, user) {
        if (!newName || !user) return;
        if (newName === user.name) return;

        // 更新本地存储
        const personas = external.getSavedPersonas();
        const updatedPersonas = personas.map(p => {
            if (p.id === user.id) {
                return { ...p, name: newName };
            }
            return p;
        });
        
        // 触发外部更新（如果有回调）
        if (external.updatePersona) {
            external.updatePersona(user.id, { name: newName });
        } else {
            // 直接保存到localStorage
            localStorage.setItem('saved_personas', JSON.stringify(updatedPersonas));
        }

        // 刷新当前显示
        if (elements.wechatTitle) {
            elements.wechatTitle.textContent = newName;
        }
        console.log('微信名已更新:', newName);
    }

    // 处理微信号修改
    function handleIdChange(user) {
        if (!user) return;
        
        const newId = prompt('请输入新的微信号:', user.wechat || '');
        if (newId === null || newId.trim() === '' || newId.trim() === user.wechat) return;

        // 检查微信号是否已被占用
        const personas = external.getSavedPersonas();
        const exists = personas.some(p => p.wechat === newId.trim() && p.id !== user.id);
        if (exists) {
            alert('该微信号已被占用');
            return;
        }

        // 更新本地存储
        const updatedPersonas = personas.map(p => {
            if (p.id === user.id) {
                return { ...p, wechat: newId.trim() };
            }
            return p;
        });

        if (external.updatePersona) {
            external.updatePersona(user.id, { wechat: newId.trim() });
        } else {
            localStorage.setItem('saved_personas', JSON.stringify(updatedPersonas));
        }

        // 同步到 userProfile
        if (window.userProfile) {
            window.userProfile.wechat = newId.trim();
            localStorage.setItem('user_profile', JSON.stringify(window.userProfile));
        }

        // 更新输入框显示
        if (elements.meIdInput) {
            elements.meIdInput.value = newId.trim();
        }
        console.log('微信号已更新:', newId.trim());
    }

    // 我的钱包点击占位符
    function handleWalletClick() {
        console.log('点击：我的钱包 - 功能待实现');
        // 留空用占位符方便后面替换功能
    }

    // 我的朋友圈点击占位符
    function handleMomentsClick() {
        console.log('点击：我的朋友圈 - 功能待实现');
        // 留空用占位符方便后面替换功能
    }

    // 我的人设点击 - 打开用户人设页面
    function handlePersonaClick() {
        if (window.UserPersonaModule && typeof UserPersonaModule.openUserPersona === 'function') {
            UserPersonaModule.openUserPersona('page9');
        } else {
            console.log('UserPersonaModule 未加载');
        }
    }

    // 渲染聊天列表（微信主页）
    function renderChatList(personas) {
        if (!elements.wechatContent) return;

        // 获取所有有聊天记录的人设
        const chatList = personas.map(persona => {
            const key = `chat_history_${persona.id}`;
            const saved = localStorage.getItem(key);
            if (!saved) return null;
            
            try {
                const messages = JSON.parse(saved);
                if (messages.length === 0) return null;
                
                // 获取最后一条消息
                const lastMsg = messages[messages.length - 1];
                let lastMsgText = '';
                if (lastMsg.msgType === 'text') {
                    lastMsgText = typeof lastMsg.content === 'string' ? lastMsg.content : JSON.stringify(lastMsg.content);
                } else if (lastMsg.msgType === 'redPacket') {
                    lastMsgText = `[红包] ${lastMsg.content?.title || '微信红包'}`;
                } else if (lastMsg.msgType === 'transfer') {
                    lastMsgText = `[转账] ${lastMsg.content?.amount || '0.00'}元`;
                } else if (lastMsg.msgType === 'voice') {
                    lastMsgText = `[语音] ${lastMsg.content?.duration || '5"'}`
                } else if (lastMsg.msgType === 'image') {
                    lastMsgText = '[图片]';
                } else {
                    lastMsgText = String(lastMsg.content || '');
                }
                
                // 截断文本
                if (lastMsgText.length > 20) {
                    lastMsgText = lastMsgText.substring(0, 20) + '...';
                }
                
                return {
                    persona,
                    lastMsgText,
                    timestamp: lastMsg.timestamp
                };
            } catch {
                return null;
            }
        }).filter(item => item !== null);

        // 按时间倒序排列
        chatList.sort((a, b) => b.timestamp - a.timestamp);

        if (chatList.length === 0) {
            elements.wechatContent.innerHTML = `
                <div class="wechat-empty" id="wechatEmpty">
                    <p class="wechat-empty-text">暂无聊天，请先在通讯录添加好友</p>
                </div>
            `;
            return;
        }

        elements.wechatContent.innerHTML = `
            <div class="chat-list" id="chatList">
                ${chatList.map(item => `
                    <div class="chat-list-item" data-id="${item.persona.id}">
                        <div class="chat-list-avatar">
                            ${item.persona.avatar 
                                ? `<img src="${item.persona.avatar}" alt="${escapeHtml(item.persona.name)}">`
                                : `<svg class="chat-list-avatar-placeholder" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:#A8D0E6;width:100%;height:100%;">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                  </svg>`
                            }
                        </div>
                        <div class="chat-list-info">
                            <div class="chat-list-name">${escapeHtml(item.persona.chatRemark || item.persona.name)}</div>
                            <div class="chat-list-lastmsg">${escapeHtml(item.lastMsgText)}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        // 绑定点击事件 - 跳转到聊天详情页
        elements.wechatContent.querySelectorAll('.chat-list-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const personaId = item.dataset.id;
                const persona = personas.find(p => p.id === personaId);
                if (persona && external.openChat) {
                    external.openChat(persona, 'page9');
                }
            });
        });
    }

    // 渲染通讯录列表
    function renderContactsList(personas) {
        if (!elements.wechatContent) return;

        // 获取好友申请数量用于显示红点
        const friendRequests = getFriendRequests();
        const hasNewRequests = friendRequests.length > 0;

        if (personas.length === 0) {
            elements.wechatContent.innerHTML = `
                <div class="wechat-empty" id="wechatEmpty">
                    <p class="wechat-empty-text">暂无联系人，点击右上角 + 添加</p>
                </div>
            `;
            return;
        }

        elements.wechatContent.innerHTML = `
            <div class="contacts-list" id="contactsList">
                <!-- 新的朋友入口 -->
                <div class="contact-item new-friends-entry" id="newFriendsEntry">
                    <div class="contact-avatar new-friends-avatar">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                        ${hasNewRequests ? `<span class="new-friends-badge">${friendRequests.length > 99 ? '99+' : friendRequests.length}</span>` : ''}
                    </div>
                    <div class="contact-info">
                        <div class="contact-name">新的朋友</div>
                    </div>
                    <svg class="contact-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </div>
                ${personas.map(persona => `
                    <div class="contact-item" data-id="${persona.id}">
                        <div class="contact-avatar">
                            ${persona.avatar 
                                ? `<img src="${persona.avatar}" alt="${escapeHtml(persona.name)}">`
                                : `<svg class="contact-avatar-placeholder" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:#A8D0E6;width:100%;height:100%;">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                  </svg>`
                            }
                        </div>
                        <div class="contact-info">
                            <div class="contact-name">${escapeHtml(persona.chatRemark || persona.name)}</div>
                            <div class="contact-wechat">${escapeHtml(persona.wechat || '未设置微信号')}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        // 绑定"新的朋友"点击事件
        const newFriendsEntry = document.getElementById('newFriendsEntry');
        if (newFriendsEntry) {
            newFriendsEntry.addEventListener('click', (e) => {
                e.stopPropagation();
                external.goToPage('pageNewFriends');
            });
        }

        // 绑定联系人点击事件
        elements.wechatContent.querySelectorAll('.contact-item[data-id]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const personaId = item.dataset.id;
                const persona = personas.find(p => p.id === personaId);
                if (persona && window.ContactDetailModule) {
                    window.ContactDetailModule.openContactDetail(persona);
                }
            });
        });
    }

    // 刷新通讯录列表（外部调用，如备注更新后）
    function refreshContacts() {
        const personas = external.getCharPersonas ? external.getCharPersonas() : [];
        renderContactsList(personas);
    }

    // ========== 好友申请相关功能 ==========
    const FRIEND_REQUEST_REASONS = [
        "我得了emo病 医生给我开了你的WeChat",
        "您列表好友的漏网之鱼",
        "再不通过就有点暧昧了",
        "恋爱合伙人驾到，请速速通过",
        "你好，月老给了我你的联系方式"
    ];

    function getFriendRequests() {
        try {
            return JSON.parse(localStorage.getItem('friend_requests') || '[]');
        } catch {
            return [];
        }
    }

    function saveFriendRequests(requests) {
        localStorage.setItem('friend_requests', JSON.stringify(requests));
    }

    function addFriendRequest(persona) {
        const requests = getFriendRequests();
        // 检查是否已存在相同微信号的申请
        const exists = requests.some(r => r.wechat === persona.wechat);
        if (exists) return;
        
        // 检查是否已经是好友
        const personas = external.getSavedPersonas ? external.getSavedPersonas() : [];
        const isFriend = personas.some(p => p.wechat === persona.wechat);
        if (isFriend) return;

        const request = {
            id: 'request_' + Date.now(),
            personaId: persona.id,
            name: persona.name,
            wechat: persona.wechat,
            avatar: persona.avatar,
            reason: FRIEND_REQUEST_REASONS[Math.floor(Math.random() * FRIEND_REQUEST_REASONS.length)],
            time: Date.now()
        };
        requests.unshift(request);
        saveFriendRequests(requests);
        
        // 刷新通讯录列表以显示红点
        refreshContacts();
    }

    function removeFriendRequest(requestId) {
        const requests = getFriendRequests();
        const filtered = requests.filter(r => r.id !== requestId);
        saveFriendRequests(filtered);
        refreshContacts();
    }

    function acceptFriendRequest(requestId) {
        const requests = getFriendRequests();
        const request = requests.find(r => r.id === requestId);
        if (!request) return;

        // 添加到通讯录
        const persona = {
            id: request.personaId,
            name: request.name,
            wechat: request.wechat,
            avatar: request.avatar,
            createdAt: Date.now()
        };
        
        if (external.addPersona) {
            external.addPersona(persona);
        }

        // 移除申请
        removeFriendRequest(requestId);
        
        // 刷新通讯录
        refreshContacts();
        
        showToast('已通过好友申请');
    }

    function rejectFriendRequest(requestId) {
        removeFriendRequest(requestId);
        showToast('已拒绝');
    }

    function showToast(message) {
        const existingToast = document.querySelector('.wechat-toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.className = 'wechat-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(58, 80, 114, 0.9);
            color: #fff;
            padding: 12px 24px;
            border-radius: 12px;
            font-size: 14px;
            z-index: 3000;
            animation: toastIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        `;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastOut 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    // 渲染新的朋友页面
    function renderNewFriendsPage() {
        const contentEl = document.getElementById('newFriendsContent');
        if (!contentEl) return;

        const requests = getFriendRequests();

        if (requests.length === 0) {
            contentEl.innerHTML = `
                <div class="new-friends-empty">
                    <svg class="new-friends-empty-icon" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    <p class="new-friends-empty-text">还没有好友申请</p>
                </div>
            `;
            return;
        }

        contentEl.innerHTML = requests.map(request => `
            <div class="friend-request-item" data-id="${request.id}">
                <div class="request-header">
                    <div class="request-avatar">
                        ${request.avatar 
                            ? `<img src="${request.avatar}" alt="">`
                            : `<svg class="request-avatar-placeholder" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:#FFFFFF;width:100%;height:100%;">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                              </svg>`}
                    </div>
                    <div class="request-info">
                        <div class="request-name">${escapeHtml(request.name)}</div>
                        <div class="request-wechat">${escapeHtml(request.wechat)}</div>
                    </div>
                </div>
                <div class="request-reason">${escapeHtml(request.reason)}</div>
                <div class="request-actions">
                    <button class="request-btn reject" data-action="reject" data-id="${request.id}">拒绝</button>
                    <button class="request-btn accept" data-action="accept" data-id="${request.id}">同意</button>
                </div>
            </div>
        `).join('');

        // 绑定按钮事件
        contentEl.querySelectorAll('.request-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const requestId = btn.dataset.id;
                const action = btn.dataset.action;
                if (action === 'accept') {
                    acceptFriendRequest(requestId);
                    renderNewFriendsPage(); // 重新渲染
                } else if (action === 'reject') {
                    rejectFriendRequest(requestId);
                    renderNewFriendsPage(); // 重新渲染
                }
            });
        });
    }

    // 当页面显示时刷新新的朋友页面
    function refreshNewFriendsPage() {
        // 检查当前是否在新的朋友页面
        const newFriendsPage = document.getElementById('pageNewFriends');
        if (newFriendsPage && newFriendsPage.classList.contains('active')) {
            renderNewFriendsPage();
        }
    }

    function showContactsAddModal() {
        if (!elements.contactsAddModal) return;
        elements.contactsAddModal.hidden = false;
        // 触发重绘以启动动画
        elements.contactsAddModal.offsetHeight;
        elements.contactsAddModal.classList.add('show');
    }

    function hideContactsAddModal() {
        if (!elements.contactsAddModal) return;
        elements.contactsAddModal.classList.remove('show');
        setTimeout(() => {
            elements.contactsAddModal.hidden = true;
        }, 200);
    }

    // 添加好友处理（点击模态框中的"添加好友"）
    function handleAddFriend() {
        console.log('触发添加好友');
        hideContactsAddModal();
        // 导航到添加好友搜索页
        external.goToPage('pageAddFriend');
    }

    // 发起群聊处理
    function handleGroupChat() {
        console.log('触发发起群聊');
        hideContactsAddModal();
        alert('发起群聊功能待实现');
    }

    function getCurrentTab() {
        return currentWechatTab;
    }

    function isOpen() {
        return isWechatOpen;
    }

    // ========== 事件绑定 ==========
    function bindEvents() {
        // 返回按钮
        if (elements.wechatBack) {
            elements.wechatBack.addEventListener('click', (e) => {
                e.stopPropagation();
                closeWechat();
            });
        }

        // 新的朋友页面返回按钮
        const newFriendsBack = document.getElementById('newFriendsBack');
        if (newFriendsBack) {
            newFriendsBack.addEventListener('click', (e) => {
                e.stopPropagation();
                external.goToPage('page9');
            });
        }

        // 通讯录加号弹窗相关事件
        if (elements.contactsAddModalBackdrop) {
            elements.contactsAddModalBackdrop.addEventListener('click', hideContactsAddModal);
        }
        if (elements.modalAddFriend) {
            elements.modalAddFriend.addEventListener('click', (e) => {
                e.stopPropagation();
                handleAddFriend();
            });
        }
        if (elements.modalGroupChat) {
            elements.modalGroupChat.addEventListener('click', (e) => {
                e.stopPropagation();
                handleGroupChat();
            });
        }

        // 底部 Tab 点击
        const tabMap = {
            tabWechat: 'wechat',
            tabContacts: 'contacts',
            tabMoments: 'moments',
            tabMe: 'me'
        };

        Object.entries(tabMap).forEach(([elementKey, tabName]) => {
            const tab = elements[elementKey];
            if (tab) {
                tab.addEventListener('click', (e) => {
                    e.stopPropagation();
                    switchWechatTab(tabName);
                });
            }
        });
    }

    // HTML 转义
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ========== 导出 ==========
    return {
        init,
        openWechat,
        closeWechat,
        switchWechatTab,
        getCurrentTab,
        isOpen,
        refreshContacts,
        refreshNewFriendsPage,
        addFriendRequest
    };
})();

// ========== 添加好友搜索页模块 ==========
const AddFriendModule = (function() {
    'use strict';

    let external = {
        goToPage: null,
        getSavedPersonas: () => [],
        addPersona: null
    };

    let currentSearchResult = null;

    function init(deps) {
        external = { ...external, ...deps };
        bindEvents();
    }

    function bindEvents() {
        // 返回按钮
        const backBtn = document.getElementById('addFriendBack');
        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                external.goToPage('page9');
            });
        }

        // 搜索输入框
        const searchInput = document.getElementById('addFriendSearchInput');
        const clearBtn = document.getElementById('searchClearBtn');
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const value = e.target.value.trim();
                if (clearBtn) {
                    clearBtn.hidden = !value;
                }
                if (value.length >= 1) {
                    // 实时搜索（防抖）
                    clearTimeout(searchInput.searchTimer);
                    searchInput.searchTimer = setTimeout(() => {
                        performSearch(value);
                    }, 300);
                } else {
                    hideResults();
                }
            });

            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const value = e.target.value.trim();
                    if (value) performSearch(value);
                }
            });
        }

        // 清空按钮
        if (clearBtn) {
            clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (searchInput) {
                    searchInput.value = '';
                    clearBtn.hidden = true;
                    searchInput.focus();
                }
                hideResults();
            });
        }

        // 添加按钮
        const addBtn = document.getElementById('resultAddBtn');
        if (addBtn) {
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (currentSearchResult && !addBtn.disabled) {
                    addFriend(currentSearchResult);
                }
            });
        }
    }

    function performSearch(wxid) {
        const personas = external.getSavedPersonas ? external.getSavedPersonas() : [];
        
        // 精确匹配微信号
        const found = personas.find(p => p.wechat === wxid);
        
        const resultEl = document.getElementById('searchResult');
        const emptyEl = document.getElementById('searchEmpty');
        const addBtn = document.getElementById('resultAddBtn');

        if (found) {
            currentSearchResult = found;
            showResult(found);
            
            // 检查是否已经是好友
            const isAlreadyFriend = personas.some(p => p.wechat === wxid);
            updateAddButtonState(found);
        } else if (wxid.length >= 1) {
            // 未找到但输入了内容，创建一个临时人设用于发送申请
            // 模拟全局用户数据库：任何微信号都可以搜索并发送申请
            const tempPersona = {
                id: 'temp_' + wxid,
                name: '用户' + wxid.slice(-4),
                wechat: wxid,
                avatar: '',
                isTemp: true
            };
            currentSearchResult = tempPersona;
            showResult(tempPersona);
            
            // 检查是否已在通讯录中
            const isFriend = personas.some(p => p.wechat === wxid);
            updateAddButtonState(tempPersona);
        } else {
            currentSearchResult = null;
            showEmpty();
        }
    }

    function showResult(persona) {
        const resultEl = document.getElementById('searchResult');
        const emptyEl = document.getElementById('searchEmpty');
        const avatarEl = document.getElementById('resultAvatar');
        const nameEl = document.getElementById('resultName');
        const wechatEl = document.getElementById('resultWechat');
        const addBtn = document.getElementById('resultAddBtn');

        if (emptyEl) emptyEl.hidden = true;
        if (resultEl) resultEl.hidden = false;

        // 头像
        if (avatarEl) {
            if (persona.avatar) {
                avatarEl.innerHTML = `<img src="${persona.avatar}" alt="">`;
            } else {
                avatarEl.innerHTML = `<svg class="result-avatar-placeholder" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:#FFFFFF;width:100%;height:100%;">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>`;
            }
        }
        if (nameEl) nameEl.textContent = persona.name || '';
        if (wechatEl) wechatEl.textContent = `微信号: ${persona.wechat || ''}`;
    }

    function showEmpty() {
        const resultEl = document.getElementById('searchResult');
        const emptyEl = document.getElementById('searchEmpty');
        if (resultEl) resultEl.hidden = true;
        if (emptyEl) emptyEl.hidden = false;
    }

    function hideResults() {
        const resultEl = document.getElementById('searchResult');
        const emptyEl = document.getElementById('searchEmpty');
        if (resultEl) resultEl.hidden = true;
        if (emptyEl) emptyEl.hidden = true;
        currentSearchResult = null;
    }

    function updateAddButtonState(persona) {
        const addBtn = document.getElementById('resultAddBtn');
        if (!addBtn) return;

        // 检查是否已在通讯录中
        const personas = external.getSavedPersonas ? external.getSavedPersonas() : [];
        const isFriend = personas.some(p => p.wechat === persona.wechat);

        if (isFriend) {
            addBtn.textContent = '已是好友';
            addBtn.disabled = true;
            addBtn.classList.add('added');
        } else {
            addBtn.textContent = '添加';
            addBtn.disabled = false;
            addBtn.classList.remove('added');
        }
    }

    function addFriend(persona) {
        // 发送好友申请，而不是直接添加
        if (window.WeChatModule && typeof WeChatModule.addFriendRequest === 'function') {
            WeChatModule.addFriendRequest(persona);
        }
        
        const addBtn = document.getElementById('resultAddBtn');
        if (addBtn) {
            addBtn.textContent = '已发送';
            addBtn.disabled = true;
            addBtn.classList.add('added');
        }

        // 显示成功提示
        showToast('申请已发送，等待对方通过');
        
        // 延迟返回通讯录页
        setTimeout(() => {
            external.goToPage('page9');
        }, 800);
    }

    function showToast(message) {
        const existingToast = document.querySelector('.add-friend-toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.className = 'add-friend-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(58, 80, 114, 0.9);
            color: #fff;
            padding: 12px 24px;
            border-radius: 12px;
            font-size: 14px;
            z-index: 3000;
            animation: toastIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        `;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastOut 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    return {
        init
    };
})();

// ========== 联系人详情页模块 ==========
const ContactDetailModule = (function() {
    'use strict';

    let external = {
        goToPage: null,
        openChat: null,
        getSavedPersonas: () => []
    };

    let currentPersona = null;

    function init(deps) {
        external = { ...external, ...deps };
        bindEvents();
    }

    function bindEvents() {
        // 返回按钮
        const backBtn = document.getElementById('contactDetailBack');
        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                external.goToPage('page9');
            });
        }

        // 发消息按钮
        const sendBtn = document.getElementById('contactDetailSendBtn');
        if (sendBtn) {
            sendBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (currentPersona && external.openChat) {
                    external.openChat(currentPersona, 'page9');
                }
            });
        }
    }

    function openContactDetail(persona) {
        currentPersona = persona;
        renderPersona(persona);
        external.goToPage('pageContactDetail');
    }

    function renderPersona(persona) {
        // 更新标题
        const titleEl = document.getElementById('contactDetailTitle');
        if (titleEl) titleEl.textContent = persona.name || '名字';

        // 更新头像
        const avatarEl = document.getElementById('contactDetailAvatar');
        if (avatarEl) {
            if (persona.avatar) {
                avatarEl.innerHTML = `<img src="${escapeHtml(persona.avatar)}" alt="${escapeHtml(persona.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:14px;">`;
            } else {
                avatarEl.innerHTML = `<svg class="contact-detail-avatar-placeholder" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:#FFFFFF;width:100%;height:100%;">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>`;
            }
        }

        // 更新名字
        const nameEl = document.getElementById('contactDetailName');
        if (nameEl) nameEl.textContent = persona.name || '名字';

        // 更新微信号
        const wechatEl = document.getElementById('contactDetailWechat');
        if (wechatEl) wechatEl.textContent = `微信号: ${persona.wechat || '未设置'}`;

        // 更新图片展示区（支持动态绑定本地图片路径）
        const galleryEl = document.getElementById('contactDetailGallery');
        if (galleryEl && persona.images && persona.images.length > 0) {
            galleryEl.innerHTML = persona.images.map((imgSrc, index) => `
                <div class="contact-detail-gallery-item" data-index="${index}">
                    <img src="${escapeHtml(imgSrc)}" alt="图片 ${index + 1}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">
                </div>
            `).join('');
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    return {
        init,
        openContactDetail
    };
})();

// ========== 微信聊天列表页模块 ==========
const ChatListModule = (function() {
    'use strict';

    // Mock 数据
    const personas = [
        {
            id: 'persona_1',
            name: '李白',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=libai',
            lastMessage: '长风破浪会有时，直挂云帆济沧海。'
        },
        {
            id: 'persona_2',
            name: '苏轼',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sushi',
            lastMessage: '人生到处知何似，应似飞鸿踏雪泥。这个消息有点长需要截断显示...'
        },
        {
            id: 'persona_3',
            name: '杜甫',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=dufu',
            lastMessage: '会当凌绝顶，一览众山小。'
        }
    ];

    let external = {
        goToPage: null,
        openChat: null,
        openContactDetail: null
    };

    function init(deps) {
        external = { ...external, ...deps };
        renderChatList();
        bindEvents();
    }

    function truncateText(text, maxLength = 20) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    function renderChatList() {
        const contentEl = document.getElementById('chatListContent');
        if (!contentEl) return;

        contentEl.innerHTML = `
            <div class="chat-list" id="chatList">
                ${personas.map(persona => `
                    <div class="chat-list-item" data-id="${persona.id}">
                        <div class="chat-list-avatar">
                            <img src="${persona.avatar}" alt="${persona.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div class="chat-list-avatar-placeholder" style="display:none;">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                            </div>
                        </div>
                        <div class="chat-list-info">
                            <div class="chat-list-name">${persona.name}</div>
                            <div class="chat-list-lastmsg">${truncateText(persona.lastMessage)}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        // 绑定点击事件
        contentEl.querySelectorAll('.chat-list-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const personaId = item.dataset.id;
                const persona = personas.find(p => p.id === personaId);
                if (persona) {
                    console.log('点击聊天列表项:', persona.name);
                    // 实际应用中会跳转到人设名片详情页
                    if (external.openContactDetail) {
                        external.openContactDetail(persona);
                    } else if (external.openChat) {
                        external.openChat(persona, 'pageChatList');
                    }
                }
            });
        });
    }

    function bindEvents() {
        // 底部 Tab 切换
        const tabMap = {
            'chat': null, // 当前页
            'contacts': 'page9',
            'moments': 'page9', // 会在 WeChatModule 中处理
            'me': 'page9'
        };

        document.querySelectorAll('.chat-list-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.stopPropagation();
                const tabName = tab.dataset.tab;
                
                // 更新激活状态
                document.querySelectorAll('.chat-list-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                if (tabName === 'contacts' && external.goToPage) {
                    external.goToPage('page9');
                    // 延迟切换到通讯录标签
                    setTimeout(() => {
                        if (window.WeChatModule && typeof WeChatModule.switchWechatTab === 'function') {
                            WeChatModule.switchWechatTab('contacts');
                        }
                    }, 100);
                } else if (tabName === 'moments' && external.goToPage) {
                    external.goToPage('page9');
                    setTimeout(() => {
                        if (window.WeChatModule && typeof WeChatModule.switchWechatTab === 'function') {
                            WeChatModule.switchWechatTab('moments');
                        }
                    }, 100);
                } else if (tabName === 'me' && external.goToPage) {
                    external.goToPage('page9');
                    setTimeout(() => {
                        if (window.WeChatModule && typeof WeChatModule.switchWechatTab === 'function') {
                            WeChatModule.switchWechatTab('me');
                        }
                    }, 100);
                }
            });
        });
    }

    return {
        init,
        personas // 导出供外部访问
    };
})();

// 支持 CommonJS / ES Module / 全局变量
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WeChatModule, AddFriendModule, ContactDetailModule };
} else if (typeof window !== 'undefined') {
    window.WeChatModule = WeChatModule;
    window.AddFriendModule = AddFriendModule;
    window.ContactDetailModule = ContactDetailModule;
}