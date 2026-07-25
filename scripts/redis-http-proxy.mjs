/**
 * 轻量级 Redis HTTP 代理
 * 兼容 Upstash Redis REST API 协议
 * 将 HTTP 请求转发到本地 Redis (ioredis)
 *
 * 用法: node scripts/redis-http-proxy.mjs [--port 8079] [--redis redis://localhost:6379] [--token eonova]
 */

import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'
import Redis from 'ioredis'

const args = process.argv.slice(2)
function getArg(name, fallback) {
  const idx = args.indexOf(name)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback
}

const PORT = Number(getArg('--port', '8079'))
const REDIS_URL = getArg('--redis', 'redis://localhost:6379')
const TOKEN = getArg('--token', 'eonova')

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    return Math.min(times * 50, 2000)
  },
})

redis.on('connect', () => console.log(`✅ Redis 已连接: ${REDIS_URL}`))
redis.on('error', err => console.error('❌ Redis 错误:', err.message))

// 解析请求体
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8')
      try {
        resolve(raw ? JSON.parse(raw) : null)
      }
      catch {
        resolve(raw)
      }
    })
    req.on('error', reject)
  })
}

// 编码为 base64（Upstash 协议要求）
function encodeBase64(val) {
  if (val === null || val === undefined)
    return val
  if (typeof val === 'number')
    return val
  if (typeof val === 'string')
    return Buffer.from(val).toString('base64')
  if (Array.isArray(val))
    return val.map(encodeBase64)
  return Buffer.from(JSON.stringify(val)).toString('base64')
}

// 执行单个 Redis 命令
async function execCommand(args) {
  if (!Array.isArray(args) || args.length === 0) {
    return { error: 'Invalid command' }
  }
  const [cmd, ...cmdArgs] = args
  const command = cmd.toUpperCase()

  try {
    // 处理特殊命令
    switch (command) {
      case 'FLUSHALL':
      case 'FLUSHDB':
        return { result: await redis.call(command) }

      case 'PING':
        return { result: await redis.ping() }

      case 'INFO':
        return { result: await redis.info(cmdArgs[0]) }

      case 'KEYS':
        return { result: await redis.keys(cmdArgs[0] || '*') }

      case 'SCAN': {
        const cursor = cmdArgs[0] || '0'
        const [newCursor, keys] = await redis.scan(Number(cursor), ...(cmdArgs.slice(1) || []))
        return { result: [String(newCursor), keys] }
      }

      case 'EXISTS': {
        const count = await redis.exists(...cmdArgs)
        return { result: count }
      }

      case 'TTL':
      case 'PTTL':
        return { result: await redis.call(command, cmdArgs[0]) }

      case 'EXPIRE':
      case 'PEXPIRE':
        return { result: await redis.call(command, cmdArgs[0], cmdArgs[1]) }

      case 'LPUSH':
        return { result: await redis.lpush(cmdArgs[0], ...cmdArgs.slice(1)) }

      case 'RPUSH':
        return { result: await redis.rpush(cmdArgs[0], ...cmdArgs.slice(1)) }

      case 'LRANGE':
        return { result: await redis.lrange(cmdArgs[0], cmdArgs[1], cmdArgs[2]) }

      case 'LLEN':
        return { result: await redis.llen(cmdArgs[0]) }

      case 'HSET': {
        // HSET key field value [field value ...]
        const hashKey = cmdArgs[0]
        const pairs = cmdArgs.slice(1)
        const obj = {}
        for (let i = 0; i < pairs.length; i += 2) {
          obj[pairs[i]] = pairs[i + 1]
        }
        return { result: await redis.hset(hashKey, obj) }
      }

      case 'HGET':
        return { result: await redis.hget(cmdArgs[0], cmdArgs[1]) }

      case 'HGETALL':
        return { result: await redis.hgetall(cmdArgs[0]) }

      case 'HDEL': {
        const fields = cmdArgs.slice(1)
        return { result: await redis.hdel(cmdArgs[0], ...fields) }
      }

      case 'ZADD': {
        const key = cmdArgs[0]
        const memberScores = cmdArgs.slice(1)
        const args = []
        for (let i = 0; i < memberScores.length; i += 2) {
          args.push(Number(memberScores[i]), memberScores[i + 1])
        }
        return { result: await redis.zadd(key, ...args) }
      }

      case 'ZRANGE':
        return { result: await redis.zrange(cmdArgs[0], cmdArgs[1], cmdArgs[2], ...(cmdArgs.slice(3) || [])) }

      case 'SADD':
        return { result: await redis.sadd(cmdArgs[0], ...cmdArgs.slice(1)) }

      case 'SMEMBERS':
        return { result: await redis.smembers(cmdArgs[0]) }

        // 通用命令
      default: {
        // 使用 redis.call 来处理所有其他命令
        const result = await redis.call(command, ...cmdArgs)
        return { result }
      }
    }
  }
  catch (err) {
    return { error: err.message }
  }
}

// 执行 pipeline
async function execPipeline(commands) {
  const pipeline = redis.pipeline()
  for (const cmd of commands) {
    if (Array.isArray(cmd) && cmd.length > 0) {
      pipeline.call(cmd[0].toUpperCase(), ...cmd.slice(1))
    }
  }
  const results = await pipeline.exec()
  return results.map(([err, result]) => {
    if (err)
      return { error: err.message }
    return { result }
  })
}

const server = createServer(async (req, res) => {
  // CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Upstash-Encoding, Upstash-Telemetry-Runtime, Upstash-Telemetry-Platform, Upstash-Telemetry-Sdk, upstash-sync-token')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // 认证检查
  const auth = req.headers.authorization
  if (TOKEN && auth !== `Bearer ${TOKEN}`) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Unauthorized' }))
    return
  }

  // 检查是否请求 base64 编码
  const wantsBase64 = req.headers['upstash-encoding'] === 'base64'

  try {
    const body = await readBody(req)
    const urlPath = decodeURIComponent(req.url || '/').replace(/^\//, '').replace(/\/$/, '')

    // 确定是否是 pipeline 请求
    let response

    if (urlPath === 'pipeline' || urlPath === 'queue') {
      // Pipeline 模式
      if (!Array.isArray(body)) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Pipeline expects an array of commands' }))
        return
      }
      const results = await execPipeline(body)
      response = wantsBase64
        ? results.map(r => ({ result: encodeBase64(r.result), error: r.error }))
        : results
    }
    else if (urlPath) {
      // 单命令模式: /get/key → ["GET", "key"]
      const parts = urlPath.split('/')
      const cmd = parts.map(p => decodeURIComponent(p))
      // body 作为额外参数
      if (body && Array.isArray(body)) {
        cmd.push(...body)
      }
      else if (body && typeof body === 'string') {
        cmd.push(body)
      }
      const result = await execCommand(cmd)
      response = wantsBase64
        ? { result: encodeBase64(result.result), error: result.error }
        : result
    }
    else {
      // 根路径 - 返回 OK
      response = { result: 'OK' }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(response))
  }
  catch (err) {
    console.error('请求处理错误:', err)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: err.message }))
  }
})

server.listen(PORT, () => {
  console.log(`🚀 Redis HTTP 代理已启动`)
  console.log(`   端口: ${PORT}`)
  console.log(`   Redis: ${REDIS_URL}`)
  console.log(`   Token: ${TOKEN ? '(已设置)' : '(无认证)'}`)
  console.log(`   协议: Upstash Redis REST API 兼容`)
})
