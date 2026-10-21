/* SeismoM5 card — live earthquake graph + settings flip panel for Home Assistant.
   Front: live chart via /api/seismom5/status proxy.
   Back: device settings mapped to the seismom5 integration entities. */

const S_STYLE = `
:host{display:block}
.card{background:var(--card-background-color,#1c1c1c);border-radius:var(--ha-card-border-radius,12px);box-shadow:var(--ha-card-box-shadow,none);color:var(--primary-text-color,#fff);overflow:hidden;font-family:var(--ha-font-family-body,Roboto)}
.flip{transform-style:preserve-3d;transition:transform .45s ease}
.flip.on{transform:rotateY(180deg)}
.face{backface-visibility:hidden}
.face.front{position:relative;z-index:2}
.face.back{position:absolute;inset:0;transform:rotateY(180deg);overflow-y:auto;padding:10px 16px 14px;box-sizing:border-box}
.hdr{display:flex;align-items:center;gap:10px;padding:12px 16px 0}
.hdr .t{font-size:var(--ha-card-header-font-size,17px);font-weight:500;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pill{padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600;letter-spacing:.05em;background:var(--secondary-background-color,#444);cursor:default}
.pill.ok{background:#2fbf71;color:#fff}.pill.warn{background:#f0a020;color:#111}.pill.bad{background:#f04848;color:#fff;animation:pulse 1s infinite}
@keyframes pulse{50%{opacity:.5}}
.icon{background:transparent;border:none;color:var(--secondary-text-color,#aaa);cursor:pointer;padding:4px;border-radius:6px;display:inline-flex;align-items:center}
.icon:hover{color:var(--primary-text-color,#fff);background:var(--secondary-background-color,#444)}
.icon.danger:hover{color:#f04848}
.icon ha-icon{--mdc-icon-size:20px;display:flex}
.body{padding:8px 16px 14px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}
.kpi{background:var(--secondary-background-color,#2a2a2a);border-radius:8px;padding:6px 10px}
.kpi b{display:block;font-size:16px;font-variant-numeric:tabular-nums}
.kpi.big b{font-size:22px}
.kpi span{font-size:10px;color:var(--secondary-text-color,#aaa);text-transform:uppercase;letter-spacing:.05em}
canvas{width:100%;height:120px;display:block;border-radius:8px;background:var(--secondary-background-color,#2a2a2a)}
.legend{display:flex;gap:12px;font-size:11px;color:var(--secondary-text-color,#aaa);margin-top:4px}
.legend i{display:inline-block;width:9px;height:3px;margin-right:4px;vertical-align:middle}
.err{padding:8px 0;color:var(--error-color,#f04848);font-size:13px}
.sec{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--secondary-text-color,#aaa);margin:12px 0 6px;border-bottom:1px solid var(--secondary-background-color,#444);padding-bottom:4px}
.sec:first-of-type{margin-top:4px}
.row{display:flex;align-items:center;gap:8px;padding:5px 0;font-size:13px}
.row label{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.row input[type=number],.row input[type=text],.row input[type=password],.row select{background:var(--secondary-background-color,#2a2a2a);border:1px solid transparent;color:var(--primary-text-color,#fff);border-radius:6px;padding:5px 8px;font-size:13px;width:150px;box-sizing:border-box}
.row input:focus,.row select:focus{border-color:#3b9eff;outline:none}
.sw{position:relative;width:36px;height:20px;flex:none}
.sw input{opacity:0;width:100%;height:100%;position:absolute;margin:0;cursor:pointer;z-index:1}
.sw i{position:absolute;inset:0;background:var(--secondary-background-color,#444);border-radius:99px;transition:.2s}
.sw i:before{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:.2s}
.sw input:checked+i{background:#3b9eff}
.sw input:checked+i:before{transform:translateX(16px)}
.sw input:disabled{opacity:.4;cursor:not-allowed}
.btn{background:var(--secondary-background-color,#2a2a2a);border:1px solid var(--divider-color,#444);color:var(--primary-text-color,#fff);border-radius:8px;padding:7px 12px;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.btn:hover{border-color:#3b9eff;color:#3b9eff}
.btn.warn:hover{border-color:#f0a020;color:#f0a020}
.btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.miss{color:var(--secondary-text-color,#777);font-style:italic}
a.link{color:#3b9eff;font-size:12px;text-decoration:none;display:inline-block;margin-top:10px}
`;

