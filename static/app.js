/**
 * AI智能伴侣 - 前端交互逻辑
 */

const state = {
    currentSession: null,
    messages: [],
    nickName: '小甜甜',
    nature: '活泼开朗的东北姑娘',
    isLoading: false,
};

const API_BASE_URL = '/apipatner';
const sessionMeta = {};
let presetsData = [];

const elements = {
    sessionList: document.querySelector('#sessionList'),
    chatMessages: document.querySelector('#chatMessages'),
    chatInput: document.querySelector('#chatInput'),
    sendBtn: document.querySelector('#sendBtn'),
    jumpBottom: document.querySelector('#jumpBottom'),
    newSessionBtn: document.querySelector('#newSessionBtn'),
    sessionName: document.querySelector('#sessionName'),
    chatTitle: document.querySelector('#chatTitle'),
    nickName: document.querySelector('#nickName'),
    nature: document.querySelector('#nature'),
    companionHint: document.querySelector('#companionHint'),
    themeBtn: document.querySelector('#themeBtn'),
    themeDropdown: document.querySelector('#themeDropdown'),
    presetSelect: document.querySelector('#presetSelect'),
    infoSidebar: document.querySelector('#infoSidebar'),
    infoToggleBtn: document.querySelector('#infoToggleBtn'),
    infoCloseBtn: document.querySelector('#infoCloseBtn'),
    infoMask: document.querySelector('#infoMask'),
    toastHost: document.querySelector('#toastHost'),
};

document.addEventListener('DOMContentLoaded', async () => {
    await init();
});

async function init() {
    bindEventListeners();
    await loadPresets();
    await loadSessionList();

    if (!state.currentSession) {
        await createNewSession();
    }
}

function bindEventListeners() {
    elements.sendBtn.addEventListener('click', sendMessage);
    elements.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            sendMessage();
        }
    });
    elements.chatInput.addEventListener('input', () => {
        resizeChatInput();
        updateSendButton();
    });
    elements.jumpBottom.addEventListener('click', () => {
        scrollToBottom(true);
    });
    elements.chatMessages.addEventListener('scroll', updateJumpButton);

    resizeChatInput();
    updateSendButton();

    elements.newSessionBtn.addEventListener('click', async () => {
        await createNewSession();
    });

    elements.presetSelect.addEventListener('change', (e) => {
        handlePresetChange(e.target.value);
        flashCompanionHint('已切换人设，下一条消息生效');
    });

    elements.nickName.addEventListener('change', (e) => {
        state.nickName = e.target.value || '小甜甜';
        updateChatHeader();
        updatePresetSelection();
        flashCompanionHint('昵称已更新，下一条消息生效');
        if (state.currentSession) {
            sessionMeta[state.currentSession] = {
                ...(sessionMeta[state.currentSession] || {}),
                nick_name: state.nickName,
            };
            refreshSessionListOnly();
        }
    });

    elements.nature.addEventListener('change', (e) => {
        state.nature = e.target.value || '活泼开朗的东北姑娘';
        updatePresetSelection();
        flashCompanionHint('性格已更新，下一条消息生效');
    });

    elements.infoToggleBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = !elements.infoSidebar?.classList.contains('is-open');
        setInfoOpen(open);
    });
    elements.infoCloseBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        setInfoOpen(false);
    });
    elements.infoMask?.addEventListener('click', () => {
        setInfoOpen(false);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') setInfoOpen(false);
    });

    bindPressFeedback();
    bindThemeSwitcher();
}

function setInfoOpen(open) {
    const panel = elements.infoSidebar;
    const mask = elements.infoMask;
    if (!panel) return;

    window.clearTimeout(setInfoOpen._timer);

    if (open) {
        panel.hidden = false;
        if (mask) mask.hidden = false;
        // 先显示再触发位移动画，否则 display:none 时 transition 不生效
        void panel.offsetWidth;
        panel.classList.add('is-open');
        mask?.classList.add('is-open');
        return;
    }

    panel.classList.remove('is-open');
    mask?.classList.remove('is-open');

    const finish = () => {
        if (panel.classList.contains('is-open')) return;
        panel.hidden = true;
        if (mask) mask.hidden = true;
    };

    panel.addEventListener('transitionend', finish, { once: true });
    setInfoOpen._timer = window.setTimeout(finish, 360);
}

function bindPressFeedback() {
    document.addEventListener('pointerdown', (event) => {
        const target = event.target.closest(
            '.btn-send, .btn-primary, .btn-ghost, .btn-theme, .session-btn, .theme-option, .starter-chip, .jump-bottom'
        );
        if (!target || target.disabled || target.classList.contains('is-idle')) return;
        target.classList.add('is-pressed');
    });

    const clearPressed = () => {
        document.querySelectorAll('.is-pressed').forEach((node) => {
            node.classList.remove('is-pressed');
        });
    };
    document.addEventListener('pointerup', clearPressed);
    document.addEventListener('pointercancel', clearPressed);
}

