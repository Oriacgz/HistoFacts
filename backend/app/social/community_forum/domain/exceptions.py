"""
Custom Domain Exceptions for Community Forum.
"""


class ForumDomainError(Exception):
    """Base exception for all forum errors."""
    pass


class PostNotFoundError(ForumDomainError):
    def __init__(self, post_id: str):
        super().__init__(f"Post with ID '{post_id}' was not found.")


class CommentNotFoundError(ForumDomainError):
    def __init__(self, comment_id: str):
        super().__init__(f"Comment with ID '{comment_id}' was not found.")


class UnauthorizedPostActionError(ForumDomainError):
    def __init__(self, action: str):
        super().__init__(f"You are not authorized to {action} this post.")


class UnauthorizedCommentActionError(ForumDomainError):
    def __init__(self, action: str):
        super().__init__(f"You are not authorized to {action} this comment.")


class PostLockedError(ForumDomainError):
    def __init__(self, post_id: str):
        super().__init__(f"Post with ID '{post_id}' is locked and cannot receive comments.")


class UserBannedError(ForumDomainError):
    def __init__(self, user_id: str):
        super().__init__(f"User '{user_id}' is banned from posting or commenting.")


class AlreadyLikedError(ForumDomainError):
    def __init__(self):
        super().__init__("User has already liked this item.")
