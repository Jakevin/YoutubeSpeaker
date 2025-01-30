// 存儲字幕數據的變量
let subtitles = [];
let translatedSubtitles = [];
let tts = null;
// 初始化 YouTube 處理程序
async function initializeYouTubeHandler() {
    // 等待 YouTube 播放器加載完成
    const checkForPlayer = setInterval(() => {
        const player = document.querySelector('.ytp-caption-window-container');
        if (player) {
            clearInterval(checkForPlayer);

            // 創建翻譯面板
            createTranslationPanel();

            // // 監聽實時字幕
            observeSubtitles();
        }
    }, 1000);
}

// 建立翻譯面板
function createTranslationPanel() {
    const panel = document.createElement('div');
    panel.id = 'yt-translation-panel';
    panel.innerHTML = `
        <div class="translation-header">
            <span>字幕翻譯</span>
            <div class="translation-controls">
                <button id="fetch-subtitles">獲取全部字幕</button>
                <button id="play-all-subtitles" style="display: none;">播放全部</button>
                <button id="toggle-translation">隱藏面版</button>
            </div>
        </div>
        <div class="translation-content"></div>
        <div class="loading-indicator" style="display: none;">
            正在獲取並翻譯字幕...
        </div>
    `;

    // 插入到播放器下方
    const playerContainer = document.querySelector('#below');
    if (playerContainer) {
        playerContainer.insertBefore(panel, playerContainer.firstChild);
        addPanelEventListeners(panel);
    }
}

// 添加面板事件監聽器
function addPanelEventListeners(panel) {
    // 切換顯示/隱藏
    document.getElementById('toggle-translation').addEventListener('click', () => {
        const content = panel.querySelector('.translation-content');
        const button = panel.querySelector('#toggle-translation');
        if (content.style.display === 'none') {
            content.style.display = 'block';
            button.textContent = '隱藏';
        } else {
            content.style.display = 'none';
            button.textContent = '顯示';
        }
    });

    // 獲取全部字幕按鈕事件
    document.getElementById('fetch-subtitles').addEventListener('click', async () => {
        await fetchAllSubtitles();
    });

    // 播放全部字幕按鈕事件
    document.getElementById('play-all-subtitles').addEventListener('click', () => {
        playAllSubtitles();
    });
}

// 獲取視頻ID
function getVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
}

// 從頁面數據中提取字幕配置
// 獲取視頻字幕軌道
async function getVideoSubtitleTrack(videoId) {
    try {
        // 獲取視頻頁面內容
        const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
        const html = await response.text();

        // 從頁面中提取字幕數據
        const captionRegex = /"captionTracks"\s*:\s*\[([^\]]*)\]/
        const match = html.match(captionRegex);

        if (!match) {
            throw new Error('未找到字幕數據');
        }
        console.log(match[0]);

        const captionData = JSON.parse(`{${match[0]}}`);
        // const playerCaptionsTracklistRenderer = captionData.playerCaptionsTracklistRenderer;

        // if (!playerCaptionsTracklistRenderer || !playerCaptionsTracklistRenderer.captionTracks) {
        //     throw new Error('無可用字幕');
        // }

        // 尋找英文字幕軌道
        let englishTrack = captionData['captionTracks'].find(
            track => track.languageCode === 'en-US'
        );

        if (!englishTrack) {
            englishTrack = captionData['captionTracks'].find(
                track => track.languageCode === 'en'
            );
        }

        if (!englishTrack) {
            throw new Error('未找到英文字幕');
        }

        return englishTrack;

    } catch (error) {
        console.error('獲取字幕軌道錯誤:', error);
        throw error;
    }
}

// 獲取並解析字幕內容
async function fetchSubtitleContent() {
    try {
        // 從頁面提取字幕配置
        const englishTrack = await getVideoSubtitleTrack(getVideoId());

        // 從字幕 URL 獲取內容
        const response = await fetch(englishTrack.baseUrl);
        const subtitleXml = await response.text();

        // 解析 XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(subtitleXml, "text/xml");
        const textElements = xmlDoc.getElementsByTagName('text');

        // 解析成字幕內容數組
        return Array.from(textElements).map(element => ({
            text: element.textContent.replaceAll('\n', '').trim(),
            start: parseFloat(element.getAttribute('start')),
            duration: parseFloat(element.getAttribute('dur'))
        }));
    } catch (error) {
        console.error('獲取字幕內容錯誤:', error);
        throw error;
    }
}

