import { EventEmitter } from 'node:events';
import { ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn: spawnMock }));

import { StudentDocumentScannerService } from './student-document-scanner.service.js';

function createProcess() {
  const process = new EventEmitter() as EventEmitter & {
    stdin: { end: (buffer: Buffer) => void };
    kill: ReturnType<typeof vi.fn>;
  };
  process.stdin = { end: vi.fn() };
  process.kill = vi.fn();
  return process;
}

describe('StudentDocumentScannerService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes uploaded bytes to ClamAV through stdin and accepts a clean result', async () => {
    const process = createProcess();
    spawnMock.mockReturnValue(process);
    const scanner = new StudentDocumentScannerService({ get: () => 'C:\\ClamAV\\clamscan.exe' } as never);
    const pending = scanner.scan(Buffer.from('%PDF-1.7'));
    expect(spawnMock).toHaveBeenCalledWith('C:\\ClamAV\\clamscan.exe', ['--no-summary', '--infected', '-'], {
      stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true,
    });
    expect(process.stdin.end).toHaveBeenCalledWith(Buffer.from('%PDF-1.7'));
    process.emit('close', 0, null);
    await expect(pending).resolves.toBeUndefined();
  });

  it('rejects infected uploads', async () => {
    const process = createProcess();
    spawnMock.mockReturnValue(process);
    const scanner = new StudentDocumentScannerService({ get: () => '/usr/bin/clamscan' } as never);
    const pending = scanner.scan(Buffer.from('infected'));
    process.emit('close', 1, null);
    await expect(pending).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('fails closed when ClamAV cannot start or reports an error', async () => {
    const process = createProcess();
    spawnMock.mockReturnValue(process);
    const scanner = new StudentDocumentScannerService({ get: () => '/usr/bin/clamscan' } as never);
    const pending = scanner.scan(Buffer.from('document'));
    process.emit('error', new Error('not installed'));
    await expect(pending).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('kills timed-out scanner processes and fails closed', async () => {
    vi.useFakeTimers();
    try {
      const process = createProcess();
      spawnMock.mockReturnValue(process);
      const scanner = new StudentDocumentScannerService({ get: () => '/usr/bin/clamscan' } as never);
      const pending = scanner.scan(Buffer.from('document'));
      const assertion = expect(pending).rejects.toBeInstanceOf(ServiceUnavailableException);
      await vi.advanceTimersByTimeAsync(30_000);
      await assertion;
      expect(process.kill).toHaveBeenCalledWith('SIGKILL');
    } finally {
      vi.useRealTimers();
    }
  });

  it('allows development uploads without a configured scanner', async () => {
    const scanner = new StudentDocumentScannerService({ get: () => undefined } as never);
    await expect(scanner.scan(Buffer.from('document'))).resolves.toBeUndefined();
    expect(spawnMock).not.toHaveBeenCalled();
  });
});
