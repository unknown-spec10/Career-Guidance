import os
import io
import tempfile
import pytest
from unittest.mock import MagicMock, patch
from pathlib import Path


from resume_pipeline.config import settings
from resume_pipeline.core.storage import get_storage_client, LocalFileStorage, get_local_directory


@pytest.fixture(autouse=True)
def reset_storage_singleton():
    import resume_pipeline.core.storage as storage_mod
    storage_mod._storage_client = None
    yield
    storage_mod._storage_client = None


def test_get_storage_client_default():
    # Test that we get a local client by default
    with patch.object(settings, "STORAGE_BACKEND", "local"):
        client = get_storage_client()
        assert isinstance(client, LocalFileStorage)


def test_local_file_storage_lifecycle():
    with tempfile.TemporaryDirectory() as temp_root:
        storage = LocalFileStorage(base_path=temp_root)
        
        # 1. Test upload_fileobj
        content = b"hello local storage"
        fileobj = io.BytesIO(content)
        remote_path = "resumes/app_test1/resume.pdf"
        
        storage.upload_fileobj(fileobj, remote_path)
        
        # Check that file was written locally
        local_filepath = Path(temp_root) / remote_path
        assert local_filepath.exists()
        assert local_filepath.read_bytes() == content
        
        # 2. Test list_files
        files = storage.list_files("resumes/app_test1")
        assert len(files) == 1
        assert files[0] == remote_path
        
        # 3. Test download_file
        with tempfile.NamedTemporaryFile(delete=False) as tf:
            tf_path = tf.name
        
        try:
            storage.download_file(remote_path, tf_path)
            assert Path(tf_path).read_bytes() == content
        finally:
            if os.path.exists(tf_path):
                os.remove(tf_path)
                
        # 4. Test delete_file
        storage.delete_file(remote_path)
        assert not local_filepath.exists()
        assert len(storage.list_files("resumes/app_test1")) == 0


@patch("google.cloud.storage.Client")
def test_gcs_file_storage_lifecycle(mock_gcs_client_cls):
    from resume_pipeline.core.storage import GCSFileStorage

    mock_gcs_client = MagicMock()
    mock_gcs_client_cls.return_value = mock_gcs_client
    mock_bucket = MagicMock()
    mock_gcs_client.bucket.return_value = mock_bucket

    with patch.object(settings, "STORAGE_BACKEND", "gcs"), \
         patch.object(settings, "GCS_BUCKET_NAME", "my-test-bucket"):

        storage = GCSFileStorage()

        # 1. Test upload_fileobj
        content = b"hello gcs storage"
        fileobj = io.BytesIO(content)
        remote_path = "resumes/app_test2/resume.pdf"
        mock_blob = MagicMock()
        mock_bucket.blob.return_value = mock_blob

        storage.upload_fileobj(fileobj, remote_path, is_public=False)

        mock_bucket.blob.assert_called_with(remote_path)
        assert mock_blob.upload_from_file.called
        assert mock_blob.content_type == "application/pdf"

        # 2. Test list_files
        mock_item = MagicMock()
        mock_item.name = "resumes/app_test2/resume.pdf"
        mock_gcs_client.list_blobs.return_value = [mock_item]
        files = storage.list_files("resumes/app_test2/")
        assert files == ["resumes/app_test2/resume.pdf"]
        mock_gcs_client.list_blobs.assert_called_with("my-test-bucket", prefix="resumes/app_test2/")

        # 3. Test download_file
        with tempfile.NamedTemporaryFile(delete=False) as tf:
            tf_path = tf.name
        try:
            storage.download_file(remote_path, tf_path)
            mock_blob.download_to_filename.assert_called_with(tf_path)
        finally:
            if os.path.exists(tf_path):
                os.remove(tf_path)

        # 4. Test delete_file
        storage.delete_file(remote_path)
        mock_blob.delete.assert_called_once()


@patch("google.cloud.storage.Client")
def test_get_local_directory_gcs(mock_gcs_client_cls):
    from resume_pipeline.core.storage import GCSFileStorage

    mock_gcs_client = MagicMock()
    mock_gcs_client_cls.return_value = mock_gcs_client
    mock_bucket = MagicMock()
    mock_gcs_client.bucket.return_value = mock_bucket

    # Mock listing files
    mock_item1 = MagicMock()
    mock_item1.name = "resumes/app_test3/resume.pdf"
    mock_item2 = MagicMock()
    mock_item2.name = "resumes/app_test3/metadata.json"
    mock_gcs_client.list_blobs.return_value = [mock_item1, mock_item2]

    # Track downloaded files
    downloaded = []
    def mock_download(remote_path, local_path):
        downloaded.append((remote_path, local_path))
        with open(local_path, "wb") as f:
            f.write(b"content")

    with patch.object(settings, "STORAGE_BACKEND", "gcs"), \
         patch.object(settings, "GCS_BUCKET_NAME", "my-test-bucket"), \
         patch.object(GCSFileStorage, "download_file", autospec=True,
                      side_effect=lambda self, remote, local: mock_download(remote, local)):

        with get_local_directory("app_test3") as local_dir:
            assert Path(local_dir).exists()
            assert (Path(local_dir) / "resume.pdf").exists()
            assert (Path(local_dir) / "metadata.json").exists()
            assert len(downloaded) == 2
            assert downloaded[0][0] == "resumes/app_test3/resume.pdf"
            assert downloaded[1][0] == "resumes/app_test3/metadata.json"

        # Verify that temp folder was cleaned up on exit
        assert not Path(local_dir).exists()
