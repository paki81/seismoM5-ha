"""Binary sensors for SeismoM5."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from homeassistant.components.binary_sensor import (
    BinarySensorDeviceClass,
    BinarySensorEntity,
    BinarySensorEntityDescription,
)
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .entity import SeismoM5Entity


@dataclass(frozen=True, kw_only=True)
class SeismoM5BinarySensorDescription(BinarySensorEntityDescription):
    """Binary sensor description with a value getter."""

    name: str
    is_on_fn: Callable[[SeismoM5Entity], bool]


SENSORS: tuple[SeismoM5BinarySensorDescription, ...] = (
    SeismoM5BinarySensorDescription(
        key="earthquake",
        name="Earthquake",
        is_on_fn=lambda e: e.status.get("state") == "EARTHQUAKE",
        device_class=BinarySensorDeviceClass.VIBRATION,
    ),
    SeismoM5BinarySensorDescription(
        key="mqtt",
        name="MQTT",
        is_on_fn=lambda e: bool(e.status.get("mqtt", {}).get("connected")),
        device_class=BinarySensorDeviceClass.CONNECTIVITY,
        entity_category=EntityCategory.DIAGNOSTIC,
    ),
    SeismoM5BinarySensorDescription(
        key="ap_mode",
        name="Setup access point",
        is_on_fn=lambda e: bool(e.status.get("wifi", {}).get("ap")),
        entity_category=EntityCategory.DIAGNOSTIC,
        entity_registry_enabled_default=False,
        icon="mdi:access-point",
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up binary sensors."""
    coordinator = entry.runtime_data
    async_add_entities(SeismoM5BinarySensor(coordinator, d) for d in SENSORS)


class SeismoM5BinarySensor(SeismoM5Entity, BinarySensorEntity):
    """A SeismoM5 binary sensor."""

    entity_description: SeismoM5BinarySensorDescription

    def __init__(self, coordinator, description: SeismoM5BinarySensorDescription) -> None:
        super().__init__(coordinator, description.key, description.name)
        self.entity_description = description

    @property
    def is_on(self) -> bool:
        return self.entity_description.is_on_fn(self)
