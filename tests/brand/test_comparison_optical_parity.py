from pathlib import Path
import subprocess
import sys
import unittest


class ComparisonOpticalParityTest(unittest.TestCase):
    def test_comparison_wordmarks_have_equal_visible_ink_height(self):
        result = subprocess.run(
            [
                sys.executable,
                "tools/brand/verify_comparison.py",
                "docs/brand/candidates/comparison/iroa-bi-candidates.html",
            ],
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
