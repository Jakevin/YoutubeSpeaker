<template>
    <div class="container">
        <h2>YouTube字幕翻譯設定</h2>

        <div class="input-group">
            <label for="model">要翻譯成哪個語言？</label>
            <select id="model" v-model="tarageLanguage" disabled>
                <option v-for="lang of languageList" :value="lang.LangCultureName">{{ lang.DisplayName }}</option>
            </select>
        </div>

        <div class="input-group">
            <label for="model">用哪種音調？</label>
            <select id="model" v-model="tarageVoiceId">
                <option v-for="lang of voiceIdList" :value="lang.voiceId">{{ lang.voiceName }}</option>
            </select>
        </div>

        <div class="input-group">
            <label for="apiURL">與OpenAI相容的網址:</label>
            <input id="apiURL" v-model="apiURL" placeholder="輸入您的網址">
            <div class="info-text">
                例：https://api.openai.com/v1/chat/completions
            </div>
        </div>
        <div class="input-group">
            <label for="apiKey">大語言模型API金鑰:</label>
            <input id="apiKey" v-model="apiKey" :type="showApiKey ? 'text' : 'password'" @focus="showApiKey = true" @blur="showApiKey = false"
                placeholder="輸入您的API 金鑰">
            <div class="info-text">
                使用大語言模型進行精確翻譯
            </div>
            <div class="error" v-if="error">{{ error }}</div>
        </div>

        <div class="input-group">
            <label for="model">AI 模型:</label>
            <select id="model" v-model="selectedModel" @change="handleModelChange">
                <option value="default">預設</option>
                <option value="gpt-4o-mini">GPT-4o mini</option>
                <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash Exp</option>
                <option value="custom">自行輸入</option>
            </select>
            <input type="text" id="customModel" v-model="customModelName" v-show="selectedModel === 'custom'" placeholder="輸入模型名稱">
        </div>



        <div class="switch">
            <label>啟用翻譯:</label>
            <input type="checkbox" v-model="enabled">
        </div>

        <button @click="saveSettings">儲存設定</button>

        <div :class="['status', statusClass]">
            {{ statusMessage }}
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

const languageList = [
    { "LangCultureName": "zh-TW", "DisplayName": "CHT-繁體中文-台灣" },
    { "LangCultureName": "zh-HK", "DisplayName": "HK-繁體中文-廣東" },
    { "LangCultureName": "zh-CN", "DisplayName": "CHS-簡體中文" },
    { "LangCultureName": "en-US", "DisplayName": "English-英語(美)" },
    { "LangCultureName": "ja-JP", "DisplayName": "Japan-日本語" },
    { "LangCultureName": "th-TH", "DisplayName": "Thai-泰語-タイ語" },
    { "LangCultureName": "ko-KR", "DisplayName": "Korean-韓語-国語" },
]

const voiceIdList = [
    { "voiceId": "man_1", "voiceName": "男1" },
    { "voiceId": "man_2", "voiceName": "男2" },
    { "voiceId": "women_1", "voiceName": "女1" },
    { "voiceId": "women_2", "voiceName": "女2" },
    { "voiceId": "kid", "voiceName": "兒童" },
]

// 響應式狀態
const apiURL = ref('')
const apiKey = ref('')
const selectedModel = ref('default')
const tarageLanguage = ref('zh-TW')
const tarageVoiceId = ref('man_1')
const customModelName = ref('')
const enabled = ref(true)
const error = ref('')
const showApiKey = ref(false)
const statusMessage = ref('正在檢查狀態...')

// 計算屬性
const statusClass = computed(() => {
    if (!enabled.value) return 'inactive'
    return (enabled.value && (apiKey.value || selectedModel.value === 'default')) ? 'active' : 'inactive'
})

// 當前使用的模型名稱
const currentModelName = computed(() => {
    if (selectedModel.value === 'custom') {
        return customModelName.value || '自定義模型'
    }
    switch (selectedModel.value) {
        case 'default':
            return '預設模型'
        case 'gpt-4o-mini':
            return 'GPT-4o mini'
        case 'gemini-2.0-flash-exp':
            return 'Gemini 2.0 Flash'
        default:
            return selectedModel.value
    }
})

