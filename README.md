# 明信片自助机 · Postcard Kiosk

一台平板，全程一个页面：**拍照 → 把人抠出来 → 选明信片模板 → 签名 → 生成明信片**。
纯前端，无后端，无框架。抠图（人像分割）在**本机浏览器里**完成，照片不上传任何服务器。

## 运行

```bash
cd postcard-kiosk
python3 -m http.server 8753
# 浏览器打开 http://127.0.0.1:8753
```

> 任意静态服务器都行，例如 `npx serve` 也可以。

## 在平板上用（重要）

摄像头 API（`getUserMedia`）只在**安全环境**下可用：`localhost` 或 **HTTPS**。
所以平板通过局域网 IP 访问时，必须走 HTTPS，否则相机打不开（但「从相册选择」仍可用）。

最快的几种方式：
- `npx vite`（自带本地 HTTPS 选项），或
- 用内网穿透/隧道（如 cloudflared / ngrok）拿到一个 https 地址，或
- 给本机配一张局域网自签证书。

## 流程与文件

| 步骤 | 说明 |
|------|------|
| 拍照 | `getUserMedia` 取流，前置自动镜像；也支持「从相册选择」 |
| 抠图 | `js/segmenter.js` — MediaPipe Selfie Segmentation，输出透明背景人像 |
| 模板 | `js/templates.js` — 用 canvas 直接画的 4 张底图（无需图片素材） |
| 签名 | canvas + Pointer Events，手指/触控笔均可，自动裁掉空白 |
| 合成 | `js/app.js` `composePostcard()` — 底图 + 人像 + 邮票/邮戳 + 签名贴纸 |
| 导出 | `canvas.toBlob()` → 下载 PNG（1500×1000） |

- `index.html` 结构与各步骤分屏
- `styles.css` 视觉（复古旅行明信片风：晒褪的青绿 + 珊瑚红 + 芥末黄，奶油纸底纹）

## 想改的地方

- **加模板**：在 `js/templates.js` 的 `TEMPLATES` 里加一个 `{ id, name, draw(ctx,w,h) }`。
- **抠图更干净**：把 `js/segmenter.js` 的 `cutout()` 换成云端 API（如 remove.bg），其余不用动。
- **打印 / 二维码下载**：在结果页 `save()` 旁边接打印机，或上传后生成二维码给用户扫码取图。

## 已知边界（原型阶段）

- 本机模型边缘是「够用」级别，发丝等细节不如云端；需要更高质量时切云端 API。
- 真机相机需要 HTTPS（见上）。
