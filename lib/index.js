"use strict";
const { EventEmitter } = require("events");
const debug = require("debug")("sbs:sbs");
const Queue = require("./fifo");

async function sleep(time) {
  return new Promise((resolve)=>{
    setTimeout(()=>{
      resolve();
    }, time);
  });
}

/**
 * sanitize integer value
 * @param {number | string} num - value which should be sanitized
 * @param {number} min - minimum value
 * @param {number} max - maximum value
 * @param {number} def - default value
 * @returns {number} - sanitized number
 */
function sanitizeNumber(num, min, max, def) {
  let rt = def;
  if (typeof num === "string") {
    rt = parseFloat(num);
  }
  if (typeof num === "number") {
    rt = Math.floor(num);
    rt = typeof min === "number" && rt < min ? def : rt;
    rt = typeof max === "number" && rt > max ? def : rt;
  }
  return Number.isNaN(rt) ? def : rt;
}

/**
 * main class of simple-batch-scheduler
 * @constructor
 * @param {Object} opt - option argument
 * @param {Function} opt.exec - default executer
 * @param {number} opt.maxConcurrent - max number of parallel execution
 * @param {(boolean|Function)} opt.retry - retry flag or determiner function
 * @param {boolean} opt.retryLater - if true retry job will be pushd to the bottom of queue
 * @param {number} opt.maxRetry - hard limit of retry
 * @param {number} opt.retryDelay - waiting time before retry
 * @param {number} opt.interval - interval time between each job
 * @param {string} opt.name - label for debug output
 * @event SBS#submitted - job is submitted
 * @event SBS#run - execute job
 * @event SBS#finished - job is succeeded
 * @event SBS#failed - job is failed
 * @event SBS#done - job is done
 */
class SBS extends EventEmitter {
  constructor(opt = {}) {
    super();
    this.maxConcurrent = sanitizeNumber(opt.maxConcurrent, 1, null, 1);
    this.exec = typeof opt.exec === "function" ? opt.exec : null;
    this.retry = opt.retry;
    this.retryLater = opt.retryLater;
    this.maxRetry = sanitizeNumber(opt.maxRetry, 1, null, null);
    this.retryDelay = sanitizeNumber(opt.retryDelay, 1, null, 0);
    this.interval = sanitizeNumber(opt.interval, 1, null, 0);
    this.noAutoClear = opt.noAutoClear;
    this.name = typeof opt.name === "string" ? opt.name : "";
    this.queue = new Queue();
    this.numRunning = 0;
    this.failed = new Map(); //will have failed job's id and error object from job
    this.finished = new Map(); //will have finishd job's id and its return value
    this.running = new Set(); //will have running job's id

    //please note "waiting" will have jobs which was registerd by qwait(), qwaitAll(), or qsubAndWait()
    //its key is job id and value is array of {resolv, reject, keepResultFlag} where resolv and reject is
    //call back routines of Promise which is retured from qwait(), qwaitAll(), and qsubAndWait()
    //
    //if you want to look up jobs which is waiting to be executed, you have to check this.queue.
    this.waiting = new Map();

    if (!opt.noAutoStart) {
      debug(this.name, "auto start disptaching");

      if (this.listenerCount("go") === 0) {
        this.on("go", this._dispatch);
      }
    }

    this.on("done", (id)=>{
      if (!this.waiting.has(id)) {
        return;
      }
      const state = this.qstat(id);
      //this job is retrying
      if (state !== "finished" && state !== "failed") {
        return;
      }
      debug(this.name, `${id} is ${state}`);

      const p = this.waiting.get(id);
      const keepResults = p.some((e)=>{
        return e.keepResults;
      });
      const result = this.getResult(id, keepResults);
      this.waiting.delete(id);

      for (const e of p) {
        const settle = state === "finished" ? e.resolve : e.reject;
        settle(result);
      }
    });
  }

