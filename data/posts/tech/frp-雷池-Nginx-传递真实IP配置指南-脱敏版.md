---
title: 'frp + 雷池WAF + Nginx 传递真实访问 IP 完整配置指南'
intro: '家庭网络下通过 frp 隧道穿透，让 Nginx 和雷池 WAF 都能看到真实访客 IP 的完整配置指南'
tags: ['frp', 'nginx', 'waf', '网络']
cover: ''
---

# frp + 雷池WAF + Nginx 传递真实访问 IP 完整配置指南

## 背景

家庭服务网络拓扑：

```
外网用户
  │
  ▼
VPS frps (Docker, :443)
  │  frp tunnel
  ▼
内网机器 frpc (192.168.1.10)
  │
  ▼
雷池 SafeLine WAF (192.168.1.20:20001, TLS 终结)
  │
  ▼
Nginx 真实服务 (192.168.1.30:80)
```

目标：让 Nginx 和雷池 WAF 都能看到真实访客 IP，而不是 frpc / 雷池的内网 IP。

---

## 方案选择

| 方案 | 机制 | 适用 | 改动 |
|------|------|------|------|
| X-Forwarded-For | HTTP 头传递 | 仅 HTTP/HTTPS proxy 类型 | frpc 改 type="https"，VPS frps 终结 TLS |
| Proxy Protocol | TCP 连接前缀 | 所有 TCP/UDP 类型 | frpc 加一行，后端 nginx listen 加参数 |

选择 **Proxy Protocol v2**，因为保持 TCP 模式和雷池 TLS 终结不变，改动集中在雷池和 frpc 两处。

---

## 配置步骤

### 1. frpc 配置

```toml
# frpc.toml
[[proxies]]
name = "blog-proxy"
type = "tcp"
localIP = "192.168.1.20"          # 雷池 WAF IP
localPort = 20001
remotePort = 443

[proxies.transport]
useEncryption = false
useCompression = false
proxyProtocolVersion = "v2"       # 关键配置
```

仅需在 proxy 的 `transport` 段加 `proxyProtocolVersion = "v2"`。frpc 会在每条 TCP 连接开头写入 Proxy Protocol v2 头部，携带真实客户端 IP。

### 2. 雷池 SafeLine WAF 配置

雷池 SafeLine CE 的 tengine 容器配置挂载在 `/data/safeline/resources/nginx/`。

站点配置文件：`/data/safeline/resources/nginx/sites-enabled/IF_backend_xx`

**修改前：**
```nginx
server {
    listen 0.0.0.0:20001 ssl http2;
    ...
```

**修改后：**
```nginx
server {
    listen 0.0.0.0:20001 ssl http2 proxy_protocol;
    set_real_ip_from 192.168.1.10;     # 信任 frpc 所在机器
    real_ip_header proxy_protocol;
    ...
```

**应用：**
```bash
# 备份
cp IF_backend_xx IF_backend_xx.bak

# 注意：.bak 文件不能留在 sites-enabled/ 目录，否则 log_format 重复定义报错
mv IF_backend_xx.bak /data/safeline/resources/nginx/

# 测试并重载
docker exec safeline-tengine nginx -t
docker exec safeline-tengine nginx -s reload
```

**关键点：**
- `listen` 加 `proxy_protocol` 后，nginx 才能解析 frpc 发来的 Proxy Protocol 头
- `set_real_ip_from` 必须设为 frpc 所在机器的 IP
- 雷池的 `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for` 会自动使用解析后的真实 IP

### 3. Nginx 真实服务配置

**主配置文件 `nginx.conf` (http 块内)：**
```nginx
log_format realip '$remote_addr - $http_x_forwarded_for - $http_x_real_ip';
```

**站点配置文件：**
```nginx
server {
    listen 80;

    # 信任雷池的 IP，从 X-Forwarded-For 提取真实 IP
    set_real_ip_from 192.168.1.20;
    real_ip_header X-Forwarded-For;
    real_ip_recursive on;

    # 验证日志
    access_log /var/log/nginx/realip.log realip;
    ...
}
```

---

## 全链路 IP 传递流程

```
1. 外网用户 (1.2.3.4)
     │  HTTPS 请求
     ▼
2. VPS frps :443
     │  frp tunnel (加密隧道)
     ▼
3. frpc ──Proxy Protocol v2──▶ 携带 real_ip = 1.2.3.4
     │  TCP 连接
     ▼
4. 雷池 :20001 (proxy_protocol 解析)
     │  $proxy_protocol_addr = 1.2.3.4
     │  X-Forwarded-For: 1.2.3.4
     ▼
5. Nginx :80 (real_ip_header X-Forwarded-For)
     │  $remote_addr = 1.2.3.4  ✅
     ▼
   真实服务
```

---

## 验证方法

### Nginx 侧
```bash
# 临时验证日志 (格式: $remote_addr - $http_x_forwarded_for - $http_x_real_ip)
tail -f /var/log/nginx/realip.log

# 主访问日志
tail -f /var/log/nginx/access.log
```

正常输出：
```
1.2.3.4        - 1.2.3.4        - -              # 真实公网 IP ✅
192.168.1.20   - -               - -              # 雷池健康检查 (无转发头，正常)
```

### 雷池侧
雷池通过 `$proxy_protocol_addr` 获取真实 IP，自动写入访问日志。

---

## 踩坑记录

### 坑 1：frpc 启了 proxy_protocol，雷池没配 → 全部连不上
- **现象**：frpc 正常连上 frps，所有代理 start proxy success，但网站完全无法访问（curl 超时）。
- **原因**：frpc 在每条 TCP 连接前插入 Proxy Protocol 二进制头，雷池 nginx 不认识，当成 TLS 握手垃圾数据丢弃。
- **修复**：雷池 `listen` 加 `proxy_protocol`。

### 坑 2：Nginx `log_format` 不能放 site 配置
- **现象**：`nginx: [emerg] "log_format" directive is not allowed here`
- **原因**：`log_format` 只能在 `nginx.conf` 的 `http` 块定义。
- **修复**：移到 nginx 主配置文件的 `http {}` 内。

### 坑 3：宝塔面板编译的 Nginx 可能不支持 access_log 内联格式
- **现象**：`nginx: [emerg] unknown log format`
- **原因**：某些 nginx 编译版本不支持 `access_log /path '$remote_addr ...'` 内联写法。
- **修复**：先用 `log_format` 定义命名格式，再 `access_log /path format_name`。

### 坑 4：面板可能覆盖 nginx.conf
- `log_format` 定义在 nginx 主配置文件，面板更新时可能覆盖此文件。
- **对策**：如果发现 `log format "realip" not found`，重新加回去。

### 坑 5：.bak 文件在 sites-enabled 里会导致 nginx -t 失败
- **现象**：`duplicate "log_format" name`
- **原因**：`sites-enabled/*` 的所有文件都会被 include，包括 .bak，导致同一 log_format 被重复定义。
- **修复**：备份文件移到 `sites-enabled/` 目录外。

---

## 相关资源

- [frp 官方文档 - Get Real User IP](https://gofrp.org/en/docs/features/common/realip/)
- [雷池 SafeLine 官方文档](https://docs.safeline.io/)
- [Nginx real_ip_module 文档](https://nginx.org/en/docs/http/ngx_http_realip_module.html)
- [Proxy Protocol 规范 (HAProxy)](https://www.haproxy.org/download/1.8/doc/proxy-protocol.txt)
