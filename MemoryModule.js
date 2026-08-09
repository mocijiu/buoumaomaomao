// ========== AI 记忆模块 ==========
const MemoryModule = (function() {
    'use strict';

    // ========== 记忆模块状态 ==========
    let isMemoryOpen = false;
    let memorySourcePage = 'page3';
    let currentPersona = null;
    let currentCategory = null;
    let memoryEntries = [];

    // 记忆分类配置
    const MEMORY_CATEGORIES = [
        { id: 'short', label: '短期记忆', en: 'SHORT TERM', icon: '⏳', color: '#d3b8ed' },
        { id: 'long', label: '长期记忆', en: 'LONG TERM', icon: '📚', color: '#c6a0e5' },
        { id: 'permanent', label: '永久记忆', en: 'PERMANENT', icon: '💎', color: '#b88adf' },
        { id: 'about', label: '关于你', en: 'ABOUT YOU', icon: '💖', color: '#ab75da' }
    ];

    // ========== DOM 元素缓存 ==========
    const elements = {
        // 一级界面
        memoryBack: null,
        memoryAddBtn: null,
        memoryContent: null,
        memoryList: null,
        memoryEmpty: null,

        // 二级界面
        categoryBack: null,
        categoryTitle: null,
        categoryList: null,

        // 三级界面
        detailBack: null,
        detailTitle: null,
        detailAddBtn: null,
        detailContent: null,
        detailList: null,
        detailEmpty: null,

        // 新增记忆模态框
        entryModal: null,
        entryModalBackdrop: null,
        entryModalClose: null,
        entryModalTitle: null,
        entryForm: null,
        entryTypeSelect: null,
        entryContentTextarea: null,
        entrySubmitBtn: null,
        entryCancelBtn: null
    };

    // ========== 外部依赖 ==========
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
        
        // 绑定三级界面"新增第一条记忆"按钮
        const addFirstBtn = document.getElementById('detailAddFirstBtn');
        if (addFirstBtn) {
            addFirstBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openEntryModal();
            });
        }
    }

    // 获取最新的人设列表
    function getSavedPersonas() {
        return JSON.parse(localStorage.getItem('saved_personas')) || [];
    }

    function cacheElements() {
        // 一级界面元素
        elements.memoryBack = document.getElementById('memoryBack');
        elements.memoryAddBtn = document.getElementById('memoryAddBtn');
        elements.memoryContent = document.getElementById('memoryContent');
        elements.memoryList = document.getElementById('memoryList');
        elements.memoryEmpty = document.getElementById('memoryEmpty');

        // 二级界面元素
        elements.categoryBack = document.getElementById('categoryBack');
        elements.categoryTitle = document.getElementById('categoryTitle');
        elements.categoryList = document.getElementById('categoryList');

        // 三级界面元素
        elements.detailBack = document.getElementById('detailBack');
        elements.detailTitle = document.getElementById('detailTitle');
        elements.detailAddBtn = document.getElementById('detailAddBtn');
        elements.detailContent = document.getElementById('detailContent');
        elements.detailList = document.getElementById('detailList');
        elements.detailEmpty = document.getElementById('detailEmpty');

        // 新增记忆模态框元素
        elements.entryModal = document.getElementById('memoryEntryModal');
        elements.entryModalBackdrop = document.getElementById('memoryEntryModalBackdrop');
        elements.entryModalClose = document.getElementById('memoryEntryModalClose');
        elements.entryModalTitle = document.getElementById('memoryEntryModalTitle');
        elements.entryForm = document.getElementById('memoryEntryForm');
        elements.entryTypeSelect = document.getElementById('memoryEntryTypeSelect');
        elements.entryContentTextarea = document.getElementById('memoryEntryContent');
        elements.entrySubmitBtn = document.getElementById('memoryEntrySubmitBtn');
        elements.entryCancelBtn = document.getElementById('memoryEntryCancelBtn');
    }

    // ========== 事件绑定 ==========
    function bindEvents() {
        // 一级界面返回
        if (elements.memoryBack) {
            elements.memoryBack.addEventListener('click', (e) => {
                e.stopPropagation();
                closeMemory();
            });
        }

        // 二级界面返回
        if (elements.categoryBack) {
            elements.categoryBack.addEventListener('click', (e) => {
                e.stopPropagation();
                closeCategory();
            });
        }

        // 三级界面返回
        if (elements.detailBack) {
            elements.detailBack.addEventListener('click', (e) => {
                e.stopPropagation();
                closeDetail();
            });
        }

        // 三级界面新增按钮
        if (elements.detailAddBtn) {
            elements.detailAddBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openEntryModal();
            });
        }

        // 新增记忆模态框关闭
        if (elements.entryModalBackdrop) {
            elements.entryModalBackdrop.addEventListener('click', closeEntryModal);
        }
        if (elements.entryModalClose) {
            elements.entryModalClose.addEventListener('click', closeEntryModal);
        }

        // 新增记忆表单提交
        if (elements.entryForm) {
            elements.entryForm.addEventListener('submit', (e) => {
                e.preventDefault();
                submitEntry();
            });
        }

        // 取消按钮
        if (elements.entryCancelBtn) {
            elements.entryCancelBtn.addEventListener('click', closeEntryModal);
        }
    }

    // ========== 公开方法 ==========
    function openMemory(sourcePage = 'page3') {
        if (isMemoryOpen) return;
        isMemoryOpen = true;
        memorySourcePage = sourcePage;
        currentPersona = external.getCurrentPersona();
        external.goToPage('page13'); // 记忆一级界面
        renderMemoryList();
    }

    function closeMemory() {
        if (!isMemoryOpen) return;
        isMemoryOpen = false;
        currentPersona = null;
        external.goToPage(memorySourcePage);
    }

    function openCategory(personaId) {
        const savedPersonas = getSavedPersonas();
        currentPersona = savedPersonas.find(p => p.id === personaId);
        if (!currentPersona) return;
        
        external.goToPage('page14'); // 记忆二级界面
        renderCategoryList();
    }

    function closeCategory() {
        currentCategory = null;
        external.goToPage('page13'); // 返回一级界面
    }

    function openDetail(categoryId) {
        const category = MEMORY_CATEGORIES.find(c => c.id === categoryId);
        if (!category || !currentPersona) return;
        
        currentCategory = category;
        external.goToPage('page15'); // 记忆三级界面
        loadMemoryEntries();
        renderDetailList();
    }

    function closeDetail() {
        currentCategory = null;
        external.goToPage('page14'); // 返回二级界面
    }

    // ========== 数据持久化 ==========
    function getStorageKey(categoryId) {
        if (!currentPersona) return null;
        return `memory_${currentPersona.id}_${categoryId}`;
    }

    function loadMemoryEntries() {
        if (!currentPersona || !currentCategory) {
            memoryEntries = [];
            return;
        }
        const key = getStorageKey(currentCategory.id);
        const saved = localStorage.getItem(key);
        memoryEntries = saved ? JSON.parse(saved) : [];
        
        // 按时间倒序排列
        memoryEntries.sort((a, b) => b.timestamp - a.timestamp);
    }

    function saveMemoryEntries() {
        if (!currentPersona || !currentCategory) return;
        const key = getStorageKey(currentCategory.id);
        localStorage.setItem(key, JSON.stringify(memoryEntries));
    }

    // ========== 遗忘机制逻辑占位 ==========
    function applyForgettingMechanism(categoryId, newEntry) {
        if (!currentPersona) return;

        const key = getStorageKey(categoryId);
        let entries = JSON.parse(localStorage.getItem(key) || '[]');

        switch (categoryId) {
            case 'short':
                // 短期记忆：达到10条时，最早的自动遗忘
                if (entries.length >= 10) {
                    entries.shift(); // 删除最早的一条
                    console.log('[记忆模块] 短期记忆触发遗忘机制，已移除最早的一条记忆');
                }
                break;
            case 'long':
                // 长期记忆：轮次阈值衰退遗忘（占位逻辑）
                // 实际应用中可结合对话轮次、重要性评分等
                console.log('[记忆模块] 长期记忆衰退机制占位：可按轮次/重要性衰退');
                break;
            case 'permanent':
                // 永久记忆：关键词检索与匹配机制（占位逻辑）
                // 实际应用中可建立倒排索引、向量检索等
                console.log('[记忆模块] 永久记忆关键词检索机制占位：可建立索引/向量检索');
                break;
        }

        // 保存处理后的列表
        localStorage.setItem(key, JSON.stringify(entries));
    }

    // ========== 业务逻辑 ==========
    function submitEntry() {
        const content = elements.entryContentTextarea.value.trim();
        if (!content || !currentPersona || !currentCategory) return;

        const newEntry = {
            id: 'mem_' + Date.now(),
            content,
            timestamp: Date.now(),
            type: currentCategory.id
        };

        // 根据分类应用不同的遗忘机制
        applyForgettingMechanism(currentCategory.id, newEntry);

        // 重新加载并添加新条目
        loadMemoryEntries();
        memoryEntries.unshift(newEntry);
        saveMemoryEntries();
        renderDetailList();

        closeEntryModal();
    }

    function deleteEntry(entryId) {
        if (!currentPersona || !currentCategory) return;
        
        if (!confirm('确定要删除这条记忆吗？')) return;

        memoryEntries = memoryEntries.filter(entry => entry.id !== entryId);
        saveMemoryEntries();
        renderDetailList();
    }

    function openEntryModal() {
        if (!elements.entryModal || !currentCategory) return;
        
        elements.entryModalTitle.textContent = `新增${currentCategory.label}`;
        elements.entryContentTextarea.value = '';
        elements.entryContentTextarea.placeholder = `请输入${currentCategory.label}内容...`;
        
        elements.entryModal.hidden = false;
        elements.entryModal.offsetHeight; // 触发重绘
        
        setTimeout(() => {
            elements.entryContentTextarea.focus();
        }, 100);
    }

    function closeEntryModal() {
        if (elements.entryModal) {
            elements.entryModal.hidden = true;
        }
    }

    // ========== 渲染函数 ==========
    function renderMemoryList() {
        if (!elements.memoryList || !elements.memoryEmpty) return;

        const savedPersonas = getSavedPersonas();
        if (savedPersonas.length === 0) {
            elements.memoryEmpty.style.display = 'flex';
            elements.memoryList.style.display = 'none';
            elements.memoryList.innerHTML = '';
            return;
        }

        elements.memoryEmpty.style.display = 'none';
        elements.memoryList.style.display = 'flex';

        elements.memoryList.innerHTML = savedPersonas.map(persona => {
            // 统计该人设的总记忆数
            let totalMemories = 0;
            MEMORY_CATEGORIES.forEach(cat => {
                const key = `memory_${persona.id}_${cat.id}`;
                const saved = localStorage.getItem(key);
                if (saved) {
                    totalMemories += JSON.parse(saved).length;
                }
            });

            return `
                <div class="memory-persona-card" data-id="${persona.id}">
                    <div class="memory-persona-avatar">
                        ${persona.avatar 
                            ? `<img src="${persona.avatar}" alt="${persona.name}">`
                            : `<svg class="memory-avatar-placeholder" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:#d3b8ed;width:100%;height:100%;">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>`
                        }
                    </div>
                    <div class="memory-persona-info">
                        <div class="memory-persona-name">${escapeHtml(persona.name)}</div>
                        <div class="memory-persona-stat">${totalMemories} 条记忆</div>
                    </div>
                    <div class="memory-persona-arrow">›</div>
                </div>
            `;
        }).join('');

        // 绑定卡片点击事件
        elements.memoryList.querySelectorAll('.memory-persona-card').forEach(card => {
            card.addEventListener('click', (e) => {
                e.stopPropagation();
                const personaId = card.dataset.id;
                openCategory(personaId);
            });
        });
    }

    function renderCategoryList() {
        if (!elements.categoryList || !elements.categoryTitle || !currentPersona) return;

        elements.categoryTitle.textContent = `${currentPersona.name} 的记忆`;
        elements.categoryTitle.dataset.personaId = currentPersona.id;

        elements.categoryList.innerHTML = MEMORY_CATEGORIES.map(cat => {
            // 统计该分类下的记忆数量
            const key = `memory_${currentPersona.id}_${cat.id}`;
            const saved = localStorage.getItem(key);
            const count = saved ? JSON.parse(saved).length : 0;

            return `
                <div class="memory-module-card" data-category="${cat.id}" style="--module-color: ${cat.color};">
                    <div class="memory-module-header">
                        <span class="memory-module-icon">${cat.icon}</span>
                        <div class="memory-module-titles">
                            <div class="memory-module-label">${cat.label}</div>
                            <div class="memory-module-en">${cat.en}</div>
                        </div>
                        <div class="memory-module-stats">
                            <span class="memory-count">${count} 条</span>
                            <span class="memory-arrow">›</span>
                        </div>
                    </div>
                    <div class="memory-module-preview" id="preview-${cat.id}">
                        ${renderCategoryPreview(cat.id)}
                    </div>
                </div>
            `;
        }).join('');

        // 绑定分类卡片点击事件
        elements.categoryList.querySelectorAll('.memory-module-card').forEach(card => {
            card.addEventListener('click', (e) => {
                e.stopPropagation();
                const categoryId = card.dataset.category;
                openDetail(categoryId);
            });
        });
    }

    function renderCategoryPreview(categoryId) {
        const key = `memory_${currentPersona.id}_${categoryId}`;
        const saved = localStorage.getItem(key);
        if (!saved) {
            return '<div class="memory-empty-preview">暂无记忆</div>';
        }
        
        const entries = JSON.parse(saved).slice(0, 3); // 只显示前3条预览
        if (entries.length === 0) {
            return '<div class="memory-empty-preview">暂无记忆</div>';
        }

        return entries.map(entry => `
            <div class="memory-preview-item">
                ${escapeHtml(entry.content.substring(0, 30))}${entry.content.length > 30 ? '...' : ''}
            </div>
        `).join('');
    }

    function renderDetailList() {
        if (!elements.detailList || !elements.detailEmpty || !elements.detailTitle || !currentCategory) return;

        elements.detailTitle.innerHTML = `
            <span class="memory-modal-icon">${currentCategory.icon}</span>
            ${currentCategory.label}
            <span class="memory-modal-en">${currentCategory.en}</span>
        `;

        if (memoryEntries.length === 0) {
            elements.detailEmpty.style.display = 'flex';
            elements.detailList.style.display = 'none';
            elements.detailList.innerHTML = '';
            return;
        }

        elements.detailEmpty.style.display = 'none';
        elements.detailList.style.display = 'flex';

        elements.detailList.innerHTML = memoryEntries.map(entry => `
            <div class="memory-entry-item" data-id="${entry.id}">
                <div class="memory-entry-content">
                    <div class="memory-entry-text">${escapeHtml(entry.content)}</div>
                    <div class="memory-entry-meta">
                        <span class="memory-time">${formatTime(entry.timestamp)}</span>
                        <span class="memory-source">手动添加</span>
                    </div>
                </div>
                <button class="memory-delete-btn" data-id="${entry.id}" aria-label="删除记忆">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        `).join('');

        // 绑定删除按钮事件
        elements.detailList.querySelectorAll('.memory-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const entryId = btn.dataset.id;
                deleteEntry(entryId);
            });
        });
    }

    // ========== 工具函数 ==========
    function formatTime(timestamp) {
        const date = new Date(timestamp);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${month}-${day} ${hours}:${minutes}`;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 获取外部的人设数据
    // const savedPersonas = JSON.parse(localStorage.getItem('saved_personas')) || [];

    return {
        init,
        openMemory,
        closeMemory,
        openCategory,
        closeCategory,
        openDetail,
        closeDetail
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MemoryModule;
} else if (typeof window !== 'undefined') {
    window.MemoryModule = MemoryModule;
}