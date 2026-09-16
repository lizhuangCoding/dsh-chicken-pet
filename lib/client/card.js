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
import { createElement as h, useEffect, useRef, useState } from 'react';
import { Button, IconChevronDownOutline14, Switch } from '@deepseek-ai/dsh-client-ui-primitives';
/**
 * Settings namespace this card edits.
 *
 * Spelled here rather than imported from the host half: a client package must
 * not depend on a host package. The page pairs the two by this name alone.
 */
export const SETTINGS_NAMESPACE = 'chicken-pet';
/** The card's controls, grouped so the panel reads as sections, not a list. */
const GROUPS = [
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
];
/** Styles for the card, using the shell's own theme tokens. */
const CARD_STYLES = `
.cdpc {
  list-style: none;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: 16px;
  background: var(--dsw-alias-bg-layer-3);
  transition: border-color .16s, background .16s;
  font-size: 13px;
  line-height: 1.5;
}
.cdpc:hover { border-color: var(--dsw-alias-label-dimmed); }
.cdpc[data-open='true'] {
  background: var(--dsw-alias-bg-layer-2);
  border-color: var(--dsw-alias-label-dimmed);
}
.cdpc-head {
  box-sizing: border-box;
  width: 100%;
  appearance: none;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 16px;
}
/* The chevron is the shell's own 14px icon; keep it from flexing. */
.cdpc-head > svg { flex: none; width: 14px; height: 14px; }
.cdpc-head:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: -2px;
}
.cdpc-headtext { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.cdpc-name { font-size: 15px; font-weight: 600; line-height: 1.4; color: var(--dsw-alias-label-primary); }
.cdpc-desc { font-size: 13px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); }
.cdpc-chevron {
  flex: none;
  color: var(--dsw-alias-label-tertiary);
  transition: transform .16s;
}
.cdpc[data-open='true'] .cdpc-chevron { transform: rotate(180deg); }
.cdpc-body {
  border-top: 0.5px solid var(--dsw-alias-border-l2);
  margin: 0 16px;
  padding: 4px 0 8px;
}
.cdpc-group { padding: 12px 0; }
.cdpc-group + .cdpc-group { border-top: 0.5px solid var(--dsw-alias-border-l2); }
.cdpc-grouptitle {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: .02em;
  color: var(--dsw-alias-label-tertiary);
  margin-bottom: 10px;
}
.cdpc-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 4px 16px;
  padding: 7px 0;
}
.cdpc-label { display: flex; align-items: center; gap: 8px; color: var(--dsw-alias-label-primary); }
.cdpc-hint { grid-column: 1; font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.cdpc-control { grid-column: 2; grid-row: 1 / span 2; display: flex; align-items: center; gap: 10px; }
.cdpc-number { width: 88px; }
.cdpc-slider { display: flex; align-items: center; gap: 10px; }
.cdpc-slider input[type='range'] { width: 150px; accent-color: var(--dsw-alias-brand-primary); }
.cdpc-value {
  min-width: 34px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-tertiary);
}
.cdpc-corners { display: grid; grid-template-columns: repeat(2, 18px); gap: 3px; }
.cdpc-corner {
  width: 18px; height: 18px; padding: 0; cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l3);
  border-radius: 4px;
  background: var(--dsw-alias-bg-layer-2);
  /* The fill marks the corner the pet rests in, so an unselected box has to
     stay visible against the card and a selected one has to stay distinct
     from the border colour. */
  background-image: radial-gradient(circle at center, var(--dsw-alias-label-dimmed) 2px, transparent 2px);
}
.cdpc-corner:hover { border-color: var(--dsw-alias-label-dimmed); }
.cdpc-corner[data-active='true'] {
  background-color: var(--dsw-alias-brand-primary);
  border-color: var(--dsw-alias-brand-primary);
  background-image: radial-gradient(circle at center, #fff 2px, transparent 2px);
}
.cdpc-reset {
  appearance: none; border: 0; background: none; padding: 0 2px; margin-left: 4px;
  font: inherit; font-size: 12px; cursor: pointer;
  color: var(--dsw-alias-label-tertiary);
  text-decoration: underline dotted;
}
.cdpc-reset:hover { color: var(--dsw-alias-label-primary); }
.cdpc-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 0 4px;
  border-top: 0.5px solid var(--dsw-alias-border-l2);
}
.cdpc-status { flex: 1; min-width: 0; font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.cdpc-error { flex: 1; min-width: 0; font-size: 12px; color: var(--dsw-alias-label-error); }
.cdpc-pending { flex: none; font-size: 12px; color: var(--dsw-alias-label-tertiary); }
`;
/**
 * Render the disclosure chevron.
 *
 * The shell's own icon rather than a drawn one: it carries explicit width and
 * height attributes, so it cannot stretch to fill the header the way an
 * attribute-less inline SVG does.
 * @param props - the icon's class name.
 * @returns the chevron icon element.
 */
