# 明信片自助机 · Postcard Kiosk

一台平板，全程一个页面：**拍照 → 把人抠出来 → 选明信片模板 → 签名 → 生成明信片**。
纯前端、无后端、无框架。抠图（人像分割）在**平板本机浏览器里**完成，照片不上传任何服务器。
字体和 AI 模型都打包在站点里，**不依赖任何外部 CDN**（更快、更稳，国内网络也正常）。

## 🌐 线上地址（永久）

**https://yukun181013.github.io/postcard-booth/**

平板浏览器（iPad 用 Safari，安卓用 Chrome）打开即用；首次会问摄像头权限，点「允许」。

## 📌 平板上当自助机用（建议）

让它像 App 一样全屏运行：

- **iPad（Safari）**：打开网址 → 分享按钮 → **添加到主屏幕**。从主屏图标启动就是无浏览器边框的全屏。
  再开 **设置 → 辅助功能 → 引导式访问**，三击侧边键锁定在这个 App，防止顾客退出。
- **安卓（Chrome）**：菜单 → **添加到主屏幕 / 安装应用**。再用「**应用固定 / 屏幕固定**」锁定。

> 小贴士：把平板「自动锁定 / 息屏」设为「永不」，避免自助机睡着。

## 🛠 改完怎么更新线上版

源码就是这个文件夹。改完推一下，几十秒后线上自动更新：

```bash
cd ~/Desktop/postcard-kiosk
git add -A
git commit -m "更新：xxx"
git push
```

## 本地预览（开发用）

```bash
cd ~/Desktop/postcard-kiosk
python3 -m http.server 8753
# 打开 http://127.0.0.1:8753
```

> 本地用 `localhost` 相机可用；如果用局域网 IP 访问，相机需要 HTTPS（线上地址本身就是 HTTPS，没这个问题）。

## 流程与文件

| 步骤 | 说明 |
|------|------|
| 拍照 | `getUserMedia` 取流，前置自动镜像；也支持「从相册选择」 |
| 抠图 | `js/segmenter.js` — MediaPipe Selfie Segmentation（`js/mediapipe/` 本地模型），输出透明背景人像 |
| 模板 + 地名 | `js/templates.js` 4 张 canvas 底图；地名（"Greetings from ___"）在选模板页可改，自动大写并缩放适配 |
| 签名 | canvas + Pointer Events，手指/触控笔均可，自动裁掉空白 |
| 合成 | `js/app.js` `composePostcard()` — 底图 + 人像 + 邮票/邮戳 + 签名贴纸 |
| 取图 | `canvas.toBlob()` → 系统分享（AirDrop / 存相册 / 微信）或下载 PNG（1500×1000） |

- `index.html` 结构与各步骤分屏
- `styles.css` 视觉（复古旅行明信片风：晒褪的青绿 + 珊瑚红 + 芥末黄，奶油纸底纹）
- `fonts.css` + `fonts/` 自托管字体（Latin；中文走系统字体）

## 想改的地方

- **加模板**：在 `js/templates.js` 的 `TEMPLATES` 里加一个 `{ id, name, draw(ctx,w,h) }`。
- **抠图更干净**（发丝级）：把 `js/segmenter.js` 的 `cutout()` 换成云端 API（如 remove.bg），其余不动。
- **打印**：在结果页 `save()` 旁边接打印机，现场出片。

## 已知边界

- 本机模型边缘是「够用」级别，发丝等细节不如云端；需要更高质量时切云端 API。
- 首次打开会下载约 13MB 的模型文件（之后浏览器会缓存）。
