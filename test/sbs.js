const chai = require("chai");
const { expect } = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const chaiAsPromised = require("chai-as-promised");

chai.use(sinonChai);
chai.use(chaiAsPromised);

const SBS = require("../lib/index");

/* eslint-disable-next-line no-console */
process.on("unhandledRejection", console.dir);
Error.stackTraceLimit = -1;

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
    it("should ignore not-number value for maxConcurrent", function() {
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
    it("should not execute anything if opt.noAutoStart is true", async function() {
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
    it("should accept just argument object if opt.exec is passed to constructor", async function() {
      batch.stub = stub;
      batch = new SBS({ exec: stub });
      const id1 = batch.qsub("foo");
      const id2 = batch.qsub({ args: "bar" });
      await batch.qwaitAll([id1, id2]);
      expect(stub).to.be.callCount(2);
      expect(stub.getCall(0)).to.be.calledWith("foo");
      expect(stub.getCall(1)).to.be.calledWith("bar");
    });
    it("should ignore non-function argument if opt.exec is not set", function() {
      batch.stop();
      batch.qsub("foo");
      batch.qsub({ args: "bar" });
      expect(batch.queue.size()).to.equal(0);
    });
  });
  describe("#qdel", function() {
    it("should delete job from queue", function() {
      const stub1 = sinon.stub();
      const stub2 = sinon.stub();
      batch.stop();
      const id = batch.qsub(stub1);
      batch.qsub(stub2);
      batch.qdel(id);
      batch.start();
      expect(stub1).to.be.not.called;
      expect(stub2).to.be.calledOnce;
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
  });
  describe("#qwaitAll", function() {
    it("should ignore non-number interval", async function() {
      const id = batch.qsub(stub);
      await batch.qwaitAll([id], "hoge");
      expect(batch.qstat(id)).to.equal("finished");
    });
    it("should just wait if job is waiting or running", async function() {
      const id1 = batch.qsub(() => {
        return sleep(500).then(stub);
      });
      const id2 = batch.qsub(() => {
        return sleep(500).then(stub);
      });
      await batch.qwaitAll([id1, id2], 10);
      expect(stub).to.be.callCount(2);
    });
    it("should rejected if one of jobs failed", function() {
      const id1 = batch.qsub(stub);
      const id2 = batch.qsub(stub.rejects());
      return expect(batch.qwaitAll([id1, id2], 10)).to.be.rejected;
    });
    it("should rejected if one of jobs failed", function() {
      const id1 = batch.qsub(stub);
      const id2 = batch.qsub(stub.throws());
      return expect(batch.qwaitAll([id1, id2], 10)).to.be.rejected;
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
    it("should get err object from failed job", function(done) {
      stub = stub.rejects("hoge");
      const id = batch.qsub(stub);
      const timeout = setInterval(() => {
        const state = batch.qstat(id);
        if (state === "finished" || state === "failed") {
          clearTimeout(timeout);
          expect(batch.getResult(id)).to.be.a("Error");
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
    it("should submit job and wait until it finished or failed", function() {
      stub.onCall(1).rejects();
      expect(batch.qsubAndWait(stub, 10)).to.eventually.equal("hoge");
      return expect(batch.qsubAndWait(stub, 10)).to.be.rejectedWith("Error");
    });
  });
  describe("retry functionality", function() {
    const stub2 = sinon.stub();
    beforeEach(function() {
      stub2.reset();
    });
    it("should not retry after exception occurred by default", async function() {
      stub2.onCall(0).throws();
      stub2.onCall(1).returns();
      const id = batch.qsub(() => {
        return stub2().then(stub);
      });
      await batch.qwait(id).catch(() => {});
      expect(stub).to.be.not.called;
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
      batch = new SBS({ retry: true });
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
      batch = new SBS({ retry: retry });
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
      batch = new SBS({ retry: false });
      const id = batch.qsub({ exec: exec });
      await batch.qwait(id).catch(() => {});
      expect(stub).to.be.callCount(0);
      expect(stub2).to.be.callCount(1);
    });
    it("should not retry if opt.retry() returns true", async function() {
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
});
