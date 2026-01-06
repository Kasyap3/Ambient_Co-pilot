"""
Context Engine Package
Handles context packing and heuristics for intelligent assistance
"""

from .packer import pack_context
from .heuristics import should_interrupt, should_assist

__all__ = ['pack_context', 'should_interrupt', 'should_assist']
