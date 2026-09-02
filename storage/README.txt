Temporary local media storage for N-A-V-A.

This directory is intentionally outside public/ and is only a fallback until
an external S3-compatible bucket is connected.
Set STORAGE_DRIVER=local and NAVA_STORAGE_LOCAL_SECRET to a long random secret.
When R2/S3 is available, switch STORAGE_DRIVER to r2/s3 and keep this folder only
for temporary files if desired.
