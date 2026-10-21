"""Text entities for SeismoM5 network settings."""

from __future__ import annotations

from dataclasses import dataclass

from homeassistant.components.text import TextEntity, TextEntityDescription, TextMode
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .entity import SeismoM5Entity


@dataclass(frozen=True, kw_only=True)
class SeismoM5TextDescription(TextEntityDescription):
    """Text description mapping a settings key."""

    name: str
    setting: str
    password_field: bool = False
    max_len: int = 64


TEXTS: tuple[SeismoM5TextDescription, ...] = (
    SeismoM5TextDescription(
        key="mqtt_host",
        name="MQTT host",
        setting="mqtt_host",
        entity_category=EntityCategory.CONFIG,
        icon="mdi:server",
    ),
    SeismoM5TextDescription(
        key="mqtt_user",
        name="MQTT username",
        setting="mqtt_user",
        entity_category=EntityCategory.CONFIG,
        icon="mdi:account",
    ),
    SeismoM5TextDescription(
        key="mqtt_pass",
        name="MQTT password",
        setting="mqtt_pass",
        password_field=True,
        entity_category=EntityCategory.CONFIG,
        icon="mdi:form-textbox-password",
    ),
    SeismoM5TextDescription(
        key="mqtt_base",
        name="MQTT base topic",
        setting="mqtt_base",
        entity_category=EntityCategory.CONFIG,
        icon="mdi:format-list-group",
    ),
    SeismoM5TextDescription(
        key="mqtt_slave_topic",
        name="Slave state topic",
        setting="mqtt_slave_topic",
        entity_category=EntityCategory.CONFIG,
        icon="mdi:format-list-group",
    ),
    SeismoM5TextDescription(
        key="ha_prefix",
        name="HA discovery prefix",
        setting="ha_prefix",
        entity_category=EntityCategory.CONFIG,
        icon="mdi:home-assistant",
    ),
    SeismoM5TextDescription(
        key="wifi_ssid",
        name="WiFi SSID",
        setting="wifi_ssid",
        entity_category=EntityCategory.CONFIG,
        icon="mdi:wifi",
    ),
    SeismoM5TextDescription(
        key="wifi_pass",
        name="WiFi password",
        setting="wifi_pass",
        password_field=True,
        entity_category=EntityCategory.CONFIG,
        icon="mdi:form-textbox-password",
        entity_registry_enabled_default=False,
    ),
    SeismoM5TextDescription(
        key="web_user",
        name="Web UI username",
        setting="web_user",
        entity_category=EntityCategory.CONFIG,
        entity_registry_enabled_default=False,
        icon="mdi:account-key",
    ),
    SeismoM5TextDescription(
        key="web_pass",
        name="Web UI password",
        setting="web_pass",
        password_field=True,
        entity_category=EntityCategory.CONFIG,
        entity_registry_enabled_default=False,
        icon="mdi:form-textbox-password",
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up text entities."""
    coordinator = entry.runtime_data
    async_add_entities(SeismoM5Text(coordinator, d) for d in TEXTS)


class SeismoM5Text(SeismoM5Entity, TextEntity):
    """A SeismoM5 text setting."""

    entity_description: SeismoM5TextDescription

    def __init__(self, coordinator, description: SeismoM5TextDescription) -> None:
        super().__init__(coordinator, description.key, description.name)
        self.entity_description = description
        self._attr_native_max = description.max_len
        if description.password_field:
            self._attr_mode = TextMode.PASSWORD

    @property
    def native_value(self) -> str:
        if self.entity_description.password_field:
            # Passwords are never returned by the device; show a masked placeholder
            flag = "has_" + self.entity_description.setting
            return "" if not self.settings.get(flag) else "••••••••"
        return str(self.settings.get(self.entity_description.setting, ""))

    async def async_set_value(self, value: str) -> None:
        d = self.entity_description
        if d.password_field and (value == "" or value == "••••••••"):
            return  # Keep the stored password
        await self._set(**{d.setting: value})