  /**
   * job object can have following properties
   * @typedef {Object} job
   * @typedef {Function} job.exec - function which only used in this job
   * @typedef {argument} job.args - argument object of this job
   * @typedef {number} job.maxRetry - max number of retry for this job
   * @typedef {number} job.retryDelay - waiting time before retry
   * @typedef {(boolean|Function)} job.retry - if true, this job will be requeue when exception occurred
   * @typedef {boolean} job.retryLater - if true retry job will be pushd the bottom of the queue
   * @typedef {string} job.name - human readable label for job
   * you can also specify a function which will test error object and decide to retry or not.
   */
  /**
   * submit job
   * @param {(Function|job|argument)} job - job object or function which should be executed later
   * @param {boolean} urgent - if true, job is put to the top of queue
   * if job is not function and job does not have "exec" or "args"  property,
   * it will be treated as the argument of default executer(this.exec)
   */
  qsub(job, urgent = false) {
    if (typeof this.exec !== "function" && typeof job !== "function" && typeof job.exec !== "function") {
      debug(this.name, "no function specified");
      return null;
    }
    if (Object.prototype.hasOwnProperty.call(job, "exec") && typeof job.exec !== "function") {
      debug(this.name, "job.exec must be a function");
      return null;
    }
    let actualJob = {};
    if (typeof job === "function") {
      actualJob.exec = job;
    } else if (!Object.prototype.hasOwnProperty.call(job, "exec") && !Object.prototype.hasOwnProperty.call(job, "args")) {
      actualJob.args = job;
    } else {
      actualJob = job;
    }
    actualJob.retryCount = 0;
    const id = this.queue.enqueue(actualJob, urgent);
    const name = job.name ? `${job.name} ${id}` : id;
    this.emit("submitted", id, name);
    debug(this.name, "submit job", name);
    setTimeout(()=>{
      this.emit("go");
    }, this.interval);
    return id;
  }

  /**
   * delete jobs in queue
   * @param {string} id - id string from qsub()
   * @returns {boolean} - true means successfully deleted, false means specified job is not in queue
   * please note that running job can not be deleted and qdel returns false
   */
  qdel(id) {
    debug(this.name, "delete job", id);
    const rt = this.queue.del(id);
    if (rt && this.waiting.has(id)) {
      for (const e of this.waiting.get(id)) {
        e.resolve("removed");
      }
      this.waiting.delete(id);
    }
    return rt;
  }

  /**
   * query job status
   * @param {string} id - id string from qsub()
   * @returns {string} finished - job is already finished
   * @returns {string} failed   - job is rejected or exception occurred while running
   * @returns {string} waiting  - job is not started
   * @returns {string} running  - job is running
   */
  qstat(id) {
    if (typeof id !== "string") {
      return null;
    }
    let state = "removed";
    if (this.failed.has(id)) {
      state = "failed";
    } else if (this.queue.has(id)) {
      state = "waiting";
    } else if (this.running.has(id)) {
      state = "running";
    } else if (this.finished.has(id)) {
      state = "finished";
    }
    return state;
  }


  /**
   * get return value or error object from executer
   * @param {string} id - id string from qsub()
   */
  getResult(id, keepResult) {
    let rt = null;
    if (this.failed.has(id)) {
      rt = this.failed.get(id);

      if (!(this.noAutoClear || keepResult)) {
        this.failed.set(id, null);
      }
    } else if (this.finished.has(id)) {
      rt = this.finished.get(id);

      if (!(this.noAutoClear || keepResult)) {
        this.finished.set(id, null);
      }
    }
    return rt;
  }

  /**
   * wait until specified job finish
   * @param {string} id - id string from qsub()
   */
  async qwait(id, keepResult) {
    const state = this.qstat(id);
    if (state === "failed") {
      return Promise.reject(this.getResult(id, keepResult));
    }
    if (state === "finished") {
      return Promise.resolve(this.getResult(id, keepResult));
    }
    if (state === "removed") {
      return Promise.resolve("removed");
    }
    //state is waiting or running
    return new Promise((resolve, reject)=>{
      let p = this.waiting.get(id);
      if (!p) {
        p = [];
      }
      p.push({ resolve, reject, keepResult });
      this.waiting.set(id, p);
    });
  }

  /**
   * submit job and wait until it finish
   */
  async qsubAndWait(job, keepResult) {
    const id = this.qsub(job);
    return id ? this.qwait(id, keepResult) : Promise.reject(new Error("job submit failed"));
  }