async function refreshSessionListOnly() {
    try {
        const response = await fetch(`${API_BASE_URL}/sessions`);
        const result = await response.json();
        if (result.code === 200) {
            await hydrateSessionMeta(result.data);
            renderSessionList(result.data);
        }
    } catch (error) {
        console.error(error);
    }
}

function bindThemeSwitcher() {
    elements.themeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        elements.themeDropdown.classList.toggle('show');
    });

    document.addEventListener('click', () => {
        elements.themeDropdown.classList.remove('show');
    });

    elements.themeDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    elements.themeDropdown.querySelectorAll('.theme-option').forEach((option) => {
        option.addEventListener('click', () => {
            applyTheme(option.dataset.theme);
            elements.themeDropdown.classList.remove('show');
        });
    });

    loadSavedTheme();
}

function applyTheme(theme) {
    document.body.classList.toggle('theme-dark', theme === 'dark');
    localStorage.setItem('ai-companion-theme', theme);
    requestAnimationFrame(() => updateThemeSelection(theme));
}

function updateThemeSelection(theme) {
    elements.themeDropdown.querySelectorAll('.theme-option').forEach((option) => {
        option.classList.toggle('active', option.dataset.theme === theme);
    });
}

function loadSavedTheme() {
    applyTheme(localStorage.getItem('ai-companion-theme') || 'light');
}

function parseSessionDate(sessionId) {
    const match = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})$/.exec(sessionId);
    if (!match) return null;
    const [, y, m, d, h, min, s] = match;
    return new Date(+y, +m - 1, +d, +h, +min, +s);
}

function formatSessionTime(sessionId) {
    const date = parseSessionDate(sessionId);
    if (!date || Number.isNaN(date.getTime())) return sessionId;

    const now = new Date();
    const sameDay =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();

    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const time = `${hh}:${mm}`;

    if (sameDay) return `今天 ${time}`;

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
        date.getFullYear() === yesterday.getFullYear() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getDate() === yesterday.getDate();
    if (isYesterday) return `昨天 ${time}`;

    return `${date.getMonth() + 1}月${date.getDate()}日 ${time}`;
}

function getSessionLabel(sessionId) {
    const meta = sessionMeta[sessionId];
    const nick = meta?.nick_name || '未命名';
    return { title: nick, time: formatSessionTime(sessionId) };
}

async function hydrateSessionMeta(sessionIds) {
    const missing = sessionIds.filter((id) => !sessionMeta[id]?.nick_name);
    await Promise.all(
        missing.map(async (id) => {
            try {
                const response = await fetch(`${API_BASE_URL}/sessions/${id}`);
                const result = await response.json();
                if (result.code === 200 && result.data) {
                    sessionMeta[id] = {
                        nick_name: result.data.nick_name || '未命名',
                        nature: result.data.nature || '',
                    };
                }
            } catch (error) {
                console.error(error);
            }
        })
    );
}

async function loadSessionList() {
    try {
        const response = await fetch(`${API_BASE_URL}/sessions`);
        const result = await response.json();

        if (result.code !== 200) {
            throw new Error(result.message || '加载会话列表失败');
        }

        const sessions = result.data;
        await hydrateSessionMeta(sessions);
        renderSessionList(sessions);

        if (sessions.length > 0 && !state.currentSession) {
            await loadSession(sessions[0], false);
            renderSessionList(sessions);
        }

        return sessions;
    } catch (error) {
        console.error('加载会话列表失败:', error);
        showToast('加载会话列表失败');
        return [];
    }
}

function renderSessionList(sessions) {
    elements.sessionList.innerHTML = '';

    sessions.forEach((sessionId) => {
        const { title, time } = getSessionLabel(sessionId);
        const sessionItem = document.createElement('div');
        sessionItem.className = 'session-item';
        const isActive = sessionId === state.currentSession;

        sessionItem.innerHTML = `
            <button class="session-btn ${isActive ? 'btn-active' : 'btn-secondary'}"
                    data-session="${sessionId}" type="button">
                <span class="session-title">${escapeHtml(title)}</span>
                <span class="session-time">${escapeHtml(time)}</span>
            </button>
            <button class="btn btn-icon" data-delete="${sessionId}" title="删除" type="button">×</button>
        `;

        sessionItem.querySelector(`[data-session="${sessionId}"]`).addEventListener('click', async () => {
            await loadSession(sessionId, false);
            elements.sessionList.querySelectorAll('.session-btn').forEach((btn) => {
                btn.className =
                    btn.dataset.session === sessionId
                        ? 'session-btn btn-active'
                        : 'session-btn btn-secondary';
            });
        });

        sessionItem.querySelector(`[data-delete="${sessionId}"]`).addEventListener('click', (e) => {
            e.stopPropagation();
            deleteSession(sessionId);
        });

        elements.sessionList.appendChild(sessionItem);
    });
}

