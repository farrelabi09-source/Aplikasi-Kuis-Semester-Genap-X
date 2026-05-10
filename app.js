// ============================================================
//  QUIZ APP — app.js
// ============================================================

// --- STATE GLOBAL ---
let allSubjects       = [];
let quizzesCache      = new Map();
let currentQuestionIndex = 0;
let score             = 0;
let userAnswers       = [];
let selectedSubjectId = null;
let activeQuizData    = [];
let timerInterval     = null;
let remainingTime     = 80 * 60;
let audioInitialized  = false;
let isReviewMode      = false;
let isUserMuted       = true;

const HIGH_VOLUME = 1.0;
const LOW_VOLUME  = 0.7;

// --- REFERENSI DOM ---
const menuContainer          = document.getElementById('menu-container');
const quizContainer          = document.getElementById('quiz-container');
const scoreContainer         = document.getElementById('score-container');
const subjectButtonContainer = document.getElementById('subject-button-container');
const startBtn               = document.getElementById('start-btn');
const quizTitle              = document.getElementById('quiz-title');
const questionCounter        = document.getElementById('question-counter');
const questionText           = document.getElementById('question-text');
const optionsContainer       = document.getElementById('options-container');
const explanationBox         = document.getElementById('explanation-box');
const explanationText        = document.getElementById('explanation-text');
const prevBtn                = document.getElementById('prev-btn');
const nextBtn                = document.getElementById('next-btn');
const finishBtn              = document.getElementById('finish-btn');
const reviewBackBtn          = document.getElementById('review-back-btn');
const backToMenuQuizBtn      = document.getElementById('back-to-menu-quiz-btn');
const scoreText              = document.getElementById('score-text');
const resetBtn               = document.getElementById('reset-btn');
const backToMenuScoreBtn     = document.getElementById('back-to-menu-score-btn');
const reviewBtn              = document.getElementById('review-btn');
const bgMusic                = document.getElementById('bg-music');
const musicToggleButtonFloating  = document.getElementById('music-toggle-btn-floating');
const themeToggleButtonFloating  = document.getElementById('theme-toggle-btn-floating');
const modalBackdropNav       = document.getElementById('modal-backdrop-nav');
const modalContainerNav      = document.getElementById('modal-container-nav');
const openNavBtn             = document.getElementById('open-nav-btn');
const closeNavBtn            = document.getElementById('close-nav-btn');
const modalNavTitle          = document.getElementById('modal-nav-title');
const quizNavPanel           = document.getElementById('quiz-nav-panel');
const desktopNavPanel        = document.getElementById('desktop-nav-panel');
const modalBackdropFinish    = document.getElementById('modal-backdrop-finish');
const modalContainerFinish   = document.getElementById('modal-container-finish');
const confirmFinishBtn       = document.getElementById('confirm-finish-btn');
const cancelFinishBtn        = document.getElementById('cancel-finish-btn');
const timerDisplay           = document.getElementById('timer-display');
const loadingSpinner         = document.getElementById('loading-spinner');
const questionLoadingSpinner = document.getElementById('question-loading-spinner');
const questionArea           = document.getElementById('question-area');
const passageContainer       = document.getElementById('passage-container');
const passageTitleEl         = document.getElementById('passage-title');
const passageContentEl       = document.getElementById('passage-content');

// --- AUDIO (TONE.JS SFX) ---
const popSfxHigh = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.1 } }).toDestination();
const popSfxMid  = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.1 } }).toDestination();
const popSfxLow  = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.1 } }).toDestination();
const correctSfx = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 } }).toDestination();
const wrongSfx   = new Tone.FMSynth({ harmonicity: 8, modulationIndex: 2, oscillator: { type: 'square' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.1 } }).toDestination();
const alarmSfx   = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.2 } }).toDestination();

// --- FUNGSI AUDIO ---
async function initAudio() {
    if (audioInitialized) return;
    try {
        await Tone.start();
        bgMusic.volume = HIGH_VOLUME;
        audioInitialized = true;
    } catch (e) {
        console.warn("Audio gagal dimulai.", e);
    }
}

function setMusicVolume(vol) {
    if (!isUserMuted) bgMusic.volume = vol;
}

