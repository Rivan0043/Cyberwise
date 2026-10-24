/* ==========================================================================
   CYBERWISE — CORE LOGIC & ENGINE
   ========================================================================== */

// STATE MANAGEMENT
let appState = {
    userScore: 0,
    currentCaseIndex: 0,
    completedCases: 0,
    correctAnswersCount: 0,
    unlockedBadges: [],
    casesData: []
};

// AUDIO SYNTHESIZER (WEB AUDIO API)
const AudioEngine = {
    ctx: null,
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },
    playTone(freq, type = 'sine', duration = 0.15) {
        try {
            this.init();
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) { console.log('Audio disabled'); }
    },
    playSuccess() { this.playTone(587.33, 'sine', 0.1); setTimeout(() => this.playTone(880, 'sine', 0.2), 100); },
    playError() { this.playTone(150, 'sawtooth', 0.25); },
    playClick() { this.playTone(400, 'triangle', 0.05); }
};

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    loadCasesData();
    loadBadges();
    updateDashboardUI();
});

// NAVIGATION TAB SWITCHER
function initNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            AudioEngine.playClick();
            const tabId = btn.getAttribute('data-tab');
            switchTab(tabId);
        });
    });
}

function switchTab(tabId) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

    const activeBtn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
    const activePane = document.getElementById(`tab-${tabId}`);

    if (activeBtn) activeBtn.classList.add('active');
    if (activePane) activePane.classList.add('active');

    if (tabId === 'dashboard') updateDashboardUI();
}

// FETCH DATA CASUS DARI JSON
async function loadCasesData() {
    try {
        const response = await fetch('data/cases.json');
        appState.casesData = await response.json();
        renderCurrentCase();
    } catch (error) {
        console.error("Gagal memuat data kasus:", error);
        document.getElementById('case-title').innerText = "Gagal Memuat Data Kasus";
    }
}

// RENDER CASE SIMULATOR
function renderCurrentCase() {
    if (!appState.casesData.length) return;
    
    const currentCase = appState.casesData[appState.currentCaseIndex];
    if (!currentCase) {
        renderCompletionState();
        return;
    }

    // Update Header Case
    document.getElementById('case-sender-name').innerText = currentCase.sender;
    document.getElementById('case-difficulty-tag').innerText = `Level ${currentCase.level}`;
    document.getElementById('case-title').innerText = currentCase.title;
    document.getElementById('case-description').innerText = currentCase.description;

    // Render Message HTML
    document.getElementById('case-message-body').innerHTML = currentCase.messageHtml;

    // Reset Feed & Explanation
    document.getElementById('inspection-feedback').innerHTML = `<span class="feed-placeholder">Klik elemen bergaris putus-putus pada pesan untuk menginspeksi!</span>`;
    const expBox = document.getElementById('explanation-box');
    expBox.classList.add('hidden');
    expBox.className = 'explanation-box hidden';

    // Render Options
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';
    currentCase.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = `${String.fromCharCode(65 + idx)}. ${opt.text}`;
        btn.onclick = () => evaluateAnswer(idx);
        optionsContainer.appendChild(btn);
    });
}

// INSPECT ELEMENT CLICK HANDLER
function inspectElement(type, text, detail) {
    AudioEngine.playClick();
    const feed = document.getElementById('inspection-feedback');
    feed.innerHTML = `<strong>[HASIL INSPEKSI - ${type.toUpperCase()}]</strong><br>Item: <em>"${text}"</em><br>🔍 ${detail}`;
}

// EVALUASI JAWABAN
function evaluateAnswer(selectedIdx) {
    const currentCase = appState.casesData[appState.currentCaseIndex];
    const isCorrect = selectedIdx === currentCase.correctIndex;
    const expBox = document.getElementById('explanation-box');
    const expStatus = document.getElementById('exp-status');
    const expText = document.getElementById('exp-text');

    expBox.classList.remove('hidden');

    if (isCorrect) {
        AudioEngine.playSuccess();
        expBox.classList.add('correct');
        expStatus.innerText = '✅ JAWABAN TEPAT (+100 Poin)';
        expStatus.style.color = 'var(--accent-green)';
        appState.userScore += 100;
        appState.correctAnswersCount++;
    } else {
        AudioEngine.playError();
        expBox.classList.add('wrong');
        expStatus.innerText = '❌ JAWABAN KURANG TEPAT';
        expStatus.style.color = 'var(--accent-red)';
    }

    expText.innerText = currentCase.explanation;
    
    // Disable option buttons after choice
    document.querySelectorAll('.option-btn').forEach(btn => btn.disabled = true);
    
    // Track Progress
    appState.completedCases++;
    checkBadgeUnlocks();
    updateDashboardUI();
}

