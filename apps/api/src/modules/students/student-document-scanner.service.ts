import { Injectable, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'node:child_process';

const scanTimeoutMs = 30_000;

@Injectable()
export class StudentDocumentScannerService {
  private readonly scannerPath: string | undefined;

  constructor(config: ConfigService) {
    this.scannerPath = config.get<string>('STUDENT_DOCUMENT_SCANNER_PATH');
  }

  async scan(buffer: Buffer): Promise<void> {
    // Local development may omit ClamAV; production startup requires the scanner path.
    if (!this.scannerPath) return;

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        if (error) reject(error);
        else resolve();
      };

      let process: ReturnType<typeof spawn>;
      try {
        process = spawn(this.scannerPath!, ['--no-summary', '--infected', '-'], {
          stdio: ['pipe', 'ignore', 'ignore'],
          windowsHide: true,
        });
      } catch {
        finish(new ServiceUnavailableException('Document malware scanner is unavailable'));
        return;
      }
      if (!process.stdin) {
        process.kill('SIGKILL');
        finish(new ServiceUnavailableException('Document malware scanner input is unavailable'));
        return;
      }

      timeout = setTimeout(() => {
        process.kill('SIGKILL');
        finish(new ServiceUnavailableException('Document malware scan timed out'));
      }, scanTimeoutMs);

      process.once('error', () => {
        finish(new ServiceUnavailableException('Document malware scanner is unavailable'));
      });
      process.once('close', (code) => {
        if (code === 0) finish();
        else if (code === 1) finish(new UnprocessableEntityException('The uploaded file was identified as malicious'));
        else finish(new ServiceUnavailableException('Document malware scan failed'));
      });

      try {
        process.stdin.end(buffer);
      } catch {
        process.kill('SIGKILL');
        finish(new ServiceUnavailableException('Document malware scan failed'));
      }
    });
  }
}
