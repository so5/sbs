const { EventEmitter } = require("events");
const debug = require("debug")("sbs:sbs");
const queue = require("./fifo");

class SBS extends EventEmitter {
  /**
   * @param {Object} opt - option argument
   * @param {function} opt.exec - default executer
   * @param {number} opt.maxConcurrent - max number of parallel execution
   * @param {(boolean|function)} retry - retry flag or determiner function
   */
  constructor(opt = {}) {
    super();
    this.maxConcurrent =
      typeof opt.maxConcurrent === "number" && opt.maxConcurrent > 1 ? Math.floor(opt.maxConcurrent) : 1;
    this.exec = typeof opt.exec === "function" ? opt.exec : null;
    this.retry = opt.retry;
    this.noAutoClear = opt.noAutoClear;
    this.interval = typeof opt.interval === "number" && opt.interval > 1 ? Math.floor(opt.maxConcurrent) : undefined;
    this.queue = new queue();
    this.numRunning = 0;
    this.failed = new Map();
    this.finished = new Map();
    this.running = new Set();
    if (!opt.noAutoStart) {
      debug("auto start executing");
      this.once("go", this._executer);
    }
  }

  /**
   * argument object is the only argument which will be passed to exec
   * @typedef {*} argument
   *
   * job object can have following properties
   * @typedef {Object} job
   * @typedef {function} job.exec - function which only used in this job
   * @typedef {argument} job.args - argument object of this job
   * @typedef {(boolean|function)} job.retry - if true (or returns true), this job will be immediately requeue if exception occurred
   * error object will be passed to retry function as the only argument
   */
  /**
   * submit job
   * @param {(function|job|argument)} job
   */
  qsub(job) {
    if (typeof this.exec !== "function" && typeof job !== "function" && typeof job.exec !== "function") {
      debug("no function specified");
      return null;
    }
    const id = this.queue.enqueue(job);
    debug("submit job", id);
    setImmediate(() => {
      this.emit("go");
    });
    return id;
  }

  /**
   * delete jobs in queue
   * @param {string} id - id string from qsub()
   * please note that running job can not deleted
   */
  qdel(id) {
    debug("delete job", id);
    this.queue.del(id);
  }

  /**
   * query job status
   * @param {string} id - id string from qsub()
   * @return {string} finished - job is already finished
   * @return {string} failed   - job is rejected or exception occurred while running
   * @return {string} waiting  - job is not started
   * @return {string} running  - job is running
   */
  qstat(id) {
    if (typeof id !== "string") return null;
    let state = "finished";
    if (this.failed.has(id)) {
      state = "failed";
    } else if (this.queue.has(id)) {
      state = "waiting";
    } else if (this.running.has(id)) {
      state = "running";
    }
    return state;
  }
  /**
   * get return value or error object from executer
   * @param {string} id - id string from qsub()
   */
  getResult(id) {
    let rt;
    if (this.failed.has(id)) {
      rt = this.failed.get(id);
      if (!this.noAutoClear) this.failed.set(id, null);
    } else if (this.finished.has(id)) {
      rt = this.finished.get(id);
      if (!this.noAutoClear) this.finished.set(id, null);
    }
    return rt;
  }

