from pathlib import Path


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'{label}: pattern not found')
    return text.replace(old, new, 1)

renderer = read('src/renderers/control-access.js')
old = '''      <div class="topbar-right display-status-area">
        ${cfg.showOfficialInsideCount!==false?`<section class="compact-counters"><div><strong>${n(counters.inside)}</strong><span>Dentro</span></div><div><strong>${n(counters.entriesToday??counters.entries)}</strong><span>Entradas</span></div><div><strong>${n(counters.exitsToday??counters.exits)}</strong><span>Salidas</span></div></section>`:''}
        <div class="clock-block"><strong>${esc(time)}</strong><span>${esc(date)}</span></div>
        <div class="connection-state"><span class="connection-dot ${model.online?'online':'offline'}"></span><small>${model.online?'Conectado':'Sin conexión'}</small></div>
      </div>
    </header>
    ${body}'''
new = '''      <div class="topbar-right display-status-area">
        <div class="clock-status-stack">
          <div class="clock-block"><strong>${esc(time)}</strong><span>${esc(date)}</span></div>
          <div class="connection-state"><span class="connection-dot ${model.online?'online':'offline'}"></span><small>${model.online?'Conectado':'Sin conexión'}</small></div>
        </div>
      </div>
    </header>
    ${cfg.showOfficialInsideCount!==false?`<div class="counters-row"><section class="compact-counters"><div><strong>${n(counters.inside)}</strong><span>Dentro</span></div><div><strong>${n(counters.entriesToday??counters.entries)}</strong><span>Entradas</span></div><div><strong>${n(counters.exitsToday??counters.exits)}</strong><span>Salidas</span></div></section></div>`:''}
    ${body}'''
renderer = replace_once(renderer, old, new, 'header structure')
write('src/renderers/control-access.js', renderer)

styles = read('styles.css')
styles = replace_once(
    styles,
    '.nexus-topbar{align-items:center;padding-bottom:10px}.instance-heading-wrap{min-width:0;display:flex;align-items:center;gap:10px}',
    '.nexus-topbar{align-items:center;padding:2px 0 10px}.instance-heading-wrap{min-width:0;display:flex;align-items:center;gap:10px;margin-left:-6px}',
    'left identity alignment'
)
styles = replace_once(
    styles,
    '.topbar-right{display:flex;align-items:center;gap:12px}.display-status-area{align-items:center}.compact-counters{display:flex;gap:7px}',
    '.topbar-right{display:flex;align-items:center;gap:12px}.display-status-area{align-items:flex-end}.clock-status-stack{display:grid;justify-items:end;gap:5px}.counters-row{flex:0 0 auto;display:flex;justify-content:flex-end;padding:7px 2px 0}.compact-counters{display:flex;gap:7px}',
    'status and counters layout'
)
styles = replace_once(
    styles,
    '.connection-state{min-width:62px;display:grid;justify-items:center;gap:5px;color:var(--muted)}.connection-state small{font-size:.55rem}',
    '.connection-state{min-width:0;display:flex;align-items:center;justify-content:flex-end;gap:6px;color:var(--muted)}.connection-state small{font-size:.58rem;font-weight:650}',
    'connection state layout'
)
styles = replace_once(
    styles,
    '.connection-state small,.screen-id-caption{display:none}',
    '.screen-id-caption{display:none}',
    'keep connected visible on mobile'
)
styles = replace_once(
    styles,
    '.compact-counters{flex:1}.compact-counters>div{flex:1}',
    '.compact-counters{flex:0 1 auto}.compact-counters>div{flex:1}',
    'mobile counters alignment'
)
write('styles.css', styles)

version = read('src/version.js')
version = replace_once(version, "export const APP_VERSION = '0.1.12';", "export const APP_VERSION = '0.1.13';", 'version')
write('src/version.js', version)

print('Nexus.Display 0.1.13 header layout applied')
