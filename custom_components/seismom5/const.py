"""Constants for the SeismoM5 integration."""

DOMAIN = "seismom5"

CONF_HOST = "host"
CONF_USERNAME = "username"
CONF_PASSWORD = "password"
CONF_SCAN_INTERVAL = "scan_interval"

DEFAULT_SCAN_INTERVAL = 5
MIN_SCAN_INTERVAL = 1
MAX_SCAN_INTERVAL = 60

CARD_URL = "/seismom5/card.js"
PROXY_URL = "/api/seismom5/status"
