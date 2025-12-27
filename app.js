class QuestionBank {
    constructor() {
        this.questions = [];
        this.wrongQuestions = this.loadWrongQuestions();
        this.currentIndex = 0;
        this.practiceQueue = [];
        this.examAnswers = [];
        this.markedQuestions = new Set();
        this.examStartTime = null;
        this.examTimer = null;
        this.importedData = null;
        this.practiceAnswers = [];
        this.practiceResults = [];
        this.currentQuestionType = null;
        this.practiceRecords = this.loadPracticeRecords();
    }

    loadWrongQuestions() {
        try {
            const data = localStorage.getItem('wrongQuestions');
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('加载错题失败:', e);
            return [];
        }
    }

    loadPracticeRecords() {
        try {
            const data = localStorage.getItem('practiceRecords');
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('加载练习记录失败:', e);
            return [];
        }
    }

    savePracticeRecords() {
        try {
            localStorage.setItem('practiceRecords', JSON.stringify(this.practiceRecords));
        } catch (e) {
            console.error('保存练习记录失败:', e);
        }
    }

    saveWrongQuestions() {
        try {
            localStorage.setItem('wrongQuestions', JSON.stringify(this.wrongQuestions));
        } catch (e) {
            console.error('保存错题失败:', e);
        }
    }

    addWrongQuestion(question) {
        const exists = this.wrongQuestions.find(q => q.id === question.id);
        if (!exists) {
            this.wrongQuestions.push({
                ...question,
                wrongTime: new Date().toISOString(),
                wrongCount: 1
            });
            this.saveWrongQuestions();
            this.updateWrongCount();
        } else {
            exists.wrongCount += 1;
            exists.wrongTime = new Date().toISOString();
            this.saveWrongQuestions();
        }
    }

    removeWrongQuestion(questionId) {
        this.wrongQuestions = this.wrongQuestions.filter(q => q.id !== questionId);
        this.saveWrongQuestions();
        this.updateWrongCount();
    }

    clearWrongQuestions() {
        this.wrongQuestions = [];
        this.saveWrongQuestions();
        this.updateWrongCount();
    }

    updateWrongCount() {
        const count = this.wrongQuestions.length;
        const badge = document.getElementById('wrong-count');
        if (badge) {
            badge.textContent = count;
        }
    }

    importQuestions(data) {
        if (data.questions && Array.isArray(data.questions)) {
            this.questions = data.questions.map(q => ({
                ...q,
                type: q.type || '多选题'
            }));
            return true;
        }
        return false;
    }

    shuffleQuestions() {
        if (this.practiceQueue.length > 0) {
            this.practiceQueue = [...this.practiceQueue].sort(() => Math.random() - 0.5);
        } else {
            this.practiceQueue = [...this.questions].sort(() => Math.random() - 0.5);
        }
    }

    getPracticeQuestion() {
        if (this.practiceQueue.length === 0) {
            this.shuffleQuestions();
        }
        return this.practiceQueue[this.currentIndex];
    }

    getExamQuestions() {
        return [...this.questions].sort(() => Math.random() - 0.5);
    }

    checkAnswer(question, selectedOptions) {
        const correctAnswer = question.right_answer.split('').sort().join('');
        const selected = selectedOptions.sort().join('');
        return correctAnswer === selected;
    }

    getQuestionsByType(type) {
        return this.questions.filter(q => q.type === type);
    }

    startPracticeByType(type) {
        this.currentQuestionType = type;
        this.practiceQueue = this.getQuestionsByType(type);
        this.shuffleQuestions();
        this.currentIndex = 0;
        this.practiceAnswers = new Array(this.practiceQueue.length).fill(null);
        this.practiceResults = new Array(this.practiceQueue.length).fill(null);
        return this.practiceQueue.length > 0;
    }

    recordPracticeAnswer(index, selectedOptions, isCorrect) {
        this.practiceAnswers[index] = selectedOptions;
        this.practiceResults[index] = {
            isCorrect: isCorrect,
            selectedOptions: selectedOptions,
            correctAnswer: this.practiceQueue[index].right_answer
        };
    }

    getPracticeStats() {
        const answered = this.practiceResults.filter(r => r !== null);
        const correct = answered.filter(r => r.isCorrect).length;
        const wrong = answered.length - correct;
        return {
            total: this.practiceQueue.length,
            answered: answered.length,
            correct: correct,
            wrong: wrong,
            rate: answered.length > 0 ? Math.round((correct / answered.length) * 100) : 0
        };
    }

    savePracticeRecord() {
        const stats = this.getPracticeStats();
        const record = {
            id: Date.now(),
            date: new Date().toISOString(),
            type: this.currentQuestionType,
            total: stats.total,
            correct: stats.correct,
            wrong: stats.wrong,
            rate: stats.rate,
            questions: this.practiceQueue.map((q, index) => ({
                question: q.question,
                type: q.type,
                result: this.practiceResults[index]
            }))
        };
        this.practiceRecords.unshift(record);
        if (this.practiceRecords.length > 50) {
            this.practiceRecords = this.practiceRecords.slice(0, 50);
        }
        this.savePracticeRecords();
        return record;
    }
}

