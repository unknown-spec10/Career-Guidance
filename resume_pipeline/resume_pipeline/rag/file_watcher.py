"""
File Watcher - Monitors documentation changes and triggers RAG index rebuilds.

Uses watchdog to monitor the docs/ directory for file changes.
Tracks per-file content hashes for robust cache invalidation.
Triggers async rebuilds without blocking queries.
"""

import os
import json
import hashlib
import logging
import threading
import time
from pathlib import Path
from typing import Optional, Callable, Dict, Any
from datetime import datetime

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler, FileModifiedEvent, FileCreatedEvent, FileDeletedEvent
    WATCHDOG_AVAILABLE = True
except ImportError:
    WATCHDOG_AVAILABLE = False
    # Stub classes for when watchdog is not installed
    class FileSystemEventHandler:
        """Stub for watchdog FileSystemEventHandler"""
        pass
    
    class FileEvent:
        """Stub base event"""
        is_directory: bool = False
        src_path: str = ""
    
    class FileModifiedEvent(FileEvent):
        """Stub for watchdog FileModifiedEvent"""
        pass
    
    class FileCreatedEvent(FileEvent):
        """Stub for watchdog FileCreatedEvent"""
        pass
    
    class FileDeletedEvent(FileEvent):
        """Stub for watchdog FileDeletedEvent"""
        pass
    
    class Observer:
        """Stub for watchdog Observer"""
        def schedule(self, *args, **kwargs):
            pass
        
        def start(self):
            pass
        
        def stop(self):
            pass
        
        def join(self, timeout=None):
            pass

logger = logging.getLogger(__name__)


class FileHashTracker:
    """
    Tracks per-file content hashes to enable future incremental rebuilds.
    Persists hashes to .rag_cache/file_hashes.json for cache validation.
    
    Designed for scale-to-zero: hashes are stateless in .rag_cache, can be
    discarded and regenerated on next startup.
    """
    
    def __init__(self, cache_path: str):
        """
        Initialize hash tracker.
        
        Args:
            cache_path: Path to .rag_cache directory
        """
        self.cache_path = Path(cache_path)
        self.hash_file = self.cache_path / "file_hashes.json"
        self._hashes: Dict[str, str] = {}
        self._load_hashes()
    
    def _load_hashes(self) -> None:
        """Load persisted file hashes from cache"""
        if self.hash_file.exists():
            try:
                with open(self.hash_file, 'r') as f:
                    self._hashes = json.load(f)
                logger.debug(f"Loaded {len(self._hashes)} cached file hashes")
            except Exception as e:
                logger.warning(f"Failed to load file hashes: {e}. Starting fresh.")
                self._hashes = {}
    
    def _save_hashes(self) -> None:
        """Persist file hashes to cache"""
        try:
            self.cache_path.mkdir(parents=True, exist_ok=True)
            with open(self.hash_file, 'w') as f:
                json.dump(self._hashes, f, indent=2)
        except Exception as e:
            logger.warning(f"Failed to save file hashes: {e}")
    
    def compute_file_hash(self, file_path: Path) -> Optional[str]:
        """
        Compute MD5 hash of file content, with mtime fallback.
        
        Args:
            file_path: Path to file
            
        Returns:
            Content hash or None if file cannot be read
        """
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
                return hashlib.md5(content).hexdigest()
        except (IOError, OSError) as e:
            # Fallback: use file modification time as secondary hash
            logger.warning(f"Failed to read {file_path} for hashing, using mtime: {e}")
            try:
                mtime = file_path.stat().st_mtime
                return hashlib.md5(str(mtime).encode()).hexdigest()
            except Exception as e2:
                logger.error(f"Failed to compute mtime hash for {file_path}: {e2}")
                return None
    
    def has_changed(self, file_path: Path) -> bool:
        """
        Check if file content has changed since last track.
        
        Args:
            file_path: Path to file
            
        Returns:
            True if file is new or content changed
        """
        relative_path = file_path.name  # Use filename as key
        
        current_hash = self.compute_file_hash(file_path)
        if current_hash is None:
            return False  # Assume no change if hash cannot be computed
        
        previous_hash = self._hashes.get(relative_path)
        
        if previous_hash != current_hash:
            self._hashes[relative_path] = current_hash
            self._save_hashes()
            return True
        
        return False
    
    def track_files(self, doc_files: list) -> Dict[str, str]:
        """
        Update hash tracking for a set of documentation files.
        
        Args:
            doc_files: List of file paths to track
            
        Returns:
            Dictionary of filename -> hash
        """
        file_hashes = {}
        for file_path in doc_files:
            file_hash = self.compute_file_hash(file_path)
            if file_hash:
                file_hashes[file_path.name] = file_hash
        
        self._hashes.update(file_hashes)
        self._save_hashes()
        
        return self._hashes
    
    def get_all_hashes(self) -> Dict[str, str]:
        """Get all tracked file hashes"""
        return self._hashes.copy()


