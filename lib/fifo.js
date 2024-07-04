"use strict";
const { v1: uuidv1 } = require("uuid");

class FIFO {
  constructor () {
    this.queue = [];
    this.last = null;
  }

  enqueue (element, urgent, argId) {
    const id = argId || uuidv1();
    const payload = { id, e: element };
    if (urgent) {
      this.queue.unshift(payload);
    } else {
      this.queue.push(payload);
    }
    return id;
  }

  dequeue () {
    const rt = this.queue.shift();
    if (typeof rt === "undefined") {
      return [null, null];
    }
    this.last = rt.e;
    return [rt.e, rt.id];
  }

  del (id) {
    const target = this.queue.findIndex((e) => {
      return e.id === id;
    });
    if (target !== -1) {
      this.queue.splice(target, 1);
      return true;
    }
    return false;
  }

  clear () {
    this.queue = [];
  }

  size () {
    return this.queue.length;
  }

  has (id) {
    return (
      this.queue.findIndex((e) => {
        return e.id === id;
      }) !== -1
    );
  }

  getLastEntry (needLastExecuted) {
    if (this.size() === 0) {
      return needLastExecuted ? this.last : null;
    }
    return this.queue[this.queue.length - 1].e;
  }

  find (cb) {
    const result = this.queue.find((e) => {
      return cb(e.e);
    });
    return result ? result.e : null;
  }

  removeFromQueue (entries) {
    this.queue = this.queue.filter((e) => {
      return entries.includes(e.e);
    });
  }
}

module.exports = FIFO;