class App {
    constructor() {
        this.bank = new QuestionBank();
        this.currentMode = 'home';
        this.examQuestions = [];
        this.examCurrentIndex = 0;
        this.init();
    }

    init() {
        this.bindEvents();
        this.bank.updateWrongCount();
        this.loadDefaultQuestions();
    }

    async loadDefaultQuestions() {
        try {
            const [singleChoiceResponse, multipleChoiceResponse, trueFalseResponse] = await Promise.all([
                fetch('single_choice.json'),
                fetch('multiple_choice.json'),
                fetch('true_false.json')
            ]);

            const singleChoiceData = await singleChoiceResponse.json();
            const multipleChoiceData = await multipleChoiceResponse.json();
            const trueFalseData = await trueFalseResponse.json();

            const allQuestions = [];

            singleChoiceData.questions.forEach((q, index) => {
                allQuestions.push({
                    id: `single_${index}`,
                    question: q.question,
                    type: '单选题',
                    options: q.options.map((opt, i) => ({
                        letter: String.fromCharCode(65 + i),
                        content: opt
                    })),
                    right_answer: q.answer,
                    score: 1
                });
            });

            multipleChoiceData.questions.forEach((q, index) => {
                allQuestions.push({
                    id: `multiple_${index}`,
                    question: q.question,
                    type: '多选题',
                    options: q.options.map((opt, i) => ({
                        letter: String.fromCharCode(65 + i),
                        content: opt
                    })),
                    right_answer: q.answer,
                    score: 2
                });
            });

            trueFalseData.questions.forEach((q, index) => {
                allQuestions.push({
                    id: `truefalse_${index}`,
                    question: q.question,
                    type: '判断题',
                    options: q.options.map((opt, i) => ({
                        letter: String.fromCharCode(65 + i),
                        content: opt
                    })),
                    right_answer: q.answer === '对' ? 'A' : 'B',
                    score: 1
                });
            });

            this.bank.questions = allQuestions;
            this.bank.shuffleQuestions();
            this.updateHomeStats();
        } catch (error) {
            console.error('加载题库失败:', error);
            alert('加载题库失败，请确保JSON文件存在！');
        }
    }

