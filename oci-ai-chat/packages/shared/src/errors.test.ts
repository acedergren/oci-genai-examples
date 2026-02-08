import { describe, it, expect } from 'vitest';
import {
	PortalError,
	ValidationError,
	AuthError,
	NotFoundError,
	RateLimitError,
	OCIError,
	DatabaseError,
	isPortalError,
	toPortalError,
	errorResponse
} from './errors';

describe('PortalError hierarchy', () => {
	it('creates PortalError with code, message, statusCode', () => {
		const err = new PortalError('TEST_ERROR', 'Test message', 418);
		expect(err.code).toBe('TEST_ERROR');
		expect(err.message).toBe('Test message');
		expect(err.statusCode).toBe(418);
		expect(err.name).toBe('PortalError');
	});

	it('sets context from constructor', () => {
		const context = { field: 'test', value: 123 };
		const err = new PortalError('TEST', 'msg', 400, context);
		expect(err.context).toEqual(context);
	});

	it('chains cause errors', () => {
		const cause = new Error('Root cause');
		const err = new PortalError('TEST', 'Wrapped', 500, {}, cause);
		expect(err.cause).toBe(cause);
		expect(err.cause?.message).toBe('Root cause');
	});

	it('maintains proper stack trace', () => {
		const err = new ValidationError('test');
		expect(err.stack).toContain('ValidationError');
	});
});

describe('Concrete error classes', () => {
	it('ValidationError defaults to 400', () => {
		const err = new ValidationError('Missing field', { field: 'id' });
		expect(err.code).toBe('VALIDATION_ERROR');
		expect(err.statusCode).toBe(400);
	});

	it('AuthError defaults to 401', () => {
		const err = new AuthError('Unauthorized');
		expect(err.code).toBe('AUTH_ERROR');
		expect(err.statusCode).toBe(401);
	});

	it('AuthError can be 403 Forbidden', () => {
		const err = new AuthError('Forbidden', 403);
		expect(err.statusCode).toBe(403);
	});

	it('NotFoundError returns 404', () => {
		const err = new NotFoundError('Tool not found', { toolId: 'abc' });
		expect(err.code).toBe('NOT_FOUND');
		expect(err.statusCode).toBe(404);
	});

	it('RateLimitError returns 429', () => {
		const err = new RateLimitError();
		expect(err.code).toBe('RATE_LIMIT');
		expect(err.statusCode).toBe(429);
	});

	it('RateLimitError uses custom message', () => {
		const err = new RateLimitError('Custom limit message');
		expect(err.message).toBe('Custom limit message');
	});

	it('OCIError returns 502', () => {
		const err = new OCIError('OCI CLI failed', { service: 'compute', exitCode: 1 });
		expect(err.code).toBe('OCI_ERROR');
		expect(err.statusCode).toBe(502);
	});

	it('DatabaseError returns 503', () => {
		const err = new DatabaseError('Connection failed', { attempted: 3 });
		expect(err.code).toBe('DATABASE_ERROR');
		expect(err.statusCode).toBe(503);
	});
});

describe('Serialization', () => {
	it('toJSON() includes all fields', () => {
		const err = new ValidationError('Test error', { field: 'id' });
		const json = err.toJSON();

		expect(json.name).toBe('ValidationError');
		expect(json.code).toBe('VALIDATION_ERROR');
		expect(json.message).toBe('Test error');
		expect(json.statusCode).toBe(400);
		expect(json.context).toEqual({ field: 'id' });
		expect(json.stack).toBeDefined();
	});

	it('toJSON() includes cause message when present', () => {
		const cause = new Error('Root cause');
		const err = new ValidationError('Wrapped', {}, cause);
		const json = err.toJSON();

		expect(json.cause).toBe('Root cause');
	});

	it('toJSON() omits cause when not present', () => {
		const err = new ValidationError('No cause');
		const json = err.toJSON();

		expect(json.cause).toBeUndefined();
	});

	it('toSentryExtras() excludes stack trace', () => {
		const err = new OCIError('Failed', { service: 'compute', exitCode: 1 });
		const extras = err.toSentryExtras();

		expect(extras.code).toBe('OCI_ERROR');
		expect(extras.statusCode).toBe(502);
		expect(extras.service).toBe('compute');
		expect(extras.exitCode).toBe(1);
		expect(extras.stack).toBeUndefined();
	});

	it('toSentryExtras() includes cause message', () => {
		const cause = new Error('Root');
		const err = new DatabaseError('Connection failed', {}, cause);
		const extras = err.toSentryExtras();

		expect(extras.causeMessage).toBe('Root');
	});
});

