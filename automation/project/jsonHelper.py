import json
from automation.project.handler.baseTest import BaseTest


class JsonHelper(BaseTest):
    def __init__(self):
        super().__init__()
        with open(self.paths.TEST_FILES_DIRECTORY.format("transformer_test_data.json"), "r") as transformer_test_data:
            self.transformer_test_data_json = json.load(transformer_test_data)
        with open(self.paths.ROOT_DIR+"/transformer_queries.json", "r") as transformer_queries:
            self.transformer_queries_json = json.load(transformer_queries)

    def get_transformer_test_data(self, test_name):
        self.log.info("Parsing transformer test-data...")

        for test_data in self.transformer_test_data_json:
            if test_data['name'] == test_name:
                queries = self.get_queries(test_data['sql_queries'])
                return queries, test_data['input'], test_data['output']

    def get_queries(self, queries_names):
        self.log.info("Parsing query-string...")

        query_string = ""
        for query_name in queries_names:
            for name, query in self.transformer_queries_json.items():
                if name == query_name:
                    query_string += query
        return query_string
