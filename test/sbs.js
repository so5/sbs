const chai = require("chai");
const { expect } = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");

chai.use(sinonChai);

const SBS = require("../lib/index");

/* eslint-disable-next-line no-console */
process.on("unhandledRejection", console.dir);

async function sleep(time) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, time);
  });
}

describe("test for SimpleBatchSystem", function() {
  let batch;
  let stub;
  beforeEach(function() {
    batch = new SBS();
    stub = sinon.stub().resolves("hoge");
  });
  afterEach(function() {
    stub.reset();
  });
  describe("#constructor", function() {
    it("should create with default value", function() {
      expect(batch.maxConcurrent).to.equal(1);
      expect(batch.exec).to.equal(null);
    });
    it("should ignore non-number value or less or equal 0 for maxConcurrent", function() {
      batch = new SBS({ maxConcurrent: "hoge" });
      expect(batch.maxConcurrent).to.equal(1);
      batch = new SBS({ maxConcurrent: NaN });
      expect(batch.maxConcurrent).to.equal(1);
      batch = new SBS({ maxConcurrent: {} });
      expect(batch.maxConcurrent).to.equal(1);
      batch = new SBS({ maxConcurrent: stub });
      expect(batch.maxConcurrent).to.equal(1);
      batch = new SBS({ maxConcurrent: false });
      expect(batch.maxConcurrent).to.equal(1);
      batch = new SBS({ maxConcurrent: -13 });
      expect(batch.maxConcurrent).to.equal(1);
      batch = new SBS({ maxConcurrent: 0 });
      expect(batch.maxConcurrent).to.equal(1);
    });
    it("should set maxConcurrent by option object", function() {
      batch = new SBS({ maxConcurrent: 10.3 });
      expect(batch.maxConcurrent).to.equal(10);
      batch = new SBS({ maxConcurrent: 21 });
      expect(batch.maxConcurrent).to.equal(21);
    });
    it("should ignore non-number value or less or equal 0 for maxRetry", function() {
      batch = new SBS({ maxRetry: "hoge" });
      expect(batch.maxRetry).to.be.a("null");
      batch = new SBS({ maxRetry: NaN });
      expect(batch.maxRetry).to.be.a("null");
      batch = new SBS({ maxRetry: {} });
      expect(batch.maxRetry).to.be.a("null");
      batch = new SBS({ maxRetry: stub });
      expect(batch.maxRetry).to.be.a("null");
      batch = new SBS({ maxRetry: false });
      expect(batch.maxRetry).to.be.a("null");
      batch = new SBS({ maxRetry: -13 });
      expect(batch.maxRetry).to.be.a("null");
      batch = new SBS({ maxRetry: 0 });
      expect(batch.maxRetry).to.be.a("null");
    });
    it("should set maxRetry by option object", function() {
      batch = new SBS({ maxRetry: 10.3 });
      expect(batch.maxRetry).to.equal(10);
      batch = new SBS({ maxRetry: 21 });
      expect(batch.maxRetry).to.equal(21);
    });
    it("should ignore non-number value or less than 0 for retryDelay", function() {
      batch = new SBS({ retryDelay: "hoge" });
      expect(batch.retryDelay).to.equal(0);
      batch = new SBS({ retryDelay: NaN });
      expect(batch.retryDelay).to.equal(0);
      batch = new SBS({ retryDelay: {} });
      expect(batch.retryDelay).to.equal(0);
      batch = new SBS({ retryDelay: stub });
      expect(batch.retryDelay).to.equal(0);
      batch = new SBS({ retryDelay: false });
      expect(batch.retryDelay).to.equal(0);
      batch = new SBS({ retryDelay: -13 });
      expect(batch.retryDelay).to.equal(0);
    });
    it("should set integer number retryDelay by option object", function() {
      batch = new SBS({ retryDelay: 10.3 });
      expect(batch.retryDelay).to.equal(10);
      batch = new SBS({ retryDelay: 21 });
      expect(batch.retryDelay).to.equal(21);
    });
    it("should ignore non-number value or less than 0 for interval", function() {
      batch = new SBS({ interval: "hoge" });
      expect(batch.interval).to.equal(0);
      batch = new SBS({ interval: NaN });
      expect(batch.interval).to.equal(0);
      batch = new SBS({ interval: {} });
      expect(batch.interval).to.equal(0);
      batch = new SBS({ interval: stub });
      expect(batch.interval).to.equal(0);
      batch = new SBS({ interval: false });
      expect(batch.interval).to.equal(0);
      batch = new SBS({ interval: -13 });
      expect(batch.interval).to.equal(0);
    });
    it("should set integer number interval by option object", function() {
      batch = new SBS({ interval: 10.3 });
      expect(batch.interval).to.equal(10);
      batch = new SBS({ interval: 21 });
      expect(batch.interval).to.equal(21);
    });
    it("should ignore non-function value for exec", function() {
      batch = new SBS({ exec: "hoge" });
      expect(batch.exec).to.be.a("null");
      batch = new SBS({ exec: NaN });
      expect(batch.exec).to.be.a("null");
      batch = new SBS({ exec: false });
      expect(batch.exec).to.be.a("null");
      batch = new SBS({ exec: -13 });
      expect(batch.exec).to.be.a("null");
      batch = new SBS({ exec: 0 });
      expect(batch.exec).to.be.a("null");
      batch = new SBS({ exec: {} });
      expect(batch.exec).to.be.a("null");
    });
    it("should set function for exec", function() {
      batch = new SBS({ exec: stub });
      batch.exec();
      expect(stub).to.be.calledOnce;
    });
    it("should set label for logging", function() {
      batch = new SBS({ name: "hoge" });
      expect(batch.name).to.equal("hoge");
    });
    it("should not execute anything until start() called with noAutoStart=true", async function() {
      batch = new SBS({ noAutoStart: true });
      const id = batch.qsub(stub);
      expect(batch.qstat(id)).to.equal("waiting");
      batch.start();
      await batch.qwait(id);
      expect(stub).to.be.calledOnce;
    });
  });
  describe("#qsub", function() {
    it("should accept function", async function() {
      const id = batch.qsub(stub);
      await batch.qwait(id);
      expect(stub).to.be.calledOnce;
    });
    it("should accept object with exec and args property", async function() {
      const id = batch.qsub({ exec: stub, args: "huga" });
      await batch.qwait(id);
      expect(stub).to.be.calledWith("huga");
    });
    it("should accept object with name property", async function() {
      const id = batch.qsub({ exec: stub, args: "huga", name: "piyo" });
      await batch.qwait(id);
      expect(stub).to.be.calledWith("huga");
    });
    it("should accept just argument object if default executer is set", async function() {
      batch.exec = stub;
      const id = batch.qsub("foo");
      await batch.qwait(id);
      expect(stub).to.be.callCount(1);
      expect(stub.getCall(0)).to.be.calledWith("foo");
    });
    it("should accept object which only has argument property if default executer is set", async function() {
      batch.exec = stub;
      const id = batch.qsub({ args: "bar" });
      await batch.qwait(id);
      expect(stub).to.be.callCount(1);
      expect(stub.getCall(0)).to.be.calledWith("bar");
    });
    it("should ignore non-function argument if default executer is not set", function() {
      batch.stop();
      expect(batch.qsub("foo")).to.be.a("null");
      expect(batch.qsub({ args: "bar" })).to.be.a("null");
      expect(batch.queue.size()).to.equal(0);
    });
    it("should ignore non-function job.exec", function() {
      batch.stop();
      batch.exec = stub;
      expect(batch.qsub({ exec: "bar" })).to.be.a("null");
      expect(batch.qsub({ exec: true })).to.be.a("null");
      expect(batch.qsub({ exec: 42 })).to.be.a("null");
      expect(batch.qsub({ exec: {} })).to.be.a("null");
      expect(batch.queue.size()).to.equal(0);
    });
  });
  describe("#qdel", function() {
    it("should delete job from queue", async function() {
      const stub1 = sinon.stub();
      const stub2 = sinon.stub();
      batch.stop();
      const id1 = batch.qsub(stub1);
      const id2 = batch.qsub(stub2);
      expect(batch.qdel(id1)).to.be.true;
      batch.start();
      await batch.qwait(id2);
      expect(stub1).to.be.not.called;
      expect(stub2).to.be.calledOnce;
    });
    it("should return false if id is not exist", function() {
      let id = batch.qsub(stub);
      id = id + "hoge";
      expect(batch.qdel(id)).to.be.false;
    });
  });
  describe("#qstat", function() {
    it("should return running for running job", async function() {
      const id = batch.qsub(() => {
        return sleep(1000).then(stub);
      });
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(batch.qstat(id)).to.equal("running");
          resolve();
        }, 400);
      });
    });
    it("should return waiting for waiting job", function() {
      batch.qsub(() => {
        return sleep(1500).then(stub);
      });
      const id = batch.qsub(() => {
        return sleep(1500).then(stub);
      });
      expect(batch.qstat(id)).to.equal("waiting");
    });
    it("should return failed for failed job", async function() {
      stub.onCall(0).rejects();
      stub.onCall(1).throws();
      const id1 = batch.qsub(stub);
      const id2 = batch.qsub(stub);
      try {
        await batch.qwait(id1);
      } catch (e) {
        // just ignore
      }
      try {
        await batch.qwait(id2);
      } catch (e) {
        // just ignore
      }
      expect(batch.qstat(id1)).to.equal("failed");
      expect(batch.qstat(id2)).to.equal("failed");
    });
    it("should return finished for finished job", async function() {
      const id = batch.qsub(stub);
      await batch.qwait(id);
      expect(batch.qstat(id)).to.equal("finished");
    });
    it("should return removed for non-existing job", function() {
      expect(batch.qstat("hoge")).to.equal("removed");
    });
    it("should return null if non-string argument is passed", function() {
      expect(batch.qstat(() => {})).to.be.a("null");
      expect(batch.qstat(1)).to.be.a("null");
      expect(batch.qstat([])).to.be.a("null");
      expect(batch.qstat({})).to.be.a("null");
      expect(batch.qstat(true)).to.be.a("null");
    });
  });
  describe("#qwait", function() {
    it("should just wait if job is not started", async function() {
      batch.qsub(() => {
        return sleep(500).then(stub);
      });
      const id2 = batch.qsub(stub);
      await batch.qwait(id2);
      expect(stub).to.be.callCount(2);
    });
    it("should just wait if job is running", async function() {
      const id1 = batch.qsub(() => {
        return sleep(500).then(stub);
      });
      const id2 = batch.qsub(stub);
      await batch.qwait(id1);
      expect(stub).to.be.callCount(1);
      await batch.qwait(id2);
      expect(stub).to.be.callCount(2);
    });
    it("should return result if job is already finished", async function() {
      const id = batch.qsub(stub.resolves("huga"));
      await sleep(100);
      const result = await batch.qwait(id);
      expect(stub).to.be.callCount(1);
      expect(result).to.be.equal("huga");
    });
    it("should return error if job is already failed", async function() {
      const id = batch.qsub(stub.throws("huga"));
      await sleep(100);
      try {
        await batch.qwait(id);
      } catch (result) {
        expect(stub).to.be.callCount(1);
        expect(result).to.be.a("error");
      }
    });
    it("should return error if job is already failed", async function() {
      const id = batch.qsub(stub.rejects("huga"));
      await sleep(100);
      try {
        await batch.qwait(id);
      } catch (result) {
        expect(stub).to.be.callCount(1);
        expect(result).to.be.a("error");
      }
    });
    it("should return 'removed' if job is already removed", async function() {
      const id = batch.qsub(stub);
      batch.qdel(id);
      expect(await batch.qwait(id)).to.equal("removed");
    });
    it("should return 'removed' if job is deleted while waiting", async function() {
      const id = batch.qsub(stub);
      const p = batch.qwait(id);
      batch.qdel(id);
      expect(await p).to.equal("removed");
    });
    it("should return each promise for multi call", async function() {
      batch.qsub(() => {
        return sleep(500).then(stub);
      });
      const id2 = batch.qsub(stub);
      const p1 = batch.qwait(id2);
      const p2 = batch.qwait(id2);
      const rt = await Promise.all([p1, p2]);
      expect(stub).to.be.callCount(2);
      expect(rt).to.have.members(["hoge", "hoge"]);
    });
  });
  describe("#qwaitAll", function() {
    it("should just wait if job is waiting or running", async function() {
      const id1 = batch.qsub(() => {
        return sleep(500).then(stub);
      });
      const id2 = batch.qsub(() => {
        return sleep(500).then(stub);
      });
      await batch.qwaitAll([id1, id2]);
      expect(stub).to.be.callCount(2);
    });
    it("should rejected if one of jobs rejected", async function() {
      stub.onCall(1).rejects(new Error("huga"));
      const id1 = batch.qsub(stub);
      const id2 = batch.qsub(stub);
      try {
        await batch.qwaitAll([id1, id2]);
        expect.fail();
      } catch (e) {
        expect(e).to.be.an("error");
        expect(e.message).to.equal("huga");
      }
    });
    it("should rejected if one of jobs throws", async function() {
      stub.onCall(1).throws(new Error("huga"));
      const id1 = batch.qsub(stub);
      const id2 = batch.qsub(stub);
      try {
        await batch.qwaitAll([id1, id2]);
        expect.fail();
      } catch (e) {
        expect(e).to.be.an("error");
        expect(e.message).to.equal("huga");
      }
    });
  });
  describe("#getResult", function() {
    it("should get resolved value from finished job", function(done) {
      const id = batch.qsub(stub);
      const timeout = setInterval(() => {
        const state = batch.qstat(id);
        if (state === "finished" || state === "failed") {
          clearTimeout(timeout);
          expect(batch.getResult(id)).to.equal("hoge");
          expect(batch.getResult(id)).to.equal(null);
          done();
        }
      }, 100);
    });
    it("should get resolved value from finished job and keep it with opt.noAutoclear", function(done) {
      batch.noAutoClear = true;
      const id = batch.qsub(stub);
      const timeout = setInterval(() => {
        const state = batch.qstat(id);
        if (state === "finished" || state === "failed") {
          clearTimeout(timeout);
          expect(batch.getResult(id)).to.equal("hoge");
          expect(batch.getResult(id)).to.equal("hoge");
          done();
        }
      }, 100);
    });
    it("should get resolved value from finished job and keep it if keep argument is true", function(done) {
      const id = batch.qsub(stub);
      const timeout = setInterval(() => {
        const state = batch.qstat(id);
        if (state === "finished" || state === "failed") {
          clearTimeout(timeout);
          expect(batch.getResult(id, true)).to.equal("hoge");
          expect(batch.getResult(id)).to.equal("hoge");
          done();
        }
      }, 100);
    });
    it("should get err object from failed job", function(done) {
      stub.rejects(new Error("huga"));
      const id = batch.qsub(stub);
      const timeout = setInterval(() => {
        const state = batch.qstat(id);
        if (state === "finished" || state === "failed") {
          clearTimeout(timeout);
          const e = batch.getResult(id);
          expect(e).to.be.a("Error");
          expect(e.message).to.equal("huga");
          expect(batch.getResult(id)).to.equal(null);
          done();
        }
      }, 100);
    });
    it("should get err object from failed job and keep it with opt.noAutoclear", function(done) {
      stub = stub.rejects("hoge");
      batch.noAutoClear = true;
      const id = batch.qsub(stub);
      const timeout = setInterval(() => {
        const state = batch.qstat(id);
        if (state === "finished" || state === "failed") {
          clearTimeout(timeout);
          expect(batch.getResult(id)).to.be.an("Error");
          expect(batch.getResult(id)).to.be.an("Error");
          done();
        }
      }, 100);
    });
    it("should get err object from failed job and keep it if keep argument is true", function(done) {
      stub = stub.rejects("hoge");
      const id = batch.qsub(stub);
      const timeout = setInterval(() => {
        const state = batch.qstat(id);
        if (state === "finished" || state === "failed") {
          clearTimeout(timeout);
          expect(batch.getResult(id, true)).to.be.an("Error");
          expect(batch.getResult(id, true)).to.be.an("Error");
          done();
        }
      }, 100);
    });
    it("should get undefined from running or waiting job", function() {
      const id = batch.qsub(stub);
      expect(batch.getResult(id)).to.be.an("undefined");
    });
  });
  describe("#clear", function() {
    it("should stop execution and clear all waiting job", async function() {
      const id1 = batch.qsub(() => {
        return sleep(1000).then(stub);
      });
      const id2 = batch.qsub(() => {
        return sleep(1000).then(stub);
      });
      const id3 = batch.qsub(() => {
        return sleep(1000).then(stub);
      });
      expect(batch.size()).to.equal(3);
      batch.clear();
      expect(batch.size()).to.equal(0);
      await batch.qwaitAll([id1, id2, id3]);
      expect(stub).to.be.not.called;
    });
    it("should resolve waiting promise if job is already removed", async function() {
      const id1 = batch.qsub(() => {
        return sleep(1000).then(stub);
      });
      const id2 = batch.qsub(stub);
      const p1 = batch.qwait(id1);
      const p2 = batch.qwait(id2);
      const timeout = setInterval(async () => {
        const stat = batch.qstat(id1);
        if (stat === "running") {
          batch.clear();
          clearInterval(timeout);
          expect(await p1).to.equal("hoge");
          expect(await p2).to.equal("removed");
        }
      });
    });
  });
  describe("#clearResults", function() {
    it("should clear finished and failed jobs", async function() {
      stub.onCall(0).rejects();
      stub.onCall(1).resolves();
      const id1 = batch.qsub(stub);
      const id2 = batch.qsub(stub);
      const id3 = batch.qsub(stub);
      await batch.qwait(id3);
      batch.clearResults();
      expect(batch.getResult(id1)).to.equal(null);
      expect(batch.getResult(id2)).to.equal(null);
    });
  });
  describe("#qsubAndWait", function() {
    it("should submit job and wait until it finished or failed", async function() {
      stub.onCall(1).rejects();
      expect(await batch.qsubAndWait(stub)).to.equal("hoge");
      try {
        await batch.qsubAndWait(stub);
      } catch (e) {
        expect(e).to.be.an("error");
        expect(e.message).to.equal("Error");
      }
    });
    it("should rejected if job is illegal", async function() {
      try {
        await batch.qsubAndWait("hoge");
      } catch (e) {
        expect(e).to.be.a("error");
        expect(e.message).to.equal("job submit failed");
      }
    });
  });
  describe("#getRunning", function() {
    it("should return array of running job id", async function() {
      batch.maxConcurrent = 3;
      const id1 = batch.qsub(sleep.bind(null, 1500));
      const id2 = batch.qsub(sleep.bind(null, 1500));
      const id3 = batch.qsub(sleep.bind(null, 1500));
      await sleep(1000);
      expect(batch.getRunning()).to.have.members([id1, id2, id3]);
    });
  });
  describe("#start", function() {
    it("should do nothing if start called while queue is already running", async function() {
      batch.start();
      expect(await batch.qsubAndWait(stub)).to.equal("hoge");
    });
    it("should do nothing if stop called when queue is already stopped", async function() {
      batch.stop();
      batch.stop();
      const p = batch.qsubAndWait(stub);
      batch.start();
      expect(await p).to.equal("hoge");
    });
  });
  describe("retry functionality", function() {
    const stub2 = sinon.stub();
    beforeEach(function() {
      stub2.reset();
    });
    it("should not retry after exception occurred by default", async function() {
      stub2.onCall(0).throws(new Error("hoge"));
      stub2.onCall(1).returns();
      const id = batch.qsub(() => {
        return stub2().then(stub);
      });
      try {
        await batch.qwait(id);
      } catch (e) {
        expect(e.message).to.equal("hoge");
        expect(stub).to.be.not.called;
      }
    });
    it("should not retry after rejected by default", async function() {
      stub2.onCall(0).rejects();
      stub2.onCall(1).returns();
      const id = batch.qsub(() => {
        return stub2().then(stub);
      });
      await batch.qwait(id).catch(() => {});
      expect(stub).to.be.not.called;
    });
    it("should retry if retry = true", async function() {
      stub2.onCall(0).throws();
      stub2.onCall(1).rejects(new Error());
      stub2.onCall(2).resolves("hoge");
      const exec = () => {
        return stub2().then(stub);
      };
      const id = batch.qsub({ exec: exec, retry: true });
      await batch.qwait(id);
      expect(stub).to.be.callCount(1);
      expect(stub2).to.be.callCount(3);
    });
    it("should retry if retry() returns true", async function() {
      stub2.onCall(0).throws();
      stub2.onCall(1).rejects(new Error());
      stub2.onCall(2).resolves("hoge");
      const exec = () => {
        return stub2().then(stub);
      };
      const retry = (err) => {
        return err instanceof Error;
      };
      const id = batch.qsub({
        exec: exec,
        retry: retry
      });
      await batch.qwait(id);
      expect(stub).to.be.callCount(1);
      expect(stub2).to.be.callCount(3);
    });
    it("should retry if opt.retry = true", async function() {
      stub2.onCall(0).throws();
      stub2.onCall(1).rejects(new Error());
      stub2.onCall(2).resolves("hoge");
      const exec = () => {
        return stub2().then(stub);
      };
      batch.retry = true;
      const id = batch.qsub({ exec: exec });
      await batch.qwait(id);
      expect(stub).to.be.callCount(1);
      expect(stub2).to.be.callCount(3);
    });
    it("should retry if opt.retry() returns true", async function() {
      stub2.onCall(0).throws();
      stub2.onCall(1).rejects(new Error());
      stub2.onCall(2).resolves("hoge");
      const exec = () => {
        return stub2().then(stub);
      };
      const retry = (err) => {
        return err instanceof Error;
      };
      batch = new SBS({ retry: true });
      const id = batch.qsub({
        exec: exec,
        retry: retry
      });
      await batch.qwait(id);
      expect(stub).to.be.callCount(1);
      expect(stub2).to.be.callCount(3);
    });

    it("should not retry if retry = false", async function() {
      stub2.onCall(0).throws();
      stub2.onCall(1).rejects(new Error());
      stub2.onCall(2).resolves("hoge");
      const exec = () => {
        return stub2().then(stub);
      };
      const id = batch.qsub({ exec: exec, retry: false });
      await batch.qwait(id).catch(() => {});
      expect(stub).to.be.callCount(0);
      expect(stub2).to.be.callCount(1);
    });
    it("should not retry if retry() returns true", async function() {
      stub2.onCall(0).throws();
      stub2.onCall(1).rejects(new Error());
      stub2.onCall(2).resolves("hoge");
      const exec = () => {
        return stub2().then(stub);
      };
      const retry = () => {
        return false;
      };
      batch = new SBS({ retry: retry });
      const id = batch.qsub({
        exec: exec,
        retry: retry
      });
      await batch.qwait(id).catch(() => {});
      expect(stub).to.be.callCount(0);
      expect(stub2).to.be.callCount(1);
    });
    it("should not retry if opt.retry = false", async function() {
      stub2.onCall(0).throws();
      stub2.onCall(1).rejects(new Error());
      stub2.onCall(2).resolves("hoge");
      const exec = () => {
        return stub2().then(stub);
      };
      batch.retry = false;
      const id = batch.qsub({ exec: exec });
      await batch.qwait(id).catch(() => {});
      expect(stub).to.be.callCount(0);
      expect(stub2).to.be.callCount(1);
    });
    it("should not retry if opt.retry() returns false", async function() {
      stub2.onCall(0).throws();
      stub2.onCall(1).rejects(new Error());
      stub2.onCall(2).resolves("hoge");
      const exec = () => {
        return stub2().then(stub);
      };
      const retry = () => {
        return false;
      };
      batch.retry = retry;
      const id = batch.qsub({ exec: exec });
      await batch.qwait(id).catch(() => {});
      expect(stub).to.be.callCount(0);
      expect(stub2).to.be.callCount(1);
    });
    it("should not retry if maxRetry exceeded", async function() {
      batch.maxRetry = 3;
      batch.retry = true;
      stub2.onCall(0).throws();
      stub2.onCall(1).rejects();
      stub2.onCall(2).rejects();
      stub2.onCall(3).rejects(new Error("huga"));
      stub2.onCall(4).rejects(new Error("hoge"));
      const id = batch.qsub(async () => {
        await stub2();
        return stub();
      });
      try {
        await batch.qwait(id);
      } catch (e) {
        expect(e).to.be.an("error");
        expect(e.message).to.equal("huga");
      }
      expect(stub).to.be.callCount(0);
      expect(stub2).to.be.callCount(4);
    });
    it("should retry with delay", async function() {
      stub2.onCall(0).throws();
      stub2.onCall(1).resolves();
      const id = batch.qsub({ exec: stub2, retryDelay: 1000, retry: true });
      batch.qsub(stub);
      await batch.qwait(id).catch(() => {});
      expect(stub).to.be.callCount(0);
      expect(stub2).to.be.callCount(2);
    });
    it("should retry later if retryLater is true", async function() {
      batch.retryLater = true;
      stub2.onCall(0).throws();
      stub2.onCall(1).resolves();
      const id = batch.qsub({ exec: stub2, retryDelay: 1000, retry: true });
      batch.qsub(stub);
      await batch.qwait(id);
      expect(stub).to.be.callCount(1);
      expect(stub2).to.be.callCount(2);
    });
    it("should retry later if job.retryLater is true", async function() {
      stub2.onCall(0).throws();
      stub2.onCall(1).resolves();
      const id = batch.qsub({ exec: stub2, retryDelay: 1000, retry: true, retryLater: true });
      batch.qsub(stub);
      await batch.qwait(id);
      expect(stub).to.be.callCount(1);
      expect(stub2).to.be.callCount(2);
    });
  });
  describe("parallel execution", function() {
    it("should execute up to 3 parallel", async function() {
      this.timeout(3000);
      batch.maxConcurrent = 3;
      batch.qsub(() => {
        return sleep(1000).then(stub);
      });
      batch.qsub(() => {
        return sleep(1000).then(stub);
      });
      batch.qsub(() => {
        return sleep(1000).then(stub);
      });
      batch.qsub(() => {
        return sleep(1000).then(stub);
      });
      batch.qsub(() => {
        return sleep(1000).then(stub);
      });
      batch.qsub(() => {
        return sleep(1000).then(stub);
      });
      expect(batch.size()).to.equal(6);
      setTimeout(() => {
        batch.stop();
      }, 500);
      setTimeout(() => {
        expect(stub).to.be.callCount(3);
        return Promise.resolve();
      }, 1500);
    });
    it("should execute in order of submitted", async function() {
      const id = [];
      id.push(
        batch.qsub(async () => {
          await sleep(100);
          await stub("foo");
        })
      );
      id.push(
        batch.qsub(async () => {
          await sleep(10);
          await stub("bar");
        })
      );
      id.push(
        batch.qsub(async () => {
          await stub("baz");
        })
      );
      await batch.qwaitAll(id);
      expect(stub.getCall(0)).to.be.calledWith("foo");
      expect(stub.getCall(1)).to.be.calledWith("bar");
      expect(stub.getCall(2)).to.be.calledWith("baz");
    });
  });
  describe.skip("job name feature(plese set DEBUG environment variable)", function() {
    it("should log with job's name", async function() {
      stub.onCall(0).throws();
      stub.onCall(1).rejects(new Error());
      stub.onCall(2).resolves("hoge");
      batch.retry = true;
      batch.name = "BATCH NAME";
      const id = batch.qsub({ exec: stub, name: "JOB NAME" });
      await batch.qwait(id);
      expect(stub).to.be.callCount(3);
    });
  });
});