function updateMusicState(muted) {
    isUserMuted = muted;
    bgMusic.muted = muted;
    musicToggleButtonFloating.classList.toggle('is-unmuted', !muted);
    musicToggleButtonFloating.classList.toggle('is-muted', muted);
}

async function firstInteractionHandler() {
    document.body.removeEventListener('click', firstInteractionHandler);
    document.body.removeEventListener('touchstart', firstInteractionHandler);
    if (!audioInitialized) {
        await initAudio();
        bgMusic.play().catch(e => console.warn("Play on tap failed:", e));
    }
}

// --- TIMER ---
function updateTimer() {
    const m = Math.floor(remainingTime / 60).toString().padStart(2, '0');
    const s = (remainingTime % 60).toString().padStart(2, '0');
    timerDisplay.textContent = `${m}:${s}`;
    if (remainingTime <= 300) {
        timerDisplay.classList.add('text-red-600', 'bg-red-100');
    }
    if (remainingTime <= 0) {
        clearInterval(timerInterval);
        alarmSfx.triggerAttackRelease('A5', '8n', Tone.now());
        alarmSfx.triggerAttackRelease('A5', '8n', Tone.now() + 0.4);
        alarmSfx.triggerAttackRelease('A5', '8n', Tone.now() + 0.8);
        showScore();
    }
    remainingTime--;
}

