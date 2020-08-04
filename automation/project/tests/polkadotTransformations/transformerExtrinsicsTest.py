import unittest
from automation.project.handler.testHandler import TestHandler


class TransformerExtrinsicsTest(unittest.TestCase):

    def test_transformer_extrinsics(self):
        test_handler = TestHandler()
        status, output = test_handler.perform_test('transformer_extrinsics_test')
        self.assertTrue(status, msg="Transformer extrinsics test failed!\n" + str(output))
