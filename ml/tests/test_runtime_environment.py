import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ml.src.runtime_environment import load_runtime_environment


class RuntimeEnvironmentTests(unittest.TestCase):
    def test_root_wins_over_stale_local_file(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'ml').mkdir()
            (root / '.env').write_text('ML_SERVICE_TOKEN=shared\n', encoding='utf-8')
            (root / 'ml/docker.example').write_text(
                'ML_SERVICE_TOKEN=old\nTAVILY_API=stale\n', encoding='utf-8')
            with patch('ml.src.runtime_environment.ROOT', root), patch.dict(os.environ, {}, clear=True):
                load_runtime_environment()
                self.assertEqual(os.environ['ML_SERVICE_TOKEN'], 'shared')
                self.assertNotIn('TAVILY_API', os.environ)

    def test_local_file_works_without_root_env(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'ml').mkdir()
            (root / 'ml/docker.example').write_text('ML_SERVICE_TOKEN=standalone\n', encoding='utf-8')
            with patch('ml.src.runtime_environment.ROOT', root), patch.dict(os.environ, {}, clear=True):
                load_runtime_environment()
                self.assertEqual(os.environ['ML_SERVICE_TOKEN'], 'standalone')

    def test_container_environment_wins_over_file(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / '.env').write_text('ML_SERVICE_TOKEN=file\n', encoding='utf-8')
            with patch('ml.src.runtime_environment.ROOT', root), \
                 patch.dict(os.environ, {'ML_SERVICE_TOKEN': 'container'}, clear=True):
                load_runtime_environment()
                self.assertEqual(os.environ['ML_SERVICE_TOKEN'], 'container')