function nextCase() {
    AudioEngine.playClick();
    appState.currentCaseIndex++;
    if (appState.currentCaseIndex < appState.casesData.length) {
        renderCurrentCase();
    } else {
        renderCompletionState();
    }
}

function renderCompletionState() {
    document.getElementById('case-title').innerText = " 🎉 Selamat! Seluruh Simulasi Selesai";
    document.getElementById('case-description').innerText = "Kamu telah menyelesaikan seluruh tingkat simulasi kewaspadaan siber.";
    document.getElementById('case-message-body').innerHTML = `<div style="text-align:center; padding:2rem;"><h3>Skor Akhir: ${appState.userScore}</h3><p>Buka tab "Pencapaian" untuk mengunduh sertifikat resmi milikmu!</p></div>`;
    document.getElementById('options-container').innerHTML = `<button class="btn btn-primary" onclick="switchTab('achievements')">🏆 Buka Sertifikat Saya</button>`;
    document.getElementById('explanation-box').classList.add('hidden');
}

// TEXT CHECKER ALGORITHM (RISK SCORE)
function analyzeText() {
    AudioEngine.playClick();
    const input = document.getElementById('checker-input').value.trim();
    if (!input) return;

    let score = 0;
    const indicators = [];

    // Rules
    if (/https?:\/\/(bit\.ly|tinyurl\.com|t\.co|cutt\.ly)/i.test(input)) {
        score += 35;
        indicators.push("Menggunakan penyingkat URL anonim (bit.ly/tinyurl).");
    }
    if (/(menang|hadiah|gratis|cashback|ratusan juta|undian)/i.test(input)) {
        score += 25;
        indicators.push("Iming-iming finansial/hadiah mencurigakan.");
    }
    if (/(segera|1x24 jam|terblokir|sebelum dibekukan|mendesak)/i.test(input)) {
        score += 20;
        indicators.push("Gaya bahasa mendesak yang memicu kepanikan.");
    }
    if (/(klik link|isi formulir|transfer|masukkan pin|otp)/i.test(input)) {
        score += 20;
        indicators.push("Mengarahkan tindakan berbahaya (minta OTP/Pin/Transfer).");
    }

    // Display Result
    const resPanel = document.getElementById('checker-result');
    const scoreVal = document.getElementById('risk-score-value');
    const levelLabel = document.getElementById('risk-level-label');
    const circle = document.getElementById('score-circle');
    const ul = document.getElementById('indicators-ul');

    resPanel.classList.remove('hidden');
    scoreVal.innerText = `${score}%`;
    ul.innerHTML = '';

    if (score >= 60) {
        circle.style.borderColor = 'var(--accent-red)';
        levelLabel.innerText = "Tingkat Risiko: BAHAYA / PHISHING";
        levelLabel.style.color = 'var(--accent-red)';
    } else if (score >= 25) {
        circle.style.borderColor = 'var(--accent-amber)';
        levelLabel.innerText = "Tingkat Risiko: MENCURIGAKAN";
        levelLabel.style.color = 'var(--accent-amber)';
    } else {
        circle.style.borderColor = 'var(--accent-green)';
        levelLabel.innerText = "Tingkat Risiko: AMAN";
        levelLabel.style.color = 'var(--accent-green)';
    }

    if (indicators.length === 0) {
        ul.innerHTML = '<li>Teks tidak memiliki pola frasa indikator bahaya umum.</li>';
    } else {
        indicators.forEach(ind => {
            const li = document.createElement('li');
            li.innerText = ind;
            ul.appendChild(li);
        });
    }
}

