(function() {
    'use strict';

    // ========== 配置常量 ==========
    const CORRECT_PASSWORD = '1234';
    const PAGES = ['page1', 'page2', 'page3', 'page4', 'page5', 'page6', 'page7', 'page8', 'page9', 'page10', 'page11', 'page12', 'page13', 'page14', 'page15', 'page16', 'page17', 'page18', 'pageAddFriend', 'pageNewFriends', 'pageContactDetail'];
    const DESKTOP_PAGES = ['page3', 'page4'];

    // ========== 状态管理 ==========
    let currentPageIndex = 0;
    let passwordInput = '';
    let isDragging = false;
    let dragStartX = 0;
    let dragCurrentX = 0;
    let dragStartY = 0;
    let hasMoved = false;
    let isHorizontalDrag = false;
    let isSettingsOpen = false;
    let isApiSettingsOpen = false;
    let isPersonaListOpen = false;
    let isPersonaDetailOpen = false;
    let editingPersonaId = null;
    let personaListSourcePage = 'page3';
    let isMemoryOpen = false;
    let memorySourcePage = 'page3';

    // ========== WeChat 页面状态 ==========
    // WeChat 状态由 WeChatModule 管理

    // ========== 我的人设页面状态 ==========
    let isUserPersonaOpen = false;
    let userPersonaSourcePage = 'page9';

    // ========== 全局用户对象 (user人设 - 我的人设) ==========
    // 模拟全局用户对象，包含头像、姓名、详细人设、微信号
    // 此头像需要与"我的主页"和"聊天界面"完全同步
    window.userProfile = JSON.parse(localStorage.getItem('user_profile')) || {
        avatar: '',           // 头像 - 需与"我的主页"和"聊天界面"完全同步
        name: '微信用户',       // 姓名
        persona: '',          // 详细人设 - 供 AI 读取
        wechat: '',           // 微信号 - 用于区分用户自己和Char人设
        isDefaultPersona: false // 是否设为默认人设
    };

    // ========== Char 人设数据 (AI扮演的人设，主界面的人设) ==========
    // 从 saved_personas 中获取，现在 saved_personas 只存 Char 人设
    function getCharPersonas() {
        return JSON.parse(localStorage.getItem('saved_personas')) || [];
    }

    function addCharPersona(persona) {
        const allPersonas = JSON.parse(localStorage.getItem('saved_personas')) || [];
        const newPersona = {
            ...persona,
            id: persona.id || 'char_' + Date.now(),
            createdAt: Date.now()
        };
        allPersonas.unshift(newPersona);
        localStorage.setItem('saved_personas', JSON.stringify(allPersonas));
        return newPersona;
    }

    function updateCharPersona(personaId, updates) {
        const allPersonas = JSON.parse(localStorage.getItem('saved_personas')) || [];
        const index = allPersonas.findIndex(p => p.id === personaId);
        if (index !== -1) {
            allPersonas[index] = { ...allPersonas[index], ...updates };
            localStorage.setItem('saved_personas', JSON.stringify(allPersonas));
            return allPersonas[index];
        }
        return null;
    }

    function deleteCharPersona(personaId) {
        let allPersonas = JSON.parse(localStorage.getItem('saved_personas')) || [];
        allPersonas = allPersonas.filter(p => p.id !== personaId);
        localStorage.setItem('saved_personas', JSON.stringify(allPersonas));

        // 删除相关聊天记录、设置、记忆
        localStorage.removeItem(`chat_history_${personaId}`);
        localStorage.removeItem(`chat_settings_${personaId}`);
        localStorage.removeItem(`chat_memory_${personaId}`);
        localStorage.removeItem(`chat_summary_${personaId}`);
    }

    // ========== 头像同步工具函数 ==========
    /**
     * 同步用户头像到所有相关界面
     * - window.userProfile.avatar (全局用户头像)
     * - 触发 ChatModule 重新渲染以更新聊天界面的用户头像
     * - 刷新 WeChat "我" 页面
     * 注意：不再同步到 saved_personas，因为 saved_personas 现在只存 Char 人设
     */
    function syncUserAvatar(newAvatar) {
        // 1. 更新全局 userProfile
        window.userProfile.avatar = newAvatar;
        localStorage.setItem('user_profile', JSON.stringify(window.userProfile));

        // 2. 如果 WeChat "我" 页面正在显示，刷新它
        if (window.WeChatModule && typeof WeChatModule.getCurrentTab === 'function') {
            const currentTab = WeChatModule.getCurrentTab();
            if (currentTab === 'me') {
                WeChatModule.switchWechatTab('me');
            }
        }

        // 3. 如果聊天页面正在显示，重新渲染消息以更新用户头像
        if (window.ChatModule && typeof ChatModule.renderMessages === 'function') {
            ChatModule.renderMessages();
        }

        console.log('[Avatar Sync] 用户头像已同步:', newAvatar);
    }

    /**
     * 同步角色头像到所有相关界面
     * - savedPersonas 中对应人设的头像
     * - 通讯录列表/详情页
     * - 如果正在与该角色聊天，更新聊天界面的角色头像
     */
    function syncCharAvatar(personaId, newAvatar) {
        // 1. 更新 savedPersonas 中对应的人设
        const index = savedPersonas.findIndex(p => p.id === personaId);
        if (index !== -1) {
            savedPersonas[index].avatar = newAvatar;
            localStorage.setItem('saved_personas', JSON.stringify(savedPersonas));
        }

        // 2. 如果正在与该角色聊天，更新 currentChatPersona 并重新渲染
        if (window.ChatModule && typeof ChatModule.getCurrentPersona === 'function') {
            const currentPersona = ChatModule.getCurrentPersona();
            if (currentPersona && currentPersona.id === personaId) {
                currentPersona.avatar = newAvatar;
                ChatModule.renderMessages();
            }
        }

        // 3. 刷新通讯录列表
        if (window.WeChatModule && typeof WeChatModule.refreshContacts === 'function') {
            WeChatModule.refreshContacts();
        }

        console.log('[Avatar Sync] 角色头像已同步:', personaId, newAvatar);
    }

    // ========== 预存 API 配置状态 ==========
    let savedPresets = JSON.parse(localStorage.getItem('saved_api_configs')) || [];

    // ========== 人设数据状态 ==========
    let savedPersonas = JSON.parse(localStorage.getItem('saved_personas')) || [];

    // ========== 聊天设置状态 ==========
    let isChatSettingsOpen = false;
    let chatSettingsSourcePage = 'page5';
    let isSearchHistoryOpen = false;
    let searchHistorySourcePage = 'page11';

    // ========== DOM 元素缓存 ==========
    const elements = {
        phoneContainer: null,
        pages: {},
        dateInfo: null,
        timeInfo: null,
        passwordIndicators: null,
        passwordKeypad: null,
        desktopScreens: {},
        pageIndicators: {},
        fileInputs: {},
        settingsBack: null,
        dockWidgets: {},
        apiSettingsBack: null,
        apiUrlInput: null,
        apiKeyInput: null,
        apiKeyToggle: null,
        apiModelInput: null,
        fetchModelsBtn: null,
        tempSlider: null,
        tempValue: null,
        presetSelect: null,
        savePresetBtn: null,
        deletePresetBtn: null,
        personaBack: null,
        personaAddBtn: null,
        personaEmpty: null,
        personaList: null,
        personaDetailBack: null,
        personaDetailSave: null,
        personaAvatarInput: null,
        personaAvatarPreview: null,
        personaNameInput: null,
        personaWechatInput: null,
        personaDescInput: null,
        worldbookPlaceholder: null,
        personaForm: null,
        personaDeleteBtn: null,
        personaDeleteModal: null,
        personaDeleteBackdrop: null,
        personaDeleteWithMemoryBtn: null,
        personaDeleteKeepMemoryBtn: null,
        personaDeleteCancelBtn: null,
        personaDeleteMessage: null,
        personaDeleteWarning: null,
        chatSettingsBack: null,
        chatSettingsSave: null,
        chatRemarkInput: null,
        chatBgSelectBtn: null,
        chatBgFileInput: null,
        innerThoughtInput: null,
        contextDecrease: null,
        contextCountInput: null,
        contextIncrease: null,
        autoSummaryInput: null,
        memoryRefInput: null,
        openSearchHistoryBtn: null,
        searchHistoryBack: null,
        searchHistoryInput: null,
        // WeChat 页面元素 (由 WeChatModule 管理)
    };

    // ========== 初始化 ==========
    function init() {
        cacheElements();
        WeChatModule.init({
            PAGES,
            currentPageIndex: () => currentPageIndex,
            goToPage,
            elements,
            isSettingsOpen: () => isSettingsOpen,
            setIsSettingsOpen: (val) => { isSettingsOpen = val; },
            openChat: (persona, sourcePage) => ChatModule.openChat(persona, sourcePage),
            getSavedPersonas: () => savedPersonas,
            getCharPersonas: () => getCharPersonas(),
            addCharPersona: (persona) => addCharPersona(persona),
            updateCharPersona: (personaId, updates) => updateCharPersona(personaId, updates),
            deleteCharPersona: (personaId) => deleteCharPersona(personaId),
            syncCharAvatar: (personaId, avatar) => syncCharAvatar(personaId, avatar),
            addPersona: (persona) => {
                const exists = savedPersonas.some(p => p.wechat === persona.wechat);
                if (!exists) {
                    savedPersonas.unshift({
                        ...persona,
                        id: persona.id || 'persona_' + Date.now(),
                        createdAt: Date.now()
                    });
                    localStorage.setItem('saved_personas', JSON.stringify(savedPersonas));
                }
            },
            addFriendRequest: (persona) => {
                if (window.WeChatModule && typeof WeChatModule.addFriendRequest === 'function') {
                    WeChatModule.addFriendRequest(persona);
                }
            },
            updatePersona: (personaId, updates) => {
                const index = savedPersonas.findIndex(p => p.id === personaId);
                if (index !== -1) {
                    savedPersonas[index] = { ...savedPersonas[index], ...updates };
                    localStorage.setItem('saved_personas', JSON.stringify(savedPersonas));
                    // 刷新通讯录和聊天列表
                    if (window.WeChatModule && typeof WeChatModule.refreshContacts === 'function') {
                        WeChatModule.refreshContacts();
                    }
                    // 刷新当前显示的页面（如果是我的页面）
                    const currentTab = WeChatModule.getCurrentTab?.();
                    if (currentTab === 'me') {
                        WeChatModule.switchWechatTab('me');
                    }
                }
            }
        });
        AddFriendModule.init({
            goToPage,
            getSavedPersonas: () => savedPersonas,
            addPersona: (persona) => {
                const exists = savedPersonas.some(p => p.wechat === persona.wechat);
                if (!exists) {
                    savedPersonas.unshift({
                        ...persona,
                        id: persona.id || 'persona_' + Date.now(),
                        createdAt: Date.now()
                    });
                    localStorage.setItem('saved_personas', JSON.stringify(savedPersonas));
                }
            }
        });
        ContactDetailModule.init({
            goToPage,
            openChat: (persona, sourcePage) => ChatModule.openChat(persona, sourcePage),
            getSavedPersonas: () => savedPersonas
        });
        ChatModule.init({
            PAGES,
            goToPage,
            elements
        });
        MemoryModule.init({
            PAGES,
            goToPage,
            elements,
            getCurrentPersona: () => ChatModule.getCurrentPersona?.()
        });
        UserPersonaModule.init({
            PAGES,
            goToPage,
            getSavedPersonas: () => savedPersonas,
            getUserProfile: () => window.userProfile
        });
        RensheModule.init({
            PAGES,
            goToPage,
            getSavedPersonas: () => savedPersonas,
            getCharPersonas: () => getCharPersonas(),
            addCharPersona: (persona) => addCharPersona(persona),
            updateCharPersona: (personaId, updates) => updateCharPersona(personaId, updates),
            deleteCharPersona: (personaId) => deleteCharPersona(personaId),
            syncCharAvatar: (personaId, avatar) => syncCharAvatar(personaId, avatar)
        });
        bindEvents();
        startClock();
        showPage(0);

        setTimeout(function() {
            const page1 = document.getElementById('page1');
            if (page1) {
                if (!page1.classList.contains('active')) {
                    page1.classList.add('active');
                }
                page1.style.opacity = '1';
                page1.style.visibility = 'visible';
                page1.style.transform = 'translateX(0)';
                page1.style.zIndex = '10';
                page1.style.pointerEvents = 'auto';
            }
            console.log('[Init] 锁屏页面状态已加固');
        }, 200);
    }

    function cacheElements() {
        elements.phoneContainer = document.getElementById('phoneContainer');
        elements.dateInfo = document.getElementById('dateInfo');
        elements.timeInfo = document.getElementById('timeInfo');
        elements.passwordIndicators = document.getElementById('passwordIndicators');
        elements.passwordKeypad = document.getElementById('passwordKeypad');
        elements.settingsBack = document.getElementById('settingsBack');
        elements.apiSettingsBack = document.getElementById('apiSettingsBack');
        elements.apiSettingsSave = document.getElementById('apiSettingsSave');
        elements.apiUrlInput = document.getElementById('apiUrlInput');
        elements.apiKeyInput = document.getElementById('apiKeyInput');
        elements.apiKeyToggle = document.getElementById('apiKeyToggle');
        elements.apiModelSelect = document.getElementById('apiModelSelect');
        elements.apiPresetNameInput = document.getElementById('apiPresetNameInput');
        elements.fetchModelsBtn = document.getElementById('fetchModelsBtn');
        elements.tempSlider = document.getElementById('tempSlider');
        elements.tempValue = document.getElementById('tempValue');
        elements.presetSelect = document.getElementById('presetSelect');
        elements.savePresetBtn = document.getElementById('savePresetBtn');
        elements.deletePresetBtn = document.getElementById('deletePresetBtn');

        elements.personaDeleteModal = document.getElementById('personaDeleteModal');
        elements.personaDeleteBackdrop = document.getElementById('personaDeleteBackdrop');
        elements.personaDeleteWithMemoryBtn = document.getElementById('personaDeleteWithMemoryBtn');
        elements.personaDeleteKeepMemoryBtn = document.getElementById('personaDeleteKeepMemoryBtn');
        elements.personaDeleteCancelBtn = document.getElementById('personaDeleteCancelBtn');
        elements.personaDeleteMessage = document.getElementById('personaDeleteMessage');
        elements.personaDeleteWarning = document.getElementById('personaDeleteWarning');

        elements.chatSettingsBack = document.getElementById('chatSettingsBack');
        elements.chatSettingsSave = document.getElementById('chatSettingsSave');
        elements.chatRemarkInput = document.getElementById('chatRemarkInput');
        elements.chatBgSelectBtn = document.getElementById('chatBgSelectBtn');
        elements.chatBgFileInput = document.getElementById('chatBgFileInput');
        elements.innerThoughtInput = document.getElementById('innerThoughtInput');
        elements.contextDecrease = document.getElementById('contextDecrease');
        elements.contextCountInput = document.getElementById('contextCountInput');
        elements.contextIncrease = document.getElementById('contextIncrease');
        elements.autoSummaryInput = document.getElementById('autoSummaryInput');
        elements.memoryRefInput = document.getElementById('memoryRefInput');
        elements.openSearchHistoryBtn = document.getElementById('openSearchHistoryBtn');
        elements.timeAwareInput = document.getElementById('timeAwareInput');
        elements.fontColorInput = document.getElementById('fontColorInput');
        elements.fontOpacitySlider = document.getElementById('fontOpacitySlider');
        elements.fontOpacityValue = document.getElementById('fontOpacityValue');
        elements.charBubbleColorInput = document.getElementById('charBubbleColorInput');
        elements.charBubbleOpacitySlider = document.getElementById('charBubbleOpacitySlider');
        elements.charBubbleOpacityValue = document.getElementById('charBubbleOpacityValue');
        elements.userBubbleColorInput = document.getElementById('userBubbleColorInput');
        elements.userBubbleOpacitySlider = document.getElementById('userBubbleOpacitySlider');
        elements.userBubbleOpacityValue = document.getElementById('userBubbleOpacityValue');
        elements.deleteChatHistoryBtn = document.getElementById('deleteChatHistoryBtn');

        elements.searchHistoryBack = document.getElementById('searchHistoryBack');
        elements.searchHistoryInput = document.getElementById('searchHistoryInput');

        PAGES.forEach(id => {
            elements.pages[id] = document.getElementById(id);
        });

        elements.desktopScreens.page3 = document.getElementById('desktop1');
        elements.desktopScreens.page4 = document.getElementById('desktop2');

        document.querySelectorAll('.page-indicator').forEach((el, i) => {
            elements.pageIndicators[DESKTOP_PAGES[i]] = el;
        });

        document.querySelectorAll('.widget-image .file-input').forEach(input => {
            const widget = input.closest('.widget-image');
            const key = widget.dataset.widget;
            elements.fileInputs[key] = input;
        });

        document.querySelectorAll('.widget-dock').forEach((dock, index) => {
            const dockIndex = parseInt(dock.dataset.dockIndex, 10);
            elements.dockWidgets[dockIndex] = dock;
        });
    }

    // ========== 页面切换 ==========
    function showPage(index, direction = 'none') {
        if (index < 0 || index >= PAGES.length) return;

        const prevPageId = PAGES[currentPageIndex];
        const nextPageId = PAGES[index];
        const prevPage = elements.pages[prevPageId];
        const nextPage = elements.pages[nextPageId];

        if (prevPage) {
            prevPage.classList.remove('active');
            if (direction === 'left') {
                prevPage.classList.add('slide-left-exit');
            } else if (direction === 'right') {
                prevPage.classList.add('slide-right-exit');
            } else {
                prevPage.classList.add('prev');
            }
        }

        nextPage.classList.remove('prev', 'next', 'slide-left-exit', 'slide-right-exit', 'slide-left-enter', 'slide-right-enter');
        
        if (direction === 'left') {
            nextPage.classList.add('slide-left-enter');
        } else if (direction === 'right') {
            nextPage.classList.add('slide-right-enter');
        }

        nextPage.classList.add('active');

        setTimeout(() => {
            if (prevPage) {
                prevPage.classList.remove('slide-left-exit', 'slide-right-exit', 'prev');
            }
            nextPage.classList.remove('slide-left-enter', 'slide-right-enter');
            
            if (nextPageId === 'pageNewFriends' && window.WeChatModule && typeof WeChatModule.refreshNewFriendsPage === 'function') {
                WeChatModule.refreshNewFriendsPage();
            }
        }, 500);

        currentPageIndex = index;
        updatePageIndicators();
    }

    function goToPage(pageId) {
        const index = PAGES.indexOf(pageId);
        if (index !== -1) {
            const direction = index > currentPageIndex ? 'left' : 'right';
            showPage(index, direction);
        }
    }

    function nextPage() {
        if (currentPageIndex < PAGES.length - 1) {
            showPage(currentPageIndex + 1, 'left');
        }
    }

    function prevPage() {
        if (currentPageIndex > 0) {
            showPage(currentPageIndex - 1, 'right');
        }
    }

    function updatePageIndicators() {
        DESKTOP_PAGES.forEach((pageId, i) => {
            const indicator = elements.pageIndicators[pageId];
            if (indicator) {
                indicator.querySelectorAll('.dot').forEach((dot, j) => {
                    dot.classList.toggle('active', j === i && (pageId === PAGES[currentPageIndex]));
                });
            }
        });
    }

    // ========== 时钟 ==========
    function startClock() {
        updateClock();
        setInterval(updateClock, 1000);
    }

    function updateClock() {
        const now = new Date();
        const month = now.getMonth() + 1;
        const day = now.getDate();
        const weekdays = ['星期天', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        const weekday = weekdays[now.getDay()];
        elements.dateInfo.textContent = `${month}月${day}日 ${weekday}`;
        const hours = now.getHours();
        const minutes = now.getMinutes().toString().padStart(2, '0');
        elements.timeInfo.textContent = `${hours}:${minutes}`;
    }

    // ========== 密码输入逻辑 ==========
    function handleKeypadClick(value) {
        if (value === 'cancel') {
            clearPassword();
            return;
        }
        if (value === 'backspace') {
            deletePassword();
            return;
        }
        if (passwordInput.length < 4) {
            passwordInput += value;
            updatePasswordIndicators();
            if (passwordInput.length === 4) {
                setTimeout(checkPassword, 150);
            }
        }
    }

    function updatePasswordIndicators() {
        const indicators = elements.passwordIndicators.querySelectorAll('.indicator');
        indicators.forEach((indicator, i) => {
            indicator.classList.remove('filled', 'active-input');
            if (i < passwordInput.length) {
                indicator.classList.add('filled');
            }
            if (i === passwordInput.length) {
                indicator.classList.add('active-input');
            }
        });
    }

    function clearPassword() {
        passwordInput = '';
        updatePasswordIndicators();
    }

    function deletePassword() {
        if (passwordInput.length > 0) {
            passwordInput = passwordInput.slice(0, -1);
            updatePasswordIndicators();
        }
    }

    function checkPassword() {
        if (passwordInput === CORRECT_PASSWORD) {
            passwordInput = '';
            updatePasswordIndicators();
            goToPage('page3');
        } else {
            shakePasswordIndicators();
            setTimeout(clearPassword, 500);
        }
    }

    function shakePasswordIndicators() {
        const container = elements.passwordIndicators;
        container.style.animation = 'shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97)';
        setTimeout(() => {
            container.style.animation = '';
        }, 400);
    }

    // ========== 图片上传 ==========
    function setupImageUpload() {
        Object.entries(elements.fileInputs).forEach(([key, input]) => {
            const widget = input.closest('.widget-image');
            widget.addEventListener('click', (e) => {
                if (e.target === widget || e.target.classList.contains('widget-placeholder') || 
                    e.target.classList.contains('widget-image-preview')) {
                    input.click();
                }
            });
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file && file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const img = widget.querySelector('.widget-image-preview');
                        img.src = event.target.result;
                        widget.classList.add('has-image');
                    };
                    reader.readAsDataURL(file);
                }
            });
        });
    }

    // ========== 设置页面逻辑 ==========
    function openSettings() {
        if (isSettingsOpen) return;
        isSettingsOpen = true;
        goToPage('page5');
    }

    function closeSettings() {
        if (!isSettingsOpen) return;
        isSettingsOpen = false;
        goToPage('page3');
    }

    // ========== 触摸/鼠标滑动手势 (仅桌面页) ==========
    const DESKTOP_SCREEN_MAP = {
        'desktop1': 'page3',
        'desktop2': 'page4'
    };

    function bindTouchEvents() {
        DESKTOP_PAGES.forEach(pageId => {
            const screen = elements.desktopScreens[pageId];
            if (!screen) return;
            screen.addEventListener('touchstart', handleTouchStart, { passive: true });
            screen.addEventListener('touchmove', handleTouchMove, { passive: false });
            screen.addEventListener('touchend', handleTouchEnd, { passive: true });
            screen.addEventListener('mousedown', handleMouseDown);
        });
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }

    function handleMouseMove(e) {
        if (!isDragging) return;
        moveDrag(e.clientX, e.clientY, e);
    }

    function handleMouseUp() {
        const screen = elements.desktopScreens[PAGES[currentPageIndex]];
        if (screen) endDrag(screen);
    }

    function getPageIdFromScreen(screen) {
        return DESKTOP_SCREEN_MAP[screen.id] || '';
    }

    function handleTouchStart(e) {
        const screen = e.currentTarget;
        if (PAGES[currentPageIndex] !== getPageIdFromScreen(screen)) return;
        if (e.target.closest('.widget-dock, .widget-small, .widget-wide, .widget-tall, .widget-half')) return;
        const touch = e.touches[0];
        startDrag(touch.clientX, touch.clientY, screen);
    }

    function handleTouchMove(e) {
        if (!isDragging) return;
        const touch = e.touches[0];
        moveDrag(touch.clientX, touch.clientY, e);
    }

    function handleTouchEnd(e) {
        if (!isDragging) return;
        endDrag(e.currentTarget);
    }

    function handleMouseDown(e) {
        if (e.button !== 0) return;
        if (e.target.closest('.widget-dock, .widget-small, .widget-wide, .widget-tall, .widget-half')) return;
        const screen = e.currentTarget;
        if (PAGES[currentPageIndex] !== getPageIdFromScreen(screen)) return;
        startDrag(e.clientX, e.clientY, screen);
    }

    function startDrag(clientX, clientY, target) {
        isDragging = true;
        hasMoved = false;
        isHorizontalDrag = false;
        dragStartX = clientX;
        dragStartY = clientY;
        dragCurrentX = clientX;
        target.style.transition = 'none';
    }

    function moveDrag(clientX, clientY, e) {
        if (!isDragging) return;
        const deltaX = clientX - dragStartX;
        const deltaY = clientY - dragStartY;
        if (!hasMoved && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
            hasMoved = true;
            isHorizontalDrag = Math.abs(deltaX) > Math.abs(deltaY);
        }
        if (hasMoved && isHorizontalDrag) {
            if (e.preventDefault) e.preventDefault();
            const screen = elements.desktopScreens[PAGES[currentPageIndex]];
            if (!screen) return;
            const maxDrag = screen.offsetWidth * 0.3;
            const drag = Math.max(-maxDrag, Math.min(maxDrag, deltaX));
            screen.style.transform = `translateX(${drag}px)`;
            dragCurrentX = clientX;
        }
    }

    function endDrag(target) {
        if (!isDragging || !hasMoved || !isHorizontalDrag) {
            resetCurrentScreen();
            isDragging = false;
            return;
        }
        const deltaX = dragCurrentX - dragStartX;
        const screen = elements.desktopScreens[PAGES[currentPageIndex]];
        if (!screen) {
            isDragging = false;
            return;
        }
        const threshold = screen.offsetWidth * 0.25;
        screen.style.transition = 'transform var(--transition-slow)';
        if (deltaX > threshold && PAGES[currentPageIndex] === 'page4') {
            screen.style.transform = `translateX(${screen.offsetWidth}px)`;
            setTimeout(() => prevPage(), 350);
        } else if (deltaX < -threshold && PAGES[currentPageIndex] === 'page3') {
            screen.style.transform = `translateX(-${screen.offsetWidth}px)`;
            setTimeout(() => nextPage(), 350);
        } else {
            resetCurrentScreen();
        }
        isDragging = false;
    }

    function resetCurrentScreen() {
        const screen = elements.desktopScreens[PAGES[currentPageIndex]];
        if (screen) {
            screen.style.transition = 'transform var(--transition-normal)';
            screen.style.transform = 'translateX(0)';
        }
    }

    // ========== 事件绑定 ==========
    function bindEvents() {
        const lockPage = document.getElementById('page1');
        if (lockPage) {
            const goToPassword = function(e) {
                e.preventDefault();
                e.stopPropagation();
                requestAnimationFrame(function() {
                    goToPage('page2');
                });
            };
            lockPage.removeEventListener('click', goToPassword);
            lockPage.addEventListener('click', goToPassword);
        }

        document.addEventListener('click', function(e) {
            if (PAGES[currentPageIndex] === 'page1') {
                const lockPageEl = document.getElementById('page1');
                if (lockPageEl && lockPageEl.contains(e.target)) {
                    e.preventDefault();
                    e.stopPropagation();
                    goToPage('page2');
                }
            }
        }, true);

        elements.passwordKeypad.addEventListener('click', (e) => {
            const key = e.target.closest('.key');
            if (key && key.dataset.value) {
                handleKeypadClick(key.dataset.value);
            }
        });

        document.querySelectorAll('.page-indicator .dot').forEach(dot => {
            dot.addEventListener('click', () => {
                const pageIndex = parseInt(dot.dataset.page, 10);
                const targetPage = DESKTOP_PAGES[pageIndex];
                if (targetPage) {
                    const currentDesktopIndex = DESKTOP_PAGES.indexOf(PAGES[currentPageIndex]);
                    const direction = pageIndex > currentDesktopIndex ? 'left' : 'right';
                    goToPage(targetPage);
                }
            });
        });

        setupImageUpload();
        bindTouchEvents();

        if (elements.settingsBack) {
            elements.settingsBack.addEventListener('click', (e) => {
                e.stopPropagation();
                closeSettings();
            });
        }

        Object.entries(elements.dockWidgets).forEach(([dockIndex, dock]) => {
            dock.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(dockIndex, 10);
                if (PAGES[currentPageIndex] === 'page3') {
                    if (index === 0) {
                        openSettings();
                    } else if (index === 1) {
                        if (window.RensheModule && typeof RensheModule.openRenshe === 'function') {
                            RensheModule.openRenshe('page3');
                        }
                    } else if (index === 3) {
                        WeChatModule.openWechat('page3');
                    }
                }
            });
        });

        document.querySelectorAll('.widget-small').forEach((widget, index) => {
            widget.addEventListener('click', (e) => {
                e.stopPropagation();
                if (index === 4 && PAGES[currentPageIndex] === 'page3') {
                    MemoryModule.openMemory('page3');
                }
            });
        });

        document.querySelectorAll('.settings-card[data-setting]').forEach(card => {
            card.addEventListener('click', (e) => {
                e.stopPropagation();
                const setting = card.dataset.setting;
                if (setting === 'api') {
                    openApiSettings();
                } else if (setting === 'backup') {
                    openBackupSettings();
                }
            });
        });

        document.addEventListener('keydown', (e) => {
            if (PAGES[currentPageIndex] !== 'page2') return;
            if (e.key >= '0' && e.key <= '9') {
                handleKeypadClick(e.key);
            } else if (e.key === 'Backspace') {
                deletePassword();
            } else if (e.key === 'Escape') {
                clearPassword();
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) updateClock();
        });

        bindApiSettingsEvents();
        bindBackupSettingsEvents();
        bindChatSettingsEvents();
        bindSearchHistoryEvents();
    }

    // ========== 启动 ==========
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ========== API 设置页面功能函数 ==========
    function openApiSettings() {
        if (isApiSettingsOpen) return;
        isApiSettingsOpen = true;
        isSettingsOpen = false;
        goToPage('page6');
        loadSavedApiData();
        renderPresetDropdown();
    }

    function closeApiSettings() {
        if (!isApiSettingsOpen) return;
        isApiSettingsOpen = false;
        isSettingsOpen = true;
        goToPage('page5');
    }

    function bindApiSettingsEvents() {
        if (elements.apiSettingsBack) {
            elements.apiSettingsBack.addEventListener('click', (e) => {
                e.stopPropagation();
                closeApiSettings();
            });
        }
        if (elements.apiSettingsSave) {
            elements.apiSettingsSave.addEventListener('click', (e) => {
                e.stopPropagation();
                saveApiConfigForChat();
            });
        }
        if (elements.apiKeyToggle && elements.apiKeyInput) {
            elements.apiKeyToggle.addEventListener('click', () => {
                const isPassword = elements.apiKeyInput.type === 'password';
                elements.apiKeyInput.type = isPassword ? 'text' : 'password';
                const openIcon = elements.apiKeyToggle.querySelector('.icon-eye-open');
                const closedIcon = elements.apiKeyToggle.querySelector('.icon-eye-closed');
                if (openIcon && closedIcon) {
                    openIcon.style.display = isPassword ? 'none' : 'block';
                    closedIcon.style.display = isPassword ? 'block' : 'none';
                }
            });
        }
        if (elements.tempSlider && elements.tempValue) {
            elements.tempSlider.addEventListener('input', (e) => {
                elements.tempValue.textContent = parseFloat(e.target.value).toFixed(1);
            });
        }
        if (elements.fetchModelsBtn) {
            elements.fetchModelsBtn.addEventListener('click', fetchModels);
        }
        if (elements.savePresetBtn) {
            elements.savePresetBtn.addEventListener('click', savePresetConfig);
        }
        if (elements.deletePresetBtn) {
            elements.deletePresetBtn.addEventListener('click', deletePresetConfig);
        }
        if (elements.presetSelect) {
            elements.presetSelect.addEventListener('change', onPresetSelected);
        }
        if (elements.apiModelSelect) {
            elements.apiModelSelect.addEventListener('change', (e) => {
                const selectedModel = e.target.value;
                const lastConfig = JSON.parse(localStorage.getItem('last_api_config') || 'null') || {};
                lastConfig.model = selectedModel;
                localStorage.setItem('last_api_config', JSON.stringify(lastConfig));
            });
        }
    }

    function fetchModels() {
        const url = elements.apiUrlInput?.value?.trim();
        const key = elements.apiKeyInput?.value?.trim();
        if (!url || !key) {
            alert('请先填写 API 网址和密钥');
            return;
        }
        const btn = elements.fetchModelsBtn;
        const originalText = btn.textContent;
        btn.textContent = '拉取中...';
        btn.disabled = true;
        let baseUrl = url.replace(/\/+$/, '');
        if (baseUrl.endsWith('/v1/chat/completions')) {
            baseUrl = baseUrl.replace('/v1/chat/completions', '');
        }
        if (!baseUrl.endsWith('/v1')) {
            baseUrl += '/v1';
        }
        const modelsUrl = baseUrl + '/models';
        fetch(modelsUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.data && Array.isArray(data.data) && data.data.length > 0) {
                elements.apiModelSelect.innerHTML = '<option value="">请选择模型</option>';
                data.data.forEach(model => {
                    if (model.id) {
                        const option = document.createElement('option');
                        option.value = model.id;
                        option.textContent = model.id;
                        elements.apiModelSelect.appendChild(option);
                    }
                });
            } else {
                throw new Error('未获取到模型列表');
            }
        })
        .catch(err => {
            console.error('拉取模型失败:', err);
            alert('拉取模型失败: ' + err.message);
        })
        .finally(() => {
            btn.textContent = originalText;
            btn.disabled = false;
        });
    }

    function loadSavedApiData() {
        const lastConfig = JSON.parse(localStorage.getItem('last_api_config') || 'null');
        if (lastConfig) {
            elements.apiUrlInput.value = lastConfig.url || '';
            elements.apiKeyInput.value = lastConfig.key || '';
            const savedModel = lastConfig.model || '';
            if (savedModel) {
                let modelExists = false;
                for (let i = 0; i < elements.apiModelSelect.options.length; i++) {
                    if (elements.apiModelSelect.options[i].value === savedModel) {
                        modelExists = true;
                        break;
                    }
                }
                if (!modelExists) {
                    const option = document.createElement('option');
                    option.value = savedModel;
                    option.textContent = savedModel;
                    elements.apiModelSelect.appendChild(option);
                }
                elements.apiModelSelect.value = savedModel;
            }
            elements.apiModelSelect.style.color = savedModel ? '#3A5072' : '#8A9BB8';
            elements.apiPresetNameInput.value = lastConfig.presetName || '';
            const temp = lastConfig.temp !== undefined ? lastConfig.temp : 0.7;
            elements.tempSlider.value = temp;
            elements.tempValue.textContent = temp.toFixed(1);
        }
    }

    function saveLastApiConfig() {
        const config = {
            url: elements.apiUrlInput.value.trim(),
            key: elements.apiKeyInput.value.trim(),
            model: elements.apiModelSelect.value.trim(),
            presetName: elements.apiPresetNameInput.value.trim(),
            temp: parseFloat(elements.tempSlider.value)
        };
        localStorage.setItem('last_api_config', JSON.stringify(config));
    }

    function saveApiConfigForChat() {
        const url = elements.apiUrlInput.value.trim();
        const key = elements.apiKeyInput.value.trim();
        if (!url || !key) {
            alert('请先填写 API 网址和密钥');
            return;
        }
        saveLastApiConfig();
        const btn = elements.apiSettingsSave;
        const originalIcon = btn.querySelector('.api-settings-save-icon');
        if (originalIcon) {
            originalIcon.textContent = '✅';
            setTimeout(() => {
                originalIcon.textContent = '✨';
            }, 1000);
        }
    }

    function renderPresetDropdown() {
        if (!elements.presetSelect) return;
        const currentValue = elements.presetSelect.value;
        elements.presetSelect.innerHTML = '<option value="">请选择预设...</option>';
        savedPresets.forEach(preset => {
            const option = document.createElement('option');
            option.value = preset.id;
            option.textContent = preset.name;
            elements.presetSelect.appendChild(option);
        });
        if (currentValue && savedPresets.some(p => p.id === currentValue)) {
            elements.presetSelect.value = currentValue;
        }
    }

    function onPresetSelected() {
        const presetId = elements.presetSelect.value;
        if (!presetId) return;
        const preset = savedPresets.find(p => p.id === presetId);
        if (!preset) return;
        elements.apiUrlInput.value = preset.url || '';
        elements.apiKeyInput.value = preset.key || '';
        elements.apiModelSelect.value = preset.model || '';
        elements.apiModelSelect.style.color = preset.model ? '#3A5072' : '#8A9BB8';
        elements.apiPresetNameInput.value = preset.name || '';
        elements.tempSlider.value = preset.temp !== undefined ? preset.temp : 0.7;
        elements.tempValue.textContent = (preset.temp !== undefined ? preset.temp : 0.7).toFixed(1);
        saveLastApiConfig();
    }

    function savePresetConfig() {
        const url = elements.apiUrlInput.value.trim();
        const key = elements.apiKeyInput.value.trim();
        const model = elements.apiModelSelect.value.trim();
        const temp = parseFloat(elements.tempSlider.value);
        if (!url || !key) {
            alert('请先填写 API 网址和密钥');
            return;
        }
        const name = elements.apiPresetNameInput.value.trim() || `预设 ${savedPresets.length + 1}`;
        const newPreset = {
            id: 'preset_' + Date.now(),
            name: name,
            url,
            key,
            model,
            temp
        };
        savedPresets.push(newPreset);
        localStorage.setItem('saved_api_configs', JSON.stringify(savedPresets));
        renderPresetDropdown();
        elements.presetSelect.value = newPreset.id;
        elements.apiPresetNameInput.value = '';
        saveLastApiConfig();
    }

    function deletePresetConfig() {
        const presetId = elements.presetSelect.value;
        if (!presetId) {
            alert('请先选择要删除的预设');
            return;
        }
        const preset = savedPresets.find(p => p.id === presetId);
        if (!preset) return;
        if (!confirm(`确定要删除预设"${preset.name}"吗？`)) return;
        savedPresets = savedPresets.filter(p => p.id !== presetId);
        localStorage.setItem('saved_api_configs', JSON.stringify(savedPresets));
        renderPresetDropdown();
        elements.apiUrlInput.value = '';
        elements.apiKeyInput.value = '';
        elements.apiModelSelect.value = '';
        elements.apiModelSelect.style.color = '#8A9BB8';
        elements.tempSlider.value = 0.7;
        elements.tempValue.textContent = '0.7';
        saveLastApiConfig();
    }

    // ========== 人设页面功能函数 ==========
    function openPersonaList(sourcePage = 'page3') {
        if (isPersonaListOpen) return;
        isPersonaListOpen = true;
        personaListSourcePage = sourcePage;
        if (sourcePage === 'page5') {
            isSettingsOpen = false;
        }
        goToPage('page7');
        renderPersonaList();
    }

    function closePersonaList() {
        if (!isPersonaListOpen) return;
        isPersonaListOpen = false;
        goToPage(personaListSourcePage);
    }

    function openPersonaDetail(personaId = null) {
        if (isPersonaDetailOpen) return;
        isPersonaDetailOpen = true;
        editingPersonaId = personaId;
        goToPage('page8');
        resetPersonaForm();
        if (personaId) {
            loadPersonaData(personaId);
            const freshDeleteBtn = document.getElementById('personaDeleteBtn');
            if (freshDeleteBtn) {
                freshDeleteBtn.style.display = 'flex';
            }
        } else {
            const freshDeleteBtn = document.getElementById('personaDeleteBtn');
            if (freshDeleteBtn) {
                freshDeleteBtn.style.display = 'none';
            }
        }
    }

    function closePersonaDetail() {
        if (!isPersonaDetailOpen) return;
        isPersonaDetailOpen = false;
        editingPersonaId = null;
        closePersonaDeleteModal();
        goToPage('page7');
    }

    function bindPersonaListEvents() {
        if (elements.personaBack) {
            elements.personaBack.addEventListener('click', (e) => {
                e.stopPropagation();
                closePersonaList();
            });
        }
        if (elements.personaAddBtn) {
            elements.personaAddBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openPersonaDetail(null);
            });
        }
    }

    function bindPersonaDetailEvents() {
        if (elements.personaDetailBack) {
            elements.personaDetailBack.addEventListener('click', (e) => {
                e.stopPropagation();
                closePersonaDetail();
            });
        }
        if (elements.personaDetailSave) {
            elements.personaDetailSave.addEventListener('click', (e) => {
                e.stopPropagation();
                savePersona();
            });
        }
        if (elements.personaAvatarInput && elements.personaAvatarPreview) {
            elements.personaAvatarPreview.addEventListener('click', () => {
                elements.personaAvatarInput.click();
            });
            elements.personaAvatarInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file && file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        elements.personaAvatarPreview.innerHTML = `<img src="${event.target.result}" alt="头像预览" style="width:100%;height:100%;object-fit:cover;border-radius:20px;">`;
                        elements.personaAvatarPreview.classList.add('has-image');
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // ====== 修改点：直接删除人设（使用原生 confirm） ======
        const deleteBtn = document.getElementById('personaDeleteBtn');
        if (deleteBtn) {
            // 移除旧的监听器（通过克隆替换方式），防止重复绑定
            const newDeleteBtn = deleteBtn.cloneNode(true);
            deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
            elements.personaDeleteBtn = newDeleteBtn;

            newDeleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = newDeleteBtn.dataset.personaId || editingPersonaId;
                if (!id) {
                    alert('未找到要删除的人设 ID');
                    return;
                }
                // 直接弹出原生确认框，确认后调用删除函数（删除包括聊天记录和记忆）
                if (confirm('确定要删除该人设吗？\n此操作将删除该人设的所有聊天记录和记忆，且不可撤销！')) {
                    deletePersonaWithMemory(id);
                }
            });
            console.log('✅ 删除按钮已绑定为直接删除（含确认框）');
        } else {
            console.warn('personaDeleteBtn 元素未找到');
        }
    }

    // ====== 修改点：删除人设函数接受 id 参数 ======
    function deletePersonaWithMemory(id) {
        if (!id) return;
        const persona = savedPersonas.find(p => p.id === id);
        if (!persona) {
            alert('该人设不存在或已被删除');
            return;
        }

        // 删除聊天记录、设置、记忆
        localStorage.removeItem(`chat_history_${id}`);
        localStorage.removeItem(`chat_settings_${id}`);
        localStorage.removeItem(`chat_memory_${id}`);
        localStorage.removeItem(`chat_summary_${id}`);

        // 从人设列表中移除
        savedPersonas = savedPersonas.filter(p => p.id !== id);
        localStorage.setItem('saved_personas', JSON.stringify(savedPersonas));

        closePersonaDetail();
        renderPersonaList();

        // 如果当前正在与该人设聊天，关闭聊天页面
        if (window.ChatModule && typeof ChatModule.getCurrentPersona === 'function' && ChatModule.getCurrentPersona()?.id === id) {
            ChatModule.closeChat();
        }
    }

    // 保留函数（但不再使用），以防其他代码调用
    function deletePersonaKeepMemory(id) {
        if (!id) return;
        const persona = savedPersonas.find(p => p.id === id);
        if (!persona) return;
        localStorage.removeItem(`chat_history_${id}`);
        localStorage.removeItem(`chat_settings_${id}`);
        // 保留记忆：chat_memory_${id} 和 chat_summary_${id} 不删除
        savedPersonas = savedPersonas.filter(p => p.id !== id);
        localStorage.setItem('saved_personas', JSON.stringify(savedPersonas));
        closePersonaDetail();
        renderPersonaList();
        if (window.ChatModule && typeof ChatModule.getCurrentPersona === 'function' && ChatModule.getCurrentPersona()?.id === id) {
            ChatModule.closeChat();
        }
    }

    // 关闭删除确认弹窗（虽然不再使用自定义弹窗，但保留以防兼容）
    function closePersonaDeleteModal() {
        if (elements.personaDeleteModal) {
            elements.personaDeleteModal.setAttribute('hidden', '');
        }
    }

    // 重置人设表单
    function resetPersonaForm() {
        if (elements.personaForm) {
            elements.personaForm.reset();
        }
        if (elements.personaAvatarPreview) {
            elements.personaAvatarPreview.innerHTML = `
                <svg class="persona-avatar-placeholder" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
            `;
            elements.personaAvatarPreview.classList.remove('has-image');
        }
        const freshDeleteBtn = document.getElementById('personaDeleteBtn');
        if (freshDeleteBtn) {
            freshDeleteBtn.style.display = 'none';
        }
        editingPersonaId = null;
    }

    function loadPersonaData(personaId) {
        const persona = savedPersonas.find(p => p.id === personaId);
        if (!persona) return;
        elements.personaNameInput.value = persona.name || '';
        elements.personaWechatInput.value = persona.wechat || '';
        elements.personaGenderInput.value = persona.gender || '';
        elements.personaAgeInput.value = persona.age || '';
        elements.personaAddressInput.value = persona.address || '';
        elements.personaBirthdayInput.value = persona.birthday || '';
        elements.personaDescInput.value = persona.desc || '';
        if (persona.avatar) {
            elements.personaAvatarPreview.innerHTML = `<img src="${persona.avatar}" alt="头像预览" style="width:100%;height:100%;object-fit:cover;border-radius:20px;">`;
            elements.personaAvatarPreview.classList.add('has-image');
        }
        const freshDeleteBtn = document.getElementById('personaDeleteBtn');
        if (freshDeleteBtn) {
            freshDeleteBtn.dataset.personaId = personaId;
        }
    }

    function savePersona() {
        const name = elements.personaNameInput.value.trim();
        const wechat = elements.personaWechatInput.value.trim();
        const gender = elements.personaGenderInput.value.trim();
        const age = elements.personaAgeInput.value.trim();
        const address = elements.personaAddressInput.value.trim();
        const birthday = elements.personaBirthdayInput.value.trim();
        const desc = elements.personaDescInput.value.trim();
        if (!name) {
            alert('请输入名字');
            elements.personaNameInput.focus();
            return;
        }
        let avatar = '';
        const avatarImg = elements.personaAvatarPreview.querySelector('img');
        if (avatarImg) {
            avatar = avatarImg.src;
        }

        // 检查头像是否变化（仅在编辑现有人设时）
        let avatarChanged = false;
        let targetPersonaId = editingPersonaId;
        if (editingPersonaId) {
            const existingPersona = savedPersonas.find(p => p.id === editingPersonaId);
            if (existingPersona && existingPersona.avatar !== avatar) {
                avatarChanged = true;
            }
            const index = savedPersonas.findIndex(p => p.id === editingPersonaId);
            if (index !== -1) {
                savedPersonas[index] = {
                    ...savedPersonas[index],
                    name,
                    wechat,
                    gender,
                    age,
                    address,
                    birthday,
                    desc,
                    avatar,
                    updatedAt: Date.now()
                };
            }
        } else {
            const newPersona = {
                id: 'persona_' + Date.now(),
                name,
                wechat,
                gender,
                age,
                address,
                birthday,
                desc,
                avatar,
                createdAt: Date.now()
            };
            savedPersonas.unshift(newPersona);
            targetPersonaId = newPersona.id;
        }
        localStorage.setItem('saved_personas', JSON.stringify(savedPersonas));
        closePersonaDetail();
        renderPersonaList();

        // 如果头像变化，同步到所有界面
        if (avatarChanged && targetPersonaId) {
            syncCharAvatar(targetPersonaId, avatar);
        }
    }

    function renderPersonaList() {
        if (!elements.personaList || !elements.personaEmpty) return;
        if (savedPersonas.length === 0) {
            elements.personaEmpty.style.display = 'flex';
            elements.personaList.style.display = 'none';
            elements.personaList.innerHTML = '';
            return;
        }
        elements.personaEmpty.style.display = 'none';
        elements.personaList.style.display = 'flex';
        elements.personaList.innerHTML = savedPersonas.map(persona => `
            <div class="persona-card" data-id="${persona.id}">
                <div class="persona-card-avatar">
                    ${persona.avatar 
                        ? `<img src="${persona.avatar}" alt="${persona.name}">`
                        : `<svg class="persona-avatar-placeholder" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:#A8D0E6;width:100%;height:100%;">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                          </svg>`
                    }
                </div>
                <div class="persona-card-info">
                    <div class="persona-card-name">${escapeHtml(persona.name)}</div>
                    <div class="persona-card-wechat">${escapeHtml(persona.wechat || '未设置微信号')}</div>
                </div>
            </div>
        `).join('');
        elements.personaList.querySelectorAll('.persona-card').forEach(card => {
            card.addEventListener('click', (e) => {
                e.stopPropagation();
                const personaId = card.dataset.id;
                openPersonaDetail(personaId);
            });
        });
    }

    // ========== 聊天设置页面功能函数 ==========
    let currentChatSettingsPersona = null;

    function openChatSettings(sourcePage = 'page5', persona = null) {
        if (isChatSettingsOpen) return;
        isChatSettingsOpen = true;
        chatSettingsSourcePage = sourcePage;
        currentChatSettingsPersona = persona;
        if (sourcePage === 'page5') {
            isSettingsOpen = false;
        }
        goToPage('page11');
        loadChatSettings();
    }

    function closeChatSettings() {
        if (!isChatSettingsOpen) return;
        isChatSettingsOpen = false;
        goToPage(chatSettingsSourcePage);
    }

    function bindChatSettingsEvents() {
        if (elements.chatSettingsBack) {
            elements.chatSettingsBack.addEventListener('click', (e) => {
                e.stopPropagation();
                closeChatSettings();
            });
        }
        if (elements.chatSettingsSave) {
            elements.chatSettingsSave.addEventListener('click', (e) => {
                e.stopPropagation();
                saveChatSettings();
            });
        }
        if (elements.chatBgSelectBtn && elements.chatBgFileInput) {
            elements.chatBgSelectBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                elements.chatBgFileInput.click();
            });
            elements.chatBgFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file && file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        elements.chatBgFileInput.dataset.preview = event.target.result;
                        elements.chatBgSelectBtn.textContent = '已选择';
                        elements.chatBgSelectBtn.style.color = '#B6D8CE';
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
        if (elements.contextDecrease && elements.contextCountInput) {
            elements.contextDecrease.addEventListener('click', (e) => {
                e.stopPropagation();
                let val = parseInt(elements.contextCountInput.value, 10) || 1;
                if (val > 1) {
                    elements.contextCountInput.value = val - 1;
                }
            });
        }
        if (elements.contextIncrease && elements.contextCountInput) {
            elements.contextIncrease.addEventListener('click', (e) => {
                e.stopPropagation();
                let val = parseInt(elements.contextCountInput.value, 10) || 1;
                if (val < 500) {
                    elements.contextCountInput.value = val + 1;
                }
            });
        }
        if (elements.contextCountInput) {
            elements.contextCountInput.addEventListener('change', () => {
                let val = parseInt(elements.contextCountInput.value, 10);
                if (isNaN(val) || val < 1) val = 1;
                if (val > 500) val = 500;
                elements.contextCountInput.value = val;
            });
        }
        if (elements.openSearchHistoryBtn) {
            elements.openSearchHistoryBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openSearchHistory();
            });
        }
        function bindOpacitySlider(slider, valueEl) {
            if (slider && valueEl) {
                slider.addEventListener('input', () => {
                    valueEl.textContent = parseFloat(slider.value).toFixed(1);
                });
            }
        }
        bindOpacitySlider(elements.fontOpacitySlider, elements.fontOpacityValue);
        bindOpacitySlider(elements.charBubbleOpacitySlider, elements.charBubbleOpacityValue);
        bindOpacitySlider(elements.userBubbleOpacitySlider, elements.userBubbleOpacityValue);

        if (elements.deleteChatHistoryBtn) {
            elements.deleteChatHistoryBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!currentChatSettingsPersona) return;
                if (confirm('确定要删除当前联系人的所有聊天记录吗？记忆不会丢失！')) {
                    const key = `chat_history_${currentChatSettingsPersona.id}`;
                    localStorage.removeItem(key);
                    if (window.ChatModule && typeof ChatModule.getCurrentPersona === 'function' && ChatModule.getCurrentPersona()?.id === currentChatSettingsPersona.id) {
                        ChatModule.clearChatHistory();
                    }
                    const btn = elements.deleteChatHistoryBtn;
                    const originalText = btn.querySelector('.chat-settings-delete-label');
                    if (originalText) {
                        originalText.textContent = '已删除';
                        originalText.style.color = '#B6D8CE';
                        setTimeout(() => {
                            originalText.textContent = '删除聊天记录';
                            originalText.style.color = '#E91E63';
                        }, 1500);
                    }
                }
            });
        }
    }

    function loadChatSettings() {
        const personaId = currentChatSettingsPersona?.id;
        const settingsKey = personaId ? `chat_settings_${personaId}` : 'chat_settings';
        const settings = JSON.parse(localStorage.getItem(settingsKey) || '{}');
        if (elements.chatRemarkInput) {
            elements.chatRemarkInput.value = settings.remark || (currentChatSettingsPersona?.chatRemark || '');
        }
        if (elements.innerThoughtInput) {
            elements.innerThoughtInput.checked = settings.innerThoughtEnabled !== false;
        }
        if (elements.contextCountInput) {
            elements.contextCountInput.value = settings.contextCount || 10;
        }
        if (elements.autoSummaryInput) {
            elements.autoSummaryInput.value = settings.autoSummaryCount || 50;
        }
        if (elements.memoryRefInput) {
            elements.memoryRefInput.value = settings.memoryRefCount || 5;
        }
        if (elements.chatBgFileInput && settings.chatBg) {
            elements.chatBgFileInput.dataset.preview = settings.chatBg;
            elements.chatBgSelectBtn.textContent = '已设置';
            elements.chatBgSelectBtn.style.color = '#B6D8CE';
        }
        if (elements.timeAwareInput) {
            elements.timeAwareInput.checked = settings.timeAwareEnabled !== false;
        }
        if (elements.fontColorInput) {
            elements.fontColorInput.value = settings.fontColor || '#3A5072';
        }
        if (elements.fontOpacitySlider) {
            elements.fontOpacitySlider.value = settings.fontOpacity !== undefined ? settings.fontOpacity : 1;
            if (elements.fontOpacityValue) {
                elements.fontOpacityValue.textContent = parseFloat(elements.fontOpacitySlider.value).toFixed(1);
            }
        }
        if (elements.charBubbleColorInput) {
            elements.charBubbleColorInput.value = settings.charBubbleColor || '#D5DCE0';
        }
        if (elements.charBubbleOpacitySlider) {
            elements.charBubbleOpacitySlider.value = settings.charBubbleOpacity !== undefined ? settings.charBubbleOpacity : 1;
            if (elements.charBubbleOpacityValue) {
                elements.charBubbleOpacityValue.textContent = parseFloat(elements.charBubbleOpacitySlider.value).toFixed(1);
            }
        }
        if (elements.userBubbleColorInput) {
            elements.userBubbleColorInput.value = settings.userBubbleColor || '#FAF5F0';
        }
        if (elements.userBubbleOpacitySlider) {
            elements.userBubbleOpacitySlider.value = settings.userBubbleOpacity !== undefined ? settings.userBubbleOpacity : 1;
            if (elements.userBubbleOpacityValue) {
                elements.userBubbleOpacityValue.textContent = parseFloat(elements.userBubbleOpacitySlider.value).toFixed(1);
            }
        }
    }

    function saveChatSettings() {
        const personaId = currentChatSettingsPersona?.id;
        const settingsKey = personaId ? `chat_settings_${personaId}` : 'chat_settings';
        const settings = {
            remark: elements.chatRemarkInput?.value?.trim() || '',
            innerThoughtEnabled: elements.innerThoughtInput?.checked !== false,
            contextCount: parseInt(elements.contextCountInput?.value, 10) || 10,
            autoSummaryCount: parseInt(elements.autoSummaryInput?.value, 10) || 50,
            memoryRefCount: parseInt(elements.memoryRefInput?.value, 10) || 5,
            chatBg: elements.chatBgFileInput?.dataset?.preview || '',
            timeAwareEnabled: elements.timeAwareInput?.checked !== false,
            fontColor: elements.fontColorInput?.value || '#3A5072',
            fontOpacity: parseFloat(elements.fontOpacitySlider?.value) || 1,
            charBubbleColor: elements.charBubbleColorInput?.value || '#D5DCE0',
            charBubbleOpacity: parseFloat(elements.charBubbleOpacitySlider?.value) || 1,
            userBubbleColor: elements.userBubbleColorInput?.value || '#FAF5F0',
            userBubbleOpacity: parseFloat(elements.userBubbleOpacitySlider?.value) || 1
        };
        localStorage.setItem(settingsKey, JSON.stringify(settings));
        if (settings.remark && currentChatSettingsPersona) {
            updatePersonaRemark(currentChatSettingsPersona.id, settings.remark);
        }
        if (window.ChatModule && typeof ChatModule.updateUI === 'function' && ChatModule.getCurrentPersona()?.id === personaId) {
            ChatModule.updateUI();
        }
        const btn = elements.chatSettingsSave;
        const originalText = btn.textContent;
        btn.textContent = '已保存';
        btn.style.background = 'linear-gradient(135deg, #B6D8CE 0%, #92CFF4 100%)';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 1000);
    }

    function updatePersonaRemark(personaId, remark) {
        const index = savedPersonas.findIndex(p => p.id === personaId);
        if (index !== -1) {
            savedPersonas[index].chatRemark = remark;
            localStorage.setItem('saved_personas', JSON.stringify(savedPersonas));
            if (window.WeChatModule && typeof WeChatModule.refreshContacts === 'function') {
                WeChatModule.refreshContacts();
            }
        }
    }

    // ========== 查找聊天记录页面功能函数 ==========
    function openSearchHistory() {
        if (isSearchHistoryOpen) return;
        isSearchHistoryOpen = true;
        searchHistorySourcePage = chatSettingsSourcePage;
        goToPage('page12');
        setTimeout(() => {
            if (elements.searchHistoryInput) {
                elements.searchHistoryInput.focus();
            }
        }, 300);
    }

    function closeSearchHistory() {
        if (!isSearchHistoryOpen) return;
        isSearchHistoryOpen = false;
        goToPage('page11');
    }

    function bindSearchHistoryEvents() {
        if (elements.searchHistoryBack) {
            elements.searchHistoryBack.addEventListener('click', (e) => {
                e.stopPropagation();
                closeSearchHistory();
            });
        }
        if (elements.searchHistoryInput) {
            elements.searchHistoryInput.addEventListener('input', (e) => {
                const query = e.target.value.trim();
                handleSearchHistory(query);
            });
            elements.searchHistoryInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearchHistory(e.target.value.trim());
                }
            });
        }
    }

    function handleSearchHistory(query) {
        console.log('搜索聊天记录:', query);
        const resultsContainer = document.getElementById('searchHistoryResults');
        if (resultsContainer && query) {
            resultsContainer.innerHTML = `
                <div class="search-history-empty">
                    <p class="search-history-empty-text">搜索 "${escapeHtml(query)}" 的功能待实现</p>
                </div>
            `;
        }
    }

    // ========== 备份管理功能 ==========
    let isBackupSettingsOpen = false;

    function openBackupSettings() {
        if (isBackupSettingsOpen) return;
        isBackupSettingsOpen = true;
        isSettingsOpen = false;
        goToPage('page17');
        loadLastBackupTime();
    }

    function closeBackupSettings() {
        if (!isBackupSettingsOpen) return;
        isBackupSettingsOpen = false;
        isSettingsOpen = true;
        goToPage('page5');
    }

    function bindBackupSettingsEvents() {
        const backupSettingsBack = document.getElementById('backupSettingsBack');
        const backupExportBtn = document.getElementById('backupExportBtn');
        const backupImportBtn = document.getElementById('backupImportBtn');
        const backupFileInput = document.getElementById('backupFileInput');
        if (backupSettingsBack) {
            backupSettingsBack.addEventListener('click', (e) => {
                e.stopPropagation();
                closeBackupSettings();
            });
        }
        if (backupExportBtn) {
            backupExportBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleExportBackup();
            });
        }
        if (backupImportBtn) {
            backupImportBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                backupFileInput?.click();
            });
        }
        if (backupFileInput) {
            backupFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file && file.type === 'application/json') {
                    handleImportBackup(file);
                } else if (file) {
                    alert('请选择 .json 格式的备份文件');
                }
                e.target.value = '';
            });
        }
    }

    function handleExportBackup() {
        try {
            const backupData = {
                version: '1.0',
                timestamp: Date.now(),
                timestampISO: new Date().toISOString(),
                savedApiConfigs: JSON.parse(localStorage.getItem('saved_api_configs') || '[]'),
                lastApiConfig: JSON.parse(localStorage.getItem('last_api_config') || 'null'),
                savedPersonas: JSON.parse(localStorage.getItem('saved_personas') || '[]'),
                myProfile: JSON.parse(localStorage.getItem('my_profile_data') || 'null'),
                chatHistories: getAllChatHistories(),
                chatSettings: getAllChatSettings(),
                memories: JSON.parse(localStorage.getItem('memories') || 'null'),
                innerThoughts: JSON.parse(localStorage.getItem('inner_thoughts') || 'null'),
                wallpaper: localStorage.getItem('wallpaper_image') || null
            };
            const jsonStr = JSON.stringify(backupData, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const now = new Date();
            const dateStr = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}`;
            a.download = `backup_${dateStr}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            updateLastBackupTimeDisplay();
            showToast('备份导出成功！');
        } catch (err) {
            console.error('导出备份失败:', err);
            showToast('导出失败，请重试');
        }
    }

    function handleImportBackup(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const backupData = JSON.parse(event.target.result);
                if (!backupData.version || !backupData.timestamp) {
                    throw new Error('无效的备份文件格式');
                }
                if (!confirm('导入备份将覆盖当前所有数据（人设、聊天记录、设置等），确定继续吗？')) {
                    return;
                }
                if (backupData.savedApiConfigs) {
                    localStorage.setItem('saved_api_configs', JSON.stringify(backupData.savedApiConfigs));
                }
                if (backupData.lastApiConfig) {
                    localStorage.setItem('last_api_config', JSON.stringify(backupData.lastApiConfig));
                }
                if (backupData.savedPersonas) {
                    localStorage.setItem('saved_personas', JSON.stringify(backupData.savedPersonas));
                    savedPersonas = backupData.savedPersonas;
                }
                if (backupData.myProfile) {
                    localStorage.setItem('my_profile_data', JSON.stringify(backupData.myProfile));
                }
                if (backupData.chatHistories) {
                    Object.entries(backupData.chatHistories).forEach(([key, value]) => {
                        localStorage.setItem(key, JSON.stringify(value));
                    });
                }
                if (backupData.chatSettings) {
                    Object.entries(backupData.chatSettings).forEach(([key, value]) => {
                        localStorage.setItem(key, JSON.stringify(value));
                    });
                }
                if (backupData.memories) {
                    localStorage.setItem('memories', JSON.stringify(backupData.memories));
                }
                if (backupData.innerThoughts) {
                    localStorage.setItem('inner_thoughts', JSON.stringify(backupData.innerThoughts));
                }
                if (backupData.wallpaper) {
                    localStorage.setItem('wallpaper_image', backupData.wallpaper);
                }
                updateLastBackupTimeDisplay();
                showToast('备份导入成功！页面将刷新...');
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } catch (err) {
                console.error('导入备份失败:', err);
                showToast('导入失败：' + err.message);
            }
        };
        reader.readAsText(file);
    }

    function getAllChatHistories() {
        const histories = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('chat_history_')) {
                histories[key] = JSON.parse(localStorage.getItem(key) || '[]');
            }
        }
        return histories;
    }

    function getAllChatSettings() {
        const settings = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('chat_settings')) {
                settings[key] = JSON.parse(localStorage.getItem(key) || '{}');
            }
        }
        return settings;
    }

    function loadLastBackupTime() {
        const lastBackup = localStorage.getItem('last_backup_time');
        updateLastBackupTimeDisplay(lastBackup);
    }

    function updateLastBackupTimeDisplay(timeMs) {
        const timeValueEl = document.getElementById('backupTimeValue');
        if (!timeValueEl) return;
        const time = timeMs || localStorage.getItem('last_backup_time');
        if (time) {
            const date = new Date(parseInt(time, 10));
            const formatted = `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
            timeValueEl.textContent = formatted;
        } else {
            timeValueEl.textContent = '—';
        }
    }

    function updateLastBackupTimeDisplay() {
        const now = Date.now();
        localStorage.setItem('last_backup_time', now.toString());
        const timeValueEl = document.getElementById('backupTimeValue');
        if (timeValueEl) {
            const date = new Date(now);
            const formatted = `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
            timeValueEl.textContent = formatted;
        }
    }

    function showToast(message) {
        const existingToast = document.querySelector('.backup-toast');
        if (existingToast) existingToast.remove();
        const toast = document.createElement('div');
        toast.className = 'backup-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(51, 51, 51, 0.9);
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

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ========== 我的人设页面模块 (user人设) ==========
    const UserPersonaModule = (function() {
        'use strict';

        let external = {
            PAGES: [],
            goToPage: null,
            getSavedPersonas: () => [],
            getUserProfile: () => null
        };

        let userPersonaElements = {
            backBtn: null,
            saveBtn: null,
            avatarPreview: null,
            avatarInput: null,
            nameInput: null,
            detailInput: null,
            defaultBtn: null,
            defaultToggle: null,
            specificBtn: null,
            manageBtn: null
        };

        function init(deps) {
            external = { ...external, ...deps };
            cacheElements();
            bindEvents();
        }

        function cacheElements() {
            userPersonaElements.backBtn = document.getElementById('userPersonaBack');
            userPersonaElements.saveBtn = document.getElementById('userPersonaSave');
            userPersonaElements.avatarPreview = document.getElementById('userPersonaAvatarPreview');
            userPersonaElements.avatarInput = document.getElementById('userPersonaAvatarInput');
            userPersonaElements.nameInput = document.getElementById('userPersonaNameInput');
            userPersonaElements.detailInput = document.getElementById('userPersonaDetailInput');
            userPersonaElements.defaultBtn = document.getElementById('userPersonaDefaultBtn');
            userPersonaElements.defaultToggle = document.getElementById('userPersonaDefaultToggle');
            userPersonaElements.specificBtn = document.getElementById('userPersonaSpecificBtn');
            userPersonaElements.manageBtn = document.getElementById('userPersonaManageBtn');
        }

        function openUserPersona(sourcePage = 'page9') {
            if (isUserPersonaOpen) return;
            isUserPersonaOpen = true;
            userPersonaSourcePage = sourcePage;
            loadUserProfileData();
            external.goToPage('page18');
        }

        function closeUserPersona() {
            if (!isUserPersonaOpen) return;
            isUserPersonaOpen = false;
            external.goToPage(userPersonaSourcePage);
        }

        function loadUserProfileData() {
            const userProfile = external.getUserProfile();
            if (!userProfile) return;

            // 加载头像
            if (userProfile.avatar && userPersonaElements.avatarPreview) {
                userPersonaElements.avatarPreview.innerHTML = `<img src="${userProfile.avatar}" alt="头像" style="width:100%;height:100%;object-fit:cover;border-radius:24px;">`;
                userPersonaElements.avatarPreview.classList.add('has-image');
            }

            // 加载姓名
            if (userPersonaElements.nameInput) {
                userPersonaElements.nameInput.value = userProfile.name || '';
            }

            // 加载详细人设
            if (userPersonaElements.detailInput) {
                userPersonaElements.detailInput.value = userProfile.persona || '';
            }

            // 加载默认人设开关状态
            if (userPersonaElements.defaultToggle) {
                userPersonaElements.defaultToggle.checked = userProfile.isDefaultPersona || false;
            }
        }

        function saveUserProfile() {
            const userProfile = external.getUserProfile();
            if (!userProfile) return;

            const name = userPersonaElements.nameInput?.value.trim() || '';
            const persona = userPersonaElements.detailInput?.value.trim() || '';
            const isDefault = userPersonaElements.defaultToggle?.checked || false;

            let avatar = userProfile.avatar;
            const avatarImg = userPersonaElements.avatarPreview?.querySelector('img');
            if (avatarImg) {
                avatar = avatarImg.src;
            }

            // 检查头像是否变化
            const avatarChanged = avatar !== userProfile.avatar;

            // 更新全局 userProfile（仅保存到 user_profile localStorage）
            window.userProfile = {
                ...userProfile,
                name,
                persona,
                avatar,
                isDefaultPersona: isDefault
            };

            localStorage.setItem('user_profile', JSON.stringify(window.userProfile));
            console.log('人设保存成功:', window.userProfile);

            // 如果头像变化，同步到所有界面
            if (avatarChanged) {
                syncUserAvatar(avatar);
            }
        }

        function bindEvents() {
            // 返回按钮
            if (userPersonaElements.backBtn) {
                userPersonaElements.backBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    closeUserPersona();
                });
            }

            // 保存按钮
            if (userPersonaElements.saveBtn) {
                userPersonaElements.saveBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    saveUserProfile();
                });
            }

            // 头像上传
            if (userPersonaElements.avatarPreview && userPersonaElements.avatarInput) {
                userPersonaElements.avatarPreview.addEventListener('click', () => {
                    userPersonaElements.avatarInput.click();
                });
                userPersonaElements.avatarInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file && file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            userPersonaElements.avatarPreview.innerHTML = `<img src="${event.target.result}" alt="头像预览" style="width:100%;height:100%;object-fit:cover;border-radius:24px;">`;
                            userPersonaElements.avatarPreview.classList.add('has-image');
                        };
                        reader.readAsDataURL(file);
                    }
                });
            }

            // 设为默认人设切换
            if (userPersonaElements.defaultToggle) {
                userPersonaElements.defaultToggle.addEventListener('change', (e) => {
                    e.stopPropagation();
                    // 状态已在 saveUserProfile 中处理
                    console.log('默认人设切换:', e.target.checked);
                    /* 
                        当此状态为开启时，该用户人设将全局生效，对所有聊天角色（Char）使用
                    */
                });
            }

            // 对特定用户使用 - 占位符
            if (userPersonaElements.specificBtn) {
                userPersonaElements.specificBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    console.log('点击：对特定用户使用 - 功能待实现');
                    // 留空用占位符方便后面替换功能
                });
            }

            // 管理其他人设 - 占位符
            if (userPersonaElements.manageBtn) {
                userPersonaElements.manageBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    console.log('点击：管理其他人设 - 功能待实现');
                    // 留空用占位符方便后面替换功能
                });
            }
        }

        return {
            init,
            openUserPersona,
            closeUserPersona
        };
    })();

    // 暴露到全局供 WeChatModule 使用
    window.UserPersonaModule = UserPersonaModule;

    window.PhoneUI = {
        goToPage,
        nextPage,
        prevPage,
        openSettings,
        closeSettings,
        openApiSettings,
        closeApiSettings,
        openPersonaList,
        closePersonaList,
        openPersonaDetail,
        closePersonaDetail,
        openChatSettings,
        closeChatSettings,
        openSearchHistory,
        closeSearchHistory,
        openBackupSettings,
        closeBackupSettings,
        openWechat: WeChatModule.openWechat,
        closeWechat: WeChatModule.closeWechat,
        openMemory: MemoryModule.openMemory,
        closeMemory: MemoryModule.closeMemory,
        getCurrentPage: () => PAGES[currentPageIndex],
        setPassword: (pwd) => { passwordInput = pwd; updatePasswordIndicators(); }
    };

})();

// 添加 shake 动画到 CSS (运行时注入)
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
@keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
    20%, 40%, 60%, 80% { transform: translateX(6px); }
}
@keyframes toastIn {
    from { opacity: 0; transform: translateX(-50%) translateY(20px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
@keyframes toastOut {
    from { opacity: 1; transform: translateX(-50%) translateY(0); }
    to { opacity: 0; transform: translateX(-50%) translateY(20px); }
}
`;
document.head.appendChild(shakeStyle);