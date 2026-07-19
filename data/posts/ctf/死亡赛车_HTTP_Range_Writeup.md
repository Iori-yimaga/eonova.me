---
title: '死亡赛车：哈利迪的竞速 - HTTP Range 思维题 Writeup'
date: '2026-05-30'
modifiedTime: '2026-05-30'
intro: '死亡赛车：哈利迪的竞速。欢迎来到绿洲（OASIS）！詹姆斯·哈利迪临终前宣布自己在游戏中设置了一个彩蛋，找到他们，拯救绿洲。祝你好运 Gamer!'
tags: ['ctf', 'writeup', 'cve', 'java', 'python', 'http']
cover: ''
---

# 死亡赛车：哈利迪的竞速 - HTTP Range 思维题 Writeup

## 题目描述

> 死亡赛车：哈利迪的竞速。欢迎来到绿洲（OASIS）！詹姆斯·哈利迪临终前宣布自己在游戏中设置了一个彩蛋，找到他们，拯救绿洲。祝你好运 Gamer!

**目标信息：**
- `biccvd6.haobachang2.loveli.com.cn:8888`

**Flag 位置：** `/tmp/flag.txt`

---

## 攻击链总览

```
首页入口 → /DeathMatch/ → /DeathMatch/info 获取文件名
→ 发现 /DeathMatch/download 返回 100MB 随机文件
→ "盲目追随常规路线" 暗示不要直接下载
→ "竞速" + 电影隐喻 → HTTP Range 请求读取文件末尾
→ flag 藏在 100MB 文件的最后 300 字节中
```

---

## 一、信息收集

### 1.1 服务识别

```bash
nmap -sV -p 8888 biccvd6.haobachang2.loveli.com.cn
# 8888/tcp → Werkzeug/3.0.1 Python/3.10.19
```

IP `118.24.140.71`（与之前挑战的 `haobachang` 域名不同，这是 `haobachang2` 新平台）。

### 1.2 首页探索

访问首页，发现"头号玩家漏洞靶场 - Ready Player One CTF"，死亡赛车模块入口：

```html
<a href="/DeathMatch/" class="btn">传送门</a>
```

### 1.3 死亡赛车页面

进入 `/DeathMatch/`，JavaScript 调用了两个 API：

```javascript
fetch('/DeathMatch/info')       // → {"filename":"HallidayCopperKey"}
window.location.href = '/DeathMatch/download'  // → 104,857,981 字节
```

- `/DeathMatch/info` 返回 JSON：文件名 `HallidayCopperKey`（铜钥匙）
- `/DeathMatch/download` 返回 ~100MB 的二进制文件

### 1.4 关键线索

页面上的文字提示：

> "盲目追随常规路线的遗憾，将成为你最大的遗憾"

> "钥匙就在终点等你"

**这是核心线索。**

---

## 二、漏洞分析

### 2.1 题目本质

这不是传统漏洞利用题，而是**思维题**（CTF 中常称为 "misc" 或 "forensic" 类）。

直接下载 100MB 文件 → 可以，但需要遍历 104,857,981 字节搜索 flag → 这就是"盲目追随常规路线"。

### 2.2 电影隐喻（《头号玩家》）

在电影 *Ready Player One* 中，第一关"死亡赛车"的破解方法：所有赛车手都全力**向前**冲，只有主角韦德发现——应该**倒车**进入隐藏隧道，从而拿到**铜钥匙**。

映射到 CTF：
| 电影 | CTF |
|------|-----|
| 向前开车 | 直接下载整个文件 |
| 倒车 | HTTP `Range` 请求从末尾读取 |
| 铜钥匙 (Copper Key) | `/DeathMatch/download` 返回的 `HallidayCopperKey` 文件 |
| 隐藏隧道 | 文件末尾的 flag |

### 2.3 技术前提

Werkzeug/3.0.1 支持 HTTP Range 请求：

