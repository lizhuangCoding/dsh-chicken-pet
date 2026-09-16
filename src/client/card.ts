/**
 * The pet's card on the Web settings page.
 *
 * The page dispatches one card per settings namespace the host serves, keyed by
 * that namespace, so registering here is what puts the pet's options in the
 * interface instead of leaving users to edit `cordis.patch.yml` by hand.
 *
 * The card follows the same shape as the ones DSH ships: a header that names
 * the plugin and discloses its controls in place, a chevron that turns over
 * when open, a pending marker that survives collapsing, and a footer with
 * discard and save. Edits are staged locally and written on save rather than
 * committed on every keystroke, so a slider drag is one write instead of fifty.
 *
 * Two constraints come from the browser shell rather than from taste:
 *
 * - Only its platform modules resolve, so this card may require `react` and
 *   `@deepseek-ai/dsh-client-ui-primitives` and nothing else. `clsx` is not on
 *   that list; class names are composed with plain string joins.
 * - The inject face is spread onto props, not nested under `inject`. The face's
 *   `hooks` compartment becomes `use<Name>` and every other member lands at the
 *   top level, which is why a shipped card writes `props.save`.
 */

import type { Context } from '@deepseek-ai/cordis'
import { createElement as h, useEffect, useRef, useState } from 'react'
import { Button, IconChevronDownOutline14, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type { Config } from './config.ts'
import { CARD_STYLES } from './card-styles.ts'

/**
 * Settings namespace this card edits.
 *
 * Spelled here rather than imported from the host half: a client package must
 * not depend on a host package. The page pairs the two by this name alone.
 */
export const SETTINGS_NAMESPACE = 'chicken-pet'

/** A field on the settings scope. */
type Field = keyof Config

/** The shape of the live settings section. */
export interface ScopeSnapshot {
  status: 'loading' | 'ready' | 'unavailable'
  value: Partial<Config> | undefined
  base: unknown
  user: unknown
  revision: number | undefined
  writable: boolean
}

/** What the card's registration injects, spread onto props by the renderer. */
export interface CardFace {
  /** Live scope snapshot. */
  getSnapshot(): ScopeSnapshot
  /** Subscribe to snapshot changes. */
  subscribe(listener: () => void): () => void
  /** Persist one field. */
  set(field: string, value: unknown): Promise<void>
  /** Clear one field back to the composition layer. */
  reset(field: string): Promise<void>
}

/** How one field is drawn. */
interface FieldSpec {
  field: Field
  label: string
  hint: string
  kind: 'toggle' | 'slider' | 'number' | 'corner'
  min?: number
  max?: number
  step?: number
  /** Rendered value for sliders, so `0.75` does not show as `0.7500001`. */
  format?: (value: number) => string
}

/** The card's controls, grouped so the panel reads as sections, not a list. */
const GROUPS: ReadonlyArray<{ title: string; fields: readonly FieldSpec[] }> = [
  {
    title: '显示',
    fields: [
      { field: 'enabled', label: '显示桌宠', hint: '关掉后小鸡从界面消失，设置保留。', kind: 'toggle' },
      { field: 'corner', label: '停靠角落', hint: '拖走之后以拖动的位置为准。', kind: 'corner' },
      { field: 'size', label: '大小', hint: '渲染宽度，高度按 192:208 自动计算。', kind: 'number' },
    ],
  },
  {
    title: '活跃度',
    fields: [
      {
        field: 'liveliness',
        label: '活跃度',
        hint: '平时它自己找事做。0 = 几乎不动，1 = 一刻不停。',
        kind: 'slider',
        min: 0,
        max: 1,
        step: 0.05,
        format: v => v.toFixed(2),
      },
      { field: 'idleMinSec', label: '最短间隔', hint: '两次自主行为之间至少隔几秒。', kind: 'number' },
      { field: 'idleMaxSec', label: '最长间隔', hint: '最长间隔，必须不小于最短间隔。', kind: 'number' },
    ],
  },
  {
    title: '声音',
    fields: [
      { field: 'sound', label: '叫声', hint: 'AI 每答完一段时叫一声。', kind: 'toggle' },
      {
        field: 'volume',
        label: '音量',
        hint: '0 到 1。',
        kind: 'slider',
        min: 0,
        max: 1,
        step: 0.05,
        format: v => v.toFixed(2),
      },
    ],
  },
]


/**
 * Render the disclosure chevron.
 *
 * The shell's own icon rather than a drawn one: it carries explicit width and
 * height attributes, so it cannot stretch to fill the header the way an
 * attribute-less inline SVG does.
 * @param props - the icon's class name.
 * @returns the chevron icon element.
 */
function Chevron(props: { className?: string }) {
  return h(IconChevronDownOutline14, { className: props.className })
}

/**
 * Read the working value of every field.
 *
 * A staged edit wins over the stored one, so the form shows what the user is
 * about to save rather than what is currently saved.
 * @param snapshot - the live scope snapshot.
 * @param staged - fields the user has edited but not saved.
 * @returns the effective value of each field.
 */
function effectiveValues(snapshot: ScopeSnapshot, staged: Record<string, unknown>): Partial<Config> {
  return { ...(snapshot.value ?? {}), ...staged } as Partial<Config>
}

/**
 * Render one field's control.
 * @param spec - the field's description.
 * @param value - the effective value.
 * @param disabled - whether writing is refused.
 * @param commit - apply a staged edit.
 * @returns the row element.
 */
function renderField(
  spec: FieldSpec,
  value: unknown,
  disabled: boolean,
  commit: (field: Field, value: unknown) => void,
) {
  let control
  switch (spec.kind) {
    case 'toggle':
      control = h(Switch, {
        checked: value === true,
        disabled,
        label: spec.label,
        onChange: (next: boolean) => commit(spec.field, next),
      })
      break
    case 'slider': {
      const numeric = typeof value === 'number' ? value : 0
      control = h('div', { className: 'cdpc-slider' },
        h('input', {
          type: 'range',
          min: spec.min,
          max: spec.max,
          step: spec.step,
          value: numeric,
          disabled,
          'aria-label': spec.label,
          onChange: (e: { target: { value: string } }) => commit(spec.field, Number(e.target.value)),
        }),
        h('span', { className: 'cdpc-value' }, (spec.format ?? String)(numeric)))
      break
    }
    case 'number': {
      const numeric = typeof value === 'number' ? value : 0
      control = h('input', {
        type: 'number',
        className: 'cdpc-number',
        value: numeric,
        disabled,
        'aria-label': spec.label,
        onChange: (e: { target: { value: string } }) => {
          const next = Number(e.target.value)
          if (Number.isFinite(next)) commit(spec.field, next)
        },
      })
      break
    }
    case 'corner': {
      const corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const
      const labels: Record<string, string> = {
        'top-left': '左上', 'top-right': '右上', 'bottom-left': '左下', 'bottom-right': '右下',
      }
      control = h('div', { className: 'cdpc-corners' },
        corners.map(corner => h('button', {
          key: corner,
          type: 'button',
          title: labels[corner],
          'aria-label': labels[corner],
          'aria-pressed': value === corner,
          className: 'cdpc-corner',
          'data-active': String(value === corner),
          disabled,
          onClick: () => commit(spec.field, corner),
        })))
      break
    }
    default:
      control = null
  }

  return h('div', { className: 'cdpc-row', key: spec.field },
    h('div', { className: 'cdpc-label' }, h('span', null, spec.label)),
    h('div', { className: 'cdpc-hint' }, spec.hint),
    h('div', { className: 'cdpc-control' }, control))
}

/**
 * Render the pet's settings card.
 * @param props - the injected face, spread onto props by the renderer.
 * @returns the card element.
 */
export function ChickenPetCard(props: CardFace & { __open?: boolean }) {
  const face = props
  const [snapshot, setSnapshot] = useState<ScopeSnapshot>(() => face.getSnapshot())
  const [staged, setStaged] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  // `__open` lets the package's own tests render the disclosed state without a
  // browser; the page never passes it.
  const [open, setOpen] = useState(props.__open === true)
  const saveStarted = useRef(false)

  useEffect(() => {
    setSnapshot(face.getSnapshot())
    return face.subscribe(() => setSnapshot(face.getSnapshot()))
  }, [face])

  const values = effectiveValues(snapshot, staged)
  const user = (snapshot.user ?? {}) as Record<string, unknown>
  const dirty = Object.keys(staged).length > 0
  // Whether any field still differs from the composition layer: the reset button
  // has nothing to do once every override is gone.
  const anyOverridden = Object.keys(user).length > 0

  // Collapse once the write settles cleanly. A rejected write keeps its drafts
  // and diagnostics on screen so the user can correct them.
  useEffect(() => {
    if (saving) {
      saveStarted.current = true
      return
    }
    if (!saveStarted.current) return
    saveStarted.current = false
    if (!dirty && !failed) setOpen(false)
  }, [dirty, failed, saving])

  const commit = (field: Field, value: unknown): void => {
    setStaged(current => ({ ...current, [field]: value }))
    setFailed(false)
  }

  /**
   * Clear every field the user has overridden, returning the card to the
   * composition defaults.
   *
   * Staged edits need no wire call — dropping them restores the stored value —
   * so only fields already saved are unset on the host.
   * @returns fulfillment after every host write settles.
   */
  const restoreDefaults = async (): Promise<void> => {
    const saved = Object.keys(user).filter(field => !(field in staged))
    setStaged({})
    setFailed(false)
    if (saved.length === 0) return
    setSaving(true)
    try {
      for (const field of saved) await face.reset(field)
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  const save = async (): Promise<void> => {
    setSaving(true)
    setFailed(false)
    try {
      for (const [field, value] of Object.entries(staged)) await face.set(field, value)
      setStaged({})
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  const discard = (): void => {
    setStaged({})
    setFailed(false)
  }

  if (snapshot.status === 'loading') {
    return h('li', { className: 'cdpc' },
      h('div', { className: 'cdpc-head' }, h('span', { className: 'cdpc-desc' }, '读取设置中…')))
  }
  if (snapshot.status === 'unavailable') return null

  const disabled = !snapshot.writable

  return h('li', { className: 'cdpc', 'data-open': String(open) },
    h('button', {
      type: 'button',
      className: 'cdpc-head',
      'aria-expanded': open,
      'aria-label': `${open ? '收起' : '展开'}: 🐔 小鸡桌宠`,
      onClick: () => setOpen(!open),
    },
      h('span', { className: 'cdpc-headtext' },
        h('span', { className: 'cdpc-name' }, '🐔 小鸡桌宠'),
        h('span', { className: 'cdpc-desc' }, '一只会自己找事做的像素鸡，跟着 Agent 的工作状态活动。')),
      dirty ? h('span', { className: 'cdpc-pending' }, '未保存') : null,
      h(Chevron, { className: 'cdpc-chevron' })),
    open
      ? h('div', { className: 'cdpc-body' },
        ...GROUPS.map(group => h('div', { className: 'cdpc-group', key: group.title },
          h('div', { className: 'cdpc-grouptitle' }, group.title),
          ...group.fields.map(spec =>
            renderField(spec, values[spec.field], disabled, commit)))),
        h('div', { className: 'cdpc-footer' },
          failed
            ? h('span', { className: 'cdpc-error', role: 'status' }, '保存失败，请重试。')
            : h('span', { className: 'cdpc-status' },
              disabled ? '当前部署只读。' : dirty ? `有 ${Object.keys(staged).length} 项未保存` : '改动会保存到你的配置。'),
          // One reset for the whole card rather than one per field: a row of
          // identical "reset" links competes with the labels for attention, and
          // restoring defaults is a whole-panel action anyway.
          h(Button, {
            size: 'sm',
            disabled: saving || disabled || (!dirty && !anyOverridden),
            onClick: () => { void restoreDefaults() },
          }, '恢复默认'),
          h(Button, {
            size: 'sm',
            disabled: !dirty || saving,
            onClick: discard,
          }, '放弃'),
          h(Button, {
            variant: 'primary',
            size: 'sm',
            disabled: !dirty || saving || disabled,
            onClick: () => { void save() },
          }, saving ? '保存中…' : '保存')))
      : null)
}

/**
 * Register the card with the settings page.
 *
 * @param ctx - client registrant context.
 * @param scope - the bound scope for this plugin's settings namespace.
 * @returns nothing.
 */
export function installCard(ctx: Context, scope: {
  getSnapshot(): ScopeSnapshot
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<void>
  unset(field: string): Promise<void>
}): void {
  const styleId = 'chicken-pet-card-styles'
  if (typeof document !== 'undefined' && document.getElementById(styleId) === null) {
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = CARD_STYLES
    document.head.appendChild(style)
  }

  const face: CardFace = {
    getSnapshot: () => scope.getSnapshot(),
    subscribe: listener => scope.subscribe(listener),
    set: (field, value) => scope.set(field, value),
    reset: field => scope.unset(field),
  }

  const slots = ctx.get('slots') as {
    register(options: unknown, component: unknown): () => void
    inject(key: string, callback: () => () => void): () => void
  } | undefined

  if (slots === undefined || typeof slots.inject !== 'function') {
    console.warn('[chicken-pet] the slot registry is unavailable; the settings card is skipped')
    return
  }

  ctx.effect(() => slots.inject('settings.plugin.item', () => slots.register(
    { name: 'settings.plugin.item', key: SETTINGS_NAMESPACE, inject: () => face },
    ChickenPetCard,
  )))
}