class DocumentChangeEventHandler(FileSystemEventHandler):
    """
    Watchdog event handler for documentation file changes.
    Triggers rebuild callback on .md file modifications.
    """
    
    def __init__(
        self,
        docs_path: str,
        hash_tracker: FileHashTracker,
        on_change_callback: Callable,
        debounce_seconds: float = 2.0
    ):
        """
        Initialize event handler.
        
        Args:
            docs_path: Path to docs directory
            hash_tracker: FileHashTracker instance
            on_change_callback: Async callable to trigger on file change
            debounce_seconds: Debounce interval to avoid multiple rebuilds
        """
        super().__init__()
        self.docs_path = Path(docs_path)
        self.hash_tracker = hash_tracker
        self.on_change_callback = on_change_callback
        self.debounce_seconds = debounce_seconds
        self._last_change_time = 0.0
        self._lock = threading.Lock()
    
    def _is_markdown_file(self, file_path: Path) -> bool:
        """Check if file is a markdown file"""
        return file_path.suffix.lower() == '.md'
    
    def _should_debounce(self) -> bool:
        """Check if enough time has passed since last change"""
        current_time = time.time()
        if current_time - self._last_change_time < self.debounce_seconds:
            return True
        self._last_change_time = current_time
        return False
    
    def on_modified(self, event: FileModifiedEvent) -> None:
        """Handle file modification"""
        if event.is_directory:
            return
        
        file_path = Path(event.src_path)
        if not self._is_markdown_file(file_path):
            return
        
        with self._lock:
            if self._should_debounce():
                logger.debug(f"Debouncing file change: {file_path}")
                return
        
        if self.hash_tracker.has_changed(file_path):
            logger.info(f"Documentation file modified: {file_path}")
            self.on_change_callback()
    
    def on_created(self, event: FileCreatedEvent) -> None:
        """Handle file creation"""
        if event.is_directory:
            return
        
        file_path = Path(event.src_path)
        if not self._is_markdown_file(file_path):
            return
        
        with self._lock:
            if self._should_debounce():
                logger.debug(f"Debouncing file creation: {file_path}")
                return
        
        logger.info(f"New documentation file: {file_path}")
        self.on_change_callback()
    
    def on_deleted(self, event: FileDeletedEvent) -> None:
        """Handle file deletion"""
        if event.is_directory:
            return
        
        file_path = Path(event.src_path)
        if not self._is_markdown_file(file_path):
            return
        
        with self._lock:
            if self._should_debounce():
                logger.debug(f"Debouncing file deletion: {file_path}")
                return
        
        logger.info(f"Documentation file deleted: {file_path}")
        self.on_change_callback()


