import json

import numpy as np
from sentence_transformers import SentenceTransformer

from config import CHUNKS_PATH, EMBEDDINGS_PATH

MODEL_NAME = "intfloat/multilingual-e5-small"


def main():
    with CHUNKS_PATH.open("r", encoding="utf-8") as file:
        chunks = [json.loads(line) for line in file if line.strip()]

    if not chunks:
        raise ValueError("No chunks found. Process PDFs first.")

    model = SentenceTransformer(MODEL_NAME)

    texts = ["passage: " + chunk["text"] for chunk in chunks]
    embeddings = model.encode(
        texts,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=True,
    )

    np.save(EMBEDDINGS_PATH, embeddings)
    print(f"Saved {len(embeddings)} embeddings to {EMBEDDINGS_PATH}")


if __name__ == "__main__":
    main()
