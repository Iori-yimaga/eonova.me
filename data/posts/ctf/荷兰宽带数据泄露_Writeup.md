---
title: '荷兰宽带数据泄露'
date: '2026-06-28'
modifiedTime: '2026-06-28'
intro: '题目给出一个路由器配置备份文件 `conf.bin`，需要识别加密算法并解密，从中提取宽带（PPPoE）账号作为 flag。'
tags: ['ctf', 'writeup', 'python']
cover: ''
---

# 荷兰宽带数据泄露

## Summary

题目给出一个路由器配置备份文件 `conf.bin`，需要识别加密算法并解密，从中提取宽带（PPPoE）账号作为 flag。

## Solution

### Step 1: 分析文件结构

解压附件得到一个以 GBK 编码中文命名的目录 `荷兰宽带数据泄露/`，内含 `conf.bin`（15272 字节）。文件熵值为 7.74 bits/byte，确认为加密数据。

```
$ file conf.bin
conf.bin: data
$ python3 -c "..."  # entropy = 7.74
```

### Step 2: 使用 RouterPassView 解密

`conf.bin` 是路由器配置备份文件，使用 **RouterPassView**（NirSoft 出品）可自动识别加密算法并解密。由于 RouterPassView 是 Windows 工具，在 Linux 上通过 Wine 运行：

```bash
# 安装 Wine
apt-get install -y wine64

# 下载 RouterPassView
wget -O rpv.zip 'https://www.nirsoft.net/toolsdownload/routerpassview.zip'
unzip rpv.zip

# 使用命令行模式解密，导出 ASCII 文本
wine-stable RouterPassView.exe /RouterFile conf.bin /sascii conf_dec.txt
```

RouterPassView 自动识别该文件为 **TP-Link 路由器配置**，使用 AES-ECB 加密。

### Step 3: 提取宽带账号

解密后的 XML 配置中包含完整的路由器信息，其中关键的宽带（PPPoE）凭证：

```xml
<WANPPPConnection instance=1>
    <Name val=pppoe_eth1_d />
    <Username val=053700357621 />
    <Password val=210265 />
</WANPPPConnection>
```

题目要求的是宽带**账号**（非密码），即 PPPoE 用户名 `053700357621`。

## Flag

```
flag{053700357621}
```

## Notes

- RouterPassView v1.90 支持的命令行参数：`/RouterFile` 指定输入文件，`/sascii` 导出 ASCII 文本，`/sraw` 导出原始解密二进制，`/stext` 导出密码列表
- 该工具支持大量路由器品牌（TP-Link、D-Link、华为、中兴、Netgear 等），会自动检测加密类型
- 从 v1.90 起新增 F6 "Router File Information" 视图，可查看加密算法、密钥、IV 等详细信息
