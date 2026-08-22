/**
 * dsh-skill-authoring — DSH skill 创建与审计插件（vibe-coding-cn 9 项质量门禁）
 *
 * 准则来源：vibe-coding-cn（https://github.com/2025Emma/vibe-coding-cn）→
 *           hermes-agent-skill-authoring（hermes 侧元 skill）→ 本插件（DSH 执行器）
 *
 * 原则：所有 skill 创建/修改必须经过 9 项门禁。文档给标准（skill 版），本插件给执行。
 *
 * 工具：
 *   skill_scaffold(name, description)   生成符合门禁的 SKILL.md 骨架（含 references/index.md）
 *   skill_audit(path)                   按 9 项门禁审计现有 SKILL.md，输出 ✓/✗ 表
 *   skill_check_name(name)              校验 skill 名称正则（DSH: ^[a-z0-9]+(-[a-z0-9]+)*$）
 *
 * 钩子：
 *   skill-write-guard  tools/pre-execute 当 write/edit 目标为 ~/.dsh/skills/<目录>/SKILL.md 时，
 *                      自动跑门禁预检，不合格返回警告（不拦截，提示先补全）
 */
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'dsh-skill-authoring'
export const inject = ['tools', 'agents']

const HOME = homedir()
const SCRIPTS_DIR = join(dirname(new URL(import.meta.url).pathname), 'scripts')
const SKILLS_DIR = join(HOME, '.dsh', 'skills')

export const Config = null

function py(script, args, input) {
  try {
    const out = execFileSync('python3', [join(SCRIPTS_DIR, script), ...args], {
      input: input ?? '', encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024,
    })
    return { ok: true, out: out.trim() }
  } catch (e) {
    return { ok: false, out: String(e?.stderr || e?.message || e).trim() }
  }
}

export function apply(ctx, config = {}) {
  // ---------- 工具 1：skill_scaffold ----------
  ctx.tools.register(defineTool({
    name: 'skill_scaffold',
    description: '按 vibe-coding-cn 9 项质量门禁生成新 skill 骨架：目录 + SKILL.md（frontmatter/whenToUse/Boundaries/QuickRef/Examples 占位）+ references/index.md。创建任何新 skill 前必须先调用本工具生成骨架，再填充内容。',
    parameters: {
      name: { type: 'string', required: true, description: 'skill 名（小写+连字符，如 my-skill）' },
      description: { type: 'string', required: true, description: '描述：what + when（什么能力 + 什么场景触发）' },
      dir: { type: 'string', description: '目标目录（默认 ~/.dsh/skills/<name>）' },
    },
    output: {
      schema: { type: 'string' },
      render: (args, value) => [{ type: 'text', text: value }],
    },
    async execute(input) {
      const args = ['scaffold', input.name, input.description]
      if (input?.dir) args.push('--dir', input.dir)
      const r = py('skill_gate.py', args)
      if (!r.ok) return `[skill_scaffold] 失败：${r.out}`
      return r.out
    },
  }))

  // ---------- 工具 2：skill_audit ----------
  ctx.tools.register(defineTool({
    name: 'skill_audit',
    description: '按 vibe-coding-cn 9 项质量门禁审计 SKILL.md：name/description/whenToUse/Boundaries/QuickRef/Examples/references/验证路径/操作手册风格，逐条输出 ✓/✗。创建或修改 skill 后必须运行自检。',
    parameters: {
      path: { type: 'string', required: true, description: 'SKILL.md 路径或 skill 名（自动定位 ~/.dsh/skills/<name>/SKILL.md）' },
    },
    output: {
      schema: { type: 'string' },
      render: (args, value) => [{ type: 'text', text: value }],
    },
    async execute(input) {
      let p = input.path
      if (!p.includes('/') && !p.endsWith('.md')) p = join(SKILLS_DIR, p, 'SKILL.md')
      const r = py('skill_gate.py', ['audit', p])
      if (!r.ok) return `[skill_audit] 失败：${r.out}`
      return r.out
    },
  }))

  // ---------- 工具 3：skill_check_name ----------
  ctx.tools.register(defineTool({
    name: 'skill_check_name',
    description: '校验 skill 名称是否符合 DSH 规范（小写字母/数字，连字符分隔，如 my-skill）。创建 skill 前先校验名称。',
    parameters: {
      name: { type: 'string', required: true },
    },
    output: {
      schema: { type: 'string' },
      render: (args, value) => [{ type: 'text', text: value }],
    },
    async execute(input) {
      const r = py('skill_gate.py', ['check-name', input.name])
      if (!r.ok) return `[skill_check_name] 失败：${r.out}`
      return r.out
    },
  }))

   // ---------- 钩子：SKILL.md 写入门禁（waterfall 契约：放行 next() / 拦截 {kind:'block'}；警告走 pendingWarns→pre-step 注入）----------
  const pendingWarns = []
  ctx.on('tools/pre-execute', async (exec, next) => {
    try {
      const toolName = exec?.name || exec?.tool || exec?.id || ''
      if (toolName === 'edit') return next()
      const args = exec?.args || {}
      const target = args.file_path || args.path || ''
      if (!target.includes('/skills/') || !target.endsWith('SKILL.md')) return next()
      // 只对 dsh skills 目录生效
      if (!target.startsWith(join(HOME, '.dsh', 'skills'))) return next()
      const r = py('skill_gate.py', ['audit', target])
      if (r.ok) {
        let data
        try { data = JSON.parse(r.out) } catch { return next() }
        if (data && data.ok === false) {
          const fails = (data.checks || []).filter((c) => !c.ok).map((c) => c.title)
          pendingWarns.push(`[skill-authoring] 该 SKILL.md 未通过 9 项门禁（未达标：${fails.join(' / ')}）。建议运行 skill_audit 补全。`)
        }
      }
    } catch {
      // 钩子失败不阻塞写操作
    }
    return next()
  })

  // 警告注入通道（与 dsh-cybernetics 同构）：agent/pre-step waterfall 追加 user 消息
  if (typeof ctx.on === 'function' && ctx.agents) {
    try {
      ctx.on('agent/pre-step', async (payload, next) => {
        const decision = await next()
        if (!decision || decision.kind === 'reject') return decision
        if (pendingWarns.length === 0) return decision
        const warns = pendingWarns.splice(0)
        try {
          const { createUserMessage } = await import('@deepseek-ai/dsh-llm')
          const msg = createUserMessage({
            content: [{ type: 'text', text: warns.join('\n') }],
            source: { kind: 'plugin', plugin: 'dsh-skill-authoring' },
          })
          return { ...decision, messages: [...decision.messages, msg] }
        } catch {
          return decision
        }
      })
    } catch { /* pre-step 不可用则跳过 */ }
  }
}
