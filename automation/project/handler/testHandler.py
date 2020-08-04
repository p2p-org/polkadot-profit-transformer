import subprocess
from automation.project.jsonHelper import JsonHelper
from automation.project.handler.baseTest import BaseTest


class TestHandler(BaseTest):

    def __init__(self):
        super().__init__()

    def perform_test(self, test_name):
        self.update_test_files(test_name)
        self.log.info("Performing test-execution...")

        test_output = subprocess.getoutput(
            "ksql-test-runner -s {} -i {} -o {}".format(self.paths.TEST_FILES_DIRECTORY.format("statements.sql"),
                                                        self.paths.TEST_FILES_DIRECTORY.format("input.json"),
                                                        self.paths.TEST_FILES_DIRECTORY.format("output.json")))
        return self.get_test_status(test_output), test_output

    def update_test_files(self, test_name):
        self.log.info("Updating test files(statements.sql,input.json,output.json)")

        json_helper = JsonHelper()
        test_sql_query, test_input, test_output = json_helper.get_transformer_test_data(test_name)
        self.write_to_file(test_sql_query, 'statements.sql')
        self.write_to_file(test_input, 'input.json')
        self.write_to_file(test_output, 'output.json')

    def write_to_file(self, test_data, file_name):
        self.log.info("Writing test data into file {}".format(file_name))

        handle = open(self.paths.TEST_FILES_DIRECTORY.format(file_name), 'w')
        handle.write(test_data)
        handle.close()

    def get_test_status(self, test_output):
        self.log.info("Verifying test status...")

        if "Test passed!" in str(test_output):
            return True
        else:
            return False