class FileWatcher:
    """
    Main file watcher for RAG documentation.
    
    Uses watchdog to monitor docs/ directory and trigger RAG index rebuilds.
    Thread-safe and designed for scale-to-zero architecture:
    - No persistent in-memory state (all state in .rag_cache)
    - Can be stopped/started as needed
    - Graceful handling of missing watchdog library
    """
    
    def __init__(
        self,
        docs_path: str,
        cache_path: str,
        on_change_callback: Callable,
        debounce_seconds: float = 2.0
    ):
        """
        Initialize file watcher.
        
        Args:
            docs_path: Path to docs directory to watch
            cache_path: Path to .rag_cache directory
            on_change_callback: Async callable to trigger on doc changes
            debounce_seconds: Debounce interval for file change events
        """
        self.docs_path = Path(docs_path)
        self.cache_path = cache_path
        self.on_change_callback = on_change_callback
        self.debounce_seconds = debounce_seconds
        
        # Initialize hash tracker
        self.hash_tracker = FileHashTracker(cache_path)
        
        # Observer state
        self.observer: Optional[Observer] = None
        self._is_running = False
        self._lock = threading.Lock()
        
        # Stats
        self._stats = {
            'start_time': None,
            'file_changes_detected': 0,
            'last_change_time': None,
            'is_running': False
        }
        
        if not WATCHDOG_AVAILABLE:
            logger.warning(
                "watchdog library not available. "
                "Documentation changes will not be automatically detected. "
                "Install with: pip install watchdog"
            )
    
    def start(self) -> bool:
        """
        Start watching for documentation changes.
        
        Returns:
            True if started successfully, False if watchdog unavailable
        """
        if not WATCHDOG_AVAILABLE:
            logger.warning("Cannot start FileWatcher: watchdog not installed")
            return False
        
        with self._lock:
            if self._is_running:
                logger.debug("FileWatcher already running")
                return True
            
            try:
                # Create event handler
                event_handler = DocumentChangeEventHandler(
                    str(self.docs_path),
                    self.hash_tracker,
                    self._on_doc_change,
                    self.debounce_seconds
                )
                
                # Create observer
                self.observer = Observer()
                self.observer.schedule(
                    event_handler,
                    str(self.docs_path),
                    recursive=True
                )
                
                # Start observer thread
                self.observer.start()
                self._is_running = True
                
                self._stats['start_time'] = datetime.now().isoformat()
                self._stats['is_running'] = True
                
                logger.info(f"FileWatcher started for {self.docs_path}")
                return True
                
            except Exception as e:
                logger.error(f"Failed to start FileWatcher: {e}")
                return False
    
    def stop(self) -> None:
        """Stop watching for documentation changes"""
        with self._lock:
            if not self._is_running or not self.observer:
                return
            
            try:
                self.observer.stop()
                self.observer.join(timeout=5)
                self._is_running = False
                self._stats['is_running'] = False
                logger.info("FileWatcher stopped")
            except Exception as e:
                logger.error(f"Error stopping FileWatcher: {e}")
    
    def _on_doc_change(self) -> None:
        """
        Internal callback when documentation changes detected.
        Invokes the user-provided callback.
        """
        with self._lock:
            self._stats['file_changes_detected'] += 1
            self._stats['last_change_time'] = datetime.now().isoformat()
        
        logger.debug("Document change detected, triggering rebuild callback")
        
        try:
            self.on_change_callback()
        except Exception as e:
            logger.error(f"Error in change callback: {e}")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get watcher statistics"""
        with self._lock:
            return self._stats.copy()
    
    def __enter__(self):
        """Context manager entry"""
        self.start()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.stop()


# Singleton instance
_file_watcher: Optional[FileWatcher] = None


def get_file_watcher(
    docs_path: Optional[str] = None,
    cache_path: Optional[str] = None,
    on_change_callback: Optional[Callable] = None
) -> FileWatcher:
    """
    Get or create the singleton FileWatcher instance.
    
    Args:
        docs_path: Path to docs directory
        cache_path: Path to .rag_cache
        on_change_callback: Callback function on doc change
        
    Returns:
        FileWatcher instance
    """
    global _file_watcher
    
    if _file_watcher is None:
        if docs_path is None or cache_path is None or on_change_callback is None:
            raise ValueError("Must provide all arguments on first call")
        
        _file_watcher = FileWatcher(
            docs_path=docs_path,
            cache_path=cache_path,
            on_change_callback=on_change_callback
        )
    
    return _file_watcher
