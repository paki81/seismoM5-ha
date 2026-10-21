<p align="center">
  <img src="logo.svg" alt="seismoM5" width="240"/>
</p>

# SeismoM5 for Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![website](https://img.shields.io/badge/aswell.eu-site-blue.svg)](https://www.aswell.eu)
[![firmware](https://img.shields.io/badge/firmware-seismoM5-green.svg)](https://github.com/paki81/seismoM5)

Developed by [aswell.eu](https://www.aswell.eu) — fork of the original [febalci/seismoM5](https://github.com/febalci/seismoM5).

Custom Home Assistant integration + Lovelace card for [SeismoM5](https://github.com/paki81/seismoM5) — the M5StickC/M5StickC Plus earthquake sensor.

The integration talks directly to the device over its HTTP API (`/api/status`, `/api/settings`, `/api/action`), so it works even when MQTT is disabled and exposes **every setting of the firmware web UI** inside Home Assistant. The bundled **SeismoM5 card** shows a live helicorder-style graph.

## Installation (HACS)

1. HACS → ⋮ → **Custom repositories** → add `https://github.com/paki81/seismoM5-ha`, type **Integration**.
2. Search **SeismoM5** in HACS and download it.
3. Restart Home Assistant.
4. Settings → Devices & Services → **Add Integration** → "SeismoM5".
5. Enter the device IP (e.g. `192.168.4.63`) and, if you enabled web login on the device, its credentials.

## What you get

One device entry with **~35 entities**:

| Platform | Entities |
|---|---|
| Sensor | State, PGA, STA/LTA, trigger, WiFi signal, IP, uptime, free heap, MQTT reconnects |
| Binary sensor | **Earthquake** (vibration device class → perfect for alarms), MQTT connected, setup AP |
| Switch | STA/LTA method, speaker, continuous graph, master mode, MQTT enabled, HA discovery |
| Number | PGA trigger, LCD brightness, update period, MQTT port |
| Text | MQTT host/user/password, base topic, slave topic, HA prefix, WiFi SSID/password, web login |
| Select | Logging mode (None/Serial/Web/Both) |
| Button | Restart, Recalibrate MPU, publish event, republish discovery, toggle MQTT |

Writing a text/number/switch posts to the device and persists in its flash. Password fields are write-only (masked); changing WiFi/MQTT host causes a device reconnection.

## The card

The card is registered automatically by the integration. Add it to a dashboard:

```yaml
type: custom:seismom5-card
name: SeismoM5
```

**Layout**
- Fills the height of its container: in a *sections* dashboard resize it with the grid (default 12×5, min 6×4); the chart grows or shrinks to fit.
- In masonry dashboards it uses its natural height; set `height: 360px` to force one.
- Responsive: on narrow cards secondary KPIs, button labels and tab labels collapse automatically.

**Front**: status, PGA with threshold bar, trigger, peak of the visible window, STA/LTA ratio, live chart with trigger line and earthquake bands, MQTT / WiFi / uptime indicators. The footer has **Calibrate**, **Restart** (tap twice to confirm) and the settings button.

**Back** (settings button): tabbed panel — *Detection*, *Device*, *MQTT*, *Network*, *System* — with switches, numeric fields, segmented selectors and password fields. Every change is saved on the device immediately (green confirmation). *System* shows device info and quick actions (publish event, republish discovery, open the device web UI).

| Option | Default | Description |
|---|---|---|
| `name` | `SeismoM5` | Title |
| `poll_ms` | `500` | Live polling interval |
| `max_points` | `300` | Points kept in the chart |
| `height` | — | Fixed height (masonry only) |
| `entry_id` | first entry | Config entry to follow when you have several devices |

The card talks to the authenticated proxy endpoints of the integration (`/api/seismom5/status`, `/settings`, `/action`), so it works over HTTPS even though the device itself is plain HTTP.

> **"Custom element doesn't exist"?** After installing or updating, force-reload
> the browser (Ctrl/Cmd+Shift+R) — browsers cache the frontend aggressively.

## Automation example

```yaml
alias: Terremoto
triggers:
  - trigger: state
    entity_id: binary_sensor.seismom5_earthquake
    to: "on"
    for: "00:00:02"
actions:
  - action: notify.notify
    data: { title: "Earthquake", message: "{{ states('sensor.seismom5_pga') }} g detected" }
```

## Requirements

- SeismoM5 firmware ≥ 2.0.0 (the [paki81 fork](https://github.com/paki81/seismoM5), `main`) with the HTTP API.
- Home Assistant ≥ 2024.6 (tested on 2026.10).
- The card works over HTTPS thanks to the built-in proxy — no CORS/mixed-content issues.