// DASHBOARD UI UPDATE
function updateDashboardUI() {
    document.getElementById('dash-score').innerText = appState.userScore;
    document.getElementById('dash-completed').innerText = `${appState.completedCases}/${appState.casesData.length || 4}`;
    const acc = appState.completedCases > 0 ? Math.round((appState.correctAnswersCount / appState.completedCases) * 100) : 0;
    document.getElementById('dash-accuracy').innerText = `${acc}%`;
}

// BADGES & CERTIFICATE SYSTEM
const BADGES = [
    { id: 'b1', name: 'Phishing Hunter', desc: 'Selesaikan Kasus Pertama', icon: '🎯' },
    { id: 'b2', name: 'Fact Checker Master', desc: 'Akurasi Jawaban 100%', icon: '🕵️‍♂️' },
    { id: 'b3', name: 'Cyber Sentinel', desc: 'Raih Skor Minimal 300', icon: '🛡️' }
];

function loadBadges() {
    const container = document.getElementById('badges-container');
    container.innerHTML = '';
    BADGES.forEach(b => {
        const isUnlocked = appState.unlockedBadges.includes(b.id);
        const card = document.createElement('div');
        card.className = `badge-card ${isUnlocked ? 'unlocked' : ''}`;
        card.innerHTML = `
            <div class="b-icon">${b.icon}</div>
            <h4>${b.name}</h4>
            <p style="font-size:0.8rem; color:var(--text-secondary);">${b.desc}</p>
        `;
        container.appendChild(card);
    });
}

function checkBadgeUnlocks() {
    if (appState.completedCases >= 1 && !appState.unlockedBadges.includes('b1')) {
        appState.unlockedBadges.push('b1');
    }
    if (appState.correctAnswersCount >= 3 && !appState.unlockedBadges.includes('b2')) {
        appState.unlockedBadges.push('b2');
    }
    if (appState.userScore >= 300 && !appState.unlockedBadges.includes('b3')) {
        appState.unlockedBadges.push('b3');
    }
    loadBadges();
}

// CANVAS CERTIFICATE GENERATOR (HD 1200x840)
function generateCertificate() {
    AudioEngine.playSuccess();
    const nameInput = document.getElementById('cert-user-name').value.trim() || 'Peserta CyberWise';
    const canvas = document.getElementById('cert-canvas');
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 1200, 840);

    // Outer Border
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 12;
    ctx.strokeRect(30, 30, 1140, 780);

    // Inner Line
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(45, 45, 1110, 750);

    // Title
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 42px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SERTIFIKAT KOMPETENSI DIGITAL', 600, 150);

    ctx.fillStyle = '#06b6d4';
    ctx.font = '22px "JetBrains Mono", monospace';
    ctx.fillText('CYBERWISE LITERACY INITIATIVE', 600, 195);

    // Body Text
    ctx.fillStyle = '#94a3b8';
    ctx.font = '20px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Diberikan secara resmi kepada:', 600, 290);

    // Participant Name
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 52px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(nameInput.toUpperCase(), 600, 370);

    // Description
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '20px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Atas keberhasilan menyelesaikan seluruh modul Simulasi & Evaluasi', 600, 460);
    ctx.fillText('Deteksi Hoaks, Phishing, dan Rekayasa Sosial Digital.', 600, 495);

    // Score & Date
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 28px "JetBrains Mono", monospace';
    ctx.fillText(`TOTAL SKOR: ${appState.userScore} POIN`, 600, 580);

    ctx.fillStyle = '#64748b';
    ctx.font = '16px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`Diterbitkan pada: ${new Date().toLocaleDateString('id-ID')}`, 600, 620);

    // Signatures
    ctx.strokeStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(350, 720); ctx.lineTo(500, 720);
    ctx.moveTo(700, 720); ctx.lineTo(850, 720);
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Tim Penguji CyberWise', 425, 745);
    ctx.fillText('Direktur Literasi Digital', 775, 745);

    // Show Output
    document.getElementById('canvas-wrapper').classList.remove('hidden');
    document.getElementById('download-cert-btn').href = canvas.toDataURL('image/png');
}