// 更新狀態顯示
const updateStatus = () => {
    if (!enabled.value) {
        statusMessage.value = '翻譯功能已停用'
        return
    }

    if (!apiKey.value && selectedModel.value !== 'default') {
        statusMessage.value = '請設定 API 金鑰'
        return
    }

    // languageList.find((lang) => {
    //     if (lang.LangCultureName === tarageLanguage.value) {
    //         statusMessage.value = `翻譯功能已啟用 (使用 ${lang.DisplayName})`
    //         return true
    //     }
    // })


}

// 處理模型選擇變化
const handleModelChange = () => {
    if (selectedModel.value !== 'custom') {
        customModelName.value = ''
    }
    updateStatus()
}

// 顯示成功消息
const showSuccess = (message) => {
    const originalMessage = statusMessage.value
    statusMessage.value = message
    setTimeout(() => {
        statusMessage.value = originalMessage
        updateStatus()
    }, 3000)
}

// 測試 API 金鑰
const testApiKey = async (apiKey) => {
    try {
        const response = await fetch(apiURL.value, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: selectedModel.value === 'custom' ? customModelName.value : selectedModel.value,
                messages: [{ role: "user", content: "Hi" }],
                max_tokens: 5
            })
        })

        const data = await response.json()
        if (data.error) {
            throw new Error(data.error.message)
        }
    } catch (e) {
        if (e.message.includes('API key')) {
            throw new Error('無效的 API 金鑰')
        }
        throw new Error('無法驗證 API 金鑰，請稍後再試')
    }
}

// 儲存設定
const saveSettings = async () => {
    error.value = ''

    try {
        if (selectedModel.value === 'custom' && !customModelName.value) {
            error.value = '請輸入自定義模型名稱'
            return
        }

        if (selectedModel.value !== 'default') {
            if (!apiKey.value) {
                error.value = '請輸入 API 金鑰'
                return
            }
            await testApiKey(apiKey.value)
        }

        // 儲存設定
        await chrome.storage.sync.set({
            apiURL: selectedModel.value === 'default' ? null : apiURL.value,
            apiKey: selectedModel.value === 'default' ? null : apiKey.value,
            model: selectedModel.value === 'default' ? null :
                (selectedModel.value === 'custom' ? customModelName.value : selectedModel.value),
            tarageLanguage: tarageLanguage.value,
            tarageVoiceId: tarageVoiceId.value,
            enabled: enabled.value
        })

        showSuccess('設定已儲存！')
        updateStatus()
    } catch (e) {
        error.value = e.message
    }
}

// 組件卸載時清理
onUnmounted(() => {
    if (worker.value) {
        worker.value.removeEventListener("message", onMessageReceived);
        worker.value.removeEventListener("error", onErrorReceived);
        worker.value = null;
    }
});

// 初始化
onMounted(async () => {
    // 載入保存的設定
    const settings = await chrome.storage.sync.get(['apiURL', 'apiKey', 'model', 'enabled', 'tarageLanguage', 'tarageVoiceId'])

    if (settings.tarageLanguage) tarageLanguage.value = settings.tarageLanguage
    if (settings.tarageVoiceId) tarageVoiceId.value = settings.tarageVoiceId
    if (settings.apiKey) apiKey.value = settings.apiKey
    if (settings.apiURL) apiURL.value = settings.apiURL
    if (settings.model) {
        if (['default', 'gpt-4o-mini', 'gemini-2.0-flash-exp'].includes(settings.model)) {
            selectedModel.value = settings.model
        } else {
            selectedModel.value = 'custom'
            customModelName.value = settings.model
        }
    }

    enabled.value = settings.enabled !== false
    updateStatus()
})

// 監聽狀態變化
watch(enabled, updateStatus)
watch(selectedModel, updateStatus)
</script>

<style scoped>
.container {
    padding: 20px;
}

.input-group {
    margin-bottom: 15px;
}

.switch {
    margin: 15px 0;
}

.status {
    margin-top: 15px;
    padding: 10px;
    border-radius: 4px;
}

.status.active {
    background-color: #4CAF50;
    color: white;
}

.status.inactive {
    background-color: #f44336;
    color: white;
}

.error {
    color: #f44336;
    margin-top: 5px;
}

.info-text {
    font-size: 0.8em;
    color: #666;
    margin-top: 5px;
}
</style>