const SWITCHES = [
  ['sta_lta', 'STA/LTA method'],
  ['speaker_enable', 'Speaker'],
  ['continuous_graph', 'Continuous graph'],
  ['master', 'Master mode'],
];
const NET_SWITCHES = [
  ['mqtt_enabled', 'MQTT enabled'],
  ['ha_discovery', 'HA MQTT discovery'],
];
const NUMBERS = [
  ['pga_trigger', 'PGA trigger (g)', 'Detection'],
  ['lcd_brightness', 'LCD brightness', 'Detection'],
  ['update_period', 'Update period (s)', 'Detection'],
];
const TEXTS = [
  ['mqtt_host', 'MQTT host'],
  ['mqtt_user', 'MQTT username'],
  ['mqtt_pass', 'MQTT password', 'password'],
  ['mqtt_base', 'MQTT base topic'],
  ['mqtt_slave_topic', 'Slave state topic'],
  ['ha_prefix', 'HA discovery prefix'],
  ['wifi_ssid', 'WiFi SSID'],
  ['wifi_pass', 'WiFi password', 'password'],
];

class SeismoM5Card extends HTMLElement {
  static getConfigElement() { return document.createElement('seismom5-card-editor'); }
  static getStubConfig() { return {}; }

  setConfig(config) {
    this._cfg = config;
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `<style>${S_STYLE}</style>
      <ha-card class="card"><div class="card"><div class="flip" id="flip">
      <div class="face front">
        <div class="hdr"><div class="t"></div>
          <span class="pill" id="mq">MQTT</span><span class="pill" id="st">–</span>
          <button class="icon" id="b-cal" title="Recalibrate MPU"><ha-icon icon="mdi:axis-arrow"></ha-icon></button>
          <button class="icon danger" id="b-rst" title="Restart device"><ha-icon icon="mdi:restart"></ha-icon></button>
          <button class="icon" id="b-gear" title="Settings"><ha-icon icon="mdi:cog"></ha-icon></button>
        </div>
        <div class="body"><div class="kpis">
          <div class="kpi big"><span>PGA (g)</span><b id="pga">–</b></div>
          <div class="kpi big"><span id="trl">Trigger (g)</span><b id="tr">–</b></div>
          <div class="kpi"><span>STA / LTA</span><b id="sl" style="font-size:12px;padding-top:5px">–</b></div>
          <div class="kpi"><span id="wlab">WiFi</span><b id="w" style="font-size:12px;padding-top:5px">–</b></div>
        </div><canvas id="cv"></canvas><div class="legend" id="lg"></div><div class="err" id="err" style="display:none"></div></div>
      </div>
      <div class="face back">
        <div class="hdr" style="padding-left:0;padding-right:0">
          <div class="t">SeismoM5 settings</div>
          <button class="icon" id="b-back" title="Back"><ha-icon icon="mdi:undo"></ha-icon></button>
        </div>
        <div id="back-body"></div>
      </div>
      </div></div></ha-card>`;
    this.shadowRoot.querySelector('.t').textContent = config.name || 'SeismoM5';
    this._N = config.max_points || 300;
    this._poll = config.poll_ms || 500;
    this._hist = [];
    this._flipped = false;
    this._ent = null;
    this._buildBack();
    this.shadowRoot.getElementById('b-gear').onclick = () => this._flip(true);
    this.shadowRoot.getElementById('b-back').onclick = () => this._flip(false);
    this.shadowRoot.getElementById('b-rst').onclick = () => this._press('restart', 'Restart the device?');
    this.shadowRoot.getElementById('b-cal').onclick = () => this._press('recalibrate', 'Recalibrate the MPU? Keep the device still for ~10 s.');
    this._timer = setInterval(() => this._tick(), this._poll);
  }

  set hass(h) { this._hass = h; }

  disconnectedCallback() { clearInterval(this._timer); }

  _api(path, body) {
    return this._hass.callApi(body === undefined ? 'GET' : 'POST', 'seismom5/' + path +
      (this._cfg.entry_id ? '?entry=' + this._cfg.entry_id : ''), body);
  }

  _flip(on) {
    this._flipped = on;
    this.shadowRoot.getElementById('flip').classList.toggle('on', on);
    if (on) this._fillBack();
  }

  async _press(key, msg) {
    if (msg && !confirm(msg)) return;
    try { await this._api('action', { do: key }); }
    catch (e) { alert('Request failed: ' + (e.body?.error || e.message || e)); }
  }

