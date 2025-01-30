// 當點擊擴充功能圖示時打開側邊欄
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ tabId: tab.id });
});

// 音頻緩存
const audioCache = new Map();

// 處理來自 content script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'translate') {
        console.log('翻譯請求:', request.text);
        translateText(request.text)
            .then(translatedText => {
                sendResponse({ translatedText: translatedText });
            })
            .catch(error => {
                console.error('翻譯錯誤:', error);
                sendResponse({ error: error.message });
            });
        return true; // 保持消息通道開啟，等待異步響應
    } else if (request.action === 'speak') {
        handleSpeakRequest(request, sendResponse);
        return true; // 保持消息通道開啟，等待異步響應
    } else if (request.action === 'prefetch') {
        handlePrefetchRequest(request.text, request.speed)
            .then(() => {
                sendResponse({ status: 'prefetchDone' });
            })
            .catch(error => {
                console.error('取得語言失敗:', error);
                sendResponse({ error: error.message });
            });

        return true;
    }
});

// 處理語音請求
async function handleSpeakRequest(request, sendResponse) {
    try {
        const { text, speed } = request;
        const cacheKey = `${text}_${speed}`;

        // 檢查緩存
        if (audioCache.has(cacheKey)) {
            console.log('從緩存獲取音頻');
            sendResponse({
                status: 'success',
                audioData: audioCache.get(cacheKey)
            });
            return;
        }

        // 獲取音頻數據
        const audioData = await fetchAudioFromAPI(text, speed);

        // 存入緩存
        audioCache.set(cacheKey, audioData);

        // 發送回響應
        sendResponse({
            status: 'success',
            audioData: audioData
        });
    } catch (error) {
        console.error('語音合成錯誤:', error);
        sendResponse({
            status: 'error',
            error: error.message
        });
    }
}

// 處理預取請求
async function handlePrefetchRequest(text, speed) {
    const cacheKey = `${text}_${speed}`;
    if (!audioCache.has(cacheKey)) {
        try {
            const audioData = await fetchAudioFromAPI(text, speed);
            audioCache.set(cacheKey, audioData);
            console.log('預取音頻成功:', text);
        } catch (error) {
            console.error('預取音頻失敗:', error);
        }
    }
}

// 從 API 獲取音頻數據
async function fetchAudioFromAPI(text, speed) {

    // 從 storage 中獲取 API key 和模型設定
    let {
        tarageVoiceId = 'qiumum_0gushi'
    } = await chrome.storage.sync.get(['tarageVoiceId']);

    try {
        const response = await fetch(`${BASE_TTS_URL}?tarageVoiceId=${tarageVoiceId}&text=${encodeURIComponent(text)}&speed=${speed}`);

        if (!response.ok) {
            throw new Error('獲取音頻失敗');
        }

        const blob = await response.blob();
        return await blobToBase64(blob);
    } catch (error) {
        console.error('獲取音頻錯誤:', error);
        throw error;
    }
}

// Blob 轉 Base64
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// 使用 OpenAI API 翻譯文本
async function translateText(text) {
    try {
        // 從 storage 中獲取 API key 和模型設定
        let {
            apiURL = 'https://api.openai.com/v1/chat/completions',
            apiKey = 'sk-',
            model = 'gpt-4o-mini',
            tarageLanguage = 'zh-TW',
        } = await chrome.storage.sync.get(['apiURL', 'apiKey', 'model', 'tarageLanguage']);

        if (apiKey == null) { apiKey = 'sk-' }
        if (apiURL == null) { apiURL = 'https://api.openai.com/v1/chat/completions' }
        if (model == null) { model = 'gpt-4o-mini' }

        // 根據不同模型調整參數
        const maxTokens = text.length * 2;
        const temperature = 0;

        const response = await fetch(apiURL, {
            method: 'POST',
            headers: {
                'api-key': apiKey,
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    {
                        role: "system",
                        content: `你是一個翻譯助手。請將輸入的英文文本翻譯成${tarageLanguage}，保持準確和自然。只需要回傳翻譯結果，不需要其他解釋。翻譯時要考慮上下文語境，確保翻譯的流暢性和專業性。`
                    },
                    {
                        role: "user",
                        content: text
                    }
                ],
                temperature: temperature,
                max_tokens: maxTokens,
                presence_penalty: 0,
                frequency_penalty: 0
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || '翻譯請求失敗');
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message || '翻譯失敗');
        }

        // 提取翻譯結果
        const translatedText = data.choices[0].message.content.trim();

        return translatedText;

    } catch (error) {
        console.error('翻譯錯誤:', error);

        // 根據錯誤類型提供更具體的錯誤信息
        if (error.message.includes('API key')) {
            throw new Error('API 金鑰無效或已過期');
        } else if (error.message.includes('rate limit')) {
            throw new Error('API 呼叫次數已達上限，請稍後再試');
        } else if (error.message.includes('billing')) {
            throw new Error('API 帳戶額度不足，請檢查帳戶設定');
        }

        // 如果是其他錯誤，嘗試使用備用翻譯服務
        return await fallbackTranslation(text);
    }
}

// 備用翻譯函數（使用免費的翻譯 API）
async function fallbackTranslation(text) {
    try {
        const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-TW`);

        if (!response.ok) {
            throw new Error('備用翻譯請求失敗');
        }

        const data = await response.json();

        if (data.responseStatus === 200) {
            return data.responseData.translatedText;
        } else {
            throw new Error(data.responseDetails || '備用翻譯失敗');
        }
    } catch (error) {
        console.error('備用翻譯錯誤:', error);
        return '翻譯服務暫時不可用';
    }
}