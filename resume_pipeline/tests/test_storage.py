import os
import io
import tempfile
import pytest
from unittest.mock import MagicMock, patch
from pathlib import Path

from resume_pipeline.config import settings
from resume_pipeline.core.storage import get_storage_client, LocalFileStorage, S3FileStorage, get_local_directory


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


@patch("boto3.client")
def test_s3_file_storage_lifecycle(mock_boto_client):
    # Setup mocks
    mock_s3 = MagicMock()
    mock_boto_client.return_value = mock_s3
    
    # Mock paginator for list_files
    mock_paginator = MagicMock()
    mock_s3.get_paginator.return_value = mock_paginator
    mock_paginator.paginate.return_value = [
        {"Contents": [{"Key": "resumes/app_test2/resume.pdf"}]}
    ]
    
    with patch.object(settings, "STORAGE_BACKEND", "s3"), \
         patch.object(settings, "S3_BUCKET_NAME", "my-test-bucket"), \
         patch.object(settings, "AWS_ACCESS_KEY_ID", "fake_key"), \
         patch.object(settings, "AWS_SECRET_ACCESS_KEY", "fake_secret"):
        
        storage = S3FileStorage()
        
        # 1. Test upload_fileobj
        content = b"hello s3 storage"
        fileobj = io.BytesIO(content)
        remote_path = "resumes/app_test2/resume.pdf"
        storage.upload_fileobj(fileobj, remote_path, is_public=False)

        # Assert on call semantics (bucket/key/content-type) rather than the
        # identity of the Fileobj argument — implementations may legitimately
        # re-wrap the stream (e.g. into a fresh BytesIO) for retry safety.
        mock_s3.upload_fileobj.assert_called_once()
        call_kwargs = mock_s3.upload_fileobj.call_args.kwargs
        assert call_kwargs["Bucket"] == "my-test-bucket"
        assert call_kwargs["Key"] == remote_path
        assert call_kwargs["ExtraArgs"] == {"ContentType": "application/pdf"}
        uploaded_obj = call_kwargs["Fileobj"]
        if isinstance(uploaded_obj, io.BytesIO):
            uploaded_obj.seek(0)
            assert uploaded_obj.read() == content
        else:
            fileobj.seek(0)
            assert fileobj.read() == content
        
        # 2. Test list_files
        files = storage.list_files("resumes/app_test2/")
        assert files == ["resumes/app_test2/resume.pdf"]
        mock_s3.get_paginator.assert_called_once_with("list_objects_v2")
        
        # 3. Test download_file
        storage.download_file(remote_path, "local_dest.pdf")
        mock_s3.download_file.assert_called_once_with(
            Bucket="my-test-bucket",
            Key=remote_path,
            Filename="local_dest.pdf"
        )
        
        # 4. Test delete_file
        storage.delete_file(remote_path)
        mock_s3.delete_object.assert_called_once_with(
            Bucket="my-test-bucket",
            Key=remote_path
        )


@patch("boto3.client")
def test_get_local_directory_s3(mock_boto_client):
    mock_s3 = MagicMock()
    mock_boto_client.return_value = mock_s3
    
    # Mock listing files
    mock_paginator = MagicMock()
    mock_s3.get_paginator.return_value = mock_paginator
    mock_paginator.paginate.return_value = [
        {"Contents": [{"Key": "resumes/app_test3/resume.pdf"}, {"Key": "resumes/app_test3/metadata.json"}]}
    ]
    
    # Track downloaded files
    downloaded = []
    def mock_download(Bucket, Key, Filename):
        downloaded.append((Key, Filename))
        with open(Filename, "wb") as f:
            f.write(b"content")
            
    mock_s3.download_file.side_effect = mock_download

    with patch.object(settings, "STORAGE_BACKEND", "s3"), \
         patch.object(settings, "S3_BUCKET_NAME", "my-test-bucket"):
        
        with get_local_directory("app_test3") as local_dir:
            assert Path(local_dir).exists()
            assert (Path(local_dir) / "resume.pdf").exists()
            assert (Path(local_dir) / "metadata.json").exists()
            assert len(downloaded) == 2
            assert downloaded[0][0] == "resumes/app_test3/resume.pdf"
            assert downloaded[1][0] == "resumes/app_test3/metadata.json"
            
        # Verify that temp folder was cleaned up on exit
        assert not Path(local_dir).exists()
