/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock oci-objectstorage
const mockGetObject = jest.fn<any>();
const mockPutObject = jest.fn<any>();
const mockGetNamespace = jest.fn<any>();
const mockDeleteObject = jest.fn<any>();

jest.mock('oci-objectstorage', () => ({
  ObjectStorageClient: jest.fn().mockImplementation(() => ({
    region: null,
    getObject: mockGetObject,
    putObject: mockPutObject,
    getNamespace: mockGetNamespace,
    deleteObject: mockDeleteObject,
  })),
}));

// Mock oci-common
jest.mock('oci-common', () => ({
  ConfigFileAuthenticationDetailsProvider: jest.fn().mockImplementation(() => ({})),
  InstancePrincipalsAuthenticationDetailsProviderBuilder: jest.fn().mockImplementation(() => ({
    // @ts-expect-error - Mock implementation for testing
    build: jest.fn().mockResolvedValue({}),
  })),
  ResourcePrincipalAuthenticationDetailsProvider: {
    builder: jest.fn().mockReturnValue({}),
  },
  Region: {
    fromRegionId: jest.fn().mockReturnValue({ regionId: 'eu-frankfurt-1' }),
  },
}));

// Mock auth module
jest.mock('../../../auth', () => ({
  createAuthProvider: jest.fn(async () => ({})),
  getRegion: jest.fn(() => 'eu-frankfurt-1'),
  getCompartmentId: jest.fn(() => 'ocid1.compartment.oc1..test'),
}));

// Import after mocks
import {
  downloadTranscriptionResult,
  uploadAudioToObjectStorage,
  deleteFromObjectStorage,
  generateAudioObjectName,
} from '../object-storage';

