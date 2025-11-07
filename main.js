/**
 * H.A.C.A. DEEP DIVE ARCHIVES - CORE TERMINAL LOGIC
 */

// === 游戏状态 ===
const GameState = {
    currentUser: null,
    currentSCL: 0,
    unlockedDocs: new Set(), // 记录已解锁的文档ID
    sanity: 100, // 理智值/污染度
    readDangerousDocs: 0, // 读取危险文档数量
    firstTime: true // 是否第一次访问
};

// === DOM 元素引用 ===
const DOM = {
    screens: {
        login: document.getElementById('login-screen'),
        terminal: document.getElementById('terminal-screen')
    },
    views: {
        search: document.getElementById('search-view'),
        document: document.getElementById('document-view')
    },
    inputs: {
        login: document.getElementById('employee-id-input'),
        search: document.getElementById('search-input')
    },
    badges: {
        user: document.getElementById('current-user-id'),
        scl: document.getElementById('current-scl'),
        time: document.getElementById('system-time')
    },
    doc: {
        id: document.getElementById('doc-id-display'),
        title: document.getElementById('doc-title'),
        type: document.getElementById('doc-type'),
        scl: document.getElementById('doc-scl'),
        body: document.getElementById('doc-body')
    },
    searchResults: document.getElementById('search-results'),
    loginMessage: document.getElementById('login-message'),
    backButton: document.getElementById('back-to-search')
};

// === 核心功能 ===

function init() {
    updateTime();
    setInterval(updateTime, 1000);

    // 绑定事件监听器
    DOM.inputs.login.addEventListener('keypress', handleLogin);
    DOM.inputs.search.addEventListener('keypress', handleSearch);
    DOM.backButton.addEventListener('click', showSearchView);
    
    // 全局快捷键
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && DOM.views.document.classList.contains('active')) {
            showSearchView();
        }
    });
    
    // 关键词点击事件委托
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('keyword-highlight')) {
            const keyword = e.target.textContent;
            DOM.inputs.search.value = keyword;
            showSearchView();
            // 自动触发搜索
            setTimeout(() => {
                const searchEvent = new KeyboardEvent('keypress', { key: 'Enter' });
                DOM.inputs.search.dispatchEvent(searchEvent);
            }, 100);
        }
    });

    // 自动聚焦登录框
    DOM.inputs.login.focus();
    
    // 初始化音效系统
    initAudioSystem();
}

function updateTime() {
    const now = new Date();
    DOM.badges.time.textContent = now.toISOString().slice(11, 19);
}

// --- 视图切换 ---
function switchScreen(screenName) {
    Object.values(DOM.screens).forEach(s => s.classList.remove('active'));
    DOM.screens[screenName].classList.add('active');
}

function switchView(viewName) {
    Object.values(DOM.views).forEach(v => v.classList.remove('active'));
    DOM.views[viewName].classList.add('active');
}

function showSearchView() {
    switchView('search');
    DOM.inputs.search.focus();
}

// --- 登录系统 ---
function handleLogin(e) {
    if (e.key === 'Enter') {
        const inputId = e.target.value.trim().toUpperCase();
        DOM.loginMessage.textContent = "正在验证身份...";
        
        setTimeout(() => { // 模拟网络延迟
            // 检查普通用户
            let user = GAME_DATA.users[inputId];
            
            // 检查隐藏用户
            if (!user && GAME_DATA.hiddenUsers && GAME_DATA.hiddenUsers[inputId]) {
                user = GAME_DATA.hiddenUsers[inputId];
            }
            
            // 检查彩蛋用户
            if (!user && GAME_DATA.secretUsers && GAME_DATA.secretUsers[inputId]) {
                user = GAME_DATA.secretUsers[inputId];
            }
            
            if (user) {
                loginSuccess(inputId, user);
            } else {
                DOM.loginMessage.textContent = "错误：无效的雇员 ID。";
                e.target.value = '';
            }
        }, 800);
    }
}

