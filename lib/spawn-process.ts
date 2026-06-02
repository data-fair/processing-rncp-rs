import { spawn, type SpawnOptions } from 'node:child_process'
import Debug from 'debug'

const debug = Debug('spawn-process')

export interface SpawnResult {
  stdout: string
  stderr: string
}

/**
 * Run a command asynchronously and resolve with its stdout/stderr once it finishes.
 */
export async function runCommand (cmd: string, args: string[], options: SpawnOptions = {}): Promise<SpawnResult> {
  debug(`${cmd} ${args.join(' ')}`)
  return await new Promise<SpawnResult>((resolve, reject) => {
    const child = spawn(cmd, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] })
    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []
    child.stdout?.on('data', (chunk: Buffer) => { stdoutChunks.push(chunk) })
    child.stderr?.on('data', (chunk: Buffer) => { stderrChunks.push(chunk) })
    child.on('error', reject)
    child.on('close', (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString()
      const stderr = Buffer.concat(stderrChunks).toString()
      if (code !== 0) reject(new Error(`Command "${cmd}" exited with code ${code}: ${stderr}`))
      else resolve({ stdout, stderr })
    })
  })
}
