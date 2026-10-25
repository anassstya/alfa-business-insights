import json
import unittest
from unittest.mock import MagicMock

from ml.src.jsonb_storage import (CHUNK_BYTES, JsonbWriteConflict, read_web_research,
                                  update_jsonb, utf8_chunks)


class ContextStorageTests(unittest.TestCase):
    def test_large_json_preserves_utf8_and_publishes_only_after_all_chunks(self):
        document = json.dumps({"text": "Новость 💼 " * 4000}, ensure_ascii=False)
        chunks = list(utf8_chunks(document))
        self.assertEqual("".join(chunks), document)
        self.assertTrue(all(len(chunk.encode("utf-8")) <= CHUNK_BYTES for chunk in chunks))
        engine = MagicMock()
        execute = engine.connect.return_value.__enter__.return_value.execute
        execute.return_value.first.return_value = ("U_1",)
        update_jsonb(engine, table="company_contexts", column="payload", destination="web_research",
                     where="company_id=:id", params={"id": "U_1"}, document=document)
        calls = execute.call_args_list
        self.assertEqual("".join(c.args[1]["chunk"] for c in calls[:-1]), document)
        self.assertTrue(all("'{web_research}'" not in str(c.args[0]) for c in calls[:-1]))
        self.assertIn("'{web_research}'", str(calls[-1].args[0]))
        self.assertIn("string_agg", str(calls[-1].args[0]))

    def test_partial_upload_does_not_replace_previous_context(self):
        engine = MagicMock()
        execute = engine.connect.return_value.__enter__.return_value.execute
        execute.return_value.first.side_effect = [("U_1",), None]
        with self.assertRaises(JsonbWriteConflict):
            update_jsonb(engine, table="company_contexts", column="payload", destination="web_research",
                         where="company_id=:id", params={"id": "U_1"},
                         document=json.dumps({"text": "x" * 30000}))
        self.assertTrue(all("'{web_research}'" not in str(c.args[0]) for c in execute.call_args_list))

    def test_reader_reassembles_one_version_and_detects_concurrent_refresh(self):
        document = json.dumps({"text": "Новость 💼 " * 4000}, ensure_ascii=False)
        parts = [document[i:i+1000] for i in range(0, len(document), 1000)]
        engine = MagicMock()
        execute = engine.connect.return_value.__enter__.return_value.execute
        execute.return_value.first.side_effect = [(len(document.encode()), len(document), "version"),
                                                   *[(part,) for part in parts]]
        self.assertEqual(read_web_research(engine, "U_1"), json.loads(document))
        execute.return_value.first.side_effect = [(10000, 5000, "old-version"), None]
        with self.assertRaises(JsonbWriteConflict):
            read_web_research(engine, "U_1")

    def test_storage_helper_cannot_target_analysis_jobs(self):
        with self.assertRaises(ValueError):
            update_jsonb(MagicMock(), table="analysis_jobs", column="result", where="true",
                         params={}, document="{}")


if __name__ == "__main__":
    unittest.main()
