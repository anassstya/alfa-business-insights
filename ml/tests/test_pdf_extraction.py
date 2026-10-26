import importlib.util
import tempfile
import unittest
from pathlib import Path


@unittest.skipUnless(importlib.util.find_spec('pymupdf') and importlib.util.find_spec('pytesseract'),
                     'PDF extraction dependencies are installed in the Docker image')
class PDFExtractionTests(unittest.TestCase):
    def test_grisha_extractor_preserves_pdf_page_and_document_identity(self):
        import pymupdf
        from ml.document_search.prepare import process_pdf
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'bank.pdf'
            with pymupdf.open() as pdf:
                for index in range(2):
                    page = pdf.new_page()
                    text = ('Monetary policy influences financing conditions for corporate borrowers. '
                            'Companies should evaluate the sensitivity of future borrowing costs. ' * 4)
                    page.insert_textbox(pymupdf.Rect(50, 50, 550, 500), text)
                pdf.save(path)
            chunks = process_pdf(path, document_id='synthetic-report')
        self.assertTrue(chunks)
        self.assertEqual({c['page_start'] for c in chunks}, {1, 2})
        self.assertTrue(all(c['document_id'] == 'synthetic-report' for c in chunks))
        self.assertTrue(all(c['source'] == 'bank.pdf' and c['text'] for c in chunks))