// --- NAVIGASI LAYAR ---
async function startQuiz(subjectId) {
    isReviewMode = false;
    await initAudio();
    popSfxHigh.triggerAttackRelease('C6', '16n', Tone.now());

    menuContainer.classList.add('opacity-0');
    questionArea.classList.add('opacity-0');
    questionLoadingSpinner.classList.remove('hidden');
    passageContainer.classList.add('hidden');

    setTimeout(async () => {
        menuContainer.classList.add('hidden');
        quizContainer.classList.remove('hidden');
        setTimeout(() => quizContainer.classList.remove('opacity-0'), 10);
        setMusicVolume(LOW_VOLUME);

        try {
            let flatQuestions = [];
            if (quizzesCache.has(subjectId)) {
                flatQuestions = quizzesCache.get(subjectId);
            } else {
                const response = await fetch(`./data/${subjectId}.json`);
                if (!response.ok) throw new Error(`File data/${subjectId}.json tidak ditemukan.`);
                const fetchedData = await response.json();

                if (fetchedData.length > 0 && fetchedData[0].questions) {
                    fetchedData.forEach(group => {
                        group.questions.forEach(q => {
                            flatQuestions.push({ ...q, passageTitle: group.passageTitle, passageText: group.passageText });
                        });
                    });
                } else {
                    flatQuestions = fetchedData;
                }
                quizzesCache.set(subjectId, flatQuestions);
            }

            activeQuizData = flatQuestions;
            const subject = allSubjects.find(s => s.id === subjectId);
            quizTitle.textContent = subject.title;

            currentQuestionIndex = 0;
            score = 0;
            userAnswers = new Array(activeQuizData.length).fill(null);

            generateQuestionPanel();
            remainingTime = 80 * 60;
            if (timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(updateTimer, 1000);
            updateTimer();

            loadQuestion().then(() => {
                questionLoadingSpinner.classList.add('hidden');
                questionArea.classList.remove('opacity-0');
            });

        } catch (error) {
            console.error("Gagal memuat kuis:", error);
            alert("Gagal memuat data kuis. Pastikan file .json ada di folder /data/.");
            goToMenu();
        }
    }, 300);
}

function goToMenu() {
    isReviewMode = false;
    setMusicVolume(HIGH_VOLUME);
    if (timerInterval) clearInterval(timerInterval);

    const activeContainer = !quizContainer.classList.contains('hidden') ? quizContainer : scoreContainer;
    activeContainer.classList.add('opacity-0');

    setTimeout(() => {
        activeContainer.classList.add('hidden');
        menuContainer.classList.remove('hidden');
        setTimeout(() => menuContainer.classList.remove('opacity-0'), 10);
    }, 300);
}

async function restartQuiz() {
    isReviewMode = false;
    await initAudio();
    popSfxHigh.triggerAttackRelease('C6', '16n', Tone.now());

    scoreContainer.classList.add('opacity-0');
    setTimeout(() => {
        scoreContainer.classList.add('hidden');
        quizContainer.classList.remove('hidden');
        questionArea.classList.add('opacity-0');
        questionLoadingSpinner.classList.remove('hidden');
        setTimeout(() => quizContainer.classList.remove('opacity-0'), 10);

        currentQuestionIndex = 0;
        score = 0;
        userAnswers = new Array(activeQuizData.length).fill(null);

        generateQuestionPanel();
        remainingTime = 80 * 60;
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(updateTimer, 1000);
        updateTimer();

        loadQuestion().then(() => {
            questionLoadingSpinner.classList.add('hidden');
            questionArea.classList.remove('opacity-0');
        });

        setMusicVolume(LOW_VOLUME);
    }, 300);
}

function calculateScore() {
    score = 0;
    for (let i = 0; i < activeQuizData.length; i++) {
        if (userAnswers[i] === activeQuizData[i].correctAnswer) score++;
    }
}

function showScore() {
    if (!isReviewMode) calculateScore();

    quizContainer.classList.add('opacity-0');
    closeFinishModal(false);

    setTimeout(() => {
        quizContainer.classList.add('hidden');
        scoreContainer.classList.remove('hidden');
        setTimeout(() => scoreContainer.classList.remove('opacity-0'), 10);

        scoreText.textContent = `${score} / ${activeQuizData.length}`;
        isReviewMode = false;
        setMusicVolume(HIGH_VOLUME);
        if (timerInterval) clearInterval(timerInterval);
        closeNavModal(false);
    }, 300);
}

function startReview() {
    isReviewMode = true;
    currentQuestionIndex = 0;

    scoreContainer.classList.add('opacity-0');
    setTimeout(() => {
        scoreContainer.classList.add('hidden');
        quizContainer.classList.remove('hidden');
        questionArea.classList.add('opacity-0');
        setTimeout(() => quizContainer.classList.remove('opacity-0'), 10);
        setMusicVolume(LOW_VOLUME);
        loadQuestion().then(() => {
            questionArea.classList.remove('opacity-0');
        });
    }, 300);
}

// --- PANEL NAVIGASI SOAL ---
function generateQuestionPanel() {
    quizNavPanel.innerHTML = '';
    desktopNavPanel.innerHTML = '';

    for (let i = 0; i < activeQuizData.length; i++) {
        const button = document.createElement('button');
        button.textContent = i + 1;
        button.className = 'q-nav-btn q-nav-unanswered';
        button.dataset.index = i;
        button.addEventListener('click', () => jumpToQuestion(i, true));

        const desktopButton = button.cloneNode(true);
        desktopButton.addEventListener('click', () => jumpToQuestion(i, false));

        quizNavPanel.appendChild(button);
        desktopNavPanel.appendChild(desktopButton);
    }
}

function updateQuestionPanelState() {
    document.querySelectorAll('.q-nav-btn').forEach(button => {
        const index = parseInt(button.dataset.index);
        if (isNaN(index)) return;

        button.className = 'q-nav-btn';
        if (index === currentQuestionIndex) {
            button.classList.add('q-nav-active');
        } else if (userAnswers[index] !== null) {
            if (isReviewMode) {
                const isCorrect = (userAnswers[index] === activeQuizData[index].correctAnswer);
                button.classList.add(isCorrect ? 'q-nav-answered' : 'q-nav-wrong-answered');
            } else {
                button.classList.add('q-nav-answered-quiz');
            }
        } else {
            button.classList.add('q-nav-unanswered');
        }
    });
}

function jumpToQuestion(index, fromModal = false) {
    popSfxHigh.triggerAttackRelease('C6', '16n', Tone.now());
    questionArea.classList.add('opacity-0');
    setTimeout(() => {
        currentQuestionIndex = index;
        loadQuestion().then(() => {
            setTimeout(() => questionArea.classList.remove('opacity-0'), 10);
        });
    }, 300);
    if (fromModal) closeNavModal(false);
}

// --- LOAD SOAL ---
function loadQuestion() {
    explanationBox.classList.add('hidden');
    optionsContainer.innerHTML = '';
    const questionData = activeQuizData[currentQuestionIndex];

    if (questionData.passageText) {
        passageTitleEl.innerHTML = questionData.passageTitle;
        passageContentEl.innerHTML = questionData.passageText;
        passageContainer.classList.remove('hidden');
    } else {
        passageContainer.classList.add('hidden');
    }

    questionText.innerHTML = questionData.question;
    questionCounter.textContent = `Soal ${currentQuestionIndex + 1} dari ${activeQuizData.length}`;

    questionData.options.forEach((option, index) => {
        const button = document.createElement('button');
        const letter = String.fromCharCode(65 + index);
        button.innerHTML = `${letter}. ${option}`;
        button.className = 'option-btn border border-slate-300 rounded-lg p-3 text-left w-full transition-all duration-200 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500';
        if (!isReviewMode) {
            button.addEventListener('click', () => handleAnswer(index));
        }
        optionsContainer.appendChild(button);
    });

    updateNavButtons();
    updateQuestionPanelState();

    if (isReviewMode) {
        timerDisplay.classList.add('hidden');
        showFeedback(userAnswers[currentQuestionIndex] !== null ? userAnswers[currentQuestionIndex] : -1);
    } else {
        timerDisplay.classList.remove('hidden');
        explanationBox.classList.add('hidden');
        const selectedAnswer = userAnswers[currentQuestionIndex];
        if (selectedAnswer !== null) {
            const buttons = optionsContainer.getElementsByTagName('button');
            if (buttons[selectedAnswer]) {
                buttons[selectedAnswer].classList.add('selected-answer');
            }
        }
    }

    if (window.MathJax) {
        return MathJax.typesetPromise([questionText, optionsContainer]).catch(err => console.log('MathJax error:', err));
    } else {
        return Promise.resolve();
    }
}

function handleAnswer(selectedOptionIndex) {
    popSfxMid.triggerAttackRelease('G5', '16n', Tone.now());
    userAnswers[currentQuestionIndex] = selectedOptionIndex;

    const buttons = optionsContainer.getElementsByTagName('button');
    for (let i = 0; i < buttons.length; i++) {
        buttons[i].classList.remove('selected-answer');
    }
    buttons[selectedOptionIndex].classList.add('selected-answer');
    updateQuestionPanelState();
}

function showFeedback(selectedOptionIndex) {
    const correctAnswerIndex = activeQuizData[currentQuestionIndex].correctAnswer;
    const questionData = activeQuizData[currentQuestionIndex];
    const buttons = optionsContainer.getElementsByTagName('button');

    for (let i = 0; i < buttons.length; i++) {
        buttons[i].disabled = true;
        if (i === correctAnswerIndex) buttons[i].classList.add('correct-answer');
        else if (i === selectedOptionIndex) buttons[i].classList.add('wrong-answer');
    }

    const isCorrect = (selectedOptionIndex === correctAnswerIndex);
    if (isCorrect) {
        explanationText.innerHTML = `<strong>Penjelasan:</strong> ${questionData.explanation}`;
        explanationBox.className = 'mt-4 p-4 rounded-lg border explanation-correct';
    } else {
        const correctLetter = String.fromCharCode(65 + correctAnswerIndex);
        if (selectedOptionIndex === -1) {
            explanationText.innerHTML = `<strong>Anda tidak menjawab.</strong> Jawaban benar: ${correctLetter}.<br><br><strong>Penjelasan:</strong> ${questionData.explanation}`;
        } else {
            explanationText.innerHTML = `<strong>Jawaban benar: ${correctLetter}.</strong><br><br><strong>Penjelasan:</strong> ${questionData.explanation}`;
        }
        explanationBox.className = 'mt-4 p-4 rounded-lg border explanation-wrong';
    }
    explanationBox.classList.remove('hidden');
    updateQuestionPanelState();

    if (window.MathJax) {
        MathJax.typesetPromise([explanationBox]).catch(err => console.log('MathJax error:', err));
    }
}

function updateNavButtons() {
    prevBtn.disabled = (currentQuestionIndex === 0);

    if (isReviewMode) {
        finishBtn.classList.add('hidden');
        reviewBackBtn.classList.remove('hidden');
        if (currentQuestionIndex === activeQuizData.length - 1) {
            nextBtn.classList.add('hidden');
        } else {
            nextBtn.classList.remove('hidden');
            nextBtn.textContent = 'Berikutnya';
            nextBtn.disabled = false;
        }
    } else {
        finishBtn.classList.remove('hidden');
        reviewBackBtn.classList.add('hidden');
        nextBtn.classList.remove('hidden');
        nextBtn.disabled = (currentQuestionIndex === activeQuizData.length - 1);
        nextBtn.textContent = 'Berikutnya';
    }
}

// --- BUILD TOMBOL MATA PELAJARAN ---
function buildSubjectButtons(subjects) {
    subjectButtonContainer.innerHTML = '';
    let isFirst = true;

    subjects.forEach(subject => {
        const button = document.createElement('button');
        button.id = `subject-${subject.id}`;
        button.textContent = subject.title;
        button.className = `subject-btn w-full p-4 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all ${isFirst ? 'subject-active' : 'subject-inactive'}`;

        button.addEventListener('click', async () => {
            await firstInteractionHandler();
            popSfxHigh.triggerAttackRelease('C6', '16n', Tone.now());
            selectedSubjectId = subject.id;

            document.querySelectorAll('.subject-btn').forEach(btn => {
                btn.classList.remove('subject-active');
                btn.classList.add('subject-inactive');
            });
            button.classList.add('subject-active');
            button.classList.remove('subject-inactive');
        });

        subjectButtonContainer.appendChild(button);

        if (isFirst) {
            selectedSubjectId = subject.id;
            isFirst = false;
        }
    });
}

async function loadSubjects() {
    try {
        const response = await fetch('./subjects.json');
        if (!response.ok) throw new Error('subjects.json tidak ditemukan.');
        allSubjects = await response.json();

        if (allSubjects.length === 0) throw new Error("Tidak ada pelajaran di subjects.json");

        buildSubjectButtons(allSubjects);
        loadingSpinner.classList.add('hidden');
        subjectButtonContainer.classList.remove('hidden');
        startBtn.classList.remove('hidden');

    } catch (error) {
        console.error("Error memuat daftar pelajaran:", error);
        loadingSpinner.innerHTML = `
            <strong class="text-red-600">Error: Gagal Memuat Daftar Pelajaran</strong>
            <p class="mt-2 text-sm text-slate-600">Pastikan file <strong>subjects.json</strong> ada di folder yang sama dengan index.html.</p>`;
    }
}

// --- MODAL NAVIGASI ---
function openNavModal() {
    popSfxHigh.triggerAttackRelease('C6', '16n', Tone.now());
    modalNavTitle.textContent = quizTitle.textContent;
    modalBackdropNav.classList.remove('hidden');
    modalContainerNav.classList.remove('hidden');
    setTimeout(() => {
        modalBackdropNav.classList.remove('opacity-0');
        modalContainerNav.classList.remove('opacity-0');
    }, 10);
}

function closeNavModal(withSound = true) {
    if (withSound) popSfxLow.triggerAttackRelease('C5', '16n', Tone.now());
    modalBackdropNav.classList.add('opacity-0');
    modalContainerNav.classList.add('opacity-0');
    setTimeout(() => {
        modalBackdropNav.classList.add('hidden');
        modalContainerNav.classList.add('hidden');
    }, 300);
}

// --- MODAL SELESAI ---
function openFinishModal() {
    popSfxHigh.triggerAttackRelease('C6', '16n', Tone.now());
    modalBackdropFinish.classList.remove('hidden');
    modalContainerFinish.classList.remove('hidden');
    setTimeout(() => {
        modalBackdropFinish.classList.remove('opacity-0');
        modalContainerFinish.classList.remove('opacity-0');
    }, 10);
}

function closeFinishModal(withSound = true) {
    if (withSound) popSfxLow.triggerAttackRelease('C5', '16n', Tone.now());
    modalBackdropFinish.classList.add('opacity-0');
    modalContainerFinish.classList.add('opacity-0');
    setTimeout(() => {
        modalBackdropFinish.classList.add('hidden');
        modalContainerFinish.classList.add('hidden');
    }, 300);
}

// --- TEMA ---
function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark');
    } else {
        document.body.classList.remove('dark');
    }
    themeToggleButtonFloating.classList.toggle('active', theme === 'light');
    initParticles();
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        applyTheme(savedTheme);
    } else if (window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        applyTheme(mediaQuery.matches ? 'dark' : 'light');
        mediaQuery.addEventListener('change', e => {
            if (!localStorage.getItem('theme')) applyTheme(e.matches ? 'dark' : 'light');
        });
    } else {
        applyTheme('light');
    }
}

