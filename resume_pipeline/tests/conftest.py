"""Pytest bootstrap for the backend suite.

Windows dev-box note: torch used to fail with WinError 1114 when sklearn was
imported first (sklearn 1.4.0's bundled msvcp140 shadowed the newer system CRT
that torch 2.9 needs). Fixed in myenv via sklearn/_distributor_init.py, which
now pins the system CRT first, so import order no longer matters. This early
torch preload stays as belt-and-braces so local-embedding tests are
deterministic regardless of test-module import order. Linux CI/Docker is
unaffected.
"""
try:
    import torch  # noqa: F401
except Exception:
    pass
