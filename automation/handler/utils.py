from automation.handler.logger import init_logger


class Utils():

    def get_loger(self):
        return init_logger(__name__, testing_mode=False)
