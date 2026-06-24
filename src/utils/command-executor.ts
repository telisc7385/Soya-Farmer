import { exec, ExecOptions } from "child_process";

export interface CommandResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export function executeCommand(
  command: string,
  cwd?: string
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const options: ExecOptions = {
      shell: process.env.ComSpec || "cmd.exe",
      maxBuffer: 10 * 1024 * 1024,
      cwd,
    };

    const child = exec(command, options, (error, stdout, stderr) => {
      const result: CommandResult = {
        command,
        stdout: (stdout?.toString() || "").trim(),
        stderr: (stderr?.toString() || "").trim(),
        exitCode: error ? (error.code ?? 1) : 0,
      };

      if (error) {
        reject(result);
      } else {
        resolve(result);
      }
    });
  });
}
