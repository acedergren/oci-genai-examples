// src/lib/server/db.ts
import { getDatabase, createRepository } from '@acedergren/kyc-platform';
import type { Repository } from '@acedergren/kyc-platform';

let repositoryInstance: Repository | null = null;

export function getRepository(): Repository {
  if (!repositoryInstance) {
    const db = getDatabase();
    repositoryInstance = createRepository(db.getConnection());
  }
  return repositoryInstance;
}
