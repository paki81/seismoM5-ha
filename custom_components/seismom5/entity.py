"""Base entity for SeismoM5."""

from __future__ import annotations

from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import SeismoM5Coordinator


class SeismoM5Entity(CoordinatorEntity[SeismoM5Coordinator]):
    """Common entity base with device info."""

    _attr_has_entity_name = True

    def __init__(self, coordinator: SeismoM5Coordinator, key: str, name: str | None) -> None:
        super().__init__(coordinator)
        self._attr_unique_id = f"{coordinator.config_entry.unique_id}_{key}"
        self._attr_name = name
        status = coordinator.data.get("status", {})
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, coordinator.config_entry.unique_id)},
            name=status.get("hostname", "SeismoM5"),
            manufacturer="M5Stack / febalci fork",
            model=status.get("model"),
            sw_version=status.get("version"),
            configuration_url=coordinator.client.base,
        )

    @property
    def status(self) -> dict:
        """Live status payload."""
        return self.coordinator.data["status"]

    @property
    def settings(self) -> dict:
        """Settings payload."""
        return self.coordinator.data["settings"]

    async def _set(self, **kwargs) -> None:
        """Write settings and refresh."""
        await self.coordinator.client.update_settings(**kwargs)
        await self.coordinator.async_request_refresh()
