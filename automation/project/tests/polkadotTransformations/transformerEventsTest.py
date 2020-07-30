import unittest
from automation.project.handler.testHandler import TestHandler


class TransformerEventsTest(unittest.TestCase):

    def test_transformer_events(self):
        test_handler = TestHandler()
        status, output = test_handler.perform_test('transformer_events_test')
        self.assertTrue(status, msg="TEST FAILED!!\n" + str(output))
