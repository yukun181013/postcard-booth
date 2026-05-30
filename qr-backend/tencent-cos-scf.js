'use strict';
/* ============================================================
   腾讯云云函数(SCF) · 明信片上传签名
   ------------------------------------------------------------
   作用：给平板发回一个「一次性上传地址 putUrl」和「下载地址 getUrl」。
   平板把成片 PUT 到 putUrl，再把 getUrl 画成二维码；手机扫码即下载。

   ✅ 零依赖（只用 Node 内置 crypto），可直接粘贴进 SCF 控制台，无需 npm。
   ✅ 你的 SecretKey 只存在本函数的「环境变量」里，不进任何公开仓库。

   运行环境：Nodejs 16.13 / 18 等
   触发方式：API 网关触发器（启用「集成响应」，默认即是）
   需要的环境变量：
     SECRET_ID   你的腾讯云 SecretId
     SECRET_KEY  你的腾讯云 SecretKey
     BUCKET      存储桶名，形如 postcard-1300000000
     REGION      存储桶地域，形如 ap-guangzhou
   详见同目录上层的 SETUP-QR.md。
   ============================================================ */

const crypto = require('crypto');
const hmacsha1 = (key, str) => crypto.createHmac('sha1', key).update(str).digest('hex');
const sha1     = (str)      => crypto.createHash('sha1').update(str).digest('hex');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.main_handler = async (event) => {
  // CORS 预检（一般用不到，GET 是简单请求）
  if (event && event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  const SecretId  = process.env.SECRET_ID;
  const SecretKey = process.env.SECRET_KEY;
  const Bucket    = process.env.BUCKET;     // 例：postcard-1300000000
  const Region    = process.env.REGION;     // 例：ap-guangzhou
  const EXPIRE_DOWNLOAD_DAYS = 7;           // 仅作提示文案；真正的过期由桶「生命周期」规则决定

  if (!SecretId || !SecretKey || !Bucket || !Region) {
    return { statusCode: 500, headers: CORS,
      body: JSON.stringify({ error: '环境变量未配置(SECRET_ID/SECRET_KEY/BUCKET/REGION)' }) };
  }

  // 唯一对象名：postcards/年月日/随机16位.png
  const d = new Date();
  const day = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const key = `postcards/${day}/${crypto.randomBytes(8).toString('hex')}.png`;

  // —— 用 COS 签名算法(sha1)预签一个 PUT 地址，10 分钟内有效 ——
  const now = Math.floor(Date.now() / 1000);
  const keyTime = `${now};${now + 600}`;
  const signKey = hmacsha1(SecretKey, keyTime);
  const httpString = `put\n/${key}\n\n\n`;                 // 方法\n路径\n参数\n头部\n（参数与头部均为空）
  const stringToSign = `sha1\n${keyTime}\n${sha1(httpString)}\n`;
  const signature = hmacsha1(signKey, stringToSign);
  const q = [
    'q-sign-algorithm=sha1',
    `q-ak=${SecretId}`,
    `q-sign-time=${keyTime}`,
    `q-key-time=${keyTime}`,
    'q-header-list=',
    'q-url-param-list=',
    `q-signature=${signature}`,
  ].join('&');

  const host = `${Bucket}.cos.${Region}.myqcloud.com`;
  const putUrl = `https://${host}/${key}?${q}`;
  const getUrl = `https://${host}/${key}`;                 // 桶为「公有读私有写」，下载链接无需签名、短、好扫

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', ...CORS },
    body: JSON.stringify({ putUrl, getUrl, expireDays: EXPIRE_DOWNLOAD_DAYS }),
  };
};