  /* ---------- back panel ---------- */
  _buildBack() {
    const b = this.shadowRoot.getElementById('back-body');
    let h = '';
    h += `<div class="btns">
      <button class="btn" data-act="update"><ha-icon icon="mdi:refresh"></ha-icon>Publish event</button>
      <button class="btn" data-act="discovery"><ha-icon icon="mdi:home-assistant"></ha-icon>Republish discovery</button>
      <button class="btn warn" data-act="recalibrate"><ha-icon icon="mdi:axis-arrow"></ha-icon>Recalibrate</button>
      <button class="btn warn" data-act="restart"><ha-icon icon="mdi:restart"></ha-icon>Restart</button>
    </div>`;
    h += `<div class="sec">Detection</div>`;
    h += NUMBERS.map(([k, l]) => `<div class="row"><label>${l}</label><input type="number" step="any" data-num="${k}"></div>`).join('');
    h += SWITCHES.map(([k, l]) => `<div class="row"><label>${l}</label><span class="sw"><input type="checkbox" data-sw="${k}"><i></i></span></div>`).join('');
    h += `<div class="row"><label>Logging</label><select data-sel="logging"><option>None</option><option>Serial</option><option>Web</option><option>Both</option></select></div>`;
    h += `<div class="sec">Network</div>`;
    h += NET_SWITCHES.map(([k, l]) => `<div class="row"><label>${l}</label><span class="sw"><input type="checkbox" data-sw="${k}"><i></i></span></div>`).join('');
    h += `<div class="row"><label>MQTT port</label><input type="number" data-num="mqtt_port"></div>`;
    h += TEXTS.map(([k, l, , t]) => `<div class="row"><label>${l}</label><input type="${t || 'text'}" data-txt="${k}"></div>`).join('');
    h += `<a class="link" id="webui" href="#" target="_blank" style="display:none">Open device web interface &#8599;</a>`;
    h += `<div class="err" id="berr"></div>`;
    b.innerHTML = h;

    b.querySelectorAll('[data-act]').forEach(el => el.onclick = () =>
      this._press(el.dataset.act, el.dataset.act === 'restart' ? 'Restart the device?' : el.dataset.act === 'recalibrate' ? 'Recalibrate the MPU? Keep the device still.' : null));
    const post = (k, v) => {
      this._hass.callApi('POST', 'seismom5/settings' + (this._cfg.entry_id ? '?entry=' + this._cfg.entry_id : ''), { [k]: String(v) })
        .catch(e => { const b = this.shadowRoot.getElementById('berr'); if (b) b.textContent = 'Save failed: ' + (e.body?.error || e.message || e); });
    };
    b.querySelectorAll('[data-sw]').forEach(el => el.onchange = () => post(el.dataset.sw, el.checked ? '1' : '0'));
    b.querySelectorAll('[data-num]').forEach(el => el.onchange = () => post(el.dataset.num, el.value));
    b.querySelectorAll('[data-sel]').forEach(el => el.onchange = () => post(el.dataset.sel, el.selectedIndex));
    b.querySelectorAll('[data-txt]').forEach(el => el.onchange = () => post(el.dataset.txt, el.value));
  }

  async _fillBack() {
    const b = this.shadowRoot.getElementById('back-body');
    const berr = this.shadowRoot.getElementById('berr');
    let s;
    try { s = await this._api('settings'); } catch (e) { s = null; }
    if (!s || s.error) { berr.textContent = 'seismoM5 integration not loaded: install and configure it to edit settings from here.'; return; }
    berr.textContent = '';
    b.querySelectorAll('[data-sw]').forEach(el => { if (el.dataset.sw in s) el.checked = !!s[el.dataset.sw]; });
    b.querySelectorAll('[data-num]').forEach(el => { if (el.dataset.num in s) el.value = s[el.dataset.num]; });
    b.querySelectorAll('[data-sel]').forEach(el => { if (el.dataset.sel in s) el.selectedIndex = s[el.dataset.sel]; });
    b.querySelectorAll('[data-txt]').forEach(el => {
      if (el.type === 'password') { el.value = ''; el.placeholder = s['has_' + el.dataset.txt] ? 'unchanged' : 'not set'; }
      else if (el.dataset.txt in s) el.value = s[el.dataset.txt];
    });
    const link = this.shadowRoot.getElementById('webui');
    if (this._last?.wifi?.ip) { link.href = 'http://' + this._last.wifi.ip; link.style.display = 'inline-block'; }
  }

  /* ---------- front ---------- */
  async _tick() {
    let s = null;
    try {
      s = await this._api('status');
    } catch (e) {
      if (this._cfg.entity && this._hass.states[this._cfg.entity]) {
        const st = this._hass.states[this._cfg.entity];
        s = { state: this._hass.states[this._cfg.entity_state]?.state || 'unknown', pga: parseFloat(st.state) || 0,
              sta: 0, lta: 0, pga_trigger: this._cfg.trigger || 0.015, sta_lta: false, mqtt: { connected: true, enabled: true }, wifi: {} };
      }
    }
    const e = this.shadowRoot.getElementById('err');
    if (!s || s.error) { if (e) { e.style.display = 'block'; e.textContent = 'SeismoM5 unreachable'; } return; }
    e.style.display = 'none';
    this._last = s;
    this._render(s);
  }