describe('downloadTranscriptionResult', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should parse valid OCI Speech JSON format and return transcription result', async () => {
    const mockJson = {
      transcription: {
        transcript: 'Hello world this is a test',
        confidence: 0.95,
        languageCode: 'en',
        tokens: [
          { token: 'Hello', startTime: 0.0, endTime: 0.5, confidence: 0.98 },
          { token: 'world', startTime: 0.6, endTime: 1.1, confidence: 0.97 },
          { token: 'this', startTime: 1.2, endTime: 1.6, confidence: 0.95 },
          { token: 'is', startTime: 1.7, endTime: 2.0, confidence: 0.96 },
          { token: 'a', startTime: 2.1, endTime: 2.3, confidence: 0.94 },
          { token: 'test', startTime: 2.4, endTime: 3.0, confidence: 0.99 },
        ],
      },
    };

    const mockStream = {
      on: jest.fn((event: string, callback: Function) => {
        if (event === 'data') {
          callback(Buffer.from(JSON.stringify(mockJson)));
        } else if (event === 'end') {
          callback();
        }
        return mockStream;
      }),
    };

    mockGetObject.mockResolvedValue({ value: mockStream });

    const config = { region: 'eu-frankfurt-1' };
    const result = await downloadTranscriptionResult(
      config as any,
      'mynamespace',
      'mybucket',
      'result.json'
    );

    expect(result.text).toBe('Hello world this is a test');
    expect(result.confidence).toBe(0.95);
    expect(result.languageCode).toBe('en');
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].text).toBe('Hello world this is a test');
    expect(result.segments[0].startSecond).toBe(0.0);
    expect(result.segments[0].endSecond).toBe(3.0);
  });

  it('should handle missing transcription field gracefully', async () => {
    const mockJson = { someOtherField: 'value' };

    const mockStream = {
      on: jest.fn((event: string, callback: Function) => {
        if (event === 'data') {
          callback(Buffer.from(JSON.stringify(mockJson)));
        } else if (event === 'end') {
          callback();
        }
        return mockStream;
      }),
    };

    mockGetObject.mockResolvedValue({ value: mockStream });

    const config = { region: 'eu-frankfurt-1' };
    await expect(
      downloadTranscriptionResult(config as any, 'mynamespace', 'mybucket', 'result.json')
    ).rejects.toThrow('Missing transcription field in JSON response');
  });

  it('should handle invalid JSON parsing', async () => {
    const mockStream = {
      on: jest.fn((event: string, callback: Function) => {
        if (event === 'data') {
          callback(Buffer.from('{ invalid json'));
        } else if (event === 'end') {
          callback();
        }
        return mockStream;
      }),
    };

    mockGetObject.mockResolvedValue({ value: mockStream });

    const config = { region: 'eu-frankfurt-1' };
    await expect(
      downloadTranscriptionResult(config as any, 'mynamespace', 'mybucket', 'result.json')
    ).rejects.toThrow('Failed to parse transcription JSON');
  });

  it('should handle stream read errors', async () => {
    const mockStream = {
      on: jest.fn((event: string, callback: Function) => {
        if (event === 'error') {
          callback(new Error('Stream read failed'));
        }
        return mockStream;
      }),
    };

    mockGetObject.mockResolvedValue({ value: mockStream });

    const config = { region: 'eu-frankfurt-1' };
    await expect(
      downloadTranscriptionResult(config as any, 'mynamespace', 'mybucket', 'result.json')
    ).rejects.toThrow('Stream read error');
  });

  it('should handle empty token arrays', async () => {
    const mockJson = {
      transcription: {
        transcript: 'Hello world',
        confidence: 0.95,
        languageCode: 'en',
        tokens: [],
      },
    };

    const mockStream = {
      on: jest.fn((event: string, callback: Function) => {
        if (event === 'data') {
          callback(Buffer.from(JSON.stringify(mockJson)));
        } else if (event === 'end') {
          callback();
        }
        return mockStream;
      }),
    };

    mockGetObject.mockResolvedValue({ value: mockStream });

    const config = { region: 'eu-frankfurt-1' };
    const result = await downloadTranscriptionResult(
      config as any,
      'mynamespace',
      'mybucket',
      'result.json'
    );

    expect(result.text).toBe('Hello world');
    expect(result.segments).toHaveLength(0);
  });

  it('should group tokens into segments based on 1-second gap threshold', async () => {
    const mockJson = {
      transcription: {
        transcript: 'Hello world pause test continues',
        tokens: [
          { token: 'Hello', startTime: 0.0, endTime: 0.5 },
          { token: 'world', startTime: 0.6, endTime: 1.1 },
          // 1.5 second gap here (gap > 1 second)
          { token: 'pause', startTime: 2.6, endTime: 3.2 },
          { token: 'test', startTime: 3.3, endTime: 3.9 },
          { token: 'continues', startTime: 4.0, endTime: 4.5 },
        ],
      },
    };

    const mockStream = {
      on: jest.fn((event: string, callback: Function) => {
        if (event === 'data') {
          callback(Buffer.from(JSON.stringify(mockJson)));
        } else if (event === 'end') {
          callback();
        }
        return mockStream;
      }),
    };

    mockGetObject.mockResolvedValue({ value: mockStream });

    const config = { region: 'eu-frankfurt-1' };
    const result = await downloadTranscriptionResult(
      config as any,
      'mynamespace',
      'mybucket',
      'result.json'
    );

    expect(result.segments).toHaveLength(2);

    // First segment: Hello world
    expect(result.segments[0].text).toBe('Hello world');
    expect(result.segments[0].startSecond).toBe(0.0);
    expect(result.segments[0].endSecond).toBe(1.1);

    // Second segment: pause test continues
    expect(result.segments[1].text).toBe('pause test continues');
    expect(result.segments[1].startSecond).toBe(2.6);
    expect(result.segments[1].endSecond).toBe(4.5);
  });

  it('should preserve token confidence in extracted data', async () => {
    const mockJson = {
      transcription: {
        transcript: 'confidence test',
        tokens: [
          { token: 'confidence', startTime: 0.0, endTime: 0.5, confidence: 0.99 },
          { token: 'test', startTime: 0.6, endTime: 1.0, confidence: 0.88 },
        ],
      },
    };

    const mockStream = {
      on: jest.fn((event: string, callback: Function) => {
        if (event === 'data') {
          callback(Buffer.from(JSON.stringify(mockJson)));
        } else if (event === 'end') {
          callback();
        }
        return mockStream;
      }),
    };

    mockGetObject.mockResolvedValue({ value: mockStream });

    const config = { region: 'eu-frankfurt-1' };
    const result = await downloadTranscriptionResult(
      config as any,
      'mynamespace',
      'mybucket',
      'result.json'
    );

    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].text).toBe('confidence test');
  });

  it('should handle missing optional metadata fields', async () => {
    const mockJson = {
      transcription: {
        transcript: 'Just text no metadata',
        tokens: [
          { token: 'Just', startTime: 0.0, endTime: 0.3 },
          { token: 'text', startTime: 0.4, endTime: 0.7 },
          { token: 'no', startTime: 0.8, endTime: 1.0 },
          { token: 'metadata', startTime: 1.1, endTime: 1.6 },
        ],
      },
    };

    const mockStream = {
      on: jest.fn((event: string, callback: Function) => {
        if (event === 'data') {
          callback(Buffer.from(JSON.stringify(mockJson)));
        } else if (event === 'end') {
          callback();
        }
        return mockStream;
      }),
    };

    mockGetObject.mockResolvedValue({ value: mockStream });

    const config = { region: 'eu-frankfurt-1' };
    const result = await downloadTranscriptionResult(
      config as any,
      'mynamespace',
      'mybucket',
      'result.json'
    );

    expect(result.confidence).toBeUndefined();
    expect(result.languageCode).toBeUndefined();
    expect(result.text).toBe('Just text no metadata');
  });

  it('should skip tokens with missing required fields', async () => {
    const mockJson = {
      transcription: {
        transcript: 'Valid tokens only',
        tokens: [
          { token: 'Valid', startTime: 0.0, endTime: 0.3 }, // Valid
          { token: 'tokens', startTime: 0.4 }, // Missing endTime
          { token: 'only', startTime: 1.0, endTime: 1.5 }, // Valid
          { startTime: 2.0, endTime: 2.5 }, // Missing token
        ],
      },
    };

    const mockStream = {
      on: jest.fn((event: string, callback: Function) => {
        if (event === 'data') {
          callback(Buffer.from(JSON.stringify(mockJson)));
        } else if (event === 'end') {
          callback();
        }
        return mockStream;
      }),
    };

    mockGetObject.mockResolvedValue({ value: mockStream });

    const config = { region: 'eu-frankfurt-1' };
    const result = await downloadTranscriptionResult(
      config as any,
      'mynamespace',
      'mybucket',
      'result.json'
    );

    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].text).toBe('Valid only');
  });
});