// 獲取所有字幕
async function fetchAllSubtitles() {
    const loadingIndicator = document.querySelector('.loading-indicator');
    const fetchButton = document.getElementById('fetch-subtitles');
    loadingIndicator.style.display = 'block';
    fetchButton.disabled = true;

    try {
        const subtitleContent = await fetchSubtitleContent();
        console.log('字幕內容:', subtitleContent);

        // 將字幕分組，每5段為一組
        const batchSize = 5;
        const batches = [];
        for (let i = 0; i < subtitleContent.length; i += batchSize) {
            const batch = subtitleContent.slice(i, i + batchSize);
            const batchDuration = batch.reduce((sum, item) => sum + item.duration, 0);
            const batchTexts = batch.map(item => item.text).join(' ');

            batches.push({
                original: batchTexts,
                translated: '', // 初始為空，等播放時才翻譯
                start: batch[0].start,
                duration: batchDuration,
                originalItems: batch // 保存原始項目以便後續處理
            });
        }

        // 保存分組後的字幕
        translatedSubtitles = batches;

        // 先翻譯第一個 batch 並預取其語音
        if (translatedSubtitles.length > 0) {
            try {
                subtitlePlayer.initialize();
                await subtitlePlayer.translateIndex(0);

                // 顯示播放全部按鈕
                const playAllButton = document.getElementById('play-all-subtitles');
                if (playAllButton) {
                    playAllButton.style.display = 'inline-block';
                }
            } catch (error) {
                console.error('預翻譯第一段失敗:', error);
            }
        }

        loadingIndicator.style.display = 'none';

    } catch (error) {
        console.error('獲取字幕錯誤:', error);
        showError('獲取字幕失敗: ' + error.message);
        loadingIndicator.style.display = 'none';
        fetchButton.disabled = false;
    }
}

// 批量翻譯
async function translateBatch(text, duration = null) {
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'translate',
            text: text
        });

        if (response.error) {
            throw new Error(response.error);
        }

        // 在翻譯完成後立即發送語音合成預取請求
        const translatedText = response.translatedText;
        const speed = calculateSpeechRate(translatedText, duration);
        const prefetchResponse = await chrome.runtime.sendMessage({
            action: 'prefetch',
            text: translatedText,
            speed: speed
        });

        if (prefetchResponse.error) {
            throw new Error(prefetchResponse.error);
        }

        return translatedText;
    } catch (error) {
        console.error('翻譯錯誤:', error);
        throw error;
    }
}

// 監聽實時字幕
function observeSubtitles() {
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.target.classList.contains('caption-window')) {
                const captionText = mutation.target.textContent.trim();
                if (captionText && !subtitles.includes(captionText)) {
                    handleNewSubtitle(captionText);
                }
            }
        }
    });

    // 等待 YouTube 播放器加載完成
    const checkForPlayer = setInterval(() => {
        const player = document.querySelector('.caption-window');
        if (player) {
            clearInterval(checkForPlayer);
            observer.observe(document.querySelector('.caption-window').parentElement, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }
    }, 1000);
}

// 處理新的字幕
async function handleNewSubtitle(text) {
    if (!text || subtitles.includes(text)) return;

    subtitles.push(text);

    try {
        const response = await chrome.runtime.sendMessage({
            action: 'translate',
            text: text
        });

        if (response && response.translatedText) {
            translatedSubtitles.push({
                original: text,
                translated: response.translatedText,
                start: new Date().getTime()
            });

            updateTranslationPanel(translatedSubtitles);
        }
    } catch (error) {
        console.error('翻譯錯誤:', error);
    }
}