  /**
   * wait until specified job finish
   * @param {string} id - id string from qsub()
   * @param {number} interval - interval time of each status check (in milisecond)
   */
  qwait(id, interval) {
    if (typeof interval !== "number" || interval < 1) interval = this.interval || 1000;
    return new Promise((resolve, reject) => {
      const timeout = setInterval(() => {
        const state = this.qstat(id);
        let fullfilled = resolve;
        let result;
        if (state === "finished") {
          result = this.finished.get(id);
        } else if (state === "failed") {
          fullfilled = reject;
          result = this.failed.get(id);
        } else {
          // job is not finished. keep polling
          return;
        }
        clearInterval(timeout);
        fullfilled(result);
      }, interval);
    });
  }
  /**
   * submit job and wait until it finish
   */
  async qsubAndWait(job, interval) {
    const id = this.qsub(job);
    return id ? this.qwait(id, interval) : Promise.reject(new Error("job submit failed"));
  }
  /**
   * wait until all job finish
   * @param {string[]} ids - array of id string from qsub()
   * @param {number} interval - interval time of each status check (in milisecond)
   */
  qwaitAll(ids, interval = 1000) {
    if (typeof interval !== "number") interval = 1000;
    return new Promise((resolve, reject) => {
      const timeout = setInterval(() => {
        let isFinished = true;
        for (const id of ids) {
          const state = this.qstat(id);
          if (state === "failed") {
            clearInterval(timeout);
            reject(this.failed.get(id));
          } else if (state === "waiting" || state === "running") {
            isFinished = false;
          }
        }
        if (isFinished) {
          clearInterval(timeout);
          resolve();
        }
      }, interval);
    });
  }

  /**
   * start dispatching new job
   */
  start() {
    debug("start executing");
    this._executer();
  }
  /**
   * stop dispatching new job
   */
  stop() {
    debug("stop executing");
    this.removeListener("go", this._executer);
  }
  /**
   * return number of job in queue
   */
  size() {
    return this.queue.size();
  }
  /**
   * stop dispatching new job any more and clear all jobs in the queue
   */
  clear() {
    this.stop();
    this.queue.clear();
    this.finished = new Map();
    this.failed = new Map();
  }
  /**
   * remove results to save memory
   * id will be keeped for qstat
   */
  clearResults() {
    for (const id of this.failed.keys()) {
      this.failed.set(id, null);
    }
    for (const id of this.finished.keys()) {
      this.finished.set(id, null);
    }
  }

  _parseJob(job) {
    let exec = this.exec;
    let args = undefined;
    let retry = this.retry;

    //determine executer
    if (job.hasOwnProperty("exec") && typeof job.exec === "function") {
      exec = job.exec;
    } else if (typeof job === "function") {
      exec = job;
    } else if (typeof this.exec === "function") {
      exec = this.exec;
      args = job; //if job has args property, it will be updated later
    } else {
      // never reach!!
      throw new Error("executer is not specified");
    }
    if (job.hasOwnProperty("args")) {
      args = job.args;
    }

    //update retry flag
    if (job.hasOwnProperty("retry")) {
      retry = job.retry;
    }

    if (typeof retry !== "function") {
      const retryFlag = retry;
      retry = () => {
        return retryFlag;
      };
    }

    return [exec, args, retry];
  }

  async _executer() {
    // cancel execution at this time
    if (this.queue.size() <= 0) {
      debug("queue is empty");
      this.once("go", this._executer);
      return;
    } else if (this.numRunning >= this.maxConcurrent) {
      debug("number of running job is exceeded max concurrent");
      this.once("go", this._executer);
      return;
    }

    debug(
      "dispatching new job: running =",
      this.numRunning,
      ", waiting =",
      this.queue.size(),
      ", max concurrent =",
      this.maxConcurrent
    );
    ++this.numRunning;

    const [e, id] = this.queue.dequeue();
    const [exec, args, retry] = this._parseJob(e);

    //accept next job;
    this.once("go", this._executer);
    setImmediate(() => {
      debug("call next");
      this.emit("go");
    });

    this.running.add(id);
    try {
      this.finished.set(id, await exec(args));
    } catch (err) {
      if (retry(err)) {
        debug(id, "failed and retry soon", err);
        this.queue.enqueue(e, id, true);
      } else {
        debug(id, "failed:", err);
        this.failed.set(id, err);
      }
    } finally {
      this.running.delete(id);
      --this.numRunning;
      setImmediate(() => {
        debug(id, "end and call next");
        this.emit("go");
      });
    }
  }
}

module.exports = SBS;