describe('uploadAudioToObjectStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetNamespace.mockResolvedValue({ value: 'test-namespace' });
    mockPutObject.mockResolvedValue({});
  });

  it('should upload audio and return location details', async () => {
    const config = { region: 'eu-frankfurt-1' };
    const audioData = new Uint8Array([1, 2, 3, 4]);

    const result = await uploadAudioToObjectStorage(
      config as any,
      'my-bucket',
      'audio-123.wav',
      audioData
    );

    expect(result).toEqual({
      namespaceName: 'test-namespace',
      bucketName: 'my-bucket',
      objectName: 'audio-123.wav',
    });
    expect(mockGetNamespace).toHaveBeenCalledWith({});
    expect(mockPutObject).toHaveBeenCalledWith({
      namespaceName: 'test-namespace',
      bucketName: 'my-bucket',
      objectName: 'audio-123.wav',
      putObjectBody: audioData,
      contentLength: 4,
      contentType: 'audio/wav',
    });
  });
});

describe('deleteFromObjectStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteObject.mockResolvedValue({});
  });

  it('should delete an object from Object Storage', async () => {
    const config = { region: 'eu-frankfurt-1' };

    await deleteFromObjectStorage(config as any, 'test-namespace', 'my-bucket', 'audio-123.wav');

    expect(mockDeleteObject).toHaveBeenCalledWith({
      namespaceName: 'test-namespace',
      bucketName: 'my-bucket',
      objectName: 'audio-123.wav',
    });
  });
});

describe('generateAudioObjectName', () => {
  it('should generate a name matching the audio-{timestamp}-{random}.wav pattern', () => {
    const name = generateAudioObjectName();
    expect(name).toMatch(/^audio-\d+-[a-z0-9]+\.wav$/);
  });

  it('should generate unique names on successive calls', () => {
    const name1 = generateAudioObjectName();
    const name2 = generateAudioObjectName();
    expect(name1).not.toBe(name2);
  });
});