// 計算適當的語速
function calculateSpeechRate(text, duration) {
    if (!duration) return 1.0; // 如果沒有指定時間，使用預設語速

    let charCount = text.replaceAll("？", "").replaceAll("！", "").replaceAll(" ", "").replaceAll("…", "").length;

    let words = text.match(/[\u4e00-\u9fa5]|\u3040-\u30ff\u31f0-\u31ff\u3000-\u303f|[a-zA-Z]+(?:-[a-zA-Z]+)*/g);

    if (words) {
        // 對於每個英文單字，如果包含連字符，則進一步分割
        let splitWords = [];
        words.forEach(word => {
            if (/[a-zA-Z]+-[a-zA-Z]+/.test(word)) {
                splitWords.push(...word.split('-'));
            } else {
                splitWords.push(word);
            }
        });

        charCount = splitWords.length;
    } else {
        console.log(0);
    }

    const normalCharPerMinute = 260;
    // 將 duration 從秒轉換為分鐘
    const durationInMinutes = duration / 60;
    // 計算所需語速倍率
    const requiredRate = (charCount / normalCharPerMinute) / durationInMinutes;

    // 將速度映射到 0~2 範圍，數字越大越慢
    const normalizedRate = 2 - requiredRate;

    // 限制語速在 0~2 範圍內，2 代表最慢（速度會是原本的一半）
    return Math.min(Math.max(normalizedRate, 0), 2);
}

// 語音播放功能
async function speakText(text, onEndCallback = null, duration = null) {
    if (!text) return;

    // 如果有正在播放的音頻，先停止它
    if (subtitlePlayer.currentAudio) {
        subtitlePlayer.currentAudio.pause();
        subtitlePlayer.currentAudio = null;
    }

    const speed = calculateSpeechRate(text, duration);

    try {
        // 發送語音合成請求
        const response = await chrome.runtime.sendMessage({
            action: 'speak',
            text: text,
            speed: speed
        });

        if (response.status === 'error') {
            throw new Error(response.error);
        }

        // 創建音頻元素並播放
        const audio = new Audio(response.audioData);
        subtitlePlayer.currentAudio = audio;

        if (onEndCallback) {
            audio.onended = () => {
                subtitlePlayer.currentAudio = null;
                onEndCallback();
            };
        }

        await audio.play();

    } catch (error) {
        console.error('播放音頻錯誤:', error);
        subtitlePlayer.currentAudio = null;
        if (onEndCallback) onEndCallback();
    }
}

// 字幕播放器類
class SubtitlePlayer {
    constructor() {
        this.isPlaying = false;
        this.currentPlayingIndex = -1;
        this.startTime = null;
        this.playbackTimer = null;
        this.currentAudio = null;
        this.sortedSubtitles = [];
        this.playButton = null;
        this.videoPlayer = null;
    }

    initialize() {
        this.playButton = document.getElementById('play-all-subtitles');
        this.videoPlayer = document.querySelector('video.html5-main-video');
        this.sortedSubtitles = [...translatedSubtitles].sort((a, b) => a.start - b.start);
        this.currentPlayingIndex = 0;

    }

    stop() {
        this.isPlaying = false;
        if (this.playbackTimer) {
            clearTimeout(this.playbackTimer);
            this.playbackTimer = null;
        }
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
        if (this.videoPlayer) {
            this.videoPlayer.muted = false;
        }
        this.playButton.textContent = '播放全部';
        this.currentPlayingIndex = -1;
        this.startTime = null;
    }

    async translateIndex(index) {
        if (this.currentPlayingIndex + 1 < this.sortedSubtitles.length) {
            const subtitle = this.sortedSubtitles[index];
            try {
                subtitle.translated = await translateBatch(subtitle.original, subtitle.duration);
                updateTranslationPanel(translatedSubtitles);
            } catch (error) {
                console.error('翻譯下一段失敗:', error);
            }
        }
    }

