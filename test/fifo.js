const { expect } = require("chai");

const FIFO = require("../lib/fifo");

let q = null;

describe("test for FIFO class", function() {
  beforeEach(function() {
    q = new FIFO();
  });
  describe("#constructor", function() {
    it("should have empty queue", function() {
      expect(q.size()).to.equal(0);
    });
  });
  describe("#enqueue", function() {
    it("should increase number of queue", function() {
      const id1 = q.enqueue("a");
      expect(q.size()).to.equal(1);
      expect(id1).to.be.a("string");
      const id2 = q.enqueue("a");
      expect(q.size()).to.equal(2);
      expect(id2).to.be.a("string");
      const id3 = q.enqueue("a");
      expect(q.size()).to.equal(3);
      expect(id3).to.be.a("string");
      expect(id1).to.not.equal(id2);
      expect(id1).to.not.equal(id3);
      expect(id2).to.not.equal(id3);
    });
    it("should enqueue with specified id", function() {
      q.enqueue("a", false, 1);
      const [e, id] = q.dequeue();
      expect(e).to.equal("a");
      expect(id).to.equal(1);
    });
    it("should enqueue at the top", function() {
      q.enqueue("a");
      q.enqueue("b");
      q.enqueue("c");
      q.enqueue("d", true);
      const [e] = q.dequeue();
      expect(e).to.equal("d");
    });
  });
  describe("#dequeue", function() {
    it("should reduce number of queue", function() {
      q.enqueue("a");
      q.enqueue("b");
      q.enqueue("c");
      expect(q.size()).to.equal(3);
      let [e, id] = q.dequeue();
      expect(e).to.equal("a");
      expect(id).to.be.a("string");

      [e, id] = q.dequeue();
      expect(e).to.equal("b");
      expect(id).to.be.a("string");

      q.enqueue("d");

      [e, id] = q.dequeue();
      expect(e).to.equal("c");
      expect(id).to.be.a("string");

      [e, id] = q.dequeue();
      expect(e).to.equal("d");
      expect(id).to.be.a("string");

      [e, id] = q.dequeue();
      expect(e).to.be.an("undefined");
      expect(id).to.be.an("undefined");
    });
  });
  describe("#del", function() {
    it("should remove specific entry", function() {
      q.enqueue("a");
      const id = q.enqueue("b");
      q.enqueue("c");
      expect(q.size()).to.equal(3);
      q.del(id);
      expect(q.size()).to.equal(2);
      let [e] = q.dequeue();
      expect(e).to.equal("a");
      [e] = q.dequeue();
      expect(e).to.equal("c");
    });
  });
  describe("#clear", function() {
    it("should remove all entry", function() {
      q.enqueue("a");
      q.enqueue("b");
      q.enqueue("c");
      expect(q.size()).to.equal(3);
      q.clear();
      expect(q.size()).to.equal(0);
      const [e, id] = q.dequeue();
      expect(e).to.be.an("undefined");
      expect(id).to.be.an("undefined");
    });
  });
});