  /**
   * wait until all job finish
   * @param {string[]} ids - array of id string from qsub()
   */
  async qwaitAll(ids, keepResult) {
    return Promise.all(
      ids.map((id)=>{
        return this.qwait(id, keepResult);
      })
    );
  }

  /**
   * start dispatching new job
   */
  start() {
    debug(this.name, "start dispatching");

    if (this.listenerCount("go") === 0) {
      this.on("go", this._dispatch);
    }
    setTimeout(()=>{
      this.emit("go");
    }, this.interval);
  }


  /**
   * stop dispatching new job
   */
  stop() {
    debug(this.name, "stop dispatching");
    this.removeListener("go", this._dispatch);
  }


  /**
   * return number of job in queue
   */
  size() {
    return this.queue.size();
  }


  /**
   * return array of running job id
   */
  getRunning() {
    return Array.from(this.running);
  }


  /**
   * stop dispatching new job any more and clear all jobs in the queue
   */
  clear() {
    this.stop();
    this.queue.clear();
    this.finished.clear();
    this.failed.clear();

    for (const [k, v] of this.waiting.entries()) {
      if (!this.running.has(k)) {
        for (const e of v) {
          e.resolve("removed");
        }
      }
    }
    this.waiting.clear();
  }


  /**
   * remove results to save memory
   * id will be kept for qstat
   */
  clearResults() {
    for (const id of this.failed.keys()) {
      this.failed.set(id, null);
    }
    for (const id of this.finished.keys()) {
      this.finished.set(id, null);
    }
  }

  async _dispatch() {
    //to go or not to go
    if (this.queue.size() <= 0) {
      debug(this.name, "queue is empty");
      return false;
    }
    if (this.numRunning >= this.maxConcurrent) {
      debug(`${this.name} number of running job is exceeded max concurrent (${this.maxConcurrent})`);
      return false;
    }

    ++this.numRunning;

    //job and id can be null if queue is empty but never come here in such case.
    const [job, id] = this.queue.dequeue();
    const name = job.name ? `${job.name} ${id}` : id;
    debug(
      this.name,
      name,
      "dispatching new job: running =",
      this.numRunning,
      ", waiting =",
      this.queue.size(),
      ", max concurrent =",
      this.maxConcurrent
    );

    let exec = Object.prototype.hasOwnProperty.call(job, "exec") ? job.exec : this.exec;
    if (Object.prototype.hasOwnProperty.call(job, "args")) {
      exec = exec.bind(null, job.args);
    }

    let retry = Object.prototype.hasOwnProperty.call(job, "retry") ? job.retry : this.retry;
    if (typeof retry !== "function") {
      const retryFlag = retry;
      retry = ()=>{
        return retryFlag;
      };
    }

    const maxRetry = sanitizeNumber(job.maxRetry, 1, null, this.maxRetry);
    const retryDelay = sanitizeNumber(job.retryDelay, 1, null, this.retryDelay);
    const retryLater = Object.prototype.hasOwnProperty.call(job, "retryLater") ? job.retryLater : this.retryLater;

    //accept next job;
    setTimeout(()=>{
      this.emit("go");
    }, this.interval);

    this.running.add(id);

    try {
      this.emit("run", id, job.name);
      const rt = await exec();
      this.finished.set(id, rt);
      this.emit("finished", id, job.name);
      debug(this.name, name, "succeeded:", rt);
    } catch (err) {
      if ((maxRetry !== null && job.retryCount >= maxRetry) || !await retry(err)) {
        this.failed.set(id, err);
        this.emit("failed", id, job.name);
        debug(this.name, name, "failed:", err);
      } else {
        ++job.retryCount;
        debug(this.name, name, "failed and retry soon", err);

        if (retryDelay) {
          await sleep(retryDelay);
        }
        this.queue.enqueue(job, !retryLater, id);
      }
    } finally {
      this.running.delete(id);
      --this.numRunning;
      debug(
        this.name,
        name,
        "job end and dispatching next: running =",
        this.numRunning,
        ", waiting =",
        this.queue.size(),
        ", max concurrent =",
        this.maxConcurrent
      );
      setTimeout(()=>{
        this.emit("go");
      }, this.interval);
      this.emit("done", id, job.name);
    }
    return true;
  }
}

module.exports = SBS;
