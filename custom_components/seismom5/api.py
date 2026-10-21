"""HTTP client for the SeismoM5 device API."""

from __future__ import annotations

import asyncio
from typing import Any

import aiohttp


class SeismoM5Error(Exception):
    """Device communication error."""


class SeismoM5AuthError(SeismoM5Error):
    """Authentication failed."""


class SeismoM5Client:
    """Thin client for the /api endpoints of the firmware web interface."""

    def __init__(
        self,
        session: aiohttp.ClientSession,
        host: str,
        username: str | None = None,
        password: str | None = None,
    ) -> None:
        self.base = f"http://{host}"
        self._session = session
        self._auth = aiohttp.BasicAuth(username, password) if username else None

    async def _request(self, method: str, path: str, data: dict | None = None) -> Any:
        try:
            async with asyncio.timeout(10):
                resp = await self._session.request(
                    method, self.base + path, auth=self._auth, data=data
                )
                if resp.status == 401:
                    raise SeismoM5AuthError("Invalid web interface credentials")
                if resp.status >= 400:
                    detail = (await resp.text())[:200]
                    raise SeismoM5Error(f"HTTP {resp.status}: {detail}")
                return await resp.json(content_type=None)
        except (aiohttp.ClientError, asyncio.TimeoutError) as err:
            raise SeismoM5Error(f"Cannot reach device: {err}") from err

    async def get_status(self) -> dict:
        """Live status: state, pga, sta/lta, mqtt, wifi, uptime."""
        return await self._request("GET", "/api/status")

    async def get_settings(self) -> dict:
        """All settings; passwords are returned only as flags."""
        return await self._request("GET", "/api/settings")

    async def update_settings(self, **kwargs) -> dict:
        """Update settings; empty strings mean 'unchanged'."""
        data = {k: ("1" if v else "0") if isinstance(v, bool) else str(v)
                for k, v in kwargs.items() if v is not None}
        return await self._request("POST", "/api/settings", data=data)

    async def action(self, action: str) -> dict:
        """Run an action: restart, recalibrate, update, discovery, mqtt_toggle."""
        return await self._request("POST", "/api/action", data={"do": action})
