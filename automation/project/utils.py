from automation.project.logger import init_logger
from pathlib import Path


def get_loger():
    return init_logger(__name__, testing_mode=False)


def get_root_dir():
    return Path(__file__).parent.parent
