from app.services import chroma_service


class DummyCollection:
    def __init__(self, name: str):
        self.name = name


class DummyCloudClient:
    def __init__(self, *args, **kwargs):
        self.args = args
        self.kwargs = kwargs

    def get_or_create_collection(self, name: str):
        return DummyCollection(name)


class DummyPersistentClient:
    def __init__(self, *args, **kwargs):
        self.args = args
        self.kwargs = kwargs

    def get_or_create_collection(self, name: str):
        return DummyCollection(name)


def test_uses_cloud_client_when_api_key_present(monkeypatch):
    monkeypatch.setattr(chroma_service.chromadb, "CloudClient", DummyCloudClient)
    monkeypatch.setattr(chroma_service.chromadb, "PersistentClient", DummyPersistentClient)

    client, collection = chroma_service.get_chroma_collection(
        api_key="test-key",
        tenant="tenant-a",
        database="Dev",
        persist_dir="/tmp/chroma",
        collection_name="medical_dialogues",
    )

    assert isinstance(client, DummyCloudClient)
    assert collection.name == "medical_dialogues"
    assert client.kwargs["api_key"] == "test-key"
    assert client.kwargs["tenant"] == "tenant-a"
    assert client.kwargs["database"] == "Dev"


def test_falls_back_to_persistent_client_when_api_key_missing(monkeypatch):
    monkeypatch.setattr(chroma_service.chromadb, "CloudClient", DummyCloudClient)
    monkeypatch.setattr(chroma_service.chromadb, "PersistentClient", DummyPersistentClient)

    client, collection = chroma_service.get_chroma_collection(
        api_key="",
        persist_dir="/tmp/chroma",
        collection_name="medical_dialogues",
    )

    assert isinstance(client, DummyPersistentClient)
    assert collection.name == "medical_dialogues"
    assert client.kwargs["path"] == "/tmp/chroma"
