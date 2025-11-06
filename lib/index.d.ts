import { EventEmitter } from "events";

export = SBS;

declare class SBS extends EventEmitter {
  constructor(opt?: SBS.Options);

  maxConcurrent: number;
  exec: SBS.ExecFunction | null;
  retry: boolean | SBS.RetryFunction;
  retryLater: boolean;
  maxRetry: number | null;
  retryDelay: number;
  interval: number;
  noAutoClear: boolean;
  name: string;
  submitHook: SBS.SubmitHookFunction | null;
  queue: SBS.Queue<SBS.Job>;
  failed: Map<string, Error>;
  finished: Map<string, any>;
  running: Set<string>;
  waiting: Map<string, Array<{ resolve: (value?: any) => void, reject: (reason?: any) => void, keepResults: boolean }>>;

  qsub(job: SBS.Job | SBS.ExecFunction | any, urgent?: boolean): string | null | Promise<string | null>;
  qdel(id: string): boolean;
  qstat(id: string): "finished" | "failed" | "waiting" | "running" | "removed" | null;
  getResult(id: string, keepResult?: boolean): any;
  qwait(id: string, keepResult?: boolean): Promise<any>;
  qsubAndWait(job: SBS.Job | SBS.ExecFunction | any, keepResult?: boolean): Promise<any>;
  qwaitAll(ids: string[], keepResult?: boolean): Promise<any[]>;
  start(): void;
  stop(): void;
  size(): number;
  getRunning(): string[];
  clear(): void;
  clearResults(): void;
}

declare namespace SBS {
  export interface Options {
    exec?: ExecFunction;
    maxConcurrent?: number;
    retry?: boolean | RetryFunction;
    retryLater?: boolean;
    maxRetry?: number;
    retryDelay?: number;
    interval?: number;
    name?: string;
    submitHook?: SubmitHookFunction;
    noAutoStart?: boolean;
    noAutoClear?: boolean;
  }

  export type ExecFunction = (...args: any[]) => any | Promise<any>;
  export type RetryFunction = (err: Error) => boolean | Promise<boolean>;
  export type SubmitHookFunction = (queue: Queue<Job>, job: Job | ExecFunction | any, urgent: boolean) => boolean | Promise<boolean>;

  export interface Job {
    exec?: ExecFunction;
    args?: any;
    maxRetry?: number;
    retryDelay?: number;
    forceRetry?: boolean;
    retry?: boolean | RetryFunction;
    retryLater?: boolean;
    name?: string;
    id?: string;
    retryCount?: number;
  }

  export class Queue<T> {
    constructor();
    enqueue(element: T, urgent?: boolean, id?: string): string;
    dequeue(): [T | null, string | null];
    del(id: string): boolean;
    clear(): void;
    size(): number;
    has(id: string): boolean;
    getLastEntry(needLastExecuted?: boolean): T | null;
    find(cb: (element: T) => boolean): T | null;
    removeFromQueue(entries: T[]): void;
  }
}