  _render(s) {
    const $ = (id) => this.shadowRoot.getElementById(id);
    const st = $('st'); st.textContent = s.state;
    st.className = 'pill ' + (s.state === 'EARTHQUAKE' ? 'bad' : s.state === 'LISTENING' ? 'ok' : 'warn');
    $('mq').className = 'pill ' + (s.mqtt?.connected ? 'ok' : s.mqtt?.enabled ? 'warn' : '');
    $('pga').textContent = (s.pga ?? 0).toFixed(4);
    $('tr').textContent = s.sta_lta ? 'S/LTA' : (s.pga_trigger ?? 0).toFixed(4);
    $('sl').textContent = (s.sta ?? 0).toFixed(4) + ' / ' + (s.lta ?? 0).toFixed(4);
    $('w').textContent = s.wifi?.ap ? 'AP' : (s.wifi?.rssi ?? '–') + ' dBm';
    this._hist.push([s.pga ?? 0, s.sta ?? 0, s.lta ?? 0, s.state === 'EARTHQUAKE']);
    if (this._hist.length > this._N) this._hist.shift();
    if (!this._flipped) this._draw(s);
  }

  _draw(s) {
    const c = this.shadowRoot.getElementById('cv');
    const dpr = window.devicePixelRatio || 1;
    const w = c.width = c.clientWidth * dpr, h = c.height = c.clientHeight * dpr;
    const x = c.getContext('2d'); x.clearRect(0, 0, w, h);
    const hist = this._hist; if (!hist.length) return;
    const sl = s.sta_lta;
    const ser = sl ? [[1, '#f04848', 'STA'], [2, '#3b9eff', 'LTA']] : [[0, '#2fbf71', 'PGA']];
    let mx = sl ? 0.002 : (s.pga_trigger || 0.01) * 1.3;
    hist.forEach(p => ser.forEach(k => { if (p[k[0]] > mx) mx = p[k[0]]; }));
    const Y = v => h - 4 - (v / mx) * (h - 8), dx = w / (this._N - 1), o = this._N - hist.length;
    x.fillStyle = 'rgba(240,72,72,.14)';
    hist.forEach((p, i) => { if (p[3]) x.fillRect((o + i) * dx - dx / 2, 0, dx, h); });
    if (!sl) { x.strokeStyle = '#f0a020'; x.setLineDash([5, 5]); x.beginPath(); x.moveTo(0, Y(s.pga_trigger)); x.lineTo(w, Y(s.pga_trigger)); x.stroke(); x.setLineDash([]); }
    x.lineWidth = 1.5 * dpr;
    ser.forEach(k => { x.strokeStyle = k[1]; x.beginPath(); hist.forEach((p, i) => { const X = (o + i) * dx; i ? x.lineTo(X, Y(p[k[0]])) : x.moveTo(X, Y(p[k[0]])); }); x.stroke(); });
    this.shadowRoot.getElementById('lg').innerHTML =
      ser.map(k => `<span><i style="background:${k[1]}"></i>${k[2]}</span>`).join('') +
      (sl ? '' : '<span><i style="background:#f0a020"></i>Trigger</span>') +
      `<span>max ${mx.toFixed(4)} g</span>`;
  }
}

class SeismoM5CardEditor extends HTMLElement {
  set hass(h) { this._hass = h; }
  setConfig(c) {
    this._c = c;
    this.innerHTML = `<div style="padding:8px"><ha-textfield label="Title" value="${c.name || ''}" data-f="name"></ha-textfield>
      <ha-textfield label="Poll ms (default 500)" value="${c.poll_ms || 500}" data-f="poll_ms"></ha-textfield>
      <ha-textfield label="Entity fallback (sensor.seismom5_pga)" value="${c.entity || ''}" data-f="entity"></ha-textfield></div>`;
    this.querySelectorAll('ha-textfield').forEach(t => t.oninput = () => {
      const f = t.dataset.f; let v = t.value; if (f === 'poll_ms') v = parseInt(v) || 500;
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: { ...this._c, [f]: v } }, bubbles: true, composed: true }));
    });
  }
}

customElements.define('seismom5-card', SeismoM5Card);
customElements.define('seismom5-card-editor', SeismoM5CardEditor);
window.customCards = window.customCards || [];
window.customCards.push({ type: 'seismom5-card', name: 'SeismoM5', description: 'Live earthquake graph + settings panel', preview: true });
console.info('seismom5-card v1.1.3 loaded');
