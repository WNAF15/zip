<?php

namespace App\Contracts;

interface StorageInterface
{
    public function isConfigured(): bool;
    public function presignPut(string $objectKey, string $contentType, ?int $expires = null): array;
    public function presignGet(string $objectKey, ?int $expires = null): string;
    public function head(string $objectKey): array;
    public function delete(string $objectKey): bool;
    public function health(): array;
}
