"""Sensors for SeismoM5."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorEntityDescription,
    SensorStateClass,
)
from homeassistant.const import (
    SIGNAL_STRENGTH_DECIBELS_MILLIWATT,
    EntityCategory,
    UnitOfTime,
)
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .entity import SeismoM5Entity


@dataclass(frozen=True, kw_only=True)
class SeismoM5SensorDescription(SensorEntityDescription):
    """Sensor description with a value getter."""

    name: str
    value_fn: Callable[[SeismoM5Entity], object]


def _s(key: str):
    return lambda e: e.status.get(key)


SENSORS: tuple[SeismoM5SensorDescription, ...] = (
    SeismoM5SensorDescription(
        key="state",
        name="State",
        value_fn=_s("state"),
        icon="mdi:pulse",
    ),
    SeismoM5SensorDescription(
        key="pga",
        name="PGA",
        value_fn=lambda e: round(e.status.get("pga", 0), 4),
        native_unit_of_measurement="g",
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=4,
        icon="mdi:pulse",
    ),
    SeismoM5SensorDescription(
        key="sta",
        name="STA",
        value_fn=lambda e: round(e.status.get("sta", 0), 4),
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=4,
        entity_registry_enabled_default=False,
        icon="mdi:sine-wave",
    ),
    SeismoM5SensorDescription(
        key="lta",
        name="LTA",
        value_fn=lambda e: round(e.status.get("lta", 0), 4),
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=4,
        entity_registry_enabled_default=False,
        icon="mdi:sine-wave",
    ),
    SeismoM5SensorDescription(
        key="pga_trigger",
        name="PGA trigger",
        value_fn=lambda e: e.status.get("pga_trigger"),
        native_unit_of_measurement="g",
        suggested_display_precision=4,
        entity_category=EntityCategory.DIAGNOSTIC,
        icon="mdi:tune-vertical",
    ),
    SeismoM5SensorDescription(
        key="rssi",
        name="WiFi signal",
        value_fn=lambda e: e.status.get("wifi", {}).get("rssi"),
        device_class=SensorDeviceClass.SIGNAL_STRENGTH,
        native_unit_of_measurement=SIGNAL_STRENGTH_DECIBELS_MILLIWATT,
        state_class=SensorStateClass.MEASUREMENT,
        entity_category=EntityCategory.DIAGNOSTIC,
    ),
    SeismoM5SensorDescription(
        key="uptime",
        name="Uptime",
        value_fn=lambda e: e.status.get("uptime"),
        device_class=SensorDeviceClass.DURATION,
        native_unit_of_measurement=UnitOfTime.SECONDS,
        entity_category=EntityCategory.DIAGNOSTIC,
        entity_registry_enabled_default=False,
    ),
    SeismoM5SensorDescription(
        key="ip",
        name="IP address",
        value_fn=lambda e: e.status.get("wifi", {}).get("ip"),
        entity_category=EntityCategory.DIAGNOSTIC,
        icon="mdi:ip-network",
    ),
    SeismoM5SensorDescription(
        key="heap",
        name="Free heap",
        value_fn=lambda e: round(e.status.get("heap", 0) / 1024, 1),
        native_unit_of_measurement="kB",
        entity_category=EntityCategory.DIAGNOSTIC,
        entity_registry_enabled_default=False,
        icon="mdi:memory",
    ),
    SeismoM5SensorDescription(
        key="mqtt_reconnects",
        name="MQTT reconnects",
        value_fn=lambda e: e.status.get("mqtt", {}).get("reconnects"),
        entity_category=EntityCategory.DIAGNOSTIC,
        entity_registry_enabled_default=False,
        icon="mdi:counter",
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up sensors."""
    coordinator = entry.runtime_data
    async_add_entities(SeismoM5Sensor(coordinator, d) for d in SENSORS)


class SeismoM5Sensor(SeismoM5Entity, SensorEntity):
    """A SeismoM5 sensor."""

    entity_description: SeismoM5SensorDescription

    def __init__(self, coordinator, description: SeismoM5SensorDescription) -> None:
        super().__init__(coordinator, description.key, description.name)
        self.entity_description = description

    @property
    def native_value(self):
        return self.entity_description.value_fn(self)
