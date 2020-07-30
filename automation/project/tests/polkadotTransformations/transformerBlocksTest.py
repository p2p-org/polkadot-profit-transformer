import unittest
from automation.project.handler.testHandler import TestHandler


class TransformerBlocksTest(unittest.TestCase):

    def test_transformer_blocks(self):
        test_handler = TestHandler()
        status, output = test_handler.perform_test('transformer_blocks_test')
        self.assertTrue(status, msg="TEST FAILED!!\n" + str(output))
