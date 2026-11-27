import React from 'react';
import { Icon } from './ui';
import type { Theme } from './theme';

// The website's Tools menu: a premium launcher panel that drops from the top bar. A soft blurred scrim dims the page, and a centred
// panel lists every tool in three groups (Trade, Markets, Support), each as a card with a gradient icon tile, a title and a one-line hint.
// Same props as before (th, top, items, onClose), so Desktop.web.tsx needs no change. Click the scrim or press Esc (handled by the top bar) to close.
export type OrbitItem = { id: string; label: string; icon: string; on: boolean; badge: number; go: () => void };

const GROUPS: { name: string; hint: string; ids: string[] }[] = [
  { name: 'Trade', hint: 'Plan and review', ids: ['4', '9', '5'] },
  { name: 'Markets', hint: 'Stay informed', ids: ['8', '13', '19', '18', '17'] },
  { name: 'Support', hint: 'Help and setup', ids: ['14', '6', 'help'] },
];
const DESC: Record<string, string> = {
  '4': 'Size positions and set take-profit levels',
  '9': 'Checklist and performance, side by side',
  '5': 'Every trade you have taken, in one place',
  '8': 'Session times across the forex week',
  '13': 'Market-moving headlines as they land',
  '19': 'Compare crypto exchanges at a glance',
  '18': 'Find and compare forex brokers',
  '17': 'Prop firm rules, costs and payouts',
  '14': 'How to use the site, and about us',
  '6': 'Appearance, language and account',
  help: 'Chat with our support team',
};
const GLYPH: Record<string, string> = { 'help-circle': 'play-circle', 'chatbubbles-outline': 'chatbubble-ellipses', receipt: 'document-text' };

const CSS = `
.tm{position:fixed;left:0;right:0;bottom:0;z-index:30;direction:ltr;overflow-y:auto;display:flex;justify-content:center;align-items:flex-start;padding:0 20px 28px;
  font-family:Inter,Geist,'SF Pro Display',system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;
  background:var(--scrim);-webkit-backdrop-filter:blur(14px) saturate(1.2);backdrop-filter:blur(14px) saturate(1.2);animation:tm-fade .22s ease-out both}
.tm *{box-sizing:border-box}
@keyframes tm-fade{from{opacity:0}}
.tm-p{position:relative;width:100%;max-width:1080px;border-radius:12px;padding:1px;background:var(--rim);box-shadow:0 40px 90px -30px var(--sh),0 18px 40px -22px var(--sh);animation:tm-rise .38s cubic-bezier(.2,.8,.2,1) both}
@keyframes tm-rise{from{opacity:0;transform:translateY(-14px) scale(.985)}}
.tm-in{position:relative;border-radius:11px;background:var(--panel);overflow:hidden;color:var(--ink)}
.tm-in::before{content:"";position:absolute;left:-10%;right:-10%;top:-120px;height:260px;background:radial-gradient(50% 100% at 50% 0,var(--glow),transparent 72%);pointer-events:none}
.tm-hd{position:relative;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:22px 28px 18px;border-bottom:1px solid var(--hair)}
.tm-ttl{display:flex;align-items:center;gap:14px}
.tm-mark{width:42px;height:42px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:var(--grad);box-shadow:0 10px 22px -8px var(--tg),inset 0 1px 0 rgba(255,255,255,.45)}
.tm-h{font-size:20px;font-weight:700;letter-spacing:-.3px;line-height:1.2}
.tm-s{margin-top:2px;font-size:13px;color:var(--dim);font-weight:500}
.tm-x{display:flex;align-items:center;gap:10px;font-size:12px;color:var(--dim);font-weight:600}
.tm-k{padding:4px 8px;border-radius:5px;border:1px solid var(--line);background:var(--chip);font-size:11px;font-weight:700;letter-spacing:.4px;color:var(--dim)}
.tm-cl{width:34px;height:34px;border-radius:8px;border:1px solid var(--line);background:var(--chip);color:var(--ink);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s,border-color .2s,transform .2s}
.tm-cl:hover,.tm-cl:focus-visible{outline:none;background:var(--chiph);border-color:var(--acc);transform:rotate(90deg)}
.tm-g{position:relative;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0}
.tm-col{padding:22px 22px 24px;border-right:1px solid var(--hair);animation:tm-up .45s cubic-bezier(.2,.8,.2,1) both;animation-delay:var(--cd)}
.tm-col:last-child{border-right:0}
@keyframes tm-up{from{opacity:0;transform:translateY(10px)}}
.tm-gh{display:flex;align-items:baseline;justify-content:space-between;padding:0 8px 12px}
.tm-gn{font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:var(--acc)}
.tm-gt{font-size:12px;font-weight:500;color:var(--dim)}
.tm-c{position:relative;display:flex;align-items:center;gap:14px;width:100%;padding:11px 12px;margin:0 0 4px;border-radius:8px;border:1px solid transparent;background:transparent;color:var(--ink);text-align:left;font:inherit;cursor:pointer;
  transition:background .2s,border-color .2s,transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s}
.tm-c::before{content:"";position:absolute;left:0;top:18%;bottom:18%;width:3px;border-radius:3px;background:var(--grad);transform:scaleY(0);transition:transform .25s cubic-bezier(.2,.8,.2,1)}
.tm-c:hover,.tm-c:focus-visible{outline:none;background:var(--chip);border-color:var(--line);transform:translateX(3px);box-shadow:0 14px 26px -18px var(--sh)}
.tm-c:hover::before,.tm-c:focus-visible::before,.tm-c.on::before{transform:scaleY(1)}
.tm-c.on{background:var(--chip);border-color:var(--line)}
.tm-t{position:relative;flex:none;width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:var(--grad);box-shadow:0 8px 16px -8px var(--tg),inset 0 1px 0 rgba(255,255,255,.5),inset 0 -6px 10px rgba(0,0,40,.18);transition:transform .3s cubic-bezier(.2,.8,.2,1)}
.tm-t.v{background:var(--gradv);--tg:var(--tgv)}
.tm-c:hover .tm-t,.tm-c:focus-visible .tm-t{transform:scale(1.08) rotate(-4deg)}
.tm-bd{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:var(--sell);color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px var(--panel)}
.tm-tx{min-width:0;flex:1}
.tm-l{font-size:15px;font-weight:650;letter-spacing:-.1px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tm-d{margin-top:2px;font-size:12.5px;line-height:1.35;color:var(--dim);font-weight:500;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.tm-ar{flex:none;opacity:0;transform:translateX(-6px);color:var(--acc);transition:opacity .2s,transform .25s}
.tm-c:hover .tm-ar,.tm-c:focus-visible .tm-ar{opacity:1;transform:none}
.tm-now{flex:none;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:3px 7px;border-radius:4px;color:var(--acc);background:var(--accbg)}
@media (max-width:980px){.tm-g{grid-template-columns:1fr}.tm-col{border-right:0;border-bottom:1px solid var(--hair)}.tm-col:last-child{border-bottom:0}.tm-x .tm-k,.tm-x span{display:none}}
@media (prefers-reduced-motion:reduce){.tm,.tm-p,.tm-col{animation:none}.tm-c,.tm-t,.tm-cl,.tm-ar,.tm-c::before{transition:none}}
`;

