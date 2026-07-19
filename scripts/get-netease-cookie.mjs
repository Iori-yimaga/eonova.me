/**
 * 网易云音乐 Cookie 获取辅助脚本
 *
 * 使用方法：
 * 1. 在终端运行: node scripts/get-netease-cookie.mjs
 * 2. 脚本会启动一个本地服务器，打开浏览器让你登录
 * 3. 登录成功后，脚本会自动获取 cookie 并写入 .env.local
 *
 * 手动获取方法（推荐）：
 * 1. 打开 https://music.163.com 并登录
 * 2. 按 F12 打开开发者工具
 * 3. 切换到 Application（应用）选项卡
 * 4. 在左侧找到 Cookies -> https://music.163.com
 * 5. 复制所有 cookie 为字符串格式，例如:
 *    MUSIC_U=xxx; __csrf=xxx; ...
 * 6. 将复制的内容粘贴到 .env.local 的 NETEASE_COOKIE 字段
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ENV_LOCAL_PATH = resolve(import.meta.dirname, '..', '.env.local')
const ENV_EXAMPLE_PATH = resolve(import.meta.dirname, '..', '.env.example')

function showInstructions() {
  console.log(`
╔══════════════════════════════════════════════════════╗
║     网易云音乐 Cookie 获取指南                        ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║  方法：手动从浏览器获取（最可靠）                       ║
║                                                      ║
║  1. 打开 Chrome / Edge 浏览器                        ║
║  2. 访问 https://music.163.com                       ║
║  3. 点击右上角「登录」，用手机扫码或手机号登录           ║
║  4. 登录成功后，按 F12 打开开发者工具                  ║
║  5. 切换到 Application（应用）选项卡                   ║
║  6. 左侧栏展开 Cookies → 点击 https://music.163.com  ║
║  7. 你需要复制以下关键 cookie:                        ║
║                                                      ║
║     必需：                                           ║
║       • MUSIC_U     （用户的认证 token）               ║
║       • __csrf      （CSRF token）                   ║
║                                                      ║
║     可选但推荐：                                      ║
║       • __remember_me                                  ║
║       • NMTID                                          ║
║       • WEVNSR                                         ║
║       • gheed                                          ║
║       • ntes_kaola_uid                                 ║
║                                                      ║
║  8. 在 Console（控制台）中执行以下命令快速获取:         ║
║                                                      ║
║     document.cookie.split(';').map(c=>c.trim())       ║
║       .filter(c => ['MUSIC_U','__csrf','__remember'  ║
║       ,'NMTID','WEVNSR','gheed'].some(k               ║
║       => c.startsWith(k)))                            ║
║       .join('; ')                                     ║
║                                                      ║
║  9. 复制输出结果，然后运行：                            ║
║     node scripts/get-netease-cookie.mjs --set "你的cookie"  ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
`)
}

function setCookie(cookie) {
  if (!existsSync(ENV_LOCAL_PATH)) {
    if (existsSync(ENV_EXAMPLE_PATH)) {
      console.log('⚠️  .env.local 不存在，请先复制 .env.example 为 .env.local')
    }
    else {
      console.log('⚠️  .env.local 不存在')
    }
    return
  }

  let content = readFileSync(ENV_LOCAL_PATH, 'utf-8')

  if (content.includes('NETEASE_COOKIE=')) {
    // Replace existing NETEASE_COOKIE line
    content = content.replace(
      /NETEASE_COOKIE=.*/,
      `NETEASE_COOKIE="${cookie}"`,
    )
  }
  else {
    // Append NETEASE_COOKIE
    content += `\n# 网易云音乐 Now Playing\nNETEASE_COOKIE="${cookie}"\n`
  }

  writeFileSync(ENV_LOCAL_PATH, content, 'utf-8')
  console.log('✅ NETEASE_COOKIE 已写入 .env.local')
  console.log('')
  console.log('请重启开发服务器以使配置生效:')
  console.log('  pnpm dev')
}

function verifyCookie(cookie) {
  const hasMUSIC_U = cookie.includes('MUSIC_U=')
  const hasCSRF = cookie.includes('__csrf=')

  console.log('')
  console.log('🔍 Cookie 验证:')
  console.log(`  MUSIC_U: ${hasMUSIC_U ? '✅ 已找到' : '❌ 未找到 (必需)'}`)
  console.log(`  __csrf:  ${hasCSRF ? '✅ 已找到' : '⚠️  未找到 (推荐)'}`)

  if (!hasMUSIC_U) {
    console.log('')
    console.log('⚠️  缺少 MUSIC_U，cookie 可能无法正常工作')
    console.log('   请确保已登录网易云音乐')
    return false
  }

  return true
}

// Main
const args = process.argv.slice(2)

if (args.includes('--set')) {
  const idx = args.indexOf('--set')
  const cookie = args[idx + 1]

  if (!cookie) {
    console.log('❌ 请提供 cookie 值')
    console.log('   用法: node scripts/get-netease-cookie.mjs --set "MUSIC_U=xxx; __csrf=yyy"')
    process.exit(1)
  }

  const isValid = verifyCookie(cookie)
  if (isValid) {
    setCookie(cookie)
  }
  else {
    setCookie(cookie)
  }
}
else if (args.includes('--help') || args.includes('-h')) {
  showInstructions()
}
else {
  showInstructions()
}
