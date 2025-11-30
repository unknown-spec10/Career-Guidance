from typing import List
from ..core.interfaces import VectorStore

class VectorStoreStub(VectorStore):
    def __init__(self):
        self.store = []

    def upsert(self, id: str, vector: List[float], metadata: dict):
        self.store.append({'id': id, 'vector': vector, 'meta': metadata})

    def query(self, vector: List[float], top_k: int = 10):
        return self.store[:top_k]
