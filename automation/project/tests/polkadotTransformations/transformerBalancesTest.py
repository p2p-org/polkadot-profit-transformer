import unittest
from automation.project.handler.testHandler import TestHandler


class TransformerBalancesTest(unittest.TestCase):

    def test_transformer_balances(self):
        test_handler = TestHandler()
        status, output = test_handler.perform_test('transformer_balances_test')
        self.assertTrue(status, msg="Transformer balances test failed!\n" + str(output))
