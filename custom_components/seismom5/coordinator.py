"""Data update coordinator for SeismoM5."""

from __future__ import annotations

import logging
from datetime import timedelta

from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .api import SeismoM5Client, SeismoM5Error
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)


class SeismoM5Coordinator(DataUpdateCoordinator[dict]):
    """Polls /api/status and /api/settings."""

    def __init__(self, hass: HomeAssistant, client: SeismoM5Client, scan_interval: int) -> None:
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(seconds=scan_interval),
        )
        self.client = client
        self._cycle = 0

    async def _async_update_data(self) -> dict:
        try:
            status = await self.client.get_status()
            self._cycle += 1
            # Settings change rarely and are refetched after every write anyway;
            # poll them at a slower rate to limit requests to the ESP32.
            if self._cycle % 4 == 1 or "settings" not in (self.data or {}):
                settings = await self.client.get_settings()
            else:
                settings = self.data["settings"]
            return {"status": status, "settings": settings}
        except SeismoM5Error as err:
            raise UpdateFailed(str(err)) from err
