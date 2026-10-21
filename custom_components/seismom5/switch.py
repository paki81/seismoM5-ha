"""Switches for SeismoM5."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from homeassistant.components.switch import SwitchEntity, SwitchEntityDescription
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .entity import SeismoM5Entity


@dataclass(frozen=True, kw_only=True)
class SeismoM5SwitchDescription(SwitchEntityDescription):
    """Switch description mapping a settings key."""

    name: str
    setting: str


SWITCHES: tuple[SeismoM5SwitchDescription, ...] = (
    SeismoM5SwitchDescription(
        key="sta_lta",
        name="STA/LTA method",
        setting="sta_lta",
        entity_category=EntityCategory.CONFIG,
        icon="mdi:sine-wave",
    ),
    SeismoM5SwitchDescription(
        key="speaker",
        name="Speaker",
        setting="speaker_enable",
        entity_category=EntityCategory.CONFIG,
        icon="mdi:volume-high",
    ),
    SeismoM5SwitchDescription(
        key="continuous_graph",
        name="Continuous graph",
        setting="continuous_graph",
        entity_category=EntityCategory.CONFIG,
        icon="mdi:chart-line",
    ),
    SeismoM5SwitchDescription(
        key="master",
        name="Master mode",
        setting="master",
        entity_category=EntityCategory.CONFIG,
        icon="mdi:account-supervisor",
    ),
    SeismoM5SwitchDescription(
        key="mqtt_enabled",
        name="MQTT enabled",
        setting="mqtt_enabled",
        entity_category=EntityCategory.CONFIG,
        icon="mdi:cloud-upload",
    ),
    SeismoM5SwitchDescription(
        key="ha_discovery",
        name="Home Assistant MQTT discovery",
        setting="ha_discovery",
        entity_category=EntityCategory.CONFIG,
        icon="mdi:home-assistant",
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up switches."""
    coordinator = entry.runtime_data
    entities = [SeismoM5Switch(coordinator, d) for d in SWITCHES]
    async_add_entities(entities)


class SeismoM5Switch(SeismoM5Entity, SwitchEntity):
    """A SeismoM5 switch."""

    entity_description: SeismoM5SwitchDescription

    def __init__(self, coordinator, description: SeismoM5SwitchDescription) -> None:
        super().__init__(coordinator, description.key, description.name)
        self.entity_description = description
        if description.key == "master" and self.settings.get("slave"):
            self._attr_entity_registry_enabled_default = False

    @property
    def is_on(self) -> bool:
        return bool(self.settings.get(self.entity_description.setting))

    async def async_turn_on(self, **kwargs: Any) -> None:
        await self._set(**{self.entity_description.setting: True})

    async def async_turn_off(self, **kwargs: Any) -> None:
        await self._set(**{self.entity_description.setting: False})
