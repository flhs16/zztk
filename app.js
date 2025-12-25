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
        this.practiceQueue = [...this.questions].sort(() => Math.random() - 0.5);
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
            const trueFalseResponse = await fetch('true_false.json');
            const trueFalseData = await trueFalseResponse.json();

            const allQuestions = [];

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

        document.getElementById('start-practice').addEventListener('click', () => this.startPractice());
        document.getElementById('start-exam').addEventListener('click', () => this.startExam());
        document.getElementById('review-wrong').addEventListener('click', () => this.reviewWrongQuestions());
        document.getElementById('practice-shuffle').addEventListener('click', () => this.shufflePractice());

        document.getElementById('practice-submit').addEventListener('click', () => this.submitPracticeAnswer());
        document.getElementById('practice-next').addEventListener('click', () => this.nextPracticeQuestion());

        document.getElementById('exam-prev').addEventListener('click', () => this.prevExamQuestion());
        document.getElementById('exam-next').addEventListener('click', () => this.nextExamQuestion());
        document.getElementById('exam-mark').addEventListener('click', () => this.toggleMarkQuestion());

        document.getElementById('wrong-clear').addEventListener('click', () => this.clearWrongQuestions());
        document.getElementById('wrong-export').addEventListener('click', () => this.exportWrongQuestions());

        document.getElementById('import-browse').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });

        document.getElementById('import-file').addEventListener('change', (e) => this.handleFileImport(e));

        const dropZone = document.getElementById('import-drop-zone');
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

        document.getElementById('import-confirm').addEventListener('click', () => this.confirmImport());
        document.getElementById('import-cancel').addEventListener('click', () => this.cancelImport());

        document.getElementById('result-review').addEventListener('click', () => {
            document.getElementById('exam-result-modal').style.display = 'none';
            this.reviewWrongQuestions();
        });

        document.getElementById('result-home').addEventListener('click', () => {
            document.getElementById('exam-result-modal').style.display = 'none';
            this.showPage('home');
        });

        document.getElementById('answer-sheet-close').addEventListener('click', () => {
            document.getElementById('answer-sheet-modal').style.display = 'none';
        });
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

    shufflePractice() {
        this.bank.shuffleQuestions();
        this.bank.currentIndex = 0;
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
                if (document.getElementById('practice-answer').style.display === 'block') return;
                item.classList.toggle('selected');
            });
        });

        document.getElementById('practice-answer').style.display = 'none';
        document.getElementById('practice-actions').style.display = 'flex';
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

        document.querySelectorAll('#practice-options .option-item').forEach(item => {
            const letter = item.dataset.letter;
            if (question.right_answer.includes(letter)) {
                item.classList.add('correct');
            } else if (item.classList.contains('selected')) {
                item.classList.add('wrong');
            }
        });

        const resultDiv = document.getElementById('practice-result');
        resultDiv.className = `result ${isCorrect ? 'correct' : 'wrong'}`;
        resultDiv.querySelector('.text').textContent = isCorrect ? '回答正确' : '回答错误';

        document.getElementById('practice-correct-answer').textContent = question.right_answer;
        document.getElementById('practice-your-answer').textContent = selectedOptions.join(', ');

        document.getElementById('practice-answer').style.display = 'block';
        document.getElementById('practice-actions').style.display = 'none';

        if (!isCorrect) {
            this.bank.addWrongQuestion(question);
        }
    }

    nextPracticeQuestion() {
        if (this.bank.currentIndex < this.bank.practiceQueue.length - 1) {
            this.bank.currentIndex++;
            this.renderPracticeQuestion();
        } else {
            alert('练习完成！');
            this.showPage('home');
        }
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
