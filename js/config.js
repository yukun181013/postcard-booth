/* ============================================================
   config.js — 部署相关配置
   ------------------------------------------------------------
   开启「扫码下载」：把你的腾讯云云函数地址填进 uploadEndpoint。
   留空（""）= 关闭扫码，结果页只用本机分享 / 保存（当前默认）。

   云函数需返回 JSON：{ "putUrl": "...", "getUrl": "..." }
   详见 SETUP-QR.md。
   ============================================================ */
export const CONFIG = {
  uploadEndpoint: "",          // 例： "https://service-xxxx-1300000000.gz.apigw.tencentcs.com/release/postcard-sign"
  qrExpireText: "链接 7 天内有效",
};