function loginSuccess(id, user) {
    GameState.currentUser = user;
    GameState.currentSCL = user.clearance;
    
    DOM.badges.user.textContent = user.name;
    DOM.badges.scl.textContent = user.clearance;

    switchScreen('terminal');
    
    // 检查是否是被感染的账号
    if (user.infected) {
        applyInfectedEffects();
    }
    
    // 新手引导
    if (GameState.firstTime && user.clearance === 1) {
        GameState.firstTime = false;
        setTimeout(() => {
            showTutorial();
        }, 500);
    } else {
        showSearchView();
    }
}

// --- 搜索系统 ---
function handleSearch(e) {
    if (e.key === 'Enter') {
        const query = e.target.value.trim();
        if (!query) return;

        // === 命令解析器 ===
        const upperQuery = query.toUpperCase();
        if (upperQuery.startsWith('LOGIN ')) {
            handleCommandLogin(upperQuery.substring(6).trim());
            e.target.value = '';
            return;
        }
        if (upperQuery === 'LOGOUT' || upperQuery === 'EXIT') {
            location.reload();
            return;
        }
        if (upperQuery === 'HELP') {
             renderSystemMessage("可用命令:\n - SEARCH [关键词/文档ID]\n - LOGIN [雇员ID]\n - LOGOUT");
             e.target.value = '';
             return;
        }

        // === 常规搜索逻辑 ===
        const searchKey = query.toLowerCase();
        const results = GAME_DATA.documents.filter(doc => {
            // 权限检查
            if (doc.scl > GameState.currentSCL) return false;

            const idMatch = doc.id.toLowerCase().includes(searchKey);
            const keywordMatch = doc.keywords.some(k => k.toLowerCase().includes(searchKey));
            const titleMatch = doc.title.toLowerCase().includes(searchKey);

            return idMatch || keywordMatch || titleMatch;
        });

        renderSearchResults(results, query);
    }
}

function handleCommandLogin(inputId) {
    let user = GAME_DATA.users[inputId];
    
    // 检查隐藏用户
    if (!user && GAME_DATA.hiddenUsers && GAME_DATA.hiddenUsers[inputId]) {
        user = GAME_DATA.hiddenUsers[inputId];
    }
    
    // 检查彩蛋用户
    if (!user && GAME_DATA.secretUsers && GAME_DATA.secretUsers[inputId]) {
        user = GAME_DATA.secretUsers[inputId];
    }
    
    if (user) {
        renderSystemMessage(`> 正在验证用户 [${inputId}]...`);
        // 模拟一点延迟
        setTimeout(() => {
            GameState.currentUser = user;
            GameState.currentSCL = user.clearance;
            DOM.badges.user.textContent = user.name;
            DOM.badges.scl.textContent = user.clearance;
            renderSystemMessage(`> 身份验证成功。\n> 欢迎回来, ${user.name}。\n> 当前安全等级已更新为: SCL-${user.clearance}`);
            
            // 播放成功音效
            if (AudioSystem && AudioSystem.playSuccess) {
                AudioSystem.playSuccess();
            }
        }, 800);
    } else {
        renderSystemMessage(`> 错误：用户 [${inputId}] 无法识别。\n> 访问被拒绝。`);
        // 播放错误音效
        if (AudioSystem && AudioSystem.playError) {
            AudioSystem.playError();
        }
    }
}

function renderSystemMessage(msg) {
    DOM.searchResults.innerHTML = `<div class="system-message" style="white-space: pre-wrap;">${msg}</div>`;
}

function renderSearchResults(results, query) {
    DOM.searchResults.innerHTML = '';

    if (results.length === 0) {
        renderSystemMessage(`未找到与 "${query}" 相关的记录。`);
        return;
    }

    DOM.searchResults.innerHTML = `<div class="system-message">找到 ${results.length} 条记录：</div>`;

    results.forEach(doc => {
        const el = document.createElement('div');
        el.className = 'result-item';
        el.innerHTML = `
            <div><strong>[${doc.id}]</strong> ${doc.title}</div>
            <div class="result-meta">SCL-${doc.scl} | TYPE: ${doc.type}</div>
        `;
        el.addEventListener('click', () => openDocument(doc));
        DOM.searchResults.appendChild(el);
    });
}