function Chevron(props) {
    return h(IconChevronDownOutline14, { className: props.className });
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
function effectiveValues(snapshot, staged) {
    return { ...(snapshot.value ?? {}), ...staged };
}
/**
 * Render one field's control.
 * @param spec - the field's description.
 * @param value - the effective value.
 * @param overridden - whether the user layer sets this field.
 * @param disabled - whether writing is refused.
 * @param commit - apply a staged edit.
 * @param reset - clear the field back to the composition layer.
 * @returns the row element.
 */
function renderField(spec, value, overridden, disabled, commit, reset) {
    let control;
    switch (spec.kind) {
        case 'toggle':
            control = h(Switch, {
                checked: value === true,
                disabled,
                label: spec.label,
                onChange: (next) => commit(spec.field, next),
            });
            break;
        case 'slider': {
            const numeric = typeof value === 'number' ? value : 0;
            control = h('div', { className: 'cdpc-slider' }, h('input', {
                type: 'range',
                min: spec.min,
                max: spec.max,
                step: spec.step,
                value: numeric,
                disabled,
                'aria-label': spec.label,
                onChange: (e) => commit(spec.field, Number(e.target.value)),
            }), h('span', { className: 'cdpc-value' }, (spec.format ?? String)(numeric)));
            break;
        }
        case 'number': {
            const numeric = typeof value === 'number' ? value : 0;
            control = h('input', {
                type: 'number',
                className: 'cdpc-number',
                value: numeric,
                disabled,
                'aria-label': spec.label,
                onChange: (e) => {
                    const next = Number(e.target.value);
                    if (Number.isFinite(next))
                        commit(spec.field, next);
                },
            });
            break;
        }
        case 'corner': {
            const corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
            const labels = {
                'top-left': '左上', 'top-right': '右上', 'bottom-left': '左下', 'bottom-right': '右下',
            };
            control = h('div', { className: 'cdpc-corners' }, corners.map(corner => h('button', {
                key: corner,
                type: 'button',
                title: labels[corner],
                'aria-label': labels[corner],
                'aria-pressed': value === corner,
                className: 'cdpc-corner',
                'data-active': String(value === corner),
                disabled,
                onClick: () => commit(spec.field, corner),
            })));
            break;
        }
        default:
            control = null;
    }
    return h('div', { className: 'cdpc-row', key: spec.field }, h('div', { className: 'cdpc-label' }, h('span', null, spec.label), overridden
        ? h('button', {
            type: 'button',
            className: 'cdpc-reset',
            title: '恢复默认',
            onClick: () => reset(spec.field),
        }, '重置')
        : null), h('div', { className: 'cdpc-hint' }, spec.hint), h('div', { className: 'cdpc-control' }, control));
}
/**
 * Render the pet's settings card.
 * @param props - the injected face, spread onto props by the renderer.
 * @returns the card element.
 */
export function ChickenPetCard(props) {
    const face = props;
    const [snapshot, setSnapshot] = useState(() => face.getSnapshot());
    const [staged, setStaged] = useState({});
    const [saving, setSaving] = useState(false);
    const [failed, setFailed] = useState(false);
    // `__open` lets the package's own tests render the disclosed state without a
    // browser; the page never passes it.
    const [open, setOpen] = useState(props.__open === true);
    const saveStarted = useRef(false);
    useEffect(() => {
        setSnapshot(face.getSnapshot());
        return face.subscribe(() => setSnapshot(face.getSnapshot()));
    }, [face]);
    const values = effectiveValues(snapshot, staged);
    const user = (snapshot.user ?? {});
    const dirty = Object.keys(staged).length > 0;
    // Collapse once the write settles cleanly. A rejected write keeps its drafts
    // and diagnostics on screen so the user can correct them.
    useEffect(() => {
        if (saving) {
            saveStarted.current = true;
            return;
        }
        if (!saveStarted.current)
            return;
        saveStarted.current = false;
        if (!dirty && !failed)
            setOpen(false);
    }, [dirty, failed, saving]);
    const commit = (field, value) => {
        setStaged(current => ({ ...current, [field]: value }));
        setFailed(false);
    };
    const reset = (field) => {
        // A field the user edited but never saved needs no wire call: dropping the
        // staged value restores the stored one.
        if (field in staged) {
            setStaged((current) => {
                const next = { ...current };
                delete next[field];
                return next;
            });
            return;
        }
        void face.reset(field);
    };
    const save = async () => {
        setSaving(true);
        setFailed(false);
        try {
            for (const [field, value] of Object.entries(staged))
                await face.set(field, value);
            setStaged({});
        }
        catch {
            setFailed(true);
        }
        finally {
            setSaving(false);
        }
    };
    const discard = () => {
        setStaged({});
        setFailed(false);
    };
    if (snapshot.status === 'loading') {
        return h('li', { className: 'cdpc' }, h('div', { className: 'cdpc-head' }, h('span', { className: 'cdpc-desc' }, '读取设置中…')));
    }
    if (snapshot.status === 'unavailable')
        return null;
    const disabled = !snapshot.writable;
    return h('li', { className: 'cdpc', 'data-open': String(open) }, h('button', {
        type: 'button',
        className: 'cdpc-head',
        'aria-expanded': open,
        'aria-label': `${open ? '收起' : '展开'}: 🐔 小鸡桌宠`,
        onClick: () => setOpen(!open),
    }, h('span', { className: 'cdpc-headtext' }, h('span', { className: 'cdpc-name' }, '🐔 小鸡桌宠'), h('span', { className: 'cdpc-desc' }, '一只会自己找事做的像素鸡，跟着 Agent 的工作状态活动。')), dirty ? h('span', { className: 'cdpc-pending' }, '未保存') : null, h(Chevron, { className: 'cdpc-chevron' })), open
        ? h('div', { className: 'cdpc-body' }, ...GROUPS.map(group => h('div', { className: 'cdpc-group', key: group.title }, h('div', { className: 'cdpc-grouptitle' }, group.title), ...group.fields.map(spec => renderField(spec, values[spec.field], spec.field in user, disabled, commit, reset)))), h('div', { className: 'cdpc-footer' }, failed
            ? h('span', { className: 'cdpc-error', role: 'status' }, '保存失败，请重试。')
            : h('span', { className: 'cdpc-status' }, disabled ? '当前部署只读。' : dirty ? `有 ${Object.keys(staged).length} 项未保存` : '改动会保存到你的配置。'), h(Button, {
            size: 'sm',
            disabled: !dirty || saving,
            onClick: discard,
        }, '放弃'), h(Button, {
            variant: 'primary',
            size: 'sm',
            disabled: !dirty || saving || disabled,
            onClick: () => { void save(); },
        }, saving ? '保存中…' : '保存')))
        : null);
}
/**
 * Register the card with the settings page.
 *
 * @param ctx - client registrant context.
 * @param scope - the bound scope for this plugin's settings namespace.
 * @returns nothing.
 */
export function installCard(ctx, scope) {
    const styleId = 'chicken-pet-card-styles';
    if (typeof document !== 'undefined' && document.getElementById(styleId) === null) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = CARD_STYLES;
        document.head.appendChild(style);
    }
    const face = {
        getSnapshot: () => scope.getSnapshot(),
        subscribe: listener => scope.subscribe(listener),
        set: (field, value) => scope.set(field, value),
        reset: field => scope.unset(field),
    };
    const slots = ctx.get('slots');
    if (slots === undefined || typeof slots.inject !== 'function') {
        console.warn('[chicken-pet] the slot registry is unavailable; the settings card is skipped');
        return;
    }
    ctx.effect(() => slots.inject('settings.plugin.item', () => slots.register({ name: 'settings.plugin.item', key: SETTINGS_NAMESPACE, inject: () => face }, ChickenPetCard)));
}