describe('Response body', () => {
	it('toResponseBody() includes error and code', () => {
		const err = new ValidationError('Missing id');
		const body = err.toResponseBody();

		expect(body.error).toBe('Missing id');
		expect(body.code).toBe('VALIDATION_ERROR');
	});

	it('toResponseBody() includes requestId if present in context', () => {
		const err = new ValidationError('Test', { requestId: 'req-123' });
		const body = err.toResponseBody();

		expect(body.requestId).toBe('req-123');
	});

	it('toResponseBody() omits requestId if not in context', () => {
		const err = new ValidationError('Test', {});
		const body = err.toResponseBody();

		expect(body.requestId).toBeUndefined();
	});

	it('toResponseBody() never exposes stack trace', () => {
		const err = new DatabaseError('Connection failed');
		const body = err.toResponseBody();

		expect(JSON.stringify(body)).not.toContain('stack');
		expect(Object.keys(body)).not.toContain('stack');
	});
});

describe('Helpers', () => {
	it('isPortalError() returns true for PortalError instances', () => {
		const err = new ValidationError('test');
		expect(isPortalError(err)).toBe(true);
	});

	it('isPortalError() returns true for all subclasses', () => {
		expect(isPortalError(new ValidationError('test'))).toBe(true);
		expect(isPortalError(new AuthError('test'))).toBe(true);
		expect(isPortalError(new NotFoundError('test'))).toBe(true);
		expect(isPortalError(new RateLimitError('test'))).toBe(true);
		expect(isPortalError(new OCIError('test'))).toBe(true);
		expect(isPortalError(new DatabaseError('test'))).toBe(true);
	});

	it('isPortalError() returns false for other errors', () => {
		expect(isPortalError(new Error('standard'))).toBe(false);
		expect(isPortalError(new TypeError('type error'))).toBe(false);
		expect(isPortalError('not an error')).toBe(false);
		expect(isPortalError(null)).toBe(false);
		expect(isPortalError(undefined)).toBe(false);
	});

	it('toPortalError() returns PortalError unchanged', () => {
		const original = new ValidationError('test');
		const result = toPortalError(original);
		expect(result).toBe(original);
	});

	it('toPortalError() wraps Error in PortalError', () => {
		const cause = new Error('Root error');
		const result = toPortalError(cause);

		expect(isPortalError(result)).toBe(true);
		expect(result.code).toBe('INTERNAL_ERROR');
		expect(result.statusCode).toBe(500);
		expect(result.message).toBe('Root error');
		expect(result.cause).toBe(cause);
	});

	it('toPortalError() uses fallback message for non-Error values', () => {
		const result = toPortalError('string error');

		expect(isPortalError(result)).toBe(true);
		expect(result.code).toBe('INTERNAL_ERROR');
		expect(result.message).toBe('Internal server error');
	});

	it('toPortalError() uses custom fallback message', () => {
		const result = toPortalError(null, 'Custom fallback');

		expect(result.message).toBe('Custom fallback');
	});
});

describe('errorResponse()', () => {
	it('creates Response with correct status code', () => {
		const err = new ValidationError('Bad request');
		const response = errorResponse(err);

		expect(response.status).toBe(400);
	});

	it('sets Content-Type to application/json', () => {
		const err = new ValidationError('Test');
		const response = errorResponse(err);

		expect(response.headers.get('Content-Type')).toBe('application/json');
	});

	it('includes error and code in body', async () => {
		const err = new NotFoundError('Not found');
		const response = errorResponse(err);

		const body = await response.json();
		expect(body.error).toBe('Not found');
		expect(body.code).toBe('NOT_FOUND');
	});

	it('includes requestId in body when provided', async () => {
		const err = new ValidationError('Test', {});
		const response = errorResponse(err, 'req-456');

		const body = await response.json();
		expect(body.requestId).toBe('req-456');
	});

	it('includes X-Request-Id header when requestId provided', () => {
		const err = new ValidationError('Test');
		const response = errorResponse(err, 'req-789');

		expect(response.headers.get('X-Request-Id')).toBe('req-789');
	});

	it('omits X-Request-Id header when requestId not provided', () => {
		const err = new ValidationError('Test');
		const response = errorResponse(err);

		expect(response.headers.get('X-Request-Id')).toBeNull();
	});

	it('works with different error types', () => {
		const errors = [
			{ err: new ValidationError('Invalid'), expectedStatus: 400 },
			{ err: new AuthError('Unauthorized'), expectedStatus: 401 },
			{ err: new NotFoundError('Missing'), expectedStatus: 404 },
			{ err: new RateLimitError(), expectedStatus: 429 },
			{ err: new OCIError('OCI failed'), expectedStatus: 502 },
			{ err: new DatabaseError('DB failed'), expectedStatus: 503 }
		];

		for (const { err, expectedStatus } of errors) {
			const response = errorResponse(err);
			expect(response.status).toBe(expectedStatus);
		}
	});
});