export default function ToolsOrbit({ th, top, items, onClose }: { th: Theme; top: number; items: OrbitItem[]; onClose: () => void }) {
  const dk = th.dark;
  const acc = dk ? '#60A5FA' : '#2563EB';
  const v: any = {
    '--ink': th.text, '--dim': th.dim, '--sell': th.sell, '--acc': acc, '--accbg': dk ? 'rgba(96,165,250,.14)' : 'rgba(37,99,235,.1)',
    '--panel': th.panel, '--chip': th.panel2, '--chiph': dk ? '#243044' : '#E8EDF5',
    '--line': th.line, '--hair': th.hair,
    '--scrim': dk ? 'rgba(3,6,12,.66)' : 'rgba(15,23,42,.32)', '--sh': dk ? 'rgba(0,0,0,.7)' : 'rgba(15,23,42,.35)',
    '--rim': dk ? 'linear-gradient(135deg,rgba(96,165,250,.5),rgba(255,255,255,.06) 45%,rgba(96,165,250,.2))' : 'linear-gradient(135deg,rgba(37,99,235,.5),rgba(15,23,42,.08) 50%,rgba(37,99,235,.25))',
    '--glow': dk ? 'rgba(59,130,246,.16)' : 'rgba(37,99,235,.10)',
    '--grad': 'linear-gradient(145deg,#60A5FA,#3B82F6 55%,#2563EB)',
    '--gradv': 'linear-gradient(145deg,#3B82F6,#2563EB 55%,#1D4ED8)',
    '--tg': 'rgba(37,99,235,.55)', '--tgv': 'rgba(29,78,216,.55)',
  };
  const ic = '#FFFFFF';
  const byId = new Map(items.map((i) => [i.id, i]));
  const known = new Set(GROUPS.flatMap((g) => g.ids));
  const extra = items.filter((i) => !known.has(i.id)); // any item not listed above lands in an "More" group
  const groups = [...GROUPS.map((g) => ({ ...g, list: g.ids.map((id) => byId.get(id)).filter(Boolean) as OrbitItem[] })), ...(extra.length ? [{ name: 'More', hint: '', ids: [], list: extra }] : [])].filter((g) => g.list.length);
  let n = 0;
  return (
    <div className="tm" role="dialog" aria-label="Tools" onClick={onClose} style={{ ...v, top: top - 8, paddingTop: 12 }}>
      <style>{CSS}</style>
      <div className="tm-p" onClick={(e) => e.stopPropagation()}>
        <div className="tm-in">
          <div className="tm-hd">
            <div className="tm-ttl">
              <span className="tm-mark"><Icon name="construct" size={22} color={ic} /></span>
              <div><div className="tm-h">Tools</div><div className="tm-s">Everything you need to plan, track and trade smarter</div></div>
            </div>
            <div className="tm-x"><span>Close</span><span className="tm-k">ESC</span>
              <button type="button" className="tm-cl" aria-label="Close tools menu" onClick={onClose}><Icon name="close" size={18} color={th.text} /></button>
            </div>
          </div>
          <div className="tm-g">
            {groups.map((g, gi) => (
              <div key={g.name} className="tm-col" style={{ '--cd': `${0.05 + gi * 0.07}s` } as any}>
                <div className="tm-gh"><span className="tm-gn">{g.name}</span><span className="tm-gt">{g.hint}</span></div>
                {g.list.map((it) => {
                  const k = n++;
                  return (
                    <button key={it.id} type="button" className={`tm-c${it.on ? ' on' : ''}`} aria-label={it.label} aria-current={it.on ? 'page' : undefined} onClick={(e) => { e.stopPropagation(); it.go(); }}>
                      <span className={`tm-t${k % 2 ? ' v' : ''}`}>
                        <Icon name={GLYPH[it.icon] ?? it.icon} size={22} color={ic} />
                        {it.badge > 0 && <span className="tm-bd">{it.badge > 99 ? '99+' : it.badge}</span>}
                      </span>
                      <span className="tm-tx"><div className="tm-l">{it.label}</div>{DESC[it.id] && <div className="tm-d">{DESC[it.id]}</div>}</span>
                      {it.on ? <span className="tm-now">Open</span> : <span className="tm-ar"><Icon name="arrow-forward" size={16} color={acc} /></span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
