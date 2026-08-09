// ========== AI 记忆模块 ==========
const MemoryModule = (function() {
    'use strict';

    // ========== 记忆模块状态 ==========
    let isMemoryOpen = false;
    let memorySourcePage = 'page3';
    let currentMemoryType = null; // 当前查看的记忆类型

    // 记忆数据存储结构
    // 每个记忆条目: { id, type, content, timestamp, weight, keywords, expired }
    const MEMORY_TYPES = {
        SHORT_TERM: 'shortTerm',      // 短期记忆
        LONG_TERM: 'longTerm',        // 长期记忆
        PERMANENT: 'permanent',       // 永久记忆
        ABOUT_USER: 'aboutUser'       // 关于你
    };

    const MEMORY_TYPE_LABELS = {
        [MEMORY_TYPES.SHORT_TERM]: { label: '短期记忆', en: 'Short-term Memory', color: '#d3b8ed', icon: '⚡' },
        [MEMORY_TYPES.LONG_TERM]: { label: '长期记忆', en: 'Long-term Memory', color: '#c6a0e5', icon: '🧠' },
        [MEMORY_TYPES.PERMANENT]: { label: '永久记忆', en: 'Permanent Memory', color: '#b88adf', icon: '💎' },
        [MEMORY_TYPES.ABOUT_USER]: { label: '关于你', en: 'About User', color: '#ab75da', icon: '👤' }
    };

    // ========== DOM 元素缓存 ==========
    const elements = {
        memoryBack: null,
        memoryTitle: null,
        memoryAddBtn: null,
        memoryList: null,
        memoryModal: null,
        memoryModalBackdrop: null,
        memoryModalTitle: null,
        memoryModalContent: null,
        memoryModalClose: null,
        memoryEntryModal: null,
        memoryEntryModalBackdrop: null,
        memoryEntryModalTitle: null,
        memoryEntryModalContent: null,
        memoryEntryModalClose: null,
        memoryEntryForm: null,
        memoryEntryType: null,
        memoryEntryContent: null,
        memoryEntryKeywords: null,
        memoryEntryWeight: null
    };

    // ========== 外部依赖（由主程序注入） ==========
    let external = {
        PAGES: [],
        goToPage: null,
        elements: {},
        getCurrentPersona: () => null
    };

    // ========== 初始化 ==========
    function init(deps) {
        external = { ...external, ...deps };
        cacheElements();
        bindEvents();
        initMemoryStorage();
    }

    function cacheElements() {
        elements.memoryBack = document.getElementById('memoryBack');
        elements.memoryTitle = document.getElementById('memoryTitle');
        elements.memoryAddBtn = document.getElementById('memoryAddBtn');
        elements.memoryList = document.getElementById('memoryList');
        elements.memoryModal = document.getElementById('memoryModal');
        elements.memoryModalBackdrop = document.getElementById('memoryModalBackdrop');
        elements.memoryModalTitle = document.getElementById('memoryModalTitle');
        elements.memoryModalContent = document.getElementById('memoryModalContent');
        elements.memoryModalClose = document.getElementById('memoryModalClose');
        elements.memoryEntryModal = document.getElementById('memoryEntryModal');
        elements.memoryEntryModalBackdrop = document.getElementById('memoryEntryModalBackdrop');
        elements.memoryEntryModalTitle = document.getElementById('memoryEntryModalTitle');
        elements.memoryEntryModalContent = document.getElementById('memoryEntryModalContent');
        elements.memoryEntryModalClose = document.getElementById('memoryEntryModalClose');
        elements.memoryEntryForm = document.getElementById('memoryEntryForm');
        elements.memoryEntryType = document.getElementById('memoryEntryType');
        elements.memoryEntryContent = document.getElementById('memoryEntryContent');
        elements.memoryEntryKeywords = document.getElementById('memoryEntryKeywords');
        elements.memoryEntryWeight = document.getElementById('memoryEntryWeight');
    }

    // 初始化记忆存储（预设演示数据）
    function initMemoryStorage() {
        const persona = external.getCurrentPersona?.();
        if (!persona) return;
        
        const storageKey = `memory_${persona.id}`;
        let memoryData = JSON.parse(localStorage.getItem(storageKey) || 'null');
        
        if (!memoryData) {
            // 预设演示数据
            const now = Date.now();
            const day = 24 * 60 * 60 * 1000;
            
            memoryData = {
                [MEMORY_TYPES.SHORT_TERM]: [
                    { id: genId(), type: MEMORY_TYPES.SHORT_TERM, content: '用户刚才问了今天的天气', timestamp: now - 1000 * 60 * 5, weight: 1.0, expired: false },
                    { id: genId(), type: MEMORY_TYPES.SHORT_TERM, content: '用户提到想吃火锅', timestamp: now - 1000 * 60 * 15, weight: 0.9, expired: false },
                    { id: genId(), type: MEMORY_TYPES.SHORT_TERM, content: '用户分享了一个笑话', timestamp: now - 1000 * 60 * 30, weight: 0.8, expired: false },
                    { id: genId(), type: MEMORY_TYPES.SHORT_TERM, content: '讨论了周末的计划', timestamp: now - 1000 * 60 * 60, weight: 0.7, expired: false },
                    { id: genId(), type: MEMORY_TYPES.SHORT_TERM, content: '用户询问了AI的能力边界', timestamp: now - 1000 * 60 * 60 * 2, weight: 0.6, expired: false },
                    { id: genId(), type: MEMORY_TYPES.SHORT_TERM, content: '聊到了最喜欢的电影', timestamp: now - 1000 * 60 * 60 * 3, weight: 0.5, expired: false },
                    { id: genId(), type: MEMORY_TYPES.SHORT_TERM, content: '用户抱怨了工作压力', timestamp: now - 1000 * 60 * 60 * 4, weight: 0.4, expired: false },
                    { id: genId(), type: MEMORY_TYPES.SHORT_TERM, content: '分享了一首喜欢的歌', timestamp: now - 1000 * 60 * 60 * 5, weight: 0.3, expired: false },
                    { id: genId(), type: MEMORY_TYPES.SHORT_TERM, content: '讨论了宠物猫的日常', timestamp: now - 1000 * 60 * 60 * 6, weight: 0.2, expired: false },
                    { id: genId(), type: MEMORY_TYPES.SHORT_TERM, content: '用户说要早点休息', timestamp: now - 1000 * 60 * 60 * 7, weight: 0.1, expired: false }
                ],
                [MEMORY_TYPES.LONG_TERM]: [
                    { id: genId(), type: MEMORY_TYPES.LONG_TERM, content: '用户喜欢吃川菜，不吃香菜', timestamp: now - day * 2, weight: 0.85, keywords: ['饮食偏好', '川菜', '香菜'] },
                    { id: genId(), type: MEMORY_TYPES.LONG_TERM, content: '用户是软件工程师，喜欢用 VS Code', timestamp: now - day * 5, weight: 0.75, keywords: ['职业', '编程', 'VS Code'] },
                    { id: genId(), type: MEMORY_TYPES.LONG_TERM, content: '用户养了一只叫"豆腐"的橘猫', timestamp: now - day * 10, weight: 0.7, keywords: ['宠物', '橘猫', '豆腐'] },
                    { id: genId(), type: MEMORY_TYPES.LONG_TERM, content: '用户喜欢看科幻电影，最爱《星际穿越》', timestamp: now - day * 15, weight: 0.6, keywords: ['爱好', '电影', '科幻'] },
                    { id: genId(), type: MEMORY_TYPES.LONG_TERM, content: '用户周末喜欢去爬山露营', timestamp: now - day * 20, weight: 0.55, keywords: ['爱好', '户外', '爬山'] },
                    { id: genId(), type: MEMORY_TYPES.LONG_TERM, content: '用户最近在学习 Rust 语言', timestamp: now - day * 30, weight: 0.45, keywords: ['学习', 'Rust', '编程语言'] }
                ],
                [MEMORY_TYPES.PERMANENT]: [
                    { id: genId(), type: MEMORY_TYPES.PERMANENT, content: '用户名字叫 小雅', timestamp: now - day * 100, weight: 1.0, keywords: ['姓名', '核心身份'] },
                    { id: genId(), type: MEMORY_TYPES.PERMANENT, content: '用户生日是 5月20日', timestamp: now - day * 200, weight: 1.0, keywords: ['生日', '重要日期'] },
                    { id: genId(), type: MEMORY_TYPES.PERMANENT, content: '用户对花生严重过敏', timestamp: now - day * 300, weight: 1.0, keywords: ['过敏', '医疗信息', '花生'] },
                    { id: genId(), type: MEMORY_TYPES.PERMANENT, content: '用户在深圳工作，住在南山区', timestamp: now - day * 150, weight: 0.95, keywords: ['居住地', '工作地'] }
                ],
                [MEMORY_TYPES.ABOUT_USER]: [
                    { id: genId(), type: MEMORY_TYPES.ABOUT_USER, content: '用户温柔细心，说话轻声细语，但内心很有主见', timestamp: now - day * 10, weight: 0.9, source: 'observation' },
                    { id: genId(), type: MEMORY_TYPES.ABOUT_USER, content: '用户喜欢用"嗯嗯"、"好的"作为回应，显得很有耐心', timestamp: now - day * 5, weight: 0.85, source: 'observation' },
                    { id: genId(), type: MEMORY_TYPES.ABOUT_USER, content: '用户遇到困难会先自己思考，实在解决不了才会求助', timestamp: now - day * 15, weight: 0.8, source: 'inference' },
                    { id: genId(), type: MEMORY_TYPES.ABOUT_USER, content: '用户对技术有洁癖，代码规范要求很高', timestamp: now - day * 20, weight: 0.75, source: 'inference' }
                ]
            };
            
            localStorage.setItem(storageKey, JSON.stringify(memoryData));
        }
    }

    // 生成唯一ID
    function genId() {
        return 'mem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // 获取当前人设的记忆数据
    function getMemoryData() {
        const persona = external.getCurrentPersona?.();
        if (!persona) return null;
        const storageKey = `memory_${persona.id}`;
        return JSON.parse(localStorage.getItem(storageKey) || '{}');
    }

    // 保存记忆数据
    function saveMemoryData(data) {
        const persona = external.getCurrentPersona?.();
        if (!persona) return;
        const storageKey = `memory_${persona.id}`;
        localStorage.setItem(storageKey, JSON.stringify(data));
    }

    // ========== 公开方法 ==========
    function openMemory(sourcePage = 'page3') {
        if (isMemoryOpen) return;
        isMemoryOpen = true;
        memorySourcePage = sourcePage;
        external.goToPage('page13');
        renderMemoryList();
    }

    function closeMemory() {
        if (!isMemoryOpen) return;
        isMemoryOpen = false;
        closeMemoryModal();
        closeMemoryEntryModal();
        external.goToPage(memorySourcePage);
    }

    function getCurrentMemoryPersona() {
        return external.getCurrentPersona?.();
    }

    // ========== 记忆算法模拟 ==========

    // 短期记忆：达到10轮后最早的自动丢失
    function simulateShortTermDecay(memories) {
        // 触发逻辑：当对话达到10轮后，最早的短期记忆会自动丢失（过期）
        const activeMemories = memories.filter(m => !m.expired);
        if (activeMemories.length >= 10) {
            // 按时间排序，最早的标记为过期
            const sorted = [...activeMemories].sort((a, b) => a.timestamp - b.timestamp);
            sorted[0].expired = true;
            sorted[0].weight = 0;
        }
        return memories;
    }

    // 长期记忆：随轮次增加产生遗忘（权重降低）
    function simulateLongTermDecay(memories, conversationRounds) {
        // 它会随着对话轮次的增加而产生"遗忘"现象（权重降低或在超过一定数量的轮次后衰退）
        return memories.map(m => {
            const ageInDays = (Date.now() - m.timestamp) / (24 * 60 * 60 * 1000);
            const decayFactor = Math.max(0.1, 1 - (ageInDays * 0.02) - (conversationRounds * 0.001));
            return { ...m, weight: Math.max(0.1, m.weight * decayFactor) };
        });
    }

    // 永久记忆：根据关键词自动调用和关联
    function findPermanentMemoryByKeywords(keywords, memories) {
        // 根据上下文中触发的关键词自动调用和关联
        const lowerKeywords = keywords.map(k => k.toLowerCase());
        return memories.filter(m => 
            m.keywords && m.keywords.some(kw => lowerKeywords.includes(kw.toLowerCase()))
        );
    }

    // 关于你：AI对用户的自我认知
    function updateAboutUser(observation, type = 'observation') {
        const data = getMemoryData();
        if (!data) return;
        
        const newEntry = {
            id: genId(),
            type: MEMORY_TYPES.ABOUT_USER,
            content: observation,
            timestamp: Date.now(),
            weight: 0.8,
            source: type // 'observation' | 'inference'
        };
        
        data[MEMORY_TYPES.ABOUT_USER].unshift(newEntry);
        // 保留最新50条
        if (data[MEMORY_TYPES.ABOUT_USER].length > 50) {
            data[MEMORY_TYPES.ABOUT_USER] = data[MEMORY_TYPES.ABOUT_USER].slice(0, 50);
        }
        
        saveMemoryData(data);
    }

    // 新增记忆条目（供AI层调用）
    function addMemoryEntry(type, content, options = {}) {
        const data = getMemoryData();
        if (!data) return;
        
        const newEntry = {
            id: genId(),
            type,
            content,
            timestamp: Date.now(),
            weight: options.weight || 1.0,
            keywords: options.keywords || [],
            expired: false,
            ...options
        };
        
        data[type].unshift(newEntry);
        
        // 类型特定限制
        if (type === MEMORY_TYPES.SHORT_TERM && data[type].length > 10) {
            data[type] = data[type].slice(0, 10);
        } else if (type === MEMORY_TYPES.LONG_TERM && data[type].length > 100) {
            data[type] = data[type].slice(0, 100);
        } else if (type === MEMORY_TYPES.PERMANENT && data[type].length > 50) {
            data[type] = data[type].slice(0, 50);
        }
        
        saveMemoryData(data);
        
        // 如果当前页面打开着，刷新显示
        if (isMemoryOpen && currentMemoryType === type) {
            renderMemoryModal(type);
        }
    }

    // 删除记忆条目
    function deleteMemoryEntry(type, entryId) {
        const data = getMemoryData();
        if (!data) return;
        
        data[type] = data[type].filter(m => m.id !== entryId);
        saveMemoryData(data);
        
        if (isMemoryOpen) {
            if (currentMemoryType === type) {
                renderMemoryModal(type);
            }
            renderMemoryList();
        }
    }

    // ========== 事件绑定 ==========
    function bindEvents() {
        // 返回按钮
        if (elements.memoryBack) {
            elements.memoryBack.addEventListener('click', (e) => {
                e.stopPropagation();
                closeMemory();
            });
        }

        // 新增记忆按钮（蝴蝶/小花图标）
        if (elements.memoryAddBtn) {
            elements.memoryAddBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openMemoryEntryModal();
            });
        }

        // 模态框关闭
        if (elements.memoryModalBackdrop) {
            elements.memoryModalBackdrop.addEventListener('click', closeMemoryModal);
        }
        if (elements.memoryModalClose) {
            elements.memoryModalClose.addEventListener('click', closeMemoryModal);
        }

        // 新增记忆模态框
        if (elements.memoryEntryModalBackdrop) {
            elements.memoryEntryModalBackdrop.addEventListener('click', closeMemoryEntryModal);
        }
        if (elements.memoryEntryModalClose) {
            elements.memoryEntryModalClose.addEventListener('click', closeMemoryEntryModal);
        }
        // 取消按钮
        const memoryEntryCancelBtn = document.getElementById('memoryEntryCancelBtn');
        if (memoryEntryCancelBtn) {
            memoryEntryCancelBtn.addEventListener('click', closeMemoryEntryModal);
        }
        if (elements.memoryEntryForm) {
            elements.memoryEntryForm.addEventListener('submit', handleMemoryEntrySubmit);
        }
    }

    // ========== 渲染函数 ==========

    // 渲染记忆主列表（四个模块卡片）
    function renderMemoryList() {
        if (!elements.memoryList) return;
        
        const data = getMemoryData();
        if (!data) {
            elements.memoryList.innerHTML = '<div class="memory-empty">暂无人设数据</div>';
            return;
        }

        const types = [
            MEMORY_TYPES.SHORT_TERM,
            MEMORY_TYPES.LONG_TERM,
            MEMORY_TYPES.PERMANENT,
            MEMORY_TYPES.ABOUT_USER
        ];

        elements.memoryList.innerHTML = types.map(type => {
            const info = MEMORY_TYPE_LABELS[type];
            const memories = data[type] || [];
            const activeCount = memories.filter(m => !m.expired).length;
            const totalCount = memories.length;
            
            return `
                <div class="memory-module-card" data-type="${type}" style="--module-color: ${info.color};">
                    <div class="memory-module-header">
                        <span class="memory-module-icon">${info.icon}</span>
                        <div class="memory-module-titles">
                            <span class="memory-module-label">${info.label}</span>
                            <span class="memory-module-en">${info.en}</span>
                        </div>
                    </div>
                    <div class="memory-module-stats">
                        <span class="memory-count">${activeCount}/${totalCount}</span>
                        <span class="memory-arrow">›</span>
                    </div>
                    <div class="memory-module-preview">
                        ${memories.slice(0, 2).map(m => `
                            <div class="memory-preview-item ${m.expired ? 'expired' : ''}">
                                ${escapeHtml(m.content.substring(0, 30))}${m.content.length > 30 ? '...' : ''}
                            </div>
                        `).join('') || '<span class="memory-empty-preview">暂无记忆</span>'}
                    </div>
                </div>
            `;
        }).join('');

        // 绑定卡片点击事件
        elements.memoryList.querySelectorAll('.memory-module-card').forEach(card => {
            card.addEventListener('click', () => {
                const type = card.dataset.type;
                openMemoryModal(type);
            });
        });
    }

    // 打开记忆详情模态框
    function openMemoryModal(type) {
        currentMemoryType = type;
        const info = MEMORY_TYPE_LABELS[type];
        
        if (elements.memoryModalTitle) {
            elements.memoryModalTitle.innerHTML = `
                <span class="memory-modal-icon" style="color: ${info.color};">${info.icon}</span>
                <span>${info.label}</span>
                <span class="memory-modal-en">${info.en}</span>
            `;
        }
        
        renderMemoryModal(type);
        
        if (elements.memoryModal) {
            elements.memoryModal.hidden = false;
            elements.memoryModal.offsetHeight;
            elements.memoryModal.classList.add('show');
        }
    }

    // 渲染记忆详情内容
    function renderMemoryModal(type) {
        if (!elements.memoryModalContent) return;
        
        const data = getMemoryData();
        if (!data) return;
        
        const memories = data[type] || [];
        const info = MEMORY_TYPE_LABELS[type];
        
        if (memories.length === 0) {
            elements.memoryModalContent.innerHTML = `
                <div class="memory-modal-empty">
                    <span class="memory-modal-empty-icon">${info.icon}</span>
                    <p>暂无${info.label}记忆</p>
                    <button class="memory-add-first-btn" data-type="${type}">新增第一条记忆</button>
                </div>
            `;
            
            // 绑定新增按钮
            const btn = elements.memoryModalContent.querySelector('.memory-add-first-btn');
            if (btn) {
                btn.addEventListener('click', () => {
                    closeMemoryModal();
                    openMemoryEntryModal(type);
                });
            }
            return;
        }

        elements.memoryModalContent.innerHTML = memories.map((memory, index) => {
            const timeStr = formatTime(memory.timestamp);
            const weightPercent = Math.round(memory.weight * 100);
            const isExpired = memory.expired;
            
            let weightClass = 'weight-high';
            if (weightPercent < 30) weightClass = 'weight-low';
            else if (weightPercent < 60) weightClass = 'weight-medium';
            
            // 根据类型显示不同的额外信息
            let extraInfo = '';
            if (type === MEMORY_TYPES.SHORT_TERM) {
                extraInfo = `<span class="memory-round">第${memories.length - index}轮</span>`;
            } else if (type === MEMORY_TYPES.LONG_TERM) {
                extraInfo = memory.keywords && memory.keywords.length ? 
                    `<span class="memory-keywords">${memory.keywords.map(k => `#${k}`).join(' ')}</span>` : '';
            } else if (type === MEMORY_TYPES.PERMANENT) {
                extraInfo = memory.keywords && memory.keywords.length ? 
                    `<span class="memory-keywords">${memory.keywords.map(k => `#${k}`).join(' ')}</span>` : '';
            } else if (type === MEMORY_TYPES.ABOUT_USER) {
                extraInfo = `<span class="memory-source">${memory.source === 'inference' ? '推断' : '观察'}</span>`;
            }
            
            return `
                <div class="memory-entry-item ${isExpired ? 'expired' : ''}" data-id="${memory.id}" data-type="${type}">
                    <div class="memory-entry-content">
                        <p class="memory-entry-text">${escapeHtml(memory.content)}</p>
                        <div class="memory-entry-meta">
                            <span class="memory-time">${timeStr}</span>
                            <span class="memory-weight ${weightClass}">权重: ${weightPercent}%</span>
                            ${extraInfo}
                        </div>
                    </div>
                    <button class="memory-delete-btn" data-id="${memory.id}" data-type="${type}" aria-label="删除记忆">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            `;
        }).join('');

        // 绑定删除按钮事件
        elements.memoryModalContent.querySelectorAll('.memory-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const entryId = btn.dataset.id;
                const type = btn.dataset.type;
                deleteMemoryEntry(type, entryId);
            });
        });

        // 绑定"新增第一条"按钮（如果有）
        const addFirstBtn = elements.memoryModalContent.querySelector('.memory-add-first-btn');
        if (addFirstBtn) {
            addFirstBtn.addEventListener('click', () => {
                closeMemoryModal();
                openMemoryEntryModal(type);
            });
        }
    }

    // 关闭记忆详情模态框
    function closeMemoryModal() {
        if (elements.memoryModal) {
            elements.memoryModal.classList.remove('show');
            setTimeout(() => {
                elements.memoryModal.hidden = true;
            }, 300);
        }
        currentMemoryType = null;
    }

    // 打开新增记忆模态框
    function openMemoryEntryModal(prefillType = null) {
        if (elements.memoryEntryModalTitle) {
            elements.memoryEntryModalTitle.textContent = prefillType ? '编辑记忆' : '新增记忆';
        }
        
        // 重置表单
        if (elements.memoryEntryForm) {
            elements.memoryEntryForm.reset();
        }
        
        // 设置类型下拉框
        if (elements.memoryEntryType) {
            elements.memoryEntryType.innerHTML = Object.entries(MEMORY_TYPE_LABELS).map(([key, info]) => 
                `<option value="${key}" ${prefillType === key ? 'selected' : ''}>${info.icon} ${info.label}</option>`
            ).join('');
            
            if (prefillType) {
                elements.memoryEntryType.disabled = true;
            } else {
                elements.memoryEntryType.disabled = false;
            }
        }
        
        if (elements.memoryEntryModal) {
            elements.memoryEntryModal.hidden = false;
            elements.memoryEntryModal.offsetHeight;
            elements.memoryEntryModal.classList.add('show');
            
            // 聚焦内容输入框
            setTimeout(() => {
                if (elements.memoryEntryContent) {
                    elements.memoryEntryContent.focus();
                }
            }, 300);
        }
    }

    // 处理新增记忆表单提交
    function handleMemoryEntrySubmit(e) {
        e.preventDefault();
        
        const type = elements.memoryEntryType?.value;
        const content = elements.memoryEntryContent?.value?.trim();
        const keywords = elements.memoryEntryKeywords?.value?.trim();
        const weight = parseFloat(elements.memoryEntryWeight?.value) || 1.0;
        
        if (!type || !content) {
            alert('请填写记忆类型和内容');
            return;
        }
        
        const keywordArray = keywords ? keywords.split(',').map(k => k.trim()).filter(k => k) : [];
        
        addMemoryEntry(type, content, {
            keywords: keywordArray,
            weight: Math.max(0.1, Math.min(1, weight))
        });
        
        closeMemoryEntryModal();
    }

    // 关闭新增记忆模态框
    function closeMemoryEntryModal() {
        if (elements.memoryEntryModal) {
            elements.memoryEntryModal.classList.remove('show');
            setTimeout(() => {
                elements.memoryEntryModal.hidden = true;
            }, 300);
        }
        if (elements.memoryEntryForm) {
            elements.memoryEntryForm.reset();
        }
        if (elements.memoryEntryType) {
            elements.memoryEntryType.disabled = false;
        }
    }

    // ========== 工具函数 ==========
    function formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
        
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${month}月${day}日 ${hours}:${minutes}`;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ========== 导出供 AI 层调用的接口 ==========
    const MemoryAPI = {
        // 核心记忆操作
        addMemoryEntry,
        deleteMemoryEntry,
        getMemoryData,
        
        // 算法模拟接口（供 AI 层在合适时机调用）
        simulateShortTermDecay: (memories) => simulateShortTermDecay(memories),
        simulateLongTermDecay: (memories, rounds) => simulateLongTermDecay(memories, rounds),
        findPermanentMemoryByKeywords: (keywords, memories) => findPermanentMemoryByKeywords(keywords, memories),
        updateAboutUser,
        
        // 类型常量
        MEMORY_TYPES
    };

    return {
        init,
        openMemory,
        closeMemory,
        getCurrentMemoryPersona,
        MemoryAPI
    };
})();

// 支持 CommonJS / ES Module / 全局变量
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MemoryModule;
} else if (typeof window !== 'undefined') {
    window.MemoryModule = MemoryModule;
}