function updateChatHeader() {
    if (elements.chatTitle) {
        elements.chatTitle.textContent = state.nickName || '智能伴侣';
    }
    if (state.currentSession) {
        elements.sessionName.textContent = formatSessionTime(state.currentSession);
    } else {
        elements.sessionName.textContent = '还没有对话';
    }
}

async function loadSession(sessionId, refreshList = true) {
    try {
        const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`);
        const result = await response.json();

        if (result.code !== 200) {
            throw new Error(result.message || '会话不存在');
        }

        const sessionData = result.data;
        state.currentSession = sessionId;
        state.messages = sessionData.messages || [];
        state.nickName = sessionData.nick_name || '小甜甜';
        state.nature = sessionData.nature || '活泼开朗的东北姑娘';

        sessionMeta[sessionId] = {
            nick_name: state.nickName,
            nature: state.nature,
        };

        elements.nickName.value = state.nickName;
        elements.nature.value = state.nature;
        updateChatHeader();
        updatePresetSelection();
        renderMessages();

        if (refreshList) {
            await loadSessionList();
        }
    } catch (error) {
        console.error('加载会话失败:', error);
        showToast('加载会话失败');
    }
}

async function createNewSession() {
    if (state.currentSession && state.messages.length === 0) {
        showToast('当前对话还是空的，直接聊就好');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nick_name: state.nickName,
                nature: state.nature,
            }),
        });

        const result = await response.json();

        if (result.code !== 200) {
            throw new Error(result.message || '创建会话失败');
        }

        state.currentSession = result.data;
        state.messages = [];
        sessionMeta[state.currentSession] = {
            nick_name: state.nickName,
            nature: state.nature,
        };

        updateChatHeader();
        renderMessages();
        await loadSessionList();
    } catch (error) {
        console.error('创建会话失败:', error);
        showToast('创建对话失败');
    }
}

async function deleteSession(sessionId) {
    const label = getSessionLabel(sessionId).title;
    if (!window.confirm(`删除「${label}」的这场对话？`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, {
            method: 'DELETE',
        });
        const result = await response.json();

        if (result.code !== 200) {
            throw new Error(result.message || '删除失败');
        }

        delete sessionMeta[sessionId];

        if (sessionId === state.currentSession) {
            state.currentSession = null;
            state.messages = [];

            const sessionsResponse = await fetch(`${API_BASE_URL}/sessions`);
            const sessionsResult = await sessionsResponse.json();

            if (sessionsResult.code === 200 && sessionsResult.data.length > 0) {
                await hydrateSessionMeta(sessionsResult.data);
                await loadSession(sessionsResult.data[0], false);
                renderSessionList(sessionsResult.data);
            } else {
                updateChatHeader();
                renderMessages();
                renderSessionList([]);
            }
        } else {
            await loadSessionList();
        }

        showToast('已删除');
    } catch (error) {
        console.error('删除会话失败:', error);
        showToast('删除失败');
    }
}

const STARTERS = ['在干嘛', '今天怎么样', '陪我聊会儿', '讲个笑话'];

function renderMessages() {
    elements.chatMessages.innerHTML = '';

    if (state.messages.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = `
            <div class="empty-state-mark" aria-hidden="true"></div>
            <div class="empty-state-title">你好，我是${escapeHtml(state.nickName || '她')}</div>
            <div class="empty-state-text">想聊点什么，直接发消息就行</div>
            <div class="starter-list"></div>
        `;
        const list = empty.querySelector('.starter-list');
        STARTERS.forEach((text) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'starter-chip';
            chip.textContent = text;
            chip.addEventListener('click', () => {
                elements.chatInput.value = text;
                resizeChatInput();
                updateSendButton();
                elements.chatInput.focus();
            });
            list.appendChild(chip);
        });
        elements.chatMessages.appendChild(empty);
        updateJumpButton();
        return;
    }

    state.messages.forEach((msg) => {
        appendMessageToUI(msg.role, msg.content, false);
    });
    scrollToBottom(false);
}

function avatarText(role) {
    if (role === 'user') return '我';
    return (state.nickName || '伴').charAt(0);
}

function appendMessageToUI(role, content, enter = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}${enter ? ' is-enter' : ''}`;
    messageDiv.innerHTML = `
        <div class="message-avatar">${escapeHtml(avatarText(role))}</div>
        <div class="message-content">${escapeHtml(content)}</div>
    `;

    const emptyState = elements.chatMessages.querySelector('.empty-state');
    if (emptyState) {
        elements.chatMessages.innerHTML = '';
    }

    elements.chatMessages.appendChild(messageDiv);
    scrollToBottom(enter);
    updateJumpButton();
}

function showLoading() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message assistant loading-message is-enter';
    loadingDiv.id = 'loadingIndicator';
    loadingDiv.innerHTML = `
        <div class="message-avatar">${escapeHtml(avatarText('assistant'))}</div>
        <div class="message-content">
            <div class="loading">
                <div class="loading-dot"></div>
                <div class="loading-dot"></div>
                <div class="loading-dot"></div>
            </div>
        </div>
    `;
    elements.chatMessages.appendChild(loadingDiv);
    scrollToBottom(true);
}

