import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Documentation Validation', () => {
  describe('README completeness', () => {
    it('README should document all model types', () => {
      const readme = readFileSync(join(__dirname, '../../README.md'), 'utf-8');

      expect(readme).toContain('Language Models');
      expect(readme).toContain('Embeddings');
      expect(readme).toContain('Speech Models');
      expect(readme).toContain('Transcription Models');
      expect(readme).toContain('Reranking Models');
    });

    it('README should include installation instructions', () => {
      const readme = readFileSync(join(__dirname, '../../README.md'), 'utf-8');

      expect(readme).toContain('npm install');
      expect(readme).toContain('pnpm add');
    });

    it('README should document authentication', () => {
      const readme = readFileSync(join(__dirname, '../../README.md'), 'utf-8');

      expect(readme).toContain('Authentication');
      expect(readme).toContain('OCI_CONFIG_PROFILE');
    });

    it('README should link to examples', () => {
      const readme = readFileSync(join(__dirname, '../../README.md'), 'utf-8');

      expect(readme).toContain('examples/');
    });

    it('README should document regional availability', () => {
      const readme = readFileSync(join(__dirname, '../../README.md'), 'utf-8');

      expect(readme).toContain('Regional');
      expect(readme).toContain('us-phoenix-1');
    });
  });

  describe('API Reference Documentation', () => {
    it('should document all provider methods', () => {
      const apiRef = readFileSync(join(__dirname, '../../docs/api-reference.md'), 'utf-8');

      expect(apiRef).toContain('languageModel()');
      expect(apiRef).toContain('embeddingModel()');
      expect(apiRef).toContain('speechModel()');
      expect(apiRef).toContain('transcriptionModel()');
      expect(apiRef).toContain('rerankingModel()');
    });

    it('should document createOCI factory', () => {
      const apiRef = readFileSync(join(__dirname, '../../docs/api-reference.md'), 'utf-8');

      expect(apiRef).toContain('createOCI');
      expect(apiRef).toContain('OCIBaseConfig');
    });
  });

  describe('Configuration Guide', () => {
    it('should document configuration methods', () => {
      const config = readFileSync(join(__dirname, '../../docs/configuration.md'), 'utf-8');

      expect(config).toContain('Authentication');
      expect(config).toContain('Region');
      expect(config).toContain('Environment Variables');
    });
  });

  describe('Migration Guide', () => {
    it('should document breaking changes', () => {
      const migration = readFileSync(join(__dirname, '../../docs/migration.md'), 'utf-8');

      expect(migration).toContain('v1.x');
      expect(migration).toContain('v2.0');
      expect(migration).toContain('Breaking Changes');
    });
  });

  describe('Troubleshooting Guide', () => {
    it('should document common issues', () => {
      const troubleshooting = readFileSync(
        join(__dirname, '../../docs/troubleshooting.md'),
        'utf-8'
      );

      expect(troubleshooting).toContain('Authentication');
      expect(troubleshooting).toContain('Error');
      expect(troubleshooting).toContain('Solution');
    });
  });
});
