import json

import numpy as np
from sentence_transformers import SentenceTransformer

from config import CHUNKS_PATH, EMBEDDINGS_PATH

MODEL_NAME = "intfloat/multilingual-e5-small"


class DocumentSearch:
    def __init__(self):
        with CHUNKS_PATH.open("r", encoding="utf-8") as file:
            self.chunks = [
                json.loads(line)
                for line in file
                if line.strip()
            ]

        self.embeddings = np.load(EMBEDDINGS_PATH)

        if len(self.chunks) != len(self.embeddings):
            raise ValueError(
                "Количество текстовых фрагментов "
                "не совпадает с количеством векторов."
            )

        self.model = SentenceTransformer(MODEL_NAME)

    def search(self, question, top_k=5):
        question_vector = self.model.encode(
            ["query: " + question],
            normalize_embeddings=True,
            convert_to_numpy=True,
        )[0]

        # Векторы уже нормализованы, поэтому скалярное
        # произведение соответствует cosine similarity.
        scores = self.embeddings @ question_vector

        # Индексы top_k наиболее подходящих фрагментов.
        top_indices = np.argsort(scores)[::-1][:top_k]

        results = []

        for index in top_indices:
            chunk = self.chunks[index]

            results.append({
                "text": chunk["text"],
                "source": chunk["source"],
                "page_start": chunk["page_start"],
                "page_end": chunk["page_end"],
                "extraction_method": chunk["extraction_method"],
                "score": float(scores[index]),
            })

        return results


if __name__ == "__main__":
    search_engine = DocumentSearch()

    question = input("Введите вопрос по документам: ")
    results = search_engine.search(question)

    for number, result in enumerate(results, start=1):
        print(f"\nРезультат {number}")
        print(f"Источник: {result['source']}")
        print(
            f"Страница: {result['page_start']}"
            f"-{result['page_end']}"
        )
        print(f"Метод извлечения: {result['extraction_method']}")
        print(f"Сходство: {result['score']:.4f}")
        print(f"Текст: {result['text']}")
