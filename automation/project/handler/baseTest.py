import automation.project.utils as utils
import automation.project.Paths as paths


class BaseTest:

    def __init__(self, ):
        self.log = utils.get_loger()
        self.paths = paths
