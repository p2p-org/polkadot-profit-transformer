import logging
import colorlog


def init_logger(dunder_name, testing_mode) -> logging.Logger:
    log_format = (
        '%(levelname)s - '
        '%(message)s'
    )
    bold_seq = '\033[1m'
    colorlog_format = (
        '{} '
        '%(log_color)s '
        '{}'.format(bold_seq, log_format)
    )
    colorlog.basicConfig(format=colorlog_format)
    logger = logging.getLogger(dunder_name)

    if testing_mode:
        logger.setLevel(logging.DEBUG)
    else:
        logger.setLevel(logging.INFO)

    return logger
