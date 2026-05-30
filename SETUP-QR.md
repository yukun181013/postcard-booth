# 开启「扫码下载」配置指南（腾讯云 COS + 云函数）

做完这份配置，结果页就会出现二维码，访客用手机相机扫码即可下载明信片。
全程约 15–20 分钟。**你的密钥只会存在云函数里，不会进入这个公开仓库。**

> 原理：二维码装不下整张图，只能装网址。所以平板先把成片传到你的 COS 私有桶，
> 再把下载网址画成二维码。上传用「云函数现签的一次性地址」，别人无法往你桶里乱传。

---

## 1. 开通对象存储 COS，建一个桶

1. 登录 [腾讯云](https://console.cloud.tencent.com/) → 搜索进入 **对象存储 COS** → 第一次用先「立即开通」。
2. **创建存储桶**：
   - 名称：如 `postcard`（系统会自动加后缀变成 `postcard-1300000000` 这种，**完整桶名后面要用**）
   - 地域：选离活动现场近的，如 **广州 ap-guangzhou** / **上海 ap-shanghai**（**地域代号后面要用**）
   - 访问权限：选 **公有读私有写**
     （图片随机命名、无法被遍历；「公有读」只是让扫码的手机能直接下载，下载链接短、好扫）
3. 创建完成。记下**完整桶名**和**地域代号**。

## 2. 给桶设置跨域 CORS（让平板能上传）

进入该桶 → **安全管理 → 跨域访问 CORS 设置 → 添加规则**：

| 项 | 填写 |
|----|------|
| 来源 Origin | `https://yukun181013.github.io`（一行一个，可再加一行 `*` 方便测试） |
| 操作 Methods | 勾选 **PUT、GET、HEAD** |
| Allow-Headers | `*` |
| Expose-Headers | `ETag` |
| 超时 Max-Age | `600` |

保存。

## 3. 设置自动删除（保护隐私 + 省空间）

进入该桶 → **基础配置 → 生命周期 → 新增规则**：
- 范围：指定前缀 `postcards/`
- 动作：**到期删除**，**7 天**后删除（天数可自己定）

保存。这样所有明信片 7 天后自动清空。

## 4. 建一个「访问密钥」（建议用子账号，更安全）

- 最省事：用主账号密钥 —— [访问密钥控制台](https://console.cloud.tencent.com/cam/capi) 拿到 **SecretId / SecretKey**。
- **更安全（推荐）**：在 [访问管理 CAM](https://console.cloud.tencent.com/cam) 新建一个子用户，只给它这个桶的 COS 读写权限，用它的 SecretId / SecretKey。
  这样即使泄露，影响也只限这个桶。

## 5. 建云函数（粘贴代码，无需装依赖）

1. 进入 **云函数 SCF** → **新建** → 选 **从头开始**：
   - 函数类型：**事件函数**
   - 运行环境：**Nodejs 18.15**（或 16.13）
   - 函数名称：如 `postcard-sign`
   - 地域：建议和桶同地域
2. 函数代码：把本仓库 **`qr-backend/tencent-cos-scf.js`** 的全部内容，粘贴到在线编辑器里
   （把默认 `index.js` 内容整段替换；入口保持 `index.main_handler`）。
3. **环境变量**（高级配置 → 环境变量，新增 4 条）：
   | 键 | 值 |
   |----|----|
   | `SECRET_ID`  | 你的 SecretId |
   | `SECRET_KEY` | 你的 SecretKey |
   | `BUCKET`     | 完整桶名，如 `postcard-1300000000` |
   | `REGION`     | 地域代号，如 `ap-guangzhou` |
4. **触发器**：新增 → **API 网关触发器** → 创建。
   - 请求方法默认即可；**「集成响应」保持开启**（这样函数返回的 `statusCode/headers/body` 才生效）。
   - 创建后会得到一个**访问路径 URL**，形如
     `https://service-xxxx-1300000000.gz.apigw.tencentcs.com/release/postcard-sign`
   - **复制这个 URL。**
5. 部署/保存函数。

### 验证云函数
浏览器直接打开那个 URL，应返回类似：
```json
{"putUrl":"https://postcard-1300000000.cos.ap-guangzhou.myqcloud.com/postcards/20260530/ab12...png?q-sign-algorithm=sha1&...","getUrl":"https://postcard-1300000000.cos.ap-guangzhou.myqcloud.com/postcards/20260530/ab12...png","expireDays":7}
```
能看到 `putUrl` 和 `getUrl` 就对了。

## 6. 把地址填进网站

编辑 **`js/config.js`**，把第 4 步得到的 URL 填进 `uploadEndpoint`：
```js
export const CONFIG = {
  uploadEndpoint: "https://service-xxxx-1300000000.gz.apigw.tencentcs.com/release/postcard-sign",
  qrExpireText: "链接 7 天内有效",
};
```
保存后推送上线：
```bash
cd ~/Desktop/postcard-kiosk
git add js/config.js && git commit -m "开启扫码下载" && git push
```
几十秒后线上生效。

## 7. 现场测试
打开线上地址做一张明信片 → 结果页出现二维码 → 用手机相机扫 → 应能下载到 PNG。

---

## 常见问题
- **结果页没有二维码**：`uploadEndpoint` 没填或填错；或云函数 URL 打不开。
- **二维码生成失败（红字提示）**：多半是 COS 跨域 CORS 没配好（第 2 步），或桶名/地域写错。结果页此时仍可用「保存到本机」。
- **手机扫码打不开/下载失败**：桶不是「公有读」；或链接已过期（超过生命周期天数）。
- **想换更安全的密钥**：用第 4 步的 CAM 子账号方案。
- **费用**：个人小流量基本在免费额度内；担心的话可在 COS 设流量/容量告警。

> 不想用腾讯云？阿里云 OSS 也能做（签名算法不同）。告诉我，我把云函数换成 OSS 版本。
