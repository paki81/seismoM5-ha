/* SeismoM5 card — live earthquake graph for Home Assistant.
   Polls /api/seismom5/status (integration proxy) or a configured entity. */

const S_STYLE = `
:host{display:block}
.card{background:var(--card-background-color,#1c1c1c);border-radius:var(--ha-card-border-radius,12px);box-shadow:var(--ha-card-box-shadow,none);color:var(--primary-text-color,#fff);overflow:hidden;font-family:var(--ha-font-family-body,Roboto)}
.hdr{display:flex;align-items:center;gap:10px;padding:12px 16px 0}
.hdr .t{font-size:var(--ha-card-header-font-size,17px);font-weight:500;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pill{padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600;letter-spacing:.05em;background:var(--secondary-background-color,#444)}
.pill.ok{background:#2fbf71;color:#fff}.pill.warn{background:#f0a020;color:#111}.pill.bad{background:#f04848;color:#fff;animation:pulse 1s infinite}
@keyframes pulse{50%{opacity:.5}}
.body{padding:8px 16px 14px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}
.kpi{background:var(--secondary-background-color,#2a2a2a);border-radius:8px;padding:6px 10px}
.kpi b{display:block;font-size:16px;font-variant-numeric:tabular-nums}
.kpi.big b{font-size:22px}
.kpi span{font-size:10px;color:var(--secondary-text-color,#aaa);text-transform:uppercase;letter-spacing:.05em}
canvas{width:100%;height:120px;display:block;border-radius:8px;background:var(--secondary-background-color,#2a2a2a)}
.legend{display:flex;gap:12px;font-size:11px;color:var(--secondary-text-color,#aaa);margin-top:4px}
.legend i{display:inline-block;width:9px;height:3px;margin-right:4px;vertical-align:middle}
.err{padding:12px;color:var(--error-color,#f04848);font-size:13px}
`;

class SeismoM5Card extends HTMLElement {
  static getConfigElement() { return document.createElement('seismom5-card-editor'); }
  static getStubConfig() { return {}; }

  setConfig(config) {
    this._cfg = config;
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `<style>${S_STYLE}</style>
      <ha-card class="card"><div class="card">
      <div class="hdr"><div class="t"></div><span class="pill" id="mq">MQTT</span><span class="pill" id="st">–</span></div>
      <div class="body"><div class="kpis">
      <div class="kpi big"><span>PGA (g)</span><b id="pga">–</b></div>
      <div class="kpi big"><span id="trl">Trigger (g)</span><b id="tr">–</b></div>
      <div class="kpi"><span>STA / LTA</span><b id="sl" style="font-size:12px;padding-top:5px">–</b></div>
      <div class="kpi"><span id="wlab">WiFi</span><b id="w" style="font-size:12px;padding-top:5px">–</b></div>
      </div><canvas id="cv"></canvas><div class="legend" id="lg"></div><div class="err" id="err" style="display:none"></div></div>
      </div></ha-card>`;
    this.shadowRoot.querySelector('.t').textContent = config.name || 'SeismoM5';
    this._N = config.max_points || 300;
    this._poll = config.poll_ms || 500;
    this._hist = [];
    this._timer = setInterval(() => this._tick(), this._poll);
  }

  set hass(h) { this._hass = h; }

  disconnectedCallback() { clearInterval(this._timer); }

  async _tick() {
    let s = null;
    try {
      s = await this._hass.callApi('GET', 'seismom5/status' + (this._cfg.entry_id ? '?entry=' + this._cfg.entry_id : ''));
    } catch (e) {
      if (this._cfg.entity && this._hass.states[this._cfg.entity]) {
        const st = this._hass.states[this._cfg.entity];
        s = { state: this._hass.states[this._cfg.entity_state]?.state || 'unknown', pga: parseFloat(st.state) || 0,
              sta: 0, lta: 0, pga_trigger: this._cfg.trigger || 0.015, sta_lta: false, mqtt: { connected: true, enabled: true }, wifi: {} };
      }
    }
    if (!s || s.error) { const e = this.shadowRoot.getElementById('err'); if (e) { e.style.display = 'block'; e.textContent = 'SeismoM5 unreachable'; } return; }
    this.shadowRoot.getElementById('err').style.display = 'none';
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
    this._draw(s);
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
window.customCards.push({ type: 'seismom5-card', name: 'SeismoM5', description: 'Live earthquake sensor graph (pga, STA/LTA, trigger)', preview: true });
console.info('seismom5-card v1.0.0 loaded');
