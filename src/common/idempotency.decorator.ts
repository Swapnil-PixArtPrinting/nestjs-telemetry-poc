import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENCY_KEY = 'IDEMPOTENCY_KEY';

export const Idempotent = () => SetMetadata(IDEMPOTENCY_KEY, true);