```bash
curl -I -H "Range: bytes=0-99" http://.../DeathMatch/download
# HTTP/1.1 206 Partial Content
# Accept-Ranges: bytes
# Content-Range: bytes 0-99/104857981
```

`Accept-Ranges: bytes` 和 `206 Partial Content` 说明服务器完整支持 HTTP 范围请求。

---

## 三、利用过程

### 3.1 尝试直接下载（常规路线 ×）

```bash
# 直接下载需要处理 100MB 数据
curl http://.../DeathMatch/download | strings | grep flag{
# 需要遍历 104,857,981 字节，flag 藏在末尾
```

### 3.2 倒车 — HTTP Range 请求（正确解法 ✓）

```bash
# 读取最后 300 字节
curl -H "Range: bytes=104857681-" \
  http://biccvd6.haobachang2.loveli.com.cn:8888/DeathMatch/download
```

输出：

```
============================================================
FLAG: flag{d608d99c08044094b2874ec607a949bf}
============================================================
```

### 3.3 完整利用命令

```bash
# 一步到位
curl -s -H "Range: bytes=104857681-" \
  "http://biccvd6.haobachang2.loveli.com.cn:8888/DeathMatch/download" \
  | strings | grep FLAG
```

---

## 四、Flag

```
flag{d608d99c08044094b2874ec607a949bf}
```

---

## 五、文件结构分析

100MB 文件 `HallidayCopperKey` 的实际结构：

```
[0 - 104,857,600]   : 随机二进制数据（100MB 的 /dev/urandom 输出）
[104,857,600 - end] : 人眼可见内容（最后 ~380 字节）：

    ============================================================
    🎞️ 恭喜你找到了钥匙！
    FLAG: flag{d608d99c08044094b2874ec607a949bf}
    ============================================================
```

文件共 104,857,981 字节（≈ 100MB + 381 字节）。

---

## 六、总结

### 攻击路径

```
首页 (/)
  ↓
/DeathMatch/ (死亡赛车页面)
  ↓
/DeathMatch/info → {"filename": "HallidayCopperKey"}
  ↓
/DeathMatch/download → 100MB 随机数据 + 末尾 flag
  ↓
"盲目追随常规路线" → 不要下载整个文件
  ↓
HTTP Range: bytes=104857681- → 只读取末尾 300 字节
  ↓
FLAG: flag{d608d99c08044094b2874ec607a949bf}
```

### 关键收获

1. **CTF 中文化隐喻可能是解题关键**：题目描述和页面文字不只为了氛围，可能直接指向解法
2. **HTTP Range 请求是强大的侦察工具**：`Accept-Ranges: bytes` 的存在意味着不需要下载整个大文件
3. **思维题 ≠ 无技术含量**：理解 HTTP 协议特性（206 Partial Content）是解题前提
4. **"盲目追随常规路线" = 不要做大多数人会做的事**：在 CTF 中，如果某种操作看起来很直接但非常耗时，通常意味着有更聪明的方法

### 防御视角

实际渗透测试中，攻击者同样可以利用 Range 请求：
- 规避大文件传输检测
- 分块下载敏感文件（避免触发 DLPP 的大文件告警）
- 枚举文件结构而不下载完整内容

**建议：** 对敏感端点禁用 `Accept-Ranges`，或对 Range 请求也进行完整的访问控制和审计日志记录。

---

## 附录：电影彩蛋对应表

| 《头号玩家》元素 | CTF 挑战对应 |
|-----------------|-------------|
| 绿洲 (OASIS) | 靶场平台 |
| 詹姆斯·哈利迪 | 出题人 |
| 铜钥匙 (Copper Key) | `HallidayCopperKey` 文件 |
| 死亡赛车 | `/DeathMatch/` 模块 |
| 倒车进入隧道 | HTTP Range 从末尾读取 |
| "谢谢你玩我的游戏" | 首页 footer 文字 |
