[![npm version](https://badge.fury.io/js/simple-batch-system.svg)](https://badge.fury.io/js/simple-batch-system)
[![Known Vulnerabilities](https://snyk.io/test/github/so5/sbs/badge.svg)](https://snyk.io/test/github/so5/sbs)
[![Test Coverage](https://api.codeclimate.com/v1/badges/8f3c0ea00e755ae31081/test_coverage)](https://codeclimate.com/github/so5/sbs/test_coverage)
[![Maintainability](httpshttps://api.codeclimate.com/v1/badges/8f3c0ea00e755ae31081/maintainability)](https://codeclimate.com/github/so5/sbs/maintainability)

# Simple Batch System (SBS)

Simple Batch System is a lightweight job scheduler library for Node.js, inspired by traditional job schedulers like PBS and SLURM. It allows you to execute asynchronous tasks with control over concurrency, retry logic, and job queuing.

## Features

- **Job Queuing**: Submit jobs to a queue for execution.
- **Concurrency Control**: Limit the number of jobs that run in parallel.
- **Job Cancellation**: Cancel jobs before they start.
- **Promise-based API**: Modern and easy-to-use asynchronous API.
- **Retry Logic**: Automatically retry failed jobs.
- **Event-driven**: Emits events for job lifecycle (submitted, run, finished, failed).

## Installation

Install the package using npm:

```bash
npm install simple-batch-system
```

## Usage

Here’s a basic example of how to use the Simple Batch System:

```javascript
import SBS from 'simple-batch-system';

// Create a new SBS instance
const sbs = new SBS({ maxConcurrent: 2 });

// Define a function to be executed as a job
const myJob = async (arg) => {
  console.log(`Job started with argument: ${arg}`);
  // Simulate an async operation
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log(`Job with argument ${arg} finished.`);
  return `Result from ${arg}`;
};

// Submit jobs to the queue
const id1 = sbs.qsub({ exec: () => myJob('A') });
const id2 = sbs.qsub({ exec: () => myJob('B') });
const id3 = sbs.qsub({ exec: () => myJob('C') });

console.log(`Submitted jobs with IDs: ${id1}, ${id2}, ${id3}`);

// You can wait for a specific job to complete
sbs.qwait(id1).then((result) => {
  console.log(`Job ${id1} completed with result: ${result}`);
});

// Or wait for all jobs to complete
sbs.qwaitAll([id1, id2, id3]).then((results) => {
  console.log('All jobs completed:', results);
});
```

### Using a Default Executor

You can define a default executor for all jobs:

```javascript
import SBS from 'simple-batch-system';

const sbs = new SBS({
  exec: async (arg) => {
    console.log(`Processing: ${arg}`);
    await new Promise(resolve => setTimeout(resolve, 500));
    return `Processed: ${arg}`;
  }
});

sbs.qsub('task1');
sbs.qsub('task2');
```

## API Guide

### `new SBS(options)`

Creates a new `SBS` instance.

- `options` (Object): Configuration for the instance.
  - `maxConcurrent` (number): Maximum number of parallel jobs. Default: `1`.
  - `exec` (Function): A default function to execute for jobs.
  - `retry` (boolean|Function): Whether to retry failed jobs. Can be a function that returns `true` or `false`.
  - `maxRetry` (number): The maximum number of retries.
  - `retryDelay` (number): The delay in milliseconds before a retry.
  - `interval` (number): The interval in milliseconds between starting jobs.
  - `name` (string): A name for the SBS instance, used for debugging.

### `sbs.qsub(job, [urgent])`

Submits a job to the queue.

- `job` (Object|Function): The job to execute. Can be a function or an object with an `exec` property.
- `urgent` (boolean): If `true`, the job is added to the front of the queue.
- Returns a unique job `id`.

The `job` object can have the following properties:

- `exec` (Function): The function to execute for this job.
- `args` (any): Arguments to be passed to the default executer.
- `name` (string): A human-readable name for the job.
- `retry` (boolean|Function): Job-specific retry logic.
- `maxRetry` (number): Job-specific maximum number of retries.
- `retryDelay` (number): Job-specific delay before retrying.
- `retryLater` (boolean): If `true`, the job is pushed to the back of the queue on retry.
- `forceRetry` (boolean): If `true`, the job will be retried even if `maxRetry` is exceeded.

### `sbs.qdel(id)`

Removes a job from the queue.

- `id` (string): The ID of the job to remove.
- Returns `true` if the job was removed, `false` otherwise.

### `sbs.qstat(id)`

Gets the status of a job.

- `id` (string): The ID of the job.
- Returns one of: `"running"`, `"waiting"`, `"finished"`, `"failed"`, `"removed"`.

### `sbs.qwait(id)`

Waits for a single job to complete.

- `id` (string): The ID of the job.
- Returns a `Promise` that resolves with the job's result or rejects with an error.

### `sbs.qwaitAll(ids)`

Waits for multiple jobs to complete.

- `ids` (string[]): An array of job IDs.
- Returns a `Promise` that resolves with an array of results.

### `sbs.qsubAndWait(job)`

Submits a job and waits for it to complete.

- `job` (Object|Function): The job to execute.
- Returns a `Promise` that resolves with the job's result.

### Other Methods

- `start()`: Starts the job queue if it was stopped.
- `stop()`: Stops the job queue from starting new jobs.
- `clear()`: Stops the queue and removes all waiting jobs.
- `size()`: Returns the number of jobs in the queue.
- `getRunning()`: Returns an array of running job IDs.
- `clearResults()`: Clears stored results of finished/failed jobs to save memory.
