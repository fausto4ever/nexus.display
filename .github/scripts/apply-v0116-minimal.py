from pathlib import Path

styles = Path('styles.css')
text = styles.read_text(encoding='utf-8')
repls = {
    ':root{color-scheme:dark;--bg:#0b1020;--text:#f7f9fc;--muted:#9fb0cf;--ok:#49d18d;--warn:#ffbd5a;': ':root{color-scheme:dark;--bg:#0a0c10;--text:#f8fafc;--muted:#b8c0cc;--ok:#56d99b;--warn:#d3dae3;',
    'border-bottom:1px solid rgba(159,176,207,.16)': 'border-bottom:1px solid rgba(255,255,255,.10)',
    '.compact-counters>div{min-width:54px;padding:4px 7px;border:1px solid rgba(159,176,207,.1);border-radius:8px;background:rgba(18,26,46,.48);text-align:right}': '.compact-counters>div{min-width:50px;padding:4px 6px;border:1px solid rgba(255,255,255,.09);border-radius:8px;background:rgba(255,255,255,.035);text-align:right}',
    '.header-connection{opacity:.82}': '.header-connection-left{justify-content:flex-start;margin-top:5px;opacity:.82;color:#dfe5ec}',
    '.queue-card{min-width:0;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;padding:9px 11px;border:1px solid rgba(159,176,207,.11);border-radius:10px;background:rgba(11,16,32,.55);': '.queue-card{min-width:0;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;padding:9px 11px;border:1px solid rgba(255,255,255,.10);border-radius:10px;background:rgba(255,255,255,.025);',
    '.queue-position{width:30px;height:30px;display:grid;place-items:center;border-radius:8px;background:#1d2b4b;': '.queue-position{width:30px;height:30px;display:grid;place-items:center;border-radius:8px;background:rgba(255,255,255,.09);',
    '.queue-lane{min-height:0;display:flex;flex-direction:column;border:1px solid rgba(159,176,207,.12);border-radius:13px;background:rgba(18,26,46,.36);': '.queue-lane{min-height:0;display:flex;flex-direction:column;border:1px solid rgba(255,255,255,.10);border-radius:13px;background:rgba(255,255,255,.018);',
    'border-bottom:1px solid rgba(159,176,207,.1)': 'border-bottom:1px solid rgba(255,255,255,.08)',
    '.queue-lane-ready{border-color:rgba(255,189,90,.2);background:rgba(67,49,18,.2)}.queue-lane-ready .lane-heading{background:rgba(116,80,17,.16)}.queue-lane-waiting{opacity:.88}': '.queue-lane-ready{border-color:rgba(255,255,255,.12);background:rgba(255,255,255,.022)}.queue-lane-ready .lane-heading{background:rgba(255,255,255,.035)}.queue-lane-waiting{opacity:1}',
    '.queue-card.lane-ready .queue-position{background:#554116;color:#ffe8a6}': '.queue-card.lane-ready .queue-position{background:rgba(255,255,255,.09);color:var(--text)}',
    '.tip-strip{padding:7px 10px;border:1px solid rgba(159,176,207,.1);border-radius:9px;background:rgba(18,26,46,.45);color:#d7e1f3;': '.tip-strip{padding:7px 10px;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:rgba(255,255,255,.025);color:#eef2f7;',
    '.header-connection{gap:5px}.header-connection .connection-dot{width:7px;height:7px}.header-connection small{font-size:.49rem}': '.header-connection-left{gap:5px}.header-connection-left .connection-dot{width:7px;height:7px}.header-connection-left small{font-size:.49rem}',
}
for old, new in repls.items():
    if old not in text:
        raise SystemExit(f'pattern not found: {old[:90]}')
    text = text.replace(old, new)
styles.write_text(text, encoding='utf-8')

Path('src/version.js').write_text("export const APP_VERSION = '0.1.16';\n", encoding='utf-8')
package = Path('package.json').read_text(encoding='utf-8')
package = package.replace('"version": "0.1.15"', '"version": "0.1.16"')
Path('package.json').write_text(package, encoding='utf-8')