function hideLoading() {
    document.getElementById('loadingIndicator')?.remove();
}

function scrollToBottom(smooth) {
    elements.chatMessages.scrollTo({
        top: elements.chatMessages.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
    });
    if (!smooth) updateJumpButton();
}

function updateJumpButton() {
    if (!elements.jumpBottom || !elements.chatMessages) return;
    const el = elements.chatMessages;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    elements.jumpBottom.hidden = distance < 80;
}

function resizeChatInput() {
    const input = elements.chatInput;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
}

function updateSendButton() {
    const empty = !elements.chatInput.value.trim();
    elements.sendBtn.classList.toggle('is-idle', empty);
    elements.sendBtn.disabled = state.isLoading;
}

async function sendMessage() {
    const message = elements.chatInput.value.trim();
    if (!message || state.isLoading) return;

    elements.chatInput.value = '';
    resizeChatInput();
    updateSendButton();
    appendMessageToUI('user', message, true);
    state.messages.push({ role: 'user', content: message });

    state.isLoading = true;
    elements.sendBtn.disabled = true;
    elements.sendBtn.classList.add('is-busy');
    showLoading();

    try {
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_name: state.currentSession,
                message,
                nick_name: state.nickName,
                nature: state.nature,
            }),
        });

        const result = await response.json();
        if (result.code !== 200) {
            throw new Error(result.message || 'AI响应失败');
        }

        hideLoading();
        appendMessageToUI('assistant', result.data, true);
        state.messages.push({ role: 'assistant', content: result.data });
    } catch (error) {
        console.error('发送消息失败:', error);
        hideLoading();
        showToast('发送失败，请再试一次');
        state.messages.pop();
        renderMessages();
    } finally {
        state.isLoading = false;
        elements.sendBtn.classList.remove('is-busy');
        updateSendButton();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}

function showToast(message) {
    if (!elements.toastHost) {
        window.alert(message);
        return;
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    elements.toastHost.appendChild(toast);
    window.setTimeout(() => {
        toast.classList.add('is-out');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
        window.setTimeout(() => toast.remove(), 280);
    }, 2200);
}

function flashCompanionHint(text) {
    if (!elements.companionHint) return;
    elements.companionHint.textContent = text;
    elements.companionHint.classList.add('is-notice');
    clearTimeout(flashCompanionHint._timer);
    flashCompanionHint._timer = setTimeout(() => {
        elements.companionHint.textContent = '修改后会在下一条消息生效';
        elements.companionHint.classList.remove('is-notice');
    }, 2600);
}

async function loadPresets() {
    try {
        const response = await fetch(`${API_BASE_URL}/presets`);
        const result = await response.json();
        if (result.code !== 200) {
            throw new Error(result.message || '加载预设列表失败');
        }
        presetsData = result.data;
        renderPresetSelect(presetsData);
    } catch (error) {
        console.error('加载预设列表失败:', error);
        elements.presetSelect.innerHTML = '<option value="">加载失败</option>';
    }
}

function renderPresetSelect(presets) {
    elements.presetSelect.innerHTML = '';
    const custom = document.createElement('option');
    custom.value = '';
    custom.textContent = '自定义';
    elements.presetSelect.appendChild(custom);
    presets.forEach((preset) => {
        const option = document.createElement('option');
        option.value = preset.id;
        option.textContent = preset.name;
        elements.presetSelect.appendChild(option);
    });

    if (presets.length > 0) {
        elements.presetSelect.value = presets[0].id;
        handlePresetChange(presets[0].id);
        updateChatHeader();
    }
}

function handlePresetChange(presetId) {
    if (!presetId) return;
    const preset = presetsData.find((p) => p.id == presetId);
    if (!preset) return;

    state.nickName = preset.nick_name;
    state.nature = preset.nature;
    elements.nickName.value = preset.nick_name;
    elements.nature.value = preset.nature;
    updateChatHeader();

    if (state.currentSession) {
        sessionMeta[state.currentSession] = {
            nick_name: state.nickName,
            nature: state.nature,
        };
    }
}

function updatePresetSelection() {
    if (!presetsData.length) return;
    const matched = presetsData.find(
        (p) => p.nick_name === state.nickName && p.nature === state.nature
    );
    elements.presetSelect.value = matched ? matched.id : '';
}