// --- PARTIKEL CANVAS ---
const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');
let particles = [];

function resizeCanvas() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
}

function initParticles() {
    particles = [];
    const isDark = document.body.classList.contains('dark');
    const count  = Math.floor((canvas.width * canvas.height) / 15000);
    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 2 + 0.5,
            dx: (Math.random() - 0.5) * 0.4,
            dy: (Math.random() - 0.5) * 0.4,
            color: isDark ? `rgba(148,163,184,${Math.random() * 0.3 + 0.1})` : `rgba(100,116,139,${Math.random() * 0.2 + 0.05})`
        });
    }
}

function animateCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0 || p.x > canvas.width)  p.dx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
    });
    requestAnimationFrame(animateCanvas);
}

// ============================================================
//  INIT
// ============================================================
window.addEventListener('load', () => {
    loadTheme();
    resizeCanvas();
    initParticles();
    animateCanvas();
    window.addEventListener('resize', () => { resizeCanvas(); initParticles(); });
    loadSubjects();

    bgMusic.play().catch(e => console.warn("Autoplay (muted) gagal.", e));
    updateMusicState(isUserMuted);

    document.body.addEventListener('click', firstInteractionHandler);
    document.body.addEventListener('touchstart', firstInteractionHandler);
});

// --- EVENT LISTENERS ---
startBtn.addEventListener('click', async () => {
    await initAudio();
    if (selectedSubjectId) {
        startQuiz(selectedSubjectId);
    } else {
        alert("Silakan pilih mata pelajaran terlebih dahulu.");
    }
});

