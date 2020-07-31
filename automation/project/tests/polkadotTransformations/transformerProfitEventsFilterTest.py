import unittest
from automation.project.handler.testHandler import TestHandler


class TransformerProfitEventsFilterTest(unittest.TestCase):

    def test_transformer_profit_events_filter(self):
        test_handler = TestHandler()
        status, output = test_handler.perform_test('transformer_profit_events_filter')
        self.assertTrue(status, msg="Transformer profit events filter test failed!\n" + str(output))
