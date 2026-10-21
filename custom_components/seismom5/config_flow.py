"""Config flow for SeismoM5."""

from __future__ import annotations

import re
from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.data_entry_flow import FlowResult
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import SeismoM5AuthError, SeismoM5Client, SeismoM5Error
from .const import (
    CONF_HOST,
    CONF_PASSWORD,
    CONF_SCAN_INTERVAL,
    CONF_USERNAME,
    DEFAULT_SCAN_INTERVAL,
    DOMAIN,
    MAX_SCAN_INTERVAL,
    MIN_SCAN_INTERVAL,
)

DATA_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_HOST): str,
        vol.Optional(CONF_USERNAME): str,
        vol.Optional(CONF_PASSWORD): str,
    }
)


def _normalize_host(host: str) -> str:
    host = host.strip()
    host = re.sub(r"^https?://", "", host)
    return host.rstrip("/")


class SeismoM5ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for SeismoM5."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> FlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            host = _normalize_host(user_input[CONF_HOST])
            client = SeismoM5Client(
                async_get_clientsession(self.hass),
                host,
                user_input.get(CONF_USERNAME) or None,
                user_input.get(CONF_PASSWORD) or None,
            )
            try:
                status = await client.get_status()
            except SeismoM5AuthError:
                errors["base"] = "invalid_auth"
            except SeismoM5Error:
                errors["base"] = "cannot_connect"
            else:
                await self.async_set_unique_id(status["mac"])
                self._abort_if_unique_id_configured()
                return self.async_create_entry(
                    title=status.get("hostname", "seismoM5"),
                    data={
                        CONF_HOST: host,
                        CONF_USERNAME: user_input.get(CONF_USERNAME) or "",
                        CONF_PASSWORD: user_input.get(CONF_PASSWORD) or "",
                    },
                )

        return self.async_show_form(step_id="user", data_schema=DATA_SCHEMA, errors=errors)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: config_entries.ConfigEntry):
        """Return the options flow."""
        return SeismoM5OptionsFlow()


class SeismoM5OptionsFlow(config_entries.OptionsFlow):
    """Handle options."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> FlowResult:
        if user_input is not None:
            return self.async_create_entry(data=user_input)

        current = self.config_entry.options.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL)
        schema = vol.Schema(
            {
                vol.Required(
                    CONF_SCAN_INTERVAL,
                    default=current,
                ): vol.All(vol.Coerce(int), vol.Range(min=MIN_SCAN_INTERVAL, max=MAX_SCAN_INTERVAL)),
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema)