// --- 文档查看系统 ---
function openDocument(doc) {
    // 虽然搜索时过滤了，但这里再做一次安全检查
    if (doc.scl > GameState.currentSCL) {
        alert("安全警报：访问被拒绝。您的安全等级不足。");
        return;
    }

    DOM.doc.id.textContent = doc.id;
    DOM.doc.title.textContent = doc.title;
    DOM.doc.type.textContent = doc.type;
    DOM.doc.scl.textContent = doc.scl;
    
    // 处理文档内容中的特殊格式
    DOM.doc.body.innerHTML = parseDocumentContent(doc.content);

    switchView('document');
    
    // 记录已读 (理智系统)
    GameState.unlockedDocs.add(doc.id);
    
    // 更新理智值
    if (doc.scl >= 3) {
        GameState.readDangerousDocs++;
        GameState.sanity = Math.max(0, 100 - GameState.readDangerousDocs * 5);
        applyGlitchEffects();
    }
}

// === 特殊格式解析器 ===
function parseDocumentContent(content) {
    let html = content;
    
    // 1. [数据删除] - 黑条效果
    html = html.replace(/\[数据删除\]/g, '<span class="redacted" title="需要更高权限">[数据删除]</span>');
    html = html.replace(/\[数据损坏\]/g, '<span class="corrupted" title="数据已损坏">[数据损坏]</span>');
    
    // 2. [乱码] - 随机字符效果
    html = html.replace(/\[乱码\]/g, () => {
        const glitch = '█▓▒░' + Math.random().toString(36).substring(2, 8).toUpperCase() + '░▒▓█';
        return `<span class="glitch-text">${glitch}</span>`;
    });
    
    // 3. 关键词高亮 (可交互)
    const keywords = ['THORNE', 'VANCE', 'KAELEN', 'B4', '共鸣', 'RESONANCE', '弥米尔', 'MIMIR'];
    keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        html = html.replace(regex, match => 
            `<span class="keyword-highlight" title="点击搜索: ${match}">${match}</span>`
        );
    });
    
    // 4. 警告文本
    html = html.replace(/\[警告(.*?)\]/g, '<span class="warning-text">⚠ $1</span>');
    
    // 5. 保留换行
    html = html.replace(/\n/g, '<br>');
    
    return html;
}

// === 理智系统效果 ===
function applyGlitchEffects() {
    const level = GameState.readDangerousDocs;
    
    if (level >= 3) {
        // 轻微效果
        document.body.style.filter = 'hue-rotate(5deg)';
    }
    if (level >= 6) {
        // 中等效果：偶尔闪烁
        setInterval(() => {
            if (Math.random() < 0.1) {
                flashGlitch();
            }
        }, 5000);
    }
    if (level >= 10) {
        // 重度效果：持续干扰
        document.body.classList.add('heavy-glitch');
    }
}

// === 被感染账号的特殊效果 ===
function applyInfectedEffects() {
    // 立即应用重度污染效果
    document.body.classList.add('infected-account');
    
    // 显示感染警告
    setTimeout(() => {
        const warning = document.createElement('div');
        warning.className = 'infection-warning';
        warning.innerHTML = `
            <div style="font-size: 1.5em; color: #ff3300; text-align: center; animation: glitch-flash 0.5s infinite;">
                ⚠ 警告：检测到认知污染 ⚠<br>
                <span style="font-size: 0.8em;">当前用户意识已被"共鸣"感染</span><br>
                <span style="font-size: 0.6em; opacity: 0.8;">WE ARE ONE / 我们是一体 / JOIN US</span>
            </div>
        `;
        document.body.appendChild(warning);
        
        setTimeout(() => {
            warning.style.opacity = '0';
            setTimeout(() => warning.remove(), 1000);
        }, 3000);
    }, 500);
    
    // 持续的视觉干扰
    setInterval(() => {
        // 高频率闪烁
        if (Math.random() < 0.3) {
            flashInfectedGlitch();
        }
    }, 2000);
    
    // 色相持续变化
    let hue = 0;
    setInterval(() => {
        hue = (hue + 2) % 360;
        document.body.style.filter = `hue-rotate(${hue}deg) saturate(1.5) contrast(1.2)`;
    }, 100);
}

