"""Buttons for SeismoM5."""

from __future__ import annotations

from dataclasses import dataclass

from homeassistant.components.button import ButtonDeviceClass, ButtonEntity, ButtonEntityDescription
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .entity import SeismoM5Entity


@dataclass(frozen=True, kw_only=True)
class SeismoM5ButtonDescription(ButtonEntityDescription):
    """Button description with the firmware action."""

    name: str
    action: str


BUTTONS: tuple[SeismoM5ButtonDescription, ...] = (
    SeismoM5ButtonDescription(
        key="restart",
        name="Restart",
        action="restart",
        device_class=ButtonDeviceClass.RESTART,
        entity_category=EntityCategory.CONFIG,
    ),
    SeismoM5ButtonDescription(
        key="recalibrate",
        name="Recalibrate MPU",
        action="recalibrate",
        entity_category=EntityCategory.CONFIG,
        icon="mdi:axis-arrow",
    ),
    SeismoM5ButtonDescription(
        key="update",
        name="Publish event update",
        action="update",
        entity_category=EntityCategory.CONFIG,
        icon="mdi:refresh",
    ),
    SeismoM5ButtonDescription(
        key="discovery",
        name="Republish MQTT discovery",
        action="discovery",
        entity_category=EntityCategory.CONFIG,
        icon="mdi:home-assistant",
    ),
    SeismoM5ButtonDescription(
        key="mqtt_toggle",
        name="Toggle MQTT",
        action="mqtt_toggle",
        entity_category=EntityCategory.CONFIG,
        icon="mdi:cloud-upload",
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up buttons."""
    coordinator = entry.runtime_data
    async_add_entities(SeismoM5Button(coordinator, d) for d in BUTTONS)


class SeismoM5Button(SeismoM5Entity, ButtonEntity):
    """A SeismoM5 action button."""

    entity_description: SeismoM5ButtonDescription

    def __init__(self, coordinator, description: SeismoM5ButtonDescription) -> None:
        super().__init__(coordinator, description.key, description.name)
        self.entity_description = description

    async def async_press(self) -> None:
        await self.coordinator.client.action(self.entity_description.action)
        if self.entity_description.action != "restart":
            await self.coordinator.async_request_refresh()
