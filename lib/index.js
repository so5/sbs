const { EventEmitter } = require("events");
const debug = require("debug")("sbs:sbs");
const queue = require("./fifo");

class SBS extends EventEmitter {
  constructor(opt = {}) {
    super();
    this.maxConcurrent =
      typeof opt.maxConcurrent === "number" && opt.maxConcurrent > 0 ? Math.floor(opt.maxConcurrent) : 1;
    this.exec = typeof opt.exec === "function" ? opt.exec : null;
    this.queue = new queue();
    this.numRunning = 0;
    if (!opt.noAutoStart){
      debug("auto start executing");
      this.once("go", this._executer);
    }
    this.failed={};
    this.running=new Set();
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
    if (typeof this.exec !== "function") {
      if (typeof job !== "function") {
        if (typeof job.exec !== "function") {
          debug("no function specified");
          return;
        }
      }
    }
    const id = this.queue.enqueue(job);
    debug("submit job", id);
    setImmediate(() => {
      this.emit("go");
    });
    return id;
  }
  qdel(id) {
    debug("delete job", id);
    this.queue.del(id);
  }
  qstat(id){
    if(typeof id !== 'string') return null;
    let state = 'finished';
    if(this.failed[id] !== undefined){
      state = 'failed';
    }else if(this.queue.has(id)){
      state = 'waiting';
    }else if(this.running.has(id)){
      state = 'running';
    }
    return state;
  }
  /**
   * wait until specified job(s) finish
   * @param {string | string[]} id - id string which returned from qsub or array of id
   * @param {number} interval - interval time of each status check (in milisecond)
   */
  qwait(id, interval){
    if(typeof inteval !== 'number') interval = 100;
    if(! Array.isArray(id)) id = [id];
    return new Promise((resolve, reject)=>{
      const timeout = setInterval(()=>{
        const isRunning = id.some((e)=>{
          const state = this.qstat(e);
          return state === 'waiting' || state === 'running'
        });
        if(!isRunning){
          clearInterval(timeout);
          resolve();
        }
      }, interval);
    });
  }
  start() {
    debug("start executing");
    this._executer();
  }
  stop() {
    debug("stop executing");
    this.removeListener("go", this._executer);
  }
  size(){
    return this.queue.size();
  }
  clear() {
    this.stop();
    this.queue.clear();
  }

  _parseJob(job){
    let exec = this.exec;
    let args = undefined;
    let retry = ()=>{return false};

    //determine executer
    if(job.hasOwnProperty('exec') && typeof job.exec === "function"){
      exec = job.exec;
    }else if(typeof job === "function"){
      exec = job;
    }else if(typeof this.exec === "function"){
      exec = this.exec;
      args = job; //if job has args property, it will be updated later
    }else{
      // never reach!!
      throw new Error('executer is not specified');
    }

    if(job.hasOwnProperty('args')){
      args = job.args;
    }

    //update retry flag
    if(job.hasOwnProperty('retry')) {
      retry = typeof job.retry === "function" ? job.retry : ()=>{return job.retry};
    }

    return [exec, args, retry];
  }

  async _executer() {
    // cancel execution at this time
    if(this.queue.size() <= 0){
      debug("queue is empty");
      this.once("go", this._executer);
      return
    }else if(this.numRunning >= this.maxConcurrent){
      debug("number of running job is exceeded max concurrent");
      this.once("go", this._executer);
      return
    }

    debug("execution start: ", this.numRunning, "/", this.queue.size(), "/", this.maxConcurrent);
    ++this.numRunning;

    const [e, id] = this.queue.dequeue();
    const [exec, args, retry] = this._parseJob(e);

    debug("accept next job");
    this.once("go", this._executer);
    setImmediate(() => {
      debug("call next");
      this.emit("go");
    });

    try{
      this.running.add(id);
      await exec(args);
    }catch(err){
      if(retry(err)){
        debug(id, 'failed and retry soon', err);
        this.queue.enqueue(e, id, true);
      }else{
        debug(id, 'failed:',err);
        this.failed[id] = err;
        this.emit("error", err, id);
      }
    }finally{
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
