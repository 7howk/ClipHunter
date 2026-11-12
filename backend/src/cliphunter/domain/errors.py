"""Errors shared by business rules and use cases, without framework dependencies."""


class AppError(Exception):
    code = "application_error"


class NotFound(AppError):
    code = "not_found"


class Conflict(AppError):
    code = "conflict"


class InvalidInput(AppError):
    code = "invalid_input"


class ServiceUnavailable(AppError):
    code = "service_unavailable"


class UploadTooLarge(AppError):
    code = "upload_too_large"


class UnsupportedMedia(AppError):
    code = "unsupported_media"


class InsufficientStorage(AppError):
    code = "insufficient_storage"


class UploadTimedOut(AppError):
    code = "upload_timed_out"
