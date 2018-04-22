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

    this.queue = new queue();
    this.numRunning = 0;
    if (!opt.noAutoStart) {
      debug("auto start executing");
      this.once("go", this._executer);
    }
    this.failed = {};
    this.running = new Set();
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
    if (this.failed.hasOwnProperty(id)) {
      state = "failed";
    } else if (this.queue.has(id)) {
      state = "waiting";
    } else if (this.running.has(id)) {
      state = "running";
    }
    return state;
  }

  /**
   * wait until specified job finish
   * @param {string} id - id string from qsub()
   * @param {number} interval - interval time of each status check (in milisecond)
   */
  qwait(id, interval = 1000) {
    if (typeof interval !== "number") interval = 1000;
    return new Promise((resolve, reject) => {
      const timeout = setInterval(() => {
        const state = this.qstat(id);
        if (state === "finished") {
          clearInterval(timeout);
          resolve();
        } else if (state === "failed") {
          clearInterval(timeout);
          reject(this.failed[id]);
        }
      }, interval);
    });
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
            reject(this.failed[id]);
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

    debug("accept next job");
    this.once("go", this._executer);
    setImmediate(() => {
      debug("call next");
      this.emit("go");
    });

    try {
      this.running.add(id);
      await exec(args);
    } catch (err) {
      if (retry(err)) {
        debug(id, "failed and retry soon", err);
        this.queue.enqueue(e, id, true);
      } else {
        debug(id, "failed:", err);
        this.failed[id] = err;
        this.emit("error", err, id);
      }
    } finally {
      this.running.delete(id);
      --this.numRunning;
      setImmediate(() => {
        this.emit("go");
      });
      debug(id, "end and call next");
    }
  }
}

module.exports = SBS;
