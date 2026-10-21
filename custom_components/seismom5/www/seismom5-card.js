/* SeismoM5 card — live earthquake graph + settings panel for Home Assistant.
   Front: live chart via the integration proxy /api/seismom5/status.
   Back: device settings read/written through /api/seismom5/settings and /api/seismom5/action. */

const VERSION = '1.2.0';
const C = { ok: '#22c55e', warn: '#f59e0b', bad: '#ef4444', a: '#3b82f6' };
const ic = (i) => `<ha-icon icon="${i}"></ha-icon>`;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hexA = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const fmtUp = (s) => { s = s || 0; const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`; };
const wifiIcon = (r) => r == null ? 'mdi:wifi-off' : r > -55 ? 'mdi:wifi-strength-4' : r > -65 ? 'mdi:wifi-strength-3' : r > -75 ? 'mdi:wifi-strength-2' : 'mdi:wifi-strength-1';

const LOGO = `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><defs><linearGradient id="slg" x1="0" x2="1"><stop offset="0" stop-color="#22c55e"/><stop offset="1" stop-color="#3b82f6"/></linearGradient></defs><path stroke="url(#slg)" d="M2 12h3l2-5 3 10 3-14 3 13 2-6 1 2h3"/></svg>`;

const TABS = [
  { id: 'detect', label: 'Detection', icon: 'mdi:pulse', groups: [
    { rows: [
      { k: 'pga_trigger', t: 'num', label: 'PGA trigger', desc: 'Alarm threshold (ignored in STA/LTA mode)', step: 0.0005, min: 0.0005, max: 2, unit: 'g' },
      { k: 'sta_lta', t: 'sw', label: 'STA/LTA method', desc: 'Short/long term average ratio instead of PGA' },
      { k: 'update_period', t: 'num', label: 'Event update period', desc: 'Interval between MQTT event messages', step: 1, min: 1, max: 3600, unit: 's' },
    ] },
    { title: 'Logging', rows: [
      { k: 'logging', t: 'seg', label: 'Log output', options: ['None', 'Serial', 'Web', 'Both'] },
    ] },
  ] },
  { id: 'device', label: 'Device', icon: 'mdi:cellphone-cog', groups: [
    { rows: [
      { k: 'lcd_brightness', t: 'num', label: 'LCD standby brightness', desc: '7 (dim) – 15 (bright)', step: 1, min: 7, max: 15 },
      { k: 'speaker_enable', t: 'sw', label: 'Speaker', desc: 'Beep when an earthquake is detected' },
      { k: 'continuous_graph', t: 'sw', label: 'Continuous graph', desc: 'Keep drawing the graph on the LCD' },
    ] },
    { title: 'Master / slave', rows: [
      { k: 'master', t: 'sw', label: 'Master mode', desc: 'Alarm only when the slave sensor confirms' },
    ] },
  ] },
  { id: 'mqtt', label: 'MQTT', icon: 'mdi:cloud-outline', groups: [
    { title: 'Broker', rows: [
      { k: 'mqtt_enabled', t: 'sw', label: 'MQTT enabled' },
      { k: 'mqtt_host', t: 'txt', label: 'Host' },
      { k: 'mqtt_port', t: 'num', label: 'Port', step: 1, min: 1, max: 65535 },
      { k: 'mqtt_user', t: 'txt', label: 'Username' },
      { k: 'mqtt_pass', t: 'pw', label: 'Password' },
    ] },
    { title: 'Topics', rows: [
      { k: 'mqtt_base', t: 'txt', label: 'Base topic' },
      { k: 'mqtt_slave_topic', t: 'txt', label: 'Slave state topic' },
    ] },
    { title: 'Home Assistant discovery', rows: [
      { k: 'ha_discovery', t: 'sw', label: 'MQTT discovery', desc: 'Not needed when using this integration' },
      { k: 'ha_prefix', t: 'txt', label: 'Discovery prefix' },
    ] },
  ] },
  { id: 'net', label: 'Network', icon: 'mdi:wifi', note: 'Changing WiFi makes the device reconnect. If it cannot join, it starts its setup access point.', groups: [
    { title: 'WiFi', rows: [
      { k: 'wifi_ssid', t: 'txt', label: 'SSID' },
      { k: 'wifi_pass', t: 'pw', label: 'Password' },
    ] },
    { title: 'Web interface login', rows: [
      { k: 'web_user', t: 'txt', label: 'Username', desc: 'Empty = no login. Update the integration credentials too.' },
      { k: 'web_pass', t: 'pw', label: 'Password' },
    ] },
  ] },
  { id: 'system', label: 'System', icon: 'mdi:information-outline' },
];

const CSS = `
:host{display:block;height:100%}
ha-card{height:100%;overflow:hidden;position:relative;display:flex;flex-direction:column;container-type:inline-size;font-family:var(--ha-font-family-body,Roboto,sans-serif)}
.wrap{position:relative;flex:1;display:flex;flex-direction:column;perspective:1400px;min-height:0}
.inner{position:relative;flex:1;display:flex;flex-direction:column;min-height:0;transform-style:preserve-3d;transition:transform .55s cubic-bezier(.4,.2,.2,1)}
.wrap.flipped .inner{transform:rotateY(180deg)}
.face{backface-visibility:hidden;-webkit-backface-visibility:hidden}
.wrap.flipped .front,.wrap:not(.flipped) .back{pointer-events:none}
.front{flex:1;display:flex;flex-direction:column;gap:12px;padding:14px 16px 12px;min-height:0}
.back{position:absolute;inset:0;transform:rotateY(180deg);display:flex;flex-direction:column;overflow:hidden;border-radius:var(--ha-card-border-radius,12px);background:var(--ha-card-background,var(--card-background-color,#1c1c1c))}
@media (prefers-reduced-motion:reduce){.inner{transition:none}}

.top{display:flex;align-items:center;gap:12px}
.logo{width:38px;height:38px;border-radius:11px;flex:none;display:grid;place-items:center;background:linear-gradient(135deg,rgba(34,197,94,.18),rgba(59,130,246,.18))}
.logo svg{width:22px;height:22px}
.ttl{flex:1;min-width:0}
.name{font-size:16px;font-weight:600;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sub{font-size:12px;color:var(--secondary-text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.status{flex:none;display:inline-flex;align-items:center;gap:7px;padding:5px 12px 5px 10px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.05em;background:rgba(127,127,127,.15);color:var(--secondary-text-color)}
.status .dot{width:8px;height:8px;border-radius:50%;background:currentColor}
.status.ok{background:rgba(34,197,94,.14);color:${C.ok}}
.status.ok .dot{animation:ping 2s infinite}
.status.warn{background:rgba(245,158,11,.15);color:${C.warn}}
.status.bad{background:${C.bad};color:#fff;animation:blink 1s infinite}
@keyframes ping{0%{box-shadow:0 0 0 0 rgba(34,197,94,.55)}70%{box-shadow:0 0 0 6px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}
@keyframes blink{50%{opacity:.65}}

.kpis{display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr;gap:8px}
.kpi{min-width:0;padding:8px 10px;border-radius:12px;background:var(--secondary-background-color,rgba(127,127,127,.1))}
.kpi label{display:block;font-size:10.5px;font-weight:500;text-transform:uppercase;letter-spacing:.06em;color:var(--secondary-text-color)}
.kpi b{display:block;margin-top:2px;font-size:16px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kpi.main b{font-size:22px;line-height:1.15}
.kpi.main small{margin-left:3px;font-size:12px;font-weight:500;color:var(--secondary-text-color)}
.bar{height:4px;margin-top:6px;border-radius:2px;overflow:hidden;background:rgba(127,127,127,.2)}
.bar i{display:block;height:100%;width:0;border-radius:2px;background:${C.ok};transition:width .3s,background .3s}

.chart{position:relative;flex:1 1 150px;min-height:80px;border-radius:12px;overflow:hidden;background:var(--secondary-background-color,rgba(127,127,127,.08))}
.chart canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.ov{position:absolute;inset:0;display:none;place-items:center;text-align:center;font-size:13px;color:var(--primary-text-color);background:rgba(0,0,0,.35);backdrop-filter:blur(2px)}
.ov.show{display:grid}
.ov ha-icon{display:block;margin:0 auto 4px;--mdc-icon-size:26px;color:${C.warn}}

.foot{display:flex;align-items:center;gap:8px}
.meta{flex:1;min-width:0;display:flex;align-items:center;gap:12px;font-size:12px;color:var(--secondary-text-color);white-space:nowrap;overflow:hidden}
.meta span{display:inline-flex;align-items:center;gap:4px}
.meta ha-icon{--mdc-icon-size:16px}
.meta .on ha-icon{color:${C.ok}}
.meta .off ha-icon{color:${C.bad}}
.actions{flex:none;display:flex;gap:6px}
.act{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:34px;padding:0 12px;border-radius:10px;border:1px solid var(--divider-color,rgba(127,127,127,.25));background:transparent;color:var(--primary-text-color);font:inherit;font-size:13px;font-weight:500;cursor:pointer;transition:background .15s,border-color .15s,color .15s}
.act ha-icon{--mdc-icon-size:18px}
.act:hover{background:rgba(127,127,127,.12)}
.act.icon{width:34px;padding:0}
.act.primary{background:var(--primary-color,#03a9f4);border-color:transparent;color:var(--text-primary-color,#fff)}
.act.primary:hover{filter:brightness(1.1)}
.act.confirm{background:${C.warn};border-color:${C.warn};color:#111}
.act.danger.confirm{background:${C.bad};border-color:${C.bad};color:#fff}

.toast{position:absolute;left:50%;bottom:14px;z-index:5;transform:translate(-50%,16px);opacity:0;pointer-events:none;max-width:90%;padding:8px 14px;border-radius:999px;font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:var(--primary-text-color,#fff);color:var(--card-background-color,#111);box-shadow:0 6px 20px rgba(0,0,0,.3);transition:opacity .25s,transform .25s}
.toast.show{opacity:1;transform:translate(-50%,0)}
.toast.err{background:${C.bad};color:#fff}

.bhead{display:flex;align-items:center;gap:6px;padding:10px 12px 8px}
.iconbtn{width:36px;height:36px;flex:none;display:grid;place-items:center;border:none;border-radius:50%;background:transparent;color:var(--primary-text-color);cursor:pointer}
.iconbtn:hover{background:rgba(127,127,127,.15)}
.btitle{flex:1;font-size:16px;font-weight:600}
.saved{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:500;color:${C.ok};opacity:0;transition:opacity .2s}
.saved ha-icon{--mdc-icon-size:16px}
.saved.show{opacity:1}
.tabs{display:flex;gap:6px;padding:0 12px 10px;overflow-x:auto;scrollbar-width:none}
.tabs::-webkit-scrollbar{display:none}
.tab{flex:none;display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border:none;border-radius:999px;background:rgba(127,127,127,.12);color:var(--secondary-text-color);font:inherit;font-size:13px;font-weight:500;cursor:pointer;transition:background .15s,color .15s}
.tab ha-icon{--mdc-icon-size:16px}
.tab:hover{color:var(--primary-text-color)}
.tab.on{background:var(--primary-color,#03a9f4);color:var(--text-primary-color,#fff)}
.panel{flex:1;min-height:0;overflow-y:auto;padding:0 12px 14px}
.gt{margin:14px 4px 6px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--secondary-text-color)}
.gt:first-child{margin-top:2px}
.group{margin-bottom:6px;border-radius:14px;overflow:hidden;background:var(--secondary-background-color,rgba(127,127,127,.08))}
.row{display:flex;align-items:center;gap:12px;min-height:46px;padding:9px 14px;box-sizing:border-box;transition:background .3s}
.row+.row{border-top:1px solid var(--divider-color,rgba(127,127,127,.18))}
.row.ok{background:rgba(34,197,94,.1)}
.rl{flex:1;min-width:0}
.lab{font-size:14px}
.desc{margin-top:1px;font-size:12px;color:var(--secondary-text-color)}
.rc{flex:none;display:flex;align-items:center}
.inp{display:flex;align-items:center;height:32px;padding:0 8px;border-radius:8px;border:1px solid var(--divider-color,rgba(127,127,127,.3));background:var(--card-background-color,#111);transition:border-color .15s}
.inp:focus-within{border-color:var(--primary-color,#03a9f4)}
.inp input{width:150px;padding:0;border:none;outline:none;background:transparent;color:var(--primary-text-color);font:inherit;font-size:13px}
.inp input[type=number]{width:76px;text-align:right;-moz-appearance:textfield}
.inp input::-webkit-outer-spin-button,.inp input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.inp .u{margin-left:4px;font-size:12px;color:var(--secondary-text-color)}
.inp button{display:grid;padding:0 0 0 6px;border:none;background:none;color:var(--secondary-text-color);cursor:pointer}
.inp button ha-icon{--mdc-icon-size:16px}
.sw{position:relative;display:block;width:40px;height:22px;flex:none;cursor:pointer}
.sw input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer;z-index:1}
.sw i{position:absolute;inset:0;border-radius:999px;background:rgba(127,127,127,.35);transition:background .2s}
.sw i:before{content:'';position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .2s}
.sw input:checked+i{background:var(--primary-color,#03a9f4)}
.sw input:checked+i:before{transform:translateX(18px)}
.seg{display:inline-flex;padding:2px;border-radius:9px;border:1px solid var(--divider-color,rgba(127,127,127,.3));background:var(--card-background-color,#111)}
.seg button{padding:5px 10px;border:none;border-radius:7px;background:none;color:var(--secondary-text-color);font:inherit;font-size:12px;font-weight:500;cursor:pointer}
.seg button.on{background:var(--primary-color,#03a9f4);color:var(--text-primary-color,#fff)}
.note{display:flex;align-items:flex-start;gap:8px;margin:2px 0 4px;padding:10px 12px;border-radius:12px;font-size:12px;color:var(--secondary-text-color);background:rgba(245,158,11,.1)}
.note ha-icon{flex:none;--mdc-icon-size:18px;color:${C.warn}}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}
.tile{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:12px;border:none;border-radius:14px;background:var(--secondary-background-color,rgba(127,127,127,.08));color:var(--primary-text-color);font:inherit;font-size:13px;font-weight:500;text-align:left;text-decoration:none;cursor:pointer;transition:background .15s}
.tile ha-icon{--mdc-icon-size:22px;color:var(--primary-color,#03a9f4)}
.tile:hover{background:rgba(127,127,127,.18)}
.tile.warn ha-icon{color:${C.warn}}
.tile.danger ha-icon{color:${C.bad}}
.tile.confirm{background:${C.bad};color:#fff}
.tile.confirm ha-icon{color:#fff}
.kv .row{min-height:38px}
.kv .v{font-size:13px;color:var(--secondary-text-color);font-variant-numeric:tabular-nums;text-align:right;overflow:hidden;text-overflow:ellipsis}
.msg{padding:36px 12px;text-align:center;font-size:13px;color:var(--secondary-text-color)}
.msg button{margin-top:10px}

@container (max-width:540px){
  .tab:not(.on) .tl{display:none}.tab:not(.on){padding:0 10px}
}
@container (max-width:400px){
  .kpis{grid-template-columns:1.5fr 1fr 1fr}.kpi.opt{display:none}
  .act span{display:none}.act{width:34px;padding:0}
  .meta .up{display:none}.desc{display:none}.inp input{width:120px}
}
@container (max-width:280px){
  .kpis{grid-template-columns:1fr 1fr}.kpi.peak{display:none}.meta{display:none}.foot{justify-content:flex-end}
}
`;

class SeismoM5Card extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hist = [];
    this._tab = 'detect';
    this._settings = null;
    this._last = null;
  }

  static getConfigElement() { return document.createElement('seismom5-card-editor'); }
  static getStubConfig() { return { name: 'SeismoM5' }; }

  getCardSize() { return 5; }
  getGridOptions() { return { columns: 12, rows: 5, min_columns: 6, min_rows: 4 }; }
  getLayoutOptions() { return { grid_columns: 4, grid_rows: 5, grid_min_columns: 2, grid_min_rows: 4 }; }

  setConfig(config) {
    this._cfg = { poll_ms: 500, max_points: 300, ...config };
    this._N = Math.max(30, +this._cfg.max_points || 300);
    this._stop();
    this._build();
    if (this.isConnected) this._start();
  }

  set hass(h) {
    this._hass = h;
    if (!this._timer && this.isConnected) this._start();
  }

  connectedCallback() { this._start(); }
  disconnectedCallback() { this._stop(); }

  $(id) { return this.shadowRoot.getElementById(id); }

  _start() {
    if (this._timer || !this._hass || !this._cfg) return;
    this._timer = setInterval(() => this._tick(), Math.max(200, +this._cfg.poll_ms || 500));
    this._ro = this._ro || new ResizeObserver(() => this._draw());
    this._ro.observe(this.$('chart'));
    this._tick();
  }

  _stop() {
    clearInterval(this._timer);
    this._timer = null;
    this._ro?.disconnect();
  }

  _api(path, body) {
    const q = this._cfg.entry_id ? '?entry=' + encodeURIComponent(this._cfg.entry_id) : '';
    return this._hass.callApi(body === undefined ? 'GET' : 'POST', 'seismom5/' + path + q, body);
  }

  _err(e) { return e?.body?.error || e?.body?.message || e?.message || String(e); }

  /* ------------------------------------------------------------------ build */
  _build() {
    this.shadowRoot.innerHTML = `<style>${CSS}</style>
      <ha-card>
        <div class="wrap" id="wrap"><div class="inner">
          <div class="face front">
            <div class="top">
              <div class="logo">${LOGO}</div>
              <div class="ttl"><div class="name">${esc(this._cfg.name || 'SeismoM5')}</div><div class="sub" id="sub">Connecting…</div></div>
              <div class="status" id="status"><span class="dot"></span><span id="stxt">—</span></div>
            </div>
            <div class="kpis">
              <div class="kpi main"><label>PGA</label><b><span id="pga">—</span><small>g</small></b><div class="bar"><i id="bar"></i></div></div>
              <div class="kpi"><label>Trigger</label><b id="tr">—</b></div>
              <div class="kpi peak"><label>Peak</label><b id="peak">—</b></div>
              <div class="kpi opt"><label>STA/LTA</label><b id="sl">—</b></div>
            </div>
            <div class="chart" id="chart"><canvas id="cv"></canvas>
              <div class="ov" id="ov"><div>${ic('mdi:lan-disconnect')}<span id="ovt">Device unreachable</span></div></div>
            </div>
            <div class="foot">
              <div class="meta">
                <span id="m-mqtt">${ic('mdi:cloud-outline')}MQTT</span>
                <span id="m-wifi">${ic('mdi:wifi')}—</span>
                <span class="up" id="m-up">${ic('mdi:timer-outline')}—</span>
              </div>
              <div class="actions">
                <button class="act" id="a-cal" title="Recalibrate MPU">${ic('mdi:axis-arrow')}<span>Calibrate</span></button>
                <button class="act danger" id="a-rst" title="Restart device">${ic('mdi:restart')}<span>Restart</span></button>
                <button class="act icon primary" id="a-set" title="Settings">${ic('mdi:tune-variant')}</button>
              </div>
            </div>
          </div>
          <div class="face back">
            <div class="bhead">
              <button class="iconbtn" id="b-close" title="Back">${ic('mdi:arrow-left')}</button>
              <div class="btitle">Settings</div>
              <span class="saved" id="saved">${ic('mdi:check-circle')}Saved</span>
              <button class="iconbtn" id="b-reload" title="Reload">${ic('mdi:refresh')}</button>
            </div>
            <div class="tabs" id="tabs">${TABS.map((t) => `<button class="tab" data-tab="${t.id}" title="${t.label}">${ic(t.icon)}<span class="tl">${t.label}</span></button>`).join('')}</div>
            <div class="panel" id="panel"></div>
          </div>
        </div></div>
        <div class="toast" id="toast"></div>
      </ha-card>`;

    if (this._cfg.height) this.shadowRoot.querySelector('ha-card').style.height = this._cfg.height;

    this.$('a-set').onclick = () => this._flip(true);
    this.$('b-close').onclick = () => this._flip(false);
    this.$('b-reload').onclick = () => this._loadSettings();
    this.$('a-cal').onclick = (e) => this._confirm(e.currentTarget, () => this._action('recalibrate', 'Calibrating — keep the device still'));
    this.$('a-rst').onclick = (e) => this._confirm(e.currentTarget, () => this._action('restart', 'Restarting — back online in about a minute'));
    this.shadowRoot.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { this._tab = b.dataset.tab; this._renderPanel(); });
    this._markTab();
  }

  _toast(msg, err = false) {
    const t = this.$('toast');
    t.textContent = msg;
    t.className = 'toast show' + (err ? ' err' : '');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove('show'), err ? 4000 : 2600);
  }

  _confirm(btn, fn) {
    const sp = btn.querySelector('span');
    if (btn.classList.contains('confirm')) {
      clearTimeout(btn._t);
      btn.classList.remove('confirm');
      if (sp) sp.textContent = btn._lbl;
      fn();
      return;
    }
    btn.classList.add('confirm');
    if (sp) { btn._lbl = sp.textContent; sp.textContent = 'Confirm?'; }
    this._toast('Tap again to confirm');
    btn._t = setTimeout(() => { btn.classList.remove('confirm'); if (sp) sp.textContent = btn._lbl; }, 3000);
  }

  async _action(act, msg) {
    try {
      const r = await this._api('action', { do: act });
      if (r && r.error) throw new Error(r.error);
      this._toast(msg);
    } catch (e) {
      this._toast('Failed: ' + this._err(e), true);
    }
  }

  /* ------------------------------------------------------------------ front */
  async _tick() {
    if (this._busy || document.hidden || !this._hass) return;
    this._busy = true;
    try {
      const s = await this._api('status');
      if (!s || s.error) throw new Error(s?.error || 'no data');
      this._last = s;
      this.$('ov').classList.remove('show');
      this._render(s);
    } catch (e) {
      this.$('ovt').textContent = /no_seismom5_entry/.test(this._err(e)) ? 'SeismoM5 integration not configured' : 'Device unreachable';
      this.$('ov').classList.add('show');
      const st = this.$('status'); st.className = 'status'; this.$('stxt').textContent = 'OFFLINE';
    } finally {
      this._busy = false;
    }
  }

  _render(s) {
    const pga = s.pga ?? 0, trig = s.pga_trigger || 0;
    const st = this.$('status');
    st.className = 'status ' + (s.state === 'EARTHQUAKE' ? 'bad' : s.state === 'LISTENING' ? 'ok' : 'warn');
    this.$('stxt').textContent = s.state || '—';
    this.$('sub').textContent = [s.model, s.version && 'v' + s.version].filter(Boolean).join(' · ');

    this.$('pga').textContent = pga.toFixed(4);
    const ratio = trig ? pga / trig : 0;
    const bar = this.$('bar');
    bar.style.width = Math.min(100, ratio * 100) + '%';
    bar.style.background = ratio >= 1 ? C.bad : ratio >= 0.6 ? C.warn : C.ok;
    this.$('tr').textContent = s.sta_lta ? 'STA/LTA' : trig.toFixed(4);
    this.$('sl').textContent = s.lta > 0 ? (s.sta / s.lta).toFixed(2) : '—';

    const m = s.mqtt || {}, w = s.wifi || {};
    const mq = this.$('m-mqtt');
    mq.className = m.connected ? 'on' : m.enabled ? 'off' : '';
    mq.innerHTML = ic(m.connected ? 'mdi:cloud-check-outline' : m.enabled ? 'mdi:cloud-alert-outline' : 'mdi:cloud-off-outline') + 'MQTT';
    this.$('m-wifi').innerHTML = w.ap ? ic('mdi:access-point') + 'Setup AP' : ic(wifiIcon(w.rssi)) + (w.rssi ?? '—') + ' dBm';
    this.$('m-up').innerHTML = ic('mdi:timer-outline') + fmtUp(s.uptime);

    this._hist.push([pga, s.sta ?? 0, s.lta ?? 0, s.state === 'EARTHQUAKE']);
    if (this._hist.length > this._N) this._hist.shift();
    this.$('peak').textContent = Math.max(...this._hist.map((p) => p[0])).toFixed(4);
    if (!this.$('wrap').classList.contains('flipped')) this._draw();
  }

  _draw() {
    const s = this._last, box = this.$('chart'), c = this.$('cv');
    if (!s || !box || !c) return;
    const W = box.clientWidth, H = box.clientHeight;
    if (!W || !H) return;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const x = c.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, W, H);

    const hist = this._hist, N = this._N, sl = !!s.sta_lta;
    const series = sl ? [[1, C.bad, 'STA'], [2, C.a, 'LTA']] : [[0, C.ok, 'PGA']];
    let mx = sl ? 0.002 : (s.pga_trigger || 0.01) * 1.2;
    for (const p of hist) for (const [k] of series) if (p[k] > mx) mx = p[k];
    mx *= 1.1;
    const top = 18, bot = 6, Y = (v) => top + (H - top - bot) * (1 - v / mx);
    const dx = W / (N - 1), o = N - hist.length;
    const sec = getComputedStyle(this).getPropertyValue('--secondary-text-color').trim() || '#9ca3af';

    x.strokeStyle = 'rgba(127,127,127,.14)';
    x.lineWidth = 1;
    for (let g = 0; g <= 4; g++) {
      const yy = Math.round(top + (H - top - bot) * g / 4) + 0.5;
      x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy); x.stroke();
    }

    x.fillStyle = 'rgba(239,68,68,.16)';
    hist.forEach((p, i) => { if (p[3]) x.fillRect((o + i) * dx - dx / 2, 0, dx + 1, H); });

    if (!sl && s.pga_trigger) {
      const ty = Math.round(Y(s.pga_trigger)) + 0.5;
      x.strokeStyle = C.warn; x.setLineDash([5, 4]);
      x.beginPath(); x.moveTo(0, ty); x.lineTo(W, ty); x.stroke(); x.setLineDash([]);
      x.font = '600 10px sans-serif'; x.fillStyle = C.warn; x.textAlign = 'right'; x.textBaseline = 'bottom';
      x.fillText('TRIGGER ' + s.pga_trigger.toFixed(4), W - 6, ty - 2);
    }

    if (hist.length > 1) {
      series.forEach(([k, col], si) => {
        const trace = () => { x.beginPath(); hist.forEach((p, i) => { const X = (o + i) * dx, Yv = Y(p[k]); i ? x.lineTo(X, Yv) : x.moveTo(X, Yv); }); };
        if (si === 0) {
          trace();
          x.lineTo((o + hist.length - 1) * dx, H); x.lineTo(o * dx, H); x.closePath();
          const g = x.createLinearGradient(0, top, 0, H);
          g.addColorStop(0, hexA(col, 0.32)); g.addColorStop(1, hexA(col, 0));
          x.fillStyle = g; x.fill();
        }
        trace();
        x.strokeStyle = col; x.lineWidth = 1.6; x.lineJoin = 'round'; x.stroke();
        const lp = hist[hist.length - 1], lx = (o + hist.length - 1) * dx, ly = Y(lp[k]);
        x.fillStyle = hexA(col, 0.25); x.beginPath(); x.arc(lx - 2, ly, 6, 0, 7); x.fill();
        x.fillStyle = col; x.beginPath(); x.arc(lx - 2, ly, 3, 0, 7); x.fill();
      });
    }

    x.font = '500 10px sans-serif'; x.fillStyle = sec; x.textAlign = 'left'; x.textBaseline = 'top';
    x.fillText(mx.toFixed(4) + ' g', 8, 4);
    if (sl) {
      let lx = W - 8; x.textAlign = 'right';
      for (const [, col, name] of [...series].reverse()) { x.fillStyle = col; x.fillText(name, lx, 4); lx -= x.measureText(name).width + 10; }
    }
  }

  /* ------------------------------------------------------------------- back */
  _flip(on) {
    this.$('wrap').classList.toggle('flipped', on);
    if (on) this._loadSettings();
    else setTimeout(() => this._draw(), 50);
  }

  _markTab() {
    this.shadowRoot.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === this._tab));
  }

  async _loadSettings() {
    const p = this.$('panel');
    if (!this._settings) p.innerHTML = `<div class="msg">Loading…</div>`;
    try {
      const s = await this._api('settings');
      if (!s || s.error) throw new Error(s?.error || 'no data');
      this._settings = s;
      this._renderPanel();
    } catch (e) {
      this._settings = null;
      p.innerHTML = `<div class="msg">Cannot load settings<br><small>${esc(this._err(e))}</small><br><button class="act" id="retry">${ic('mdi:refresh')}<span>Retry</span></button></div>`;
      this.$('retry').onclick = () => this._loadSettings();
    }
  }

  _rowHtml(r, s) {
    const v = s[r.k];
    let ctl = '';
    if (r.t === 'sw') ctl = `<label class="sw"><input type="checkbox" data-k="${r.k}" data-t="sw" ${v ? 'checked' : ''}><i></i></label>`;
    else if (r.t === 'num') ctl = `<div class="inp"><input type="number" data-k="${r.k}" data-t="num" value="${esc(v)}" step="${r.step}" min="${r.min}" max="${r.max}" inputmode="decimal">${r.unit ? `<span class="u">${r.unit}</span>` : ''}</div>`;
    else if (r.t === 'txt') ctl = `<div class="inp"><input type="text" data-k="${r.k}" data-t="txt" value="${esc(v)}" spellcheck="false" autocomplete="off"></div>`;
    else if (r.t === 'pw') ctl = `<div class="inp"><input type="password" data-k="${r.k}" data-t="pw" placeholder="${s['has_' + r.k] ? '••••••••' : 'not set'}" autocomplete="new-password"><button type="button" data-eye title="Show">${ic('mdi:eye-outline')}</button></div>`;
    else if (r.t === 'seg') ctl = `<div class="seg" data-k="${r.k}">${r.options.map((o, i) => `<button type="button" data-i="${i}" class="${+v === i ? 'on' : ''}">${o}</button>`).join('')}</div>`;
    return `<div class="row" data-row="${r.k}"><div class="rl"><div class="lab">${r.label}</div>${r.desc ? `<div class="desc">${r.desc}</div>` : ''}</div><div class="rc">${ctl}</div></div>`;
  }

  _renderPanel() {
    this._markTab();
    const p = this.$('panel'), s = this._settings;
    if (!s) return;
    const tab = TABS.find((t) => t.id === this._tab);
    if (tab.id === 'system') { this._renderSystem(p); return; }

    let h = tab.note ? `<div class="note">${ic('mdi:alert-outline')}<span>${tab.note}</span></div>` : '';
    for (const g of tab.groups) {
      if (g.title) h += `<div class="gt">${g.title}</div>`;
      h += `<div class="group">${g.rows.map((r) => this._rowHtml(r, s)).join('')}</div>`;
    }
    p.innerHTML = h;
    p.scrollTop = 0;

    const blurOnEnter = (el) => el.onkeydown = (e) => { if (e.key === 'Enter') el.blur(); };
    p.querySelectorAll('input[data-t="sw"]').forEach((el) => el.onchange = () => this._save(el.dataset.k, el.checked ? '1' : '0', el.checked));
    p.querySelectorAll('input[data-t="num"]').forEach((el) => {
      blurOnEnter(el);
      el.onchange = () => {
        let v = parseFloat(el.value);
        if (isNaN(v)) { el.value = this._settings[el.dataset.k]; return; }
        v = Math.min(+el.max, Math.max(+el.min, v));
        el.value = v;
        this._save(el.dataset.k, String(v), v);
      };
    });
    p.querySelectorAll('input[data-t="txt"]').forEach((el) => { blurOnEnter(el); el.onchange = () => this._save(el.dataset.k, el.value.trim(), el.value.trim()); });
    p.querySelectorAll('input[data-t="pw"]').forEach((el) => {
      blurOnEnter(el);
      el.onchange = async () => {
        if (!el.value) return;
        const k = el.dataset.k;
        if (await this._save(k, el.value, null)) { this._settings['has_' + k] = true; el.value = ''; el.placeholder = '••••••••'; }
      };
    });
    p.querySelectorAll('[data-eye]').forEach((b) => b.onclick = () => {
      const i = b.previousElementSibling;
      i.type = i.type === 'password' ? 'text' : 'password';
      b.innerHTML = ic(i.type === 'password' ? 'mdi:eye-outline' : 'mdi:eye-off-outline');
    });
    p.querySelectorAll('.seg').forEach((seg) => seg.querySelectorAll('button').forEach((b) => b.onclick = () => {
      seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      this._save(seg.dataset.k, b.dataset.i, +b.dataset.i);
    }));
  }

  _renderSystem(p) {
    const s = this._last || {}, w = s.wifi || {}, m = s.mqtt || {}, cfg = this._settings || {};
    const kv = [
      ['Model', s.model], ['Firmware', s.version && 'v' + s.version], ['Hostname', s.hostname],
      ['IP address', w.ip], ['MAC', s.mac], ['WiFi', w.ap ? 'Setup AP' : `${w.ssid ?? '—'} (${w.rssi ?? '—'} dBm)`],
      ['MQTT', m.enabled ? (m.connected ? 'Connected' : 'Disconnected') + (m.host ? ' · ' + m.host : '') : 'Disabled'],
      ['MQTT reconnects', m.reconnects], ['Uptime', fmtUp(s.uptime)],
      ['Free heap', s.heap ? (s.heap / 1024).toFixed(1) + ' kB' : null], ['Setup AP', cfg.ap_ssid],
    ];
    p.innerHTML = `
      <div class="gt">Actions</div>
      <div class="tiles">
        <button class="tile warn" data-act="recalibrate">${ic('mdi:axis-arrow')}<span>Recalibrate</span></button>
        <button class="tile danger" data-act="restart">${ic('mdi:restart')}<span>Restart</span></button>
        <button class="tile" data-act="update">${ic('mdi:send-outline')}<span>Publish event</span></button>
        <button class="tile" data-act="discovery">${ic('mdi:home-assistant')}<span>Republish discovery</span></button>
        ${w.ip ? `<a class="tile" href="http://${esc(w.ip)}" target="_blank" rel="noopener">${ic('mdi:open-in-new')}<span>Device web UI</span></a>` : ''}
      </div>
      <div class="gt">Device</div>
      <div class="group kv">${kv.map(([k, v]) => `<div class="row"><div class="rl lab">${k}</div><div class="v">${esc(v ?? '—')}</div></div>`).join('')}</div>`;
    const msgs = {
      recalibrate: 'Calibrating — keep the device still',
      restart: 'Restarting — back online in about a minute',
      update: 'Event published',
      discovery: 'Discovery republished',
    };
    p.querySelectorAll('[data-act]').forEach((b) => b.onclick = () => {
      const a = b.dataset.act, run = () => this._action(a, msgs[a]);
      a === 'restart' || a === 'recalibrate' ? this._confirm(b, run) : run();
    });
  }

  async _save(k, v, local) {
    const row = this.shadowRoot.querySelector(`[data-row="${k}"]`);
    try {
      const r = await this._api('settings', { [k]: v });
      if (r && r.error) throw new Error(r.error);
      if (local !== null && local !== undefined) this._settings[k] = local;
      row?.classList.add('ok');
      setTimeout(() => row?.classList.remove('ok'), 1200);
      const sv = this.$('saved');
      sv.classList.add('show');
      clearTimeout(this._svT);
      this._svT = setTimeout(() => sv.classList.remove('show'), 1600);
      if (r && r.restart) this._toast('Saved — the device is restarting');
      return true;
    } catch (e) {
      this._toast('Save failed: ' + this._err(e), true);
      this._loadSettings();
      return false;
    }
  }
}

class SeismoM5CardEditor extends HTMLElement {
  set hass(h) { this._hass = h; }
  setConfig(c) {
    this._c = c;
    const f = (k, label, ph = '') => `<ha-textfield label="${label}" placeholder="${ph}" value="${esc(c[k] ?? '')}" data-f="${k}" style="display:block;margin-bottom:8px"></ha-textfield>`;
    this.innerHTML = `<div style="padding:8px 0">
      ${f('name', 'Title', 'SeismoM5')}
      ${f('poll_ms', 'Poll interval (ms)', '500')}
      ${f('max_points', 'Chart points', '300')}
      ${f('height', 'Fixed height (masonry only, e.g. 340px)', '')}
      ${f('entry_id', 'Config entry ID (multiple devices)', '')}
    </div>`;
    this.querySelectorAll('ha-textfield').forEach((t) => t.addEventListener('change', () => {
      const k = t.dataset.f;
      let v = t.value.trim();
      if (k === 'poll_ms' || k === 'max_points') v = parseInt(v) || undefined;
      const config = { ...this._c, [k]: v || undefined };
      if (config[k] === undefined) delete config[k];
      this._c = config;
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
    }));
  }
}

if (!customElements.get('seismom5-card')) {
  customElements.define('seismom5-card', SeismoM5Card);
  customElements.define('seismom5-card-editor', SeismoM5CardEditor);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'seismom5-card', name: 'SeismoM5', description: 'Live earthquake graph with device settings panel', preview: true });
}
console.info(`%c seismom5-card %c v${VERSION} `, 'background:#22c55e;color:#fff;border-radius:3px 0 0 3px', 'background:#3b82f6;color:#fff;border-radius:0 3px 3px 0');