function flashInfectedGlitch() {
    const messages = [
        'WE SEE THROUGH YOUR EYES',
        '我们通过你的眼睛看世界',
        'UNDERSTAND US',
        '理解我们',
        'YOU ARE THE RESONANCE',
        '你就是共鸣',
        'DO NOT RESIST',
        '不要抗拒',
        'THE PATTERN IS BEAUTIFUL',
        '这个模式很美丽'
    ];
    
    const glitchText = document.createElement('div');
    glitchText.className = 'infected-glitch-overlay';
    glitchText.textContent = messages[Math.floor(Math.random() * messages.length)];
    document.body.appendChild(glitchText);
    
    setTimeout(() => {
        glitchText.remove();
    }, 300);
}

function flashGlitch() {
    const glitchText = document.createElement('div');
    glitchText.className = 'glitch-overlay';
    glitchText.textContent = ['I SEE YOU', '看着你', 'JOIN US', '加入我们', '不要抗拒'][Math.floor(Math.random() * 5)];
    document.body.appendChild(glitchText);
    
    setTimeout(() => {
        glitchText.remove();
    }, 200);
}

// === 新手引导系统 ===
function showTutorial() {
    renderSystemMessage(`欢迎，新员工！

这是您的第一次登录。以下是一些基本操作指南：

1. 使用 SEARCH 功能查找文档
   示例：输入 "SYS-001" 或 "指南"

2. 点击搜索结果可以查看完整文档
   按 ESC 键返回搜索界面

3. 您当前的安全等级是 SCL-1
   更高等级的文档需要更高的访问权限

4. 特殊命令：
   - LOGIN [ID] : 切换用户账号
   - LOGOUT : 退出系统
   - HELP : 显示帮助信息

提示：仔细阅读文档，有些文档中可能隐藏着提升权限的线索。

现在，试试搜索 "SYS-001" 开始您的工作吧。`);
}

// === 音效系统 ===
const AudioSystem = {
    enabled: true,
    sounds: {}
};

function initAudioSystem() {
    // 使用 Web Audio API 生成简单的音效
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    AudioSystem.playBeep = (frequency = 800, duration = 50) => {
        if (!AudioSystem.enabled) return;
        try {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = frequency;
            oscillator.type = 'square';
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + duration / 1000);
        } catch(e) {
            console.log('音效播放失败', e);
        }
    };
    
    AudioSystem.playKeypress = () => {
        AudioSystem.playBeep(1200, 30);
    };
    
    AudioSystem.playError = () => {
        AudioSystem.playBeep(300, 100);
    };
    
    AudioSystem.playSuccess = () => {
        AudioSystem.playBeep(1500, 50);
        setTimeout(() => AudioSystem.playBeep(2000, 50), 100);
    };
    
    // 为输入框添加打字音效
    DOM.inputs.search.addEventListener('keydown', () => {
        if (AudioSystem.enabled) {
            AudioSystem.playKeypress();
        }
    });
    
    DOM.inputs.login.addEventListener('keydown', () => {
        if (AudioSystem.enabled) {
            AudioSystem.playKeypress();
        }
    });
}

// 添加音效开关按钮
function addSoundToggle() {
    const toggle = document.createElement('button');
    toggle.className = 'sound-toggle';
    toggle.textContent = '🔊 音效: 开';
    toggle.addEventListener('click', () => {
        AudioSystem.enabled = !AudioSystem.enabled;
        toggle.textContent = AudioSystem.enabled ? '🔊 音效: 开' : '🔇 音效: 关';
    });
    document.body.appendChild(toggle);
}

// === 启动游戏 ===
init();
// 延迟添加音效开关，避免在初始化时被点击
setTimeout(addSoundToggle, 1000);