nextBtn.addEventListener('click', () => {
    popSfxHigh.triggerAttackRelease('C6', '16n', Tone.now());
    questionArea.classList.add('opacity-0');
    setTimeout(() => {
        currentQuestionIndex++;
        loadQuestion().then(() => { setTimeout(() => questionArea.classList.remove('opacity-0'), 10); });
    }, 300);
});

prevBtn.addEventListener('click', () => {
    popSfxLow.triggerAttackRelease('C5', '16n', Tone.now());
    questionArea.classList.add('opacity-0');
    setTimeout(() => {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            loadQuestion().then(() => { setTimeout(() => questionArea.classList.remove('opacity-0'), 10); });
        } else {
            questionArea.classList.remove('opacity-0');
        }
    }, 300);
});

finishBtn.addEventListener('click', openFinishModal);
reviewBackBtn.addEventListener('click', showScore);
backToMenuQuizBtn.addEventListener('click', goToMenu);

reviewBtn.addEventListener('click', startReview);
resetBtn.addEventListener('click', restartQuiz);
backToMenuScoreBtn.addEventListener('click', goToMenu);

musicToggleButtonFloating.addEventListener('click', async () => {
    await initAudio();
    const newMuteState = !isUserMuted;
    updateMusicState(newMuteState);
    if (!newMuteState && quizContainer.classList.contains('hidden')) {
        setMusicVolume(HIGH_VOLUME);
    } else if (!newMuteState && !quizContainer.classList.contains('hidden')) {
        setMusicVolume(LOW_VOLUME);
    }
});

themeToggleButtonFloating.addEventListener('click', () => {
    const currentTheme = document.body.classList.contains('dark') ? 'dark' : 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
});

openNavBtn.addEventListener('click', openNavModal);
closeNavBtn.addEventListener('click', () => closeNavModal(true));
modalBackdropNav.addEventListener('click', () => closeNavModal(true));

cancelFinishBtn.addEventListener('click', () => closeFinishModal(true));
modalBackdropFinish.addEventListener('click', () => closeFinishModal(true));
confirmFinishBtn.addEventListener('click', () => {
    popSfxHigh.triggerAttackRelease('C6', '16n', Tone.now());
    closeFinishModal(false);
    showScore();
});
