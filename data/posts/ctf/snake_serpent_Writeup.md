---
title: 'snake'
date: '2026-06-28'
modifiedTime: '2026-06-28'
intro: '题目给出一张 JPEG 图片，其中在文件结束标记（FFD9）之后隐藏了一个 ZIP 文件，内含一个提示文件和一个密文文件。回答提示问题得到密钥，使用 **Serpent** 分组算法解密得到 flag。'
tags: ['ctf', 'writeup', 'python']
cover: ''
---

# snake

## Summary

题目给出一张 JPEG 图片，其中在文件结束标记（FFD9）之后隐藏了一个 ZIP 文件，内含一个提示文件和一个密文文件。回答提示问题得到密钥，使用 **Serpent** 分组算法解密得到 flag。

## Solution

### Step 1: 提取隐藏数据

解压附件得到 `snake.jpg`。检查 JPEG 文件结构，发现 `FFD9`（JPEG 结束标记）之后还有额外数据：

```python
data = open('snake.jpg', 'rb').read()
end = data.find(b'\xff\xd9')
hidden = data[end+2:]  # FFD9 之后的数据
with open('hidden.zip', 'wb') as f:
    f.write(hidden)
```

解压 `hidden.zip` 得到两个文件：`key` 和 `cipher`。

### Step 2: 确定密钥

`key` 文件是 Base64 编码的文本：

```
V2hhdCBpcyBOaWNraSBNaW5haidzIGZhdm9yaXRlIHNvbmcgdGhhdCByZWZlcnMgdG8gc25ha2VzPwo=
```

解码得到：

> What is Nicki Minaj's favorite song that refers to snakes?

答案是 **Anaconda**（Nicki Minaj 的歌曲，歌名即蟒蛇）。

### Step 3: Serpent 解密

`cipher` 文件为 48 字节密文。题目暗示使用 **Serpent** 加密算法（蛇/蟒蛇 → Serpent）。使用密钥 `anaconda`（小写）以 ECB 模式解密：

```python
from pyserpent import Serpent

key = b"anaconda\x00\x00\x00\x00\x00\x00\x00\x00"  # 零填充到 16 字节
cipher_data = open('cipher', 'rb').read()

s = Serpent(key)
plaintext = s.decrypt(cipher_data)
print(plaintext.decode())
```

输出：

```
CTF{who_knew_serpent_cipher_existed}
```

## Flag

```
CTF{who_knew_serpent_cipher_existed}
```

## Notes

- JPEG 文件在 `FF D9` 结束标记之后附加数据是一种常见的图片隐写手法
- Serpent 是 AES 竞赛的 5 个 finalist 之一，使用 128 位分组、32 轮迭代，密钥长度支持 128/192/256 位
- Python 可通过 `pip install pyserpent` 安装 Serpent 实现
- 在线加解密工具：http://serpent.online-domain-tools.com/
