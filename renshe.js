// ========== 人设管理模块 (Char人设 - AI扮演的人设) ==========
const RensheModule = (function() {
    'use strict';

    // ========== 状态 ==========
    let isRensheOpen = false;
    let rensheSourcePage = 'page3';
    let isRensheDetailOpen = false;
    let editingCharPersonaId = null;

    // ========== DOM 元素缓存 ==========
    const elements = {
        rensheBack: null,
        rensheAddBtn: null,
        rensheList: null,
        rensheEmpty: null,
        rensheDetailBack: null,
        rensheDetailSave: null,
        rensheAvatarInput: null,
        rensheAvatarPreview: null,
        rensheNameInput: null,
        rensheWechatInput: null,
        rensheGenderInput: null,
        rensheAgeInput: null,
        rensheAddressInput: null,
        rensheBirthdayInput: null,
        rensheDescInput: null,
        rensheDeleteBtn: null
    };

    // ========== 外部依赖 ==========
    let external = {
        PAGES: [],
        goToPage: null,
        getSavedPersonas: () => [],
        getCharPersonas: () => [],
        addCharPersona: null,
        updateCharPersona: null,
        deleteCharPersona: null,
        syncCharAvatar: null
    };

    // ========== 初始化 ==========
    function init(deps) {
        external = { ...external, ...deps };
        cacheElements();
        bindEvents();
    }

    function cacheElements() {
        elements.rensheBack = document.getElementById('rensheBack');
        elements.rensheAddBtn = document.getElementById('rensheAddBtn');
        elements.rensheList = document.getElementById('rensheList');
        elements.rensheEmpty = document.getElementById('rensheEmpty');
        elements.rensheDetailBack = document.getElementById('rensheDetailBack');
        elements.rensheDetailSave = document.getElementById('rensheDetailSave');
        elements.rensheAvatarInput = document.getElementById('rensheAvatarInput');
        elements.rensheAvatarPreview = document.getElementById('rensheAvatarPreview');
        elements.rensheNameInput = document.getElementById('rensheNameInput');
        elements.rensheWechatInput = document.getElementById('rensheWechatInput');
        elements.rensheGenderInput = document.getElementById('rensheGenderInput');
        elements.rensheAgeInput = document.getElementById('rensheAgeInput');
        elements.rensheAddressInput = document.getElementById('rensheAddressInput');
        elements.rensheBirthdayInput = document.getElementById('rensheBirthdayInput');
        elements.rensheDescInput = document.getElementById('rensheDescInput');
        elements.rensheDeleteBtn = document.getElementById('rensheDeleteBtn');
    }

    // ========== 公开方法 ==========
    function openRenshe(sourcePage = 'page3') {
        if (isRensheOpen) return;
        isRensheOpen = true;
        rensheSourcePage = sourcePage;
        external.goToPage('page7');
        renderCharPersonaList();
    }

    function closeRenshe() {
        if (!isRensheOpen) return;
        isRensheOpen = false;
        external.goToPage(rensheSourcePage);
    }

    function openRensheDetail(charPersonaId = null) {
        if (isRensheDetailOpen) return;
        isRensheDetailOpen = true;
        editingCharPersonaId = charPersonaId;
        external.goToPage('page8');
        resetRensheForm();
        if (charPersonaId) {
            loadCharPersonaData(charPersonaId);
            const deleteBtn = document.getElementById('rensheDeleteBtn');
            if (deleteBtn) deleteBtn.style.display = 'flex';
        } else {
            const deleteBtn = document.getElementById('rensheDeleteBtn');
            if (deleteBtn) deleteBtn.style.display = 'none';
        }
    }

    function closeRensheDetail() {
        if (!isRensheDetailOpen) return;
        isRensheDetailOpen = false;
        editingCharPersonaId = null;
        external.goToPage('page7');
    }

    // ========== 渲染 Char 人设列表 ==========
    function renderCharPersonaList() {
        if (!elements.rensheList || !elements.rensheEmpty) return;

        const charPersonas = external.getCharPersonas();
        if (charPersonas.length === 0) {
            elements.rensheEmpty.style.display = 'flex';
            elements.rensheList.style.display = 'none';
            elements.rensheList.innerHTML = '';
            return;
        }

        elements.rensheEmpty.style.display = 'none';
        elements.rensheList.style.display = 'flex';
        elements.rensheList.innerHTML = charPersonas.map(persona => `
            <div class="persona-card" data-id="${persona.id}">
                <div class="persona-card-avatar">
                    ${persona.avatar
                        ? `<img src="${escapeHtml(persona.avatar)}" alt="${escapeHtml(persona.name)}">`
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

        elements.rensheList.querySelectorAll('.persona-card').forEach(card => {
            card.addEventListener('click', (e) => {
                e.stopPropagation();
                const personaId = card.dataset.id;
                openRensheDetail(personaId);
            });
        });
    }

    // ========== 加载 Char 人设数据 ==========
    function loadCharPersonaData(personaId) {
        const charPersonas = external.getCharPersonas();
        const persona = charPersonas.find(p => p.id === personaId);
        if (!persona) return;

        elements.rensheNameInput.value = persona.name || '';
        elements.rensheWechatInput.value = persona.wechat || '';
        elements.rensheGenderInput.value = persona.gender || '';
        elements.rensheAgeInput.value = persona.age || '';
        elements.rensheAddressInput.value = persona.address || '';
        elements.rensheBirthdayInput.value = persona.birthday || '';
        elements.rensheDescInput.value = persona.desc || '';

        if (persona.avatar && elements.rensheAvatarPreview) {
            elements.rensheAvatarPreview.innerHTML = `<img src="${persona.avatar}" alt="头像预览" style="width:100%;height:100%;object-fit:cover;border-radius:20px;">`;
            elements.rensheAvatarPreview.classList.add('has-image');
        }

        const deleteBtn = document.getElementById('rensheDeleteBtn');
        if (deleteBtn) deleteBtn.dataset.personaId = personaId;
    }

    // ========== 重置表单 ==========
    function resetRensheForm() {
        const form = document.getElementById('rensheForm');
        if (form) form.reset();

        if (elements.rensheAvatarPreview) {
            elements.rensheAvatarPreview.innerHTML = `
                <svg class="persona-avatar-placeholder" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
            `;
            elements.rensheAvatarPreview.classList.remove('has-image');
        }

        const deleteBtn = document.getElementById('rensheDeleteBtn');
        if (deleteBtn) deleteBtn.style.display = 'none';
    }

    // ========== 保存 Char 人设 ==========
    function saveCharPersona() {
        const name = elements.rensheNameInput.value.trim();
        const wechat = elements.rensheWechatInput.value.trim();
        const gender = elements.rensheGenderInput.value.trim();
        const age = elements.rensheAgeInput.value.trim();
        const address = elements.rensheAddressInput.value.trim();
        const birthday = elements.rensheBirthdayInput.value.trim();
        const desc = elements.rensheDescInput.value.trim();

        if (!name) {
            alert('请输入名字');
            elements.rensheNameInput.focus();
            return;
        }

        let avatar = '';
        const avatarImg = elements.rensheAvatarPreview?.querySelector('img');
        if (avatarImg) avatar = avatarImg.src;

        let avatarChanged = false;
        let targetPersonaId = editingCharPersonaId;

        if (editingCharPersonaId) {
            const existingPersona = external.getCharPersonas().find(p => p.id === editingCharPersonaId);
            if (existingPersona && existingPersona.avatar !== avatar) {
                avatarChanged = true;
            }
            if (external.updateCharPersona) {
                external.updateCharPersona(editingCharPersonaId, { name, wechat, gender, age, address, birthday, desc, avatar, updatedAt: Date.now() });
            }
        } else {
            if (external.addCharPersona) {
                const newPersona = external.addCharPersona({ name, wechat, gender, age, address, birthday, desc, avatar, createdAt: Date.now() });
                targetPersonaId = newPersona?.id;
            }
        }

        closeRensheDetail();
        renderCharPersonaList();

        if (avatarChanged && targetPersonaId && external.syncCharAvatar) {
            external.syncCharAvatar(targetPersonaId, avatar);
        }
    }

    // ========== 删除 Char 人设 ==========
    function deleteCharPersona() {
        const deleteBtn = document.getElementById('rensheDeleteBtn');
        const personaId = deleteBtn?.dataset.personaId || editingCharPersonaId;
        if (!personaId) return;

        if (!confirm('确定要删除该人设吗？\n此操作将删除该人设的所有聊天记录和记忆，且不可撤销！')) return;

        if (external.deleteCharPersona) {
            external.deleteCharPersona(personaId);
        }

        closeRensheDetail();
        renderCharPersonaList();
    }

    // ========== 事件绑定 ==========
    function bindEvents() {
        // 返回按钮
        if (elements.rensheBack) {
            elements.rensheBack.addEventListener('click', (e) => {
                e.stopPropagation();
                closeRenshe();
            });
        }

        // 新增按钮
        if (elements.rensheAddBtn) {
            elements.rensheAddBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openRensheDetail(null);
            });
        }

        // 详情页返回
        if (elements.rensheDetailBack) {
            elements.rensheDetailBack.addEventListener('click', (e) => {
                e.stopPropagation();
                closeRensheDetail();
            });
        }

        // 详情页保存
        if (elements.rensheDetailSave) {
            elements.rensheDetailSave.addEventListener('click', (e) => {
                e.stopPropagation();
                saveCharPersona();
            });
        }

        // 头像上传
        if (elements.rensheAvatarPreview && elements.rensheAvatarInput) {
            elements.rensheAvatarPreview.addEventListener('click', () => {
                elements.rensheAvatarInput.click();
            });
            elements.rensheAvatarInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file && file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        elements.rensheAvatarPreview.innerHTML = `<img src="${event.target.result}" alt="头像预览" style="width:100%;height:100%;object-fit:cover;border-radius:20px;">`;
                        elements.rensheAvatarPreview.classList.add('has-image');
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // 删除按钮
        const deleteBtn = document.getElementById('rensheDeleteBtn');
        if (deleteBtn) {
            const newDeleteBtn = deleteBtn.cloneNode(true);
            deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
            elements.rensheDeleteBtn = newDeleteBtn;

            newDeleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteCharPersona();
            });
        }
    }

    // ========== 工具函数 ==========
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    return {
        init,
        openRenshe,
        closeRenshe,
        openRensheDetail,
        closeRensheDetail,
        renderCharPersonaList
    };
})();

// 全局暴露
if (typeof window !== 'undefined') {
    window.RensheModule = RensheModule;
}