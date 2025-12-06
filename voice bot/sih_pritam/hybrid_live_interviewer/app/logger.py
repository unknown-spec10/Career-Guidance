import logging
from logging import StreamHandler, Formatter

logger = logging.getLogger("hybrid_interviewer")
logger.setLevel(logging.DEBUG)
handler = StreamHandler()
handler.setFormatter(Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
logger.addHandler(handler)
