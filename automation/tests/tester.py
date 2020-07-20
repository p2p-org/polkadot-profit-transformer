import unittest
import subprocess
from automation.handler.utils import Utils



class firstTest(unittest.TestCase):

    def test_first(self):
        utils = Utils()
        log = utils.get_loger()
        output = subprocess.getoutput("ksql-test-runner -s /polkadot-profit-transformer/automation/statements.sql -i /polkadot-profit-transformer/automation/input.json -o /polkadot-profit-transformer/automation/output.json")
        log.info(output)
        status=self.get_test_status(output)
        self.assertTrue(status,msg="TEST FAILED!!\n"+str(output))





    def get_test_status(self,string):
        if "Test passed!" in str(string):
            return True
        else:
            return False

    def text_test(self):
        handle=open('/home/vlad/work/p2p-autotests/statements.sql','w')
        handle.write("This is a test!")
        handle.close()









