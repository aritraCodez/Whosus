import logging

from .config import Settings
from .voice import VoiceRouter

log = logging.getLogger('whosus')
rooms = {}
sessions = {}
voice = VoiceRouter()
ORIGINS = set(Settings().allowed_origins)
