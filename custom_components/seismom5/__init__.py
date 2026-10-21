"""SeismoM5 integration."""

from __future__ import annotations

from pathlib import Path

from homeassistant.components import frontend
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.typing import ConfigType
from homeassistant.components.http import HomeAssistantView
from aiohttp import web

from .api import SeismoM5Client
from .const import CARD_URL, CONF_HOST, CONF_PASSWORD, CONF_SCAN_INTERVAL, CONF_USERNAME, DEFAULT_SCAN_INTERVAL, DOMAIN, PROXY_URL
from .coordinator import SeismoM5Coordinator

PLATFORMS = [
    "sensor",
    "binary_sensor",
    "switch",
    "number",
    "select",
    "button",
    "text",
]

CARD_JS = Path(__file__).parent / "www" / "seismom5-card.js"

type SeismoM5ConfigEntry = ConfigEntry[SeismoM5Coordinator]


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Register the card resource and the status proxy."""
    await hass.http.async_register_static_paths(
        [StaticPathConfig(CARD_URL, str(CARD_JS), False)]
    )
    frontend.add_extra_js_url(hass, CARD_URL)
    hass.http.register_view(SeismoM5StatusView)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: SeismoM5ConfigEntry) -> bool:
    """Set up SeismoM5 from a config entry."""
    client = SeismoM5Client(
        async_get_clientsession(hass),
        entry.data[CONF_HOST],
        entry.data.get(CONF_USERNAME) or None,
        entry.data.get(CONF_PASSWORD) or None,
    )
    coordinator = SeismoM5Coordinator(
        hass, client, entry.options.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL)
    )
    await coordinator.async_config_entry_first_refresh()

    entry.runtime_data = coordinator
    entry.async_on_unload(entry.add_update_listener(_async_update_listener))

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def _async_update_listener(hass: HomeAssistant, entry: SeismoM5ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: SeismoM5ConfigEntry) -> bool:
    """Unload a config entry."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


class SeismoM5StatusView(HomeAssistantView):
    """Proxy /api/status of the device so the card can poll it over HTTPS."""

    url = PROXY_URL
    name = "api:seismom5:status"
    requires_auth = True

    async def get(self, request: web.Request) -> web.Response:
        """Return the device status JSON."""
        hass: HomeAssistant = request.app["hass"]
        entries = [
            e for e in hass.config_entries.async_entries(DOMAIN) if not e.disabled_by
        ]
        entry_id = request.query.get("entry")
        if entry_id:
            entries = [e for e in entries if e.entry_id == entry_id]
        if not entries:
            return web.json_response({"error": "no_seismom5_entry"}, status=404)
        coordinator: SeismoM5Coordinator = entries[0].runtime_data
        try:
            status = await coordinator.client.get_status()
        except Exception as err:  # noqa: BLE001
            return web.json_response({"error": str(err)}, status=502)
        return web.json_response(status)
