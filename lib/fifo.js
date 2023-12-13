"use strict";
const { v1: uuidv1 } = require("uuid");

class FIFO {
  constructor() {
    this.queue = [];
  }

  enqueue(element, urgent, argId) {
    const id = typeof argId === "undefined" ? uuidv1() : argId;
    const payload = { id, e: element };
    if (urgent) {
      this.queue.unshift(payload);
    } else {
      this.queue.push(payload);
    }
    return id;
  }

  dequeue() {
    const rt = this.queue.shift();
    return typeof rt !== "undefined" ? [rt.e, rt.id] : [null, null];
  }

  del(id) {
    const target = this.queue.findIndex((e)=>{
      return e.id === id;
    });
    if (target !== -1) {
      this.queue.splice(target, 1);
      return true;
    }
    return false;
  }

  clear() {
    this.queue = [];
  }

  size() {
    return this.queue.length;
  }

  has(id) {
    return (
      this.queue.findIndex((e)=>{
        return e.id === id;
      }) !==
      -1
    );
  }

  getLastEntry() {
    if (this.size() === 0) {
      return null;
    }
    return this.queue[this.queue.length - 1].e;
  }

  getFirstEntry() {
    if (this.size() === 0) {
      return null;
    }
    return this.queue[0].e;
  }

  removeFromQueue(entries) {
    this.queue = this.queue.filter((e)=>{
      return entries.includes(e.e);
    });
  }
}

module.exports = FIFO;
