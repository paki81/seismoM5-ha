"""Number entities for SeismoM5."""

from __future__ import annotations

from dataclasses import dataclass

from homeassistant.components.number import NumberEntity, NumberEntityDescription, NumberMode
from homeassistant.const import EntityCategory, UnitOfTime
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .entity import SeismoM5Entity


@dataclass(frozen=True, kw_only=True)
class SeismoM5NumberDescription(NumberEntityDescription):
    """Number description mapping a settings key."""

    name: str
    setting: str


NUMBERS: tuple[SeismoM5NumberDescription, ...] = (
    SeismoM5NumberDescription(
        key="pga_trigger",
        name="PGA trigger threshold",
        setting="pga_trigger",
        native_min_value=0.0005,
        native_max_value=2.0,
        native_step=0.0005,
        native_unit_of_measurement="g",
        mode=NumberMode.BOX,
        entity_category=EntityCategory.CONFIG,
        icon="mdi:tune-vertical",
    ),
    SeismoM5NumberDescription(
        key="lcd_brightness",
        name="LCD standby brightness",
        setting="lcd_brightness",
        native_min_value=7,
        native_max_value=15,
        native_step=1,
        mode=NumberMode.BOX,
        entity_category=EntityCategory.CONFIG,
        icon="mdi:brightness-6",
    ),
    SeismoM5NumberDescription(
        key="update_period",
        name="Event update period",
        setting="update_period",
        native_min_value=1,
        native_max_value=3600,
        native_step=1,
        native_unit_of_measurement=UnitOfTime.SECONDS,
        mode=NumberMode.BOX,
        entity_category=EntityCategory.CONFIG,
        icon="mdi:timer-outline",
    ),
    SeismoM5NumberDescription(
        key="mqtt_port",
        name="MQTT port",
        setting="mqtt_port",
        native_min_value=1,
        native_max_value=65535,
        native_step=1,
        mode=NumberMode.BOX,
        entity_category=EntityCategory.CONFIG,
        icon="mdi:ethernet",
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up numbers."""
    coordinator = entry.runtime_data
    async_add_entities(SeismoM5Number(coordinator, d) for d in NUMBERS)


class SeismoM5Number(SeismoM5Entity, NumberEntity):
    """A SeismoM5 number."""

    entity_description: SeismoM5NumberDescription

    def __init__(self, coordinator, description: SeismoM5NumberDescription) -> None:
        super().__init__(coordinator, description.key, description.name)
        self.entity_description = description

    @property
    def native_value(self) -> float | None:
        v = self.settings.get(self.entity_description.setting)
        return float(v) if v is not None else None

    async def async_set_native_value(self, value: float) -> None:
        d = self.entity_description
        v: int | float = int(value) if d.native_step and float(d.native_step).is_integer() else value
        await self._set(**{d.setting: v})
