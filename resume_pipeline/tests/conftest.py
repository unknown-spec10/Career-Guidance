"""Pytest bootstrap for the backend suite.

No import-order workarounds are needed: the offline embedding backend is ONNX
Runtime, which has no DLL/CRT shadowing conflict with scikit-learn on Windows.
"""