    async translateNext() {
        if (this.currentPlayingIndex + 1 < this.sortedSubtitles.length) {
            const nextSubtitle = this.sortedSubtitles[this.currentPlayingIndex + 1];
            if (!nextSubtitle.translated) {
                try {
                    nextSubtitle.translated = await translateBatch(nextSubtitle.original, nextSubtitle.duration);
                    updateTranslationPanel(translatedSubtitles);
                } catch (error) {
                    console.error('翻譯下一段失敗:', error);
                }
            }
        }
    }

    async playNext() {
        if (!this.isPlaying || this.currentPlayingIndex >= this.sortedSubtitles.length) {
            this.stop();
            return;
        }

        const subtitle = this.sortedSubtitles[this.currentPlayingIndex];
        const currentTime = (Date.now() - this.startTime) / 1000;

        if (!subtitle.translated) {
            try {
                subtitle.translated = await translateBatch(subtitle.original, subtitle.duration);
                updateTranslationPanel(translatedSubtitles);
            } catch (error) {
                console.error('翻譯當前段落失敗:', error);
                this.currentPlayingIndex++;
                this.playNext();
                return;
            }
        }

        this.translateNext();
        console.log(subtitle.start, currentTime);
        if (currentTime < subtitle.start) {
            this.playbackTimer = setTimeout(() => {
                this.playCurrentSubtitle(subtitle);
            }, (subtitle.start - currentTime) * 1000);
        } else {
            this.playCurrentSubtitle(subtitle);
        }
    }

    playCurrentSubtitle(subtitle) {
        updateHighlight(subtitle);
        speakText(subtitle.translated, () => {
            this.currentPlayingIndex++;
            this.playNext();
        }, subtitle.duration);
    }

    async start() {
        this.isPlaying = true;
        this.playButton.textContent = '停止播放';

        if (this.videoPlayer) {
            this.videoPlayer.currentTime = 0;
            this.videoPlayer.muted = true;
            this.videoPlayer.play();
        }
        this.startTime = Date.now();
        await this.playNext();
    }
}

// 全局播放器實例
const subtitlePlayer = new SubtitlePlayer();

// 播放全部字幕
async function playAllSubtitles() {
    if (subtitlePlayer.isPlaying) {
        subtitlePlayer.stop();
        return;
    }

    await subtitlePlayer.start();
}

// 更新字幕高亮
function updateHighlight(currentSubtitle) {
    const subtitleElements = document.querySelectorAll('.subtitle-pair');
    subtitleElements.forEach(element => {
        element.classList.remove('currently-playing');
        const translatedText = element.querySelector('.translated').textContent.trim();
        if (translatedText === currentSubtitle.translated) {
            element.classList.add('currently-playing');
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });
}

// 更新翻譯面板內容
function updateTranslationPanel(subtitles) {
    const panel = document.querySelector('#yt-translation-panel .translation-content');
    if (!panel) return;

    panel.innerHTML = subtitles.map(sub => `
        <div class="subtitle-pair">
            <div class="original">${sub.original}</div>
            <div class="translated">
                ${sub.translated}
                <button class="speak-button"
                    data-text="${sub.translated.replace(/"/g, '&quot;')}"
                    data-duration="${sub.duration || ''}"
                >
                    🔊
                </button>
            </div>
            ${sub.start ? `<div class="timestamp">${formatTimestamp(sub.start)}</div>` : ''}
        </div>
    `).join('');

    // 添加語音按鈕事件監聽器
    panel.querySelectorAll('.speak-button').forEach(button => {
        button.addEventListener('click', () => {
            const text = button.getAttribute('data-text');
            const duration = parseFloat(button.getAttribute('data-duration'));
            speakText(text, null, duration);
        });
    });

    // 自動滾動到底部
    //panel.scrollTop = panel.scrollHeight;
}

// 格式化時間戳
function formatTimestamp(seconds) {
    if (typeof seconds !== 'number') {
        return '';
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// 顯示錯誤信息
function showError(message) {
    const panel = document.querySelector('#yt-translation-panel');
    if (!panel) return;

    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;

    panel.appendChild(errorDiv);

    // 3秒後自動移除錯誤信息
    setTimeout(() => {
        errorDiv.remove();
    }, 3000);
}

// 啟動腳本
initializeYouTubeHandler();