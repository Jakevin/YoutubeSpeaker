# Youtube 英語字幕轉中文發音

影片：

[![youtube影片](https://github.com/user-attachments/assets/c5c4fb28-c928-41d7-b86a-2d25c0ed0751)](https://youtube.com/shorts/QtB9n8S4mXs?feature=share)


## 注意
開源的版本需要自行設定 API網址、API金鑰、模型名稱。
此外 TTS服務也需要自行在 `background.js` 中 `fetchAudioFromAPI`裡修改

## 目前功能有
1. 截取英文字幕
2. 英文字幕轉中文（可自行調整目標語言）
3. 批次翻譯（每5句話整理後翻譯）
4. 逐段翻譯與轉合成語音

## 資源

![Youtube字幕語系列表](https://www.searchapi.io/docs/parameters/youtube-transcripts/lang)