import { describe, it, expect } from 'vitest';
import { createIgnoreInstance, isSecretSensitive, DEFAULT_IGNORES, SECRET_SENSITIVE_PATTERNS } from '../../packages/core/src/scanner/ignore-rules.js';

describe('Ignore Rules', () => {
  describe('createIgnoreInstance', () => {
    it('should create instance with default ignores', () => {
      const ig = createIgnoreInstance();
      expect(ig).toBeDefined();
    });

    it('should add custom toolignore patterns', () => {
      const customToolignore = `
# Custom patterns
*.custom
src/generated/
dist/
      `;
      const ig = createIgnoreInstance(customToolignore);
      expect(ig).toBeDefined();
    });
  });

  describe('isSecretSensitive', () => {
    it('should detect .env files', () => {
      expect(isSecretSensitive('.env')).toBe(true);
      expect(isSecretSensitive('.env.local')).toBe(true);
      expect(isSecretSensitive('.env.production')).toBe(true);
    });

    it('should detect certificate and key files', () => {
      expect(isSecretSensitive('server.pem')).toBe(true);
      expect(isSecretSensitive('client.pem')).toBe(true);
      expect(isSecretSensitive('private.key')).toBe(true);
      expect(isSecretSensitive('certificate.crt')).toBe(true);
    });

    it('should detect credential files', () => {
      expect(isSecretSensitive('credentials.json')).toBe(true);
      expect(isSecretSensitive('secrets')).toBe(true);
      expect(isSecretSensitive('secrets/')).toBe(true);
      expect(isSecretSensitive('id_rsa')).toBe(true);
      expect(isSecretSensitive('id_rsa.pub')).toBe(true);
    });

    it('should NOT flag normal source files', () => {
      expect(isSecretSensitive('src/index.ts')).toBe(false);
      expect(isSecretSensitive('src/utils/helpers.ts')).toBe(false);
      expect(isSecretSensitive('README.md')).toBe(false);
      expect(isSecretSensitive('package.json')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isSecretSensitive('.ENV')).toBe(true);
      expect(isSecretSensitive('.ENV.PROD')).toBe(true);
    });
  });

  describe('DEFAULT_IGNORES', () => {
    it('should include common directories', () => {
      expect(DEFAULT_IGNORES).toContain('.git');
      expect(DEFAULT_IGNORES).toContain('node_modules');
      expect(DEFAULT_IGNORES).toContain('dist');
      expect(DEFAULT_IGNORES).toContain('build');
      expect(DEFAULT_IGNORES).toContain('venv');
    });

    it('should include common secret patterns', () => {
      expect(DEFAULT_IGNORES).toContain('.env');
      expect(DEFAULT_IGNORES).toContain('*.pem');
      expect(DEFAULT_IGNORES).toContain('*.key');
      expect(DEFAULT_IGNORES).toContain('credentials.json');
    });
  });

  describe('SECRET_SENSITIVE_PATTERNS', () => {
    it('should be comprehensive', () => {
      expect(SECRET_SENSITIVE_PATTERNS.length).toBeGreaterThan(0);
      expect(SECRET_SENSITIVE_PATTERNS).toContain('.env');
      expect(SECRET_SENSITIVE_PATTERNS).toContain('secrets');
    });
  });
});