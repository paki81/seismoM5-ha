"""Select entities for SeismoM5."""

from __future__ import annotations

from typing import Any

from homeassistant.components.select import SelectEntity
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .entity import SeismoM5Entity

LOGGING_OPTIONS = ["None", "Serial", "Web", "Both"]


async def async_setup_entry(
    hass: HomeAssistant,
    entry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up selects."""
    coordinator = entry.runtime_data
    async_add_entities([SeismoM5LoggingSelect(coordinator)])


class SeismoM5LoggingSelect(SeismoM5Entity, SelectEntity):
    """Logging mode select."""

    _attr_icon = "mdi:text-box-outline"
    _attr_entity_category = EntityCategory.CONFIG

    def __init__(self, coordinator) -> None:
        super().__init__(coordinator, "logging", "Logging")
        self._attr_options = LOGGING_OPTIONS

    @property
    def current_option(self) -> str:
        return LOGGING_OPTIONS[int(self.settings.get("logging", 0))]

    async def async_select_option(self, option: str) -> None:
        await self._set(logging=LOGGING_OPTIONS.index(option))
