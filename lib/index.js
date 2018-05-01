const { EventEmitter } = require("events");
const debug = require("debug")("sbs:sbs");
const queue = require("./fifo");

async function sleep(time) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, time);
  });
}

class SBS extends EventEmitter {
  /**
   * @param {Object} opt - option argument
   * @param {function} opt.exec - default executer
   * @param {number} opt.maxConcurrent - max number of parallel execution
   * @param {(boolean|function)} opt.retry - retry flag or determiner function
   * @param {number} opt.maxRetry - hard limit of retry
   * @param {number} opt.retryDelay - waiting time before retry
   */
  constructor(opt = {}) {
    super();
    this.maxConcurrent =
      typeof opt.maxConcurrent === "number" && opt.maxConcurrent > 1 ? Math.floor(opt.maxConcurrent) : 1;
    this.exec = typeof opt.exec === "function" ? opt.exec : null;
    this.retry = opt.hasOwnProperty("retry") ? opt.retry : false;
    this.maxRetry = typeof opt.maxRetry === "number" && opt.maxRetry > 1 ? Math.floor(opt.maxRetry) : null;
    this.retryDelay = typeof opt.retryDelay === "number" && opt.retryDelay > 1 ? Math.floor(opt.retryDelay) : 0;
    this.noAutoClear = opt.noAutoClear;
    this.queue = new queue();
    this.numRunning = 0;
    this.failed = new Map(); //will have failed job's id and error object from job
    this.finished = new Map(); //will have finishd job's id and its return value
    this.running = new Set(); //will have running job's id

    //please note "waiting" will have jobs which was registerd by qwait(), qwaitAll(), or qsubAndWait()
    //if you want to look up jobs which is waiting to be executed, you have to check this.queue.
    this.waiting = new Map();

    if (!opt.noAutoStart) {
      debug("auto start disptaching");
      this._open();
    }

    this.on("done", (id) => {
      if (!this.waiting.has(id)) return;
      const fullfilled = this.waiting.get(id);
      const state = this.qstat(id);
      if (state === "finished") {
        const result = this.finished.get(id);
        fullfilled.resolve(result);
      } else if (state === "failed") {
        const result = this.failed.get(id);
        fullfilled.reject(result);
      } else {
        //what's happen?
        return;
      }
      this.waiting.delete(id);
    });
  }

  /**
   * job object can have following properties
   * @typedef {Object} job
   * @typedef {function} job.exec - function which only used in this job
   * @typedef {argument} job.args - argument object of this job
   * @typedef {number} job.maxRetry - max number of retry for this job
   * @typedef {(boolean|function)} job.retry - if true, this job will be requeue when exception occurred
   * you can also specify a function which will test error object and decide to retry or not.
   */
  /**
   * submit job
   * @param {(function|job|argument)} job - job object or function which should be executed later
   * if job is not function and job does not have "exec" or "args"  property,
   * it will be treated as the argument of default executer(this.exec)
   */
  qsub(job) {
    if (typeof this.exec !== "function" && typeof job !== "function" && typeof job.exec !== "function") {
      debug("no function specified");
      return null;
    }
    if (job.hasOwnProperty("exec") && typeof job.exec !== "function") {
      debug("job.exec must be a function");
      return null;
    }
    let actualJob = {};
    if (typeof job === "function") {
      actualJob.exec = job;
    } else if (!job.hasOwnProperty("exec") && !job.hasOwnProperty("args")) {
      actualJob.args = job;
    } else {
      actualJob = job;
    }
    actualJob.retryCount = 0;
    const id = this.queue.enqueue(actualJob);
    debug("submit job", id);
    this._kick();
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
   */
  async qwait(id) {
    const state = this.qstat(id);
    if (state === "finished") {
      return Promise.resolve(this.finished.get(id));
    } else if (state === "failed") {
      return Promise.reject(this.failed.get(id));
    } else if (state === "removed") {
      return Promise.resolve("removed");
    } else if (state === "waiting" || state === "running") {
      return new Promise((resolve, reject) => {
        this.waiting.set(id, { resolve: resolve, reject: reject });
      });
    }
  }
  /**
   * submit job and wait until it finish
   */
  async qsubAndWait(job) {
    const id = this.qsub(job);
    return id ? this.qwait(id) : Promise.reject(new Error("job submit failed"));
  }
  /**
   * wait until all job finish
   * @param {string[]} ids - array of id string from qsub()
   */
  async qwaitAll(ids) {
    return Promise.all(
      ids.map((id) => {
        return this.qwait(id);
      })
    );
  }

  /**
   * start dispatching new job
   */
  start() {
    debug("start dispatching");
    this._dispatch();
  }
  /**
   * stop dispatching new job
   */
  stop() {
    debug("stop dispatching");
    this.removeListener("go", this._dispatch);
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
    this.finished.clear();
    this.failed.clear();
    for (const [k, v] of this.waiting.entries()) {
      if (!this.running.has(k)) {
        v.resolve("removed");
      }
    }
    this.waiting.clear();
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

  _open() {
    process.nextTick(() => {
      this.once("go", this._dispatch);
    });
  }

  _toGo() {
    return this.queue.size() > 0 && this.numRunning < this.maxConcurrent;
  }

  _kick() {
    process.nextTick(() => {
      if (this._toGo()) {
        this.emit("go");
      }
    });
  }

  async _dispatch() {
    // cancel execution at this time
    if (!this._toGo()) {
      if (this.queue.size() <= 0) {
        debug("queue is empty");
      } else if (this.numRunning >= this.maxConcurrent) {
        debug("number of running job is exceeded max concurrent");
      }
      this._open();
      return;
    }

    ++this.numRunning;
    debug(
      "dispatching new job: running =",
      this.numRunning,
      ", waiting =",
      this.queue.size(),
      ", max concurrent =",
      this.maxConcurrent
    );

    const [job, id] = this.queue.dequeue();
    let exec = job.hasOwnProperty("exec") ? job.exec : this.exec;
    if (job.hasOwnProperty("args")) {
      exec = exec.bind(null, job.args);
    }
    let retry = job.hasOwnProperty("retry") ? job.retry : this.retry;
    if (typeof retry !== "function") {
      const retryFlag = retry;
      retry = () => {
        return retryFlag;
      };
    }
    const retryDelay = job.hasOwnProperty("retryDelay") ? job.retryDelay : this.retryDelay;

    //accept next job;
    this._open();
    this._kick();

    this.running.add(id);
    try {
      this.finished.set(id, await exec());
    } catch (err) {
      if ((this.maxRetry !== null && job.retryCount >= this.maxRetry) || !await retry(err)) {
        debug(id, "failed:", err);
        this.failed.set(id, err);
      } else {
        ++job.retryCount;
        debug(id, "failed and retry soon", err);
        if (retryDelay) await sleep(retryDelay);
        this.queue.enqueue(job, id, true);
      }
    } finally {
      this.running.delete(id);
      --this.numRunning;
      debug(id, "end and dispatching next");
      this.emit("done", id);
      this._kick();
    }
  }
}

module.exports = SBS;