    bindEvents() {
        document.getElementById('btn-home').addEventListener('click', () => this.showPage('home'));
        document.getElementById('btn-practice').addEventListener('click', () => this.showPage('practice'));
        document.getElementById('btn-exam').addEventListener('click', () => this.showPage('exam'));
        document.getElementById('btn-wrong').addEventListener('click', () => this.showPage('wrong'));
        document.getElementById('btn-import').addEventListener('click', () => this.showPage('import'));

        // 添加快速操作按钮事件监听器
        const startSingleBtn = document.getElementById('start-single');
        const startMultipleBtn = document.getElementById('start-multiple');
        const startTruefalseBtn = document.getElementById('start-truefalse');
        
        if (startSingleBtn) startSingleBtn.addEventListener('click', () => this.startPracticeByType('单选题'));
        if (startMultipleBtn) startMultipleBtn.addEventListener('click', () => this.startPracticeByType('多选题'));
        if (startTruefalseBtn) startTruefalseBtn.addEventListener('click', () => this.startPracticeByType('判断题'));

        // 检查并添加其他按钮事件监听器
        const startPracticeBtn = document.getElementById('start-practice');
        const startExamBtn = document.getElementById('start-exam');
        const reviewWrongBtn = document.getElementById('review-wrong');
        const practiceShuffleBtn = document.getElementById('practice-shuffle');
        
        if (startPracticeBtn) startPracticeBtn.addEventListener('click', () => this.startPractice());
        if (startExamBtn) startExamBtn.addEventListener('click', () => this.startExam());
        if (reviewWrongBtn) reviewWrongBtn.addEventListener('click', () => this.reviewWrongQuestions());
        if (practiceShuffleBtn) practiceShuffleBtn.addEventListener('click', () => this.shufflePractice());

        const practiceSubmitBtn = document.getElementById('practice-submit');
        const practiceNextBtn = document.getElementById('practice-next');
        const practicePrevBtn = document.getElementById('practice-prev');
        const practiceAnswerSheetBtn = document.getElementById('practice-answer-sheet');
        const practiceSubmitAllBtn = document.getElementById('practice-submit-all');
        
        if (practiceSubmitBtn) practiceSubmitBtn.addEventListener('click', () => this.submitPracticeAnswer());
        if (practiceNextBtn) practiceNextBtn.addEventListener('click', () => this.nextPracticeQuestion());
        if (practicePrevBtn) practicePrevBtn.addEventListener('click', () => this.prevPracticeQuestion());
        if (practiceAnswerSheetBtn) practiceAnswerSheetBtn.addEventListener('click', () => this.showAnswerSheet());
        if (practiceSubmitAllBtn) practiceSubmitAllBtn.addEventListener('click', () => this.submitAllPractice());

        // 考试模式按钮事件监听器
        const examPrevBtn = document.getElementById('exam-prev');
        const examNextBtn = document.getElementById('exam-next');
        const examMarkBtn = document.getElementById('exam-mark');
        
        if (examPrevBtn) examPrevBtn.addEventListener('click', () => this.prevExamQuestion());
        if (examNextBtn) examNextBtn.addEventListener('click', () => this.nextExamQuestion());
        if (examMarkBtn) examMarkBtn.addEventListener('click', () => this.toggleMarkQuestion());

        // 错题本按钮事件监听器
        const wrongClearBtn = document.getElementById('wrong-clear');
        const wrongExportBtn = document.getElementById('wrong-export');
        
        if (wrongClearBtn) wrongClearBtn.addEventListener('click', () => this.clearWrongQuestions());
        if (wrongExportBtn) wrongExportBtn.addEventListener('click', () => this.exportWrongQuestions());

        // 导入功能按钮事件监听器
        const importBrowseBtn = document.getElementById('import-browse');
        const importFileInput = document.getElementById('import-file');
        
        if (importBrowseBtn && importFileInput) {
            importBrowseBtn.addEventListener('click', () => {
                importFileInput.click();
            });
        }
        
        if (importFileInput) {
            importFileInput.addEventListener('change', (e) => this.handleFileImport(e));
        }

        // 拖放区域事件监听器
        const dropZone = document.getElementById('import-drop-zone');
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('dragover');
            });
            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('dragover');
            });
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragover');
                const file = e.dataTransfer.files[0];
                if (file) this.processFile(file);
            });
        }

        // 导入确认/取消按钮事件监听器
        const importConfirmBtn = document.getElementById('import-confirm');
        const importCancelBtn = document.getElementById('import-cancel');
        
        if (importConfirmBtn) importConfirmBtn.addEventListener('click', () => this.confirmImport());
        if (importCancelBtn) importCancelBtn.addEventListener('click', () => this.cancelImport());

        // 考试结果按钮事件监听器
        const resultReviewBtn = document.getElementById('result-review');
        const examResultHomeBtn = document.getElementById('exam-result-home');
        const examResultModal = document.getElementById('exam-result-modal');
        
        if (resultReviewBtn && examResultModal) {
            resultReviewBtn.addEventListener('click', () => {
                examResultModal.style.display = 'none';
                this.reviewWrongQuestions();
            });
        }
        
        if (examResultHomeBtn && examResultModal) {
            examResultHomeBtn.addEventListener('click', () => {
                examResultModal.style.display = 'none';
                this.showPage('home');
            });
        }

        // 答题卡关闭按钮事件监听器
        const answerSheetCloseBtn = document.getElementById('answer-sheet-close');
        const answerSheetModal = document.getElementById('answer-sheet-modal');
        
        if (answerSheetCloseBtn && answerSheetModal) {
            answerSheetCloseBtn.addEventListener('click', () => {
                answerSheetModal.style.display = 'none';
            });
        }

        // 练习结果按钮事件监听器
        const resultCloseBtn = document.getElementById('result-close');
        const resultRetryBtn = document.getElementById('result-retry');
        const practiceResultModal = document.getElementById('practice-result-modal');
        
        if (resultCloseBtn && practiceResultModal) {
            resultCloseBtn.addEventListener('click', () => {
                practiceResultModal.style.display = 'none';
            });
        }
        
        const practiceResultHomeBtn = document.getElementById('practice-result-home');
        if (practiceResultHomeBtn && practiceResultModal) {
            practiceResultHomeBtn.addEventListener('click', () => {
                practiceResultModal.style.display = 'none';
                this.showPage('home');
            });
        }
        
        if (resultRetryBtn && practiceResultModal) {
            resultRetryBtn.addEventListener('click', () => {
                practiceResultModal.style.display = 'none';
                this.startPracticeByType(this.bank.currentQuestionType);
            });
        }
    }

    showPage(pageId) {
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

        document.getElementById(pageId).classList.add('active');
        document.getElementById(`btn-${pageId}`).classList.add('active');

        this.currentMode = pageId;

        if (pageId === 'home') {
            this.updateHomeStats();
        } else if (pageId === 'wrong') {
            this.renderWrongList();
        } else if (pageId === 'practice') {
            this.bank.shuffleQuestions();
            this.bank.currentIndex = 0;
            this.renderPracticeQuestion();
        } else if (pageId === 'exam') {
            this.startExam();
        }
    }

    updateHomeStats() {
        document.getElementById('total-questions').textContent = this.bank.questions.length;
        document.getElementById('wrong-questions').textContent = this.bank.wrongQuestions.length;

        if (this.bank.questions.length > 0) {
            const correct = this.bank.questions.length - this.bank.wrongQuestions.length;
            const rate = Math.round((correct / this.bank.questions.length) * 100);
            document.getElementById('correct-rate').textContent = rate + '%';
        } else {
            document.getElementById('correct-rate').textContent = '0%';
        }
    }

    startPractice() {
        if (this.bank.questions.length === 0) {
            alert('请先导入题库！');
            return;
        }
        this.bank.shuffleQuestions();
        this.bank.currentIndex = 0;
        this.showPage('practice');
        this.renderPracticeQuestion();
    }

    startPracticeByType(type) {
        if (this.bank.questions.length === 0) {
            alert('请先导入题库！');
            return;
        }
        const success = this.bank.startPracticeByType(type);
        if (!success) {
            alert(`没有找到${type}题目！`);
            return;
        }
        this.showPage('practice');
        this.renderPracticeQuestion();
    }

    shufflePractice() {
        if (this.bank.currentQuestionType) {
            this.bank.startPracticeByType(this.bank.currentQuestionType);
        } else {
            this.bank.shuffleQuestions();
            this.bank.currentIndex = 0;
        }
        this.renderPracticeQuestion();
    }

    renderPracticeQuestion() {
        const question = this.bank.practiceQueue[this.bank.currentIndex];
        if (!question) {
            document.getElementById('practice-question').innerHTML = `
                <div class="empty-state">
                    <span class="icon">📚</span>
                    <h3>题库为空</h3>
                    <p>请先导入题库后再练习</p>
                </div>
            `;
            return;
        }

        const progress = `${this.bank.currentIndex + 1}/${this.bank.practiceQueue.length}`;
        document.getElementById('practice-progress').textContent = progress;

        const stats = this.bank.getPracticeStats();
        document.getElementById('practice-correct').textContent = stats.correct;

        const html = `
            <h3>
                <span class="question-number">${this.bank.currentIndex + 1}.</span>
                <span class="question-type">(${question.type}, ${question.score || '无分值'}分)</span>
                <span class="qtContent">${question.question}</span>
            </h3>
        `;
        document.getElementById('practice-question').innerHTML = html;

        const optionsHtml = question.options.map(opt => `
            <div class="option-item" data-letter="${opt.letter}">
                <span class="option-letter">${opt.letter}</span>
                <span class="option-content">${opt.content}</span>
            </div>
        `).join('');

        document.getElementById('practice-options').innerHTML = optionsHtml;

        document.querySelectorAll('#practice-options .option-item').forEach(item => {
            item.addEventListener('click', () => {
                if (this.bank.practiceResults[this.bank.currentIndex]) return;
                
                const questionType = this.bank.practiceQueue[this.bank.currentIndex].type;
                if (questionType === '单选题' || questionType === '判断题') {
                    document.querySelectorAll('#practice-options .option-item').forEach(i => i.classList.remove('selected'));
                    item.classList.add('selected');
                    this.submitPracticeAnswer();
                } else {
                    item.classList.toggle('selected');
                }
            });
        });



        document.getElementById('practice-prev').disabled = this.bank.currentIndex === 0;
        document.getElementById('practice-next').textContent = 
            this.bank.currentIndex === this.bank.practiceQueue.length - 1 ? '提交' : '下一题 →';

        this.updateAnswerSheet();
    }

    submitPracticeAnswer() {
        const selectedOptions = Array.from(document.querySelectorAll('#practice-options .option-item.selected'))
            .map(item => item.dataset.letter);

        if (selectedOptions.length === 0) {
            alert('请至少选择一个选项！');
            return;
        }

        const question = this.bank.practiceQueue[this.bank.currentIndex];
        const isCorrect = this.bank.checkAnswer(question, selectedOptions);

        this.bank.recordPracticeAnswer(this.bank.currentIndex, selectedOptions, isCorrect);

        document.querySelectorAll('#practice-options .option-item').forEach(item => {
            const letter = item.dataset.letter;
            if (question.right_answer.includes(letter)) {
                item.classList.add('correct');
            } else if (item.classList.contains('selected')) {
                item.classList.add('wrong');
            }
        });



        if (!isCorrect) {
            this.bank.addWrongQuestion(question);
        }

        this.updateAnswerSheet();

        const autoNextCheckbox = document.getElementById('auto-next');
        const app = this;
        
        if (autoNextCheckbox && autoNextCheckbox.checked) {
            const questionType = this.bank.practiceQueue[this.bank.currentIndex].type;
            // 只在单选题和判断题中启用自动跳转
            if (questionType === '单选题' || questionType === '判断题') {
                // 无论对错都自动跳转，直接跳转到下一题
                setTimeout(() => {
                    app.goToNextQuestion();
                }, 500);
            }
        }
    }

    nextPracticeQuestion() {
        // 检查当前题是否已经回答
        if (!this.bank.practiceResults[this.bank.currentIndex]) {
            // 如果没有回答，先提交当前答案
            this.submitPracticeAnswer();
        } else {
            // 如果已经回答，直接跳转
            this.goToNextQuestion();
        }
    }

    goToNextQuestion() {
        if (this.bank.currentIndex < this.bank.practiceQueue.length - 1) {
            this.bank.currentIndex++;
            this.renderPracticeQuestion();
        } else {
            this.submitAllPractice();
        }
    }

    prevPracticeQuestion() {
        if (this.bank.currentIndex > 0) {
            this.bank.currentIndex--;
            this.renderPracticeQuestion();
        }
    }

    showAnswerSheet() {
        const grid = document.getElementById('answer-sheet-grid');
        const modal = document.getElementById('answer-sheet-modal');
        
        if (!grid || !modal) return;
        
        grid.innerHTML = this.bank.practiceQueue.map((_, index) => {
            const result = this.bank.practiceResults[index];
            let className = 'sheet-item';
            if (index === this.bank.currentIndex) className += ' current';
            if (result) {
                className += result.isCorrect ? ' correct' : ' wrong';
            }

            return `<div class="${className}" data-index="${index}">${index + 1}</div>`;
        }).join('');

        grid.querySelectorAll('.sheet-item').forEach(item => {
            item.addEventListener('click', () => {
                this.bank.currentIndex = parseInt(item.dataset.index);
                this.renderPracticeQuestion();
                // 直接调用关闭按钮的方法
                const closeBtn = document.getElementById('answer-sheet-close');
                if (closeBtn) {
                    closeBtn.click();
                }
            });
        });

        modal.style.display = 'flex';
    }

    updateAnswerSheet() {
        const grid = document.getElementById('answer-sheet-grid');
        
        if (!grid) return;
        
        grid.innerHTML = this.bank.practiceQueue.map((_, index) => {
            const result = this.bank.practiceResults[index];
            let className = 'sheet-item';
            if (index === this.bank.currentIndex) className += ' current';
            if (result) {
                className += result.isCorrect ? ' correct' : ' wrong';
            }

            return `<div class="${className}" data-index="${index}">${index + 1}</div>`;
        }).join('');

        grid.querySelectorAll('.sheet-item').forEach(item => {
            item.addEventListener('click', () => {
                this.bank.currentIndex = parseInt(item.dataset.index);
                this.renderPracticeQuestion();
                // 直接调用关闭按钮的方法
                const closeBtn = document.getElementById('answer-sheet-close');
                if (closeBtn) {
                    closeBtn.click();
                }
            });
        });
    }

    submitAllPractice() {
        const record = this.bank.savePracticeRecord();
        const stats = this.bank.getPracticeStats();

        const practiceTotalEl = document.getElementById('practice-total');
        const practiceCorrectEl = document.getElementById('practice-correct');
        const practiceWrongEl = document.getElementById('practice-wrong');
        const practiceRateEl = document.getElementById('practice-rate');
        const answerSheet = document.getElementById('result-answer-sheet');
        const practiceResultModal = document.getElementById('practice-result-modal');

        if (practiceTotalEl) practiceTotalEl.textContent = stats.total;
        if (practiceCorrectEl) practiceCorrectEl.textContent = stats.correct;
        if (practiceWrongEl) practiceWrongEl.textContent = stats.wrong;
        if (practiceRateEl) practiceRateEl.textContent = stats.rate + '%';

        if (answerSheet) {
            answerSheet.innerHTML = this.bank.practiceQueue.map((_, index) => {
                const result = this.bank.practiceResults[index];
                let className = 'sheet-item';
                if (result) {
                    className += result.isCorrect ? ' correct' : ' wrong';
                } else {
                    className += ' unanswered';
                }

                return `<div class="${className}" data-index="${index}">${index + 1}</div>`;
            }).join('');

            // 添加点击事件
            answerSheet.querySelectorAll('.sheet-item').forEach(item => {
                item.addEventListener('click', () => {
                    const index = parseInt(item.dataset.index);
                    this.bank.currentIndex = index;
                    this.renderPracticeQuestion();
                    if (practiceResultModal) practiceResultModal.style.display = 'none';
                });
            });
        }

        if (practiceResultModal) practiceResultModal.style.display = 'flex';
    }

    startExam() {
        if (this.bank.questions.length === 0) {
            alert('请先导入题库！');
            return;
        }

        this.examQuestions = this.bank.getExamQuestions();
        this.examCurrentIndex = 0;
        this.examAnswers = new Array(this.examQuestions.length).fill(null);
        this.bank.markedQuestions = new Set();
        this.examStartTime = Date.now();

        this.renderExamQuestion();
        this.startExamTimer();
    }

    startExamTimer() {
        if (this.examTimer) clearInterval(this.examTimer);

        this.examTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.examStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            document.getElementById('exam-time').textContent = timeStr;
        }, 1000);
    }

    stopExamTimer() {
        if (this.examTimer) {
            clearInterval(this.examTimer);
            this.examTimer = null;
        }
    }

    renderExamQuestion() {
        const question = this.examQuestions[this.examCurrentIndex];
        if (!question) return;

        const progress = `${this.examCurrentIndex + 1}/${this.examQuestions.length}`;
        document.getElementById('exam-progress').textContent = progress;

        const progressPercent = ((this.examCurrentIndex + 1) / this.examQuestions.length) * 100;
        document.getElementById('exam-progress-fill').style.width = progressPercent + '%';

        const html = `
            <h3>
                <span class="question-number">${this.examCurrentIndex + 1}.</span>
                <span class="question-type">(${question.type}, ${question.score || '无分值'}分)</span>
                <span class="qtContent">${question.question}</span>
            </h3>
        `;
        document.getElementById('exam-question').innerHTML = html;

        const selectedOptions = this.examAnswers[this.examCurrentIndex] || [];

        const optionsHtml = question.options.map(opt => `
            <div class="option-item ${selectedOptions.includes(opt.letter) ? 'selected' : ''}"
                 data-letter="${opt.letter}">
                <span class="option-letter">${opt.letter}</span>
                <span class="option-content">${opt.content}</span>
            </div>
        `).join('');

        document.getElementById('exam-options').innerHTML = optionsHtml;

        document.querySelectorAll('#exam-options .option-item').forEach(item => {
            item.addEventListener('click', () => {
                const letter = item.dataset.letter;
                const currentSelected = this.examAnswers[this.examCurrentIndex] || [];

                if (currentSelected.includes(letter)) {
                    this.examAnswers[this.examCurrentIndex] = currentSelected.filter(l => l !== letter);
                } else {
                    this.examAnswers[this.examCurrentIndex] = [...currentSelected, letter];
                }

                this.renderExamQuestion();
                this.updateAnswerSheet();
            });
        });

        document.getElementById('exam-prev').disabled = this.examCurrentIndex === 0;
        document.getElementById('exam-next').textContent =
            this.examCurrentIndex === this.examQuestions.length - 1 ? '提交试卷' : '下一题 →';

        const markBtn = document.getElementById('exam-mark');
        if (this.bank.markedQuestions.has(this.examCurrentIndex)) {
            markBtn.classList.add('marked');
            markBtn.textContent = '📌 已标记';
        } else {
            markBtn.classList.remove('marked');
            markBtn.textContent = '📌 标记此题';
        }

        this.updateAnswerSheet();
    }

    toggleMarkQuestion() {
        if (this.bank.markedQuestions.has(this.examCurrentIndex)) {
            this.bank.markedQuestions.delete(this.examCurrentIndex);
        } else {
            this.bank.markedQuestions.add(this.examCurrentIndex);
        }
        this.renderExamQuestion();
    }

    prevExamQuestion() {
        if (this.examCurrentIndex > 0) {
            this.examCurrentIndex--;
            this.renderExamQuestion();
        }
    }

    nextExamQuestion() {
        if (this.examCurrentIndex < this.examQuestions.length - 1) {
            this.examCurrentIndex++;
            this.renderExamQuestion();
        } else {
            this.submitExam();
        }
    }

    updateAnswerSheet() {
        const grid = document.getElementById('answer-sheet-grid');
        grid.innerHTML = this.examQuestions.map((_, index) => {
            let className = 'sheet-item';
            if (index === this.examCurrentIndex) className += ' current';
            if (this.examAnswers[index] && this.examAnswers[index].length > 0) className += ' answered';

            return `<div class="${className}" data-index="${index}">${index + 1}</div>`;
        }).join('');

        grid.querySelectorAll('.sheet-item').forEach(item => {
            item.addEventListener('click', () => {
                this.examCurrentIndex = parseInt(item.dataset.index);
                this.renderExamQuestion();
            });
        });
    }

    submitExam() {
        this.stopExamTimer();

        let correct = 0;
        let wrong = 0;

        this.examQuestions.forEach((question, index) => {
            const selected = this.examAnswers[index] || [];
            if (this.bank.checkAnswer(question, selected)) {
                correct++;
            } else {
                wrong++;
                this.bank.addWrongQuestion(question);
            }
        });

        const total = this.examQuestions.length;
        const rate = Math.round((correct / total) * 100);

        document.getElementById('exam-total').textContent = total;
        document.getElementById('exam-correct').textContent = correct;
        document.getElementById('exam-wrong').textContent = wrong;
        document.getElementById('exam-rate').textContent = rate + '%';

        document.getElementById('exam-result-modal').style.display = 'flex';
    }

    reviewWrongQuestions() {
        if (this.bank.wrongQuestions.length === 0) {
            alert('错题本为空！');
            return;
        }

        this.bank.questions = this.bank.wrongQuestions;
        this.bank.shuffleQuestions();
        this.bank.currentIndex = 0;
        this.showPage('practice');
        this.renderPracticeQuestion();
    }

    renderWrongList() {
        const container = document.getElementById('wrong-list');
        const total = this.bank.wrongQuestions.length;
        document.getElementById('wrong-total').textContent = total;

        if (total === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="icon">📒</span>
                    <h3>错题本为空</h3>
                    <p>继续加油！答错的题目会自动收录到这里</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.bank.wrongQuestions.map((q, index) => `
            <div class="wrong-item" data-id="${q.id}">
                <h4>${index + 1}. ${q.question}</h4>
                <div class="wrong-options">
                    ${q.options.map(opt => {
                        const isCorrect = q.right_answer.includes(opt.letter);
                        return `<span class="wrong-option ${isCorrect ? 'correct' : ''}">${opt.letter}. ${opt.content}</span>`;
                    }).join('')}
                </div>
                <div class="wrong-meta">
                    <span>✅ 正确答案: ${q.right_answer}</span>
                    <span>❌ 错误次数: ${q.wrongCount}</span>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.wrong-item').forEach(item => {
            item.addEventListener('click', () => {
                const questionId = item.dataset.id;
                const question = this.bank.wrongQuestions.find(q => q.id === questionId);
                if (question) {
                    this.bank.questions = [question];
                    this.bank.currentIndex = 0;
                    this.showPage('practice');
                    this.renderPracticeQuestion();
                }
            });
        });
    }

    clearWrongQuestions() {
        if (confirm('确定要清空所有错题吗？')) {
            this.bank.clearWrongQuestions();
            this.renderWrongList();
        }
    }

    exportWrongQuestions() {
        if (this.bank.wrongQuestions.length === 0) {
            alert('没有错题可导出！');
            return;
        }

        const data = {
            name: '错题本导出',
            exportTime: new Date().toISOString(),
            questions: this.bank.wrongQuestions
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `错题本_${new Date().toLocaleDateString()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    handleFileImport(e) {
        const file = e.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    processFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.importedData = data;
                this.showImportPreview(data);
            } catch (err) {
                alert('文件格式错误，请确保是有效的JSON文件！');
                console.error(err);
            }
        };
        reader.readAsText(file);
    }

    showImportPreview(data) {
        const preview = document.getElementById('import-preview');
        const dropZone = document.getElementById('import-drop-zone');

        dropZone.style.display = 'none';
        preview.style.display = 'block';

        document.getElementById('preview-name').textContent = data.name || '未命名题库';
        document.getElementById('preview-count').textContent = data.questions ? data.questions.length : 0;
        document.getElementById('preview-type').textContent = '多选题';

        const questionsContainer = document.getElementById('preview-questions');
        const previewQuestions = data.questions ? data.questions.slice(0, 5) : [];

        questionsContainer.innerHTML = previewQuestions.map((q, i) => `
            <div class="preview-question">
                <p><strong>${i + 1}. ${q.question.substring(0, 50)}...</strong></p>
                <p class="options">选项: ${q.options.map(o => o.letter).join(', ')} | 答案: ${q.right_answer}</p>
            </div>
        `).join('');

        if (data.questions && data.questions.length > 5) {
            questionsContainer.innerHTML += `<p style="text-align: center; color: #6c757d;">... 共 ${data.questions.length} 道题</p>`;
        }
    }

    confirmImport() {
        if (this.importedData && this.bank.importQuestions(this.importedData)) {
            this.bank.shuffleQuestions();
            this.updateHomeStats();
            this.cancelImport();
            this.showPage('home');
            alert(`成功导入 ${this.importedData.questions.length} 道题目！`);
        } else {
            alert('导入失败！');
        }
    }

    cancelImport() {
        document.getElementById('import-preview').style.display = 'none';
        document.getElementById('import-drop-zone').style.display = 'block';
        document.getElementById('import-file').value = '';
        this.importedData = null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
