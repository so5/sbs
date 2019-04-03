"use strict";
const { expect } = require("chai");

const FIFO = require("../lib/fifo");

let q = null;

describe("test for FIFO class", ()=>{
  beforeEach(()=>{
    q = new FIFO();
  });
  describe("#constructor", ()=>{
    it("should have empty queue", ()=>{
      expect(q.size()).to.equal(0);
    });
  });
  describe("#enqueue", ()=>{
    it("should increase number of queue", ()=>{
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
    it("should enqueue with specified id", ()=>{
      q.enqueue("a", false, 1);
      const [e, id] = q.dequeue();
      expect(e).to.equal("a");
      expect(id).to.equal(1);
    });
    it("should enqueue at the top", ()=>{
      q.enqueue("a");
      q.enqueue("b");
      q.enqueue("c");
      q.enqueue("d", true);
      const [e] = q.dequeue();
      expect(e).to.equal("d");
    });
  });
  describe("#dequeue", ()=>{
    it("should reduce number of queue", ()=>{
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
      expect(e).to.be.null;
      expect(id).to.be.null;
    });
  });
  describe("#del", ()=>{
    it("should remove specific entry", ()=>{
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
  describe("#clear", ()=>{
    it("should remove all entry", ()=>{
      q.enqueue("a");
      q.enqueue("b");
      q.enqueue("c");
      expect(q.size()).to.equal(3);
      q.clear();
      expect(q.size()).to.equal(0);
      const [e, id] = q.dequeue();
      expect(e).to.be.null;
      expect(id).to.be.null;
    });
  });
});
