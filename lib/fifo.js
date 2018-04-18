const uuidv1 = require("uuid");

class FIFO {
  constructor() {
    this.queue = [];
  }
  enqueue(element, id, escalation = false) {
    if (id === undefined) id = uuidv1();
    if (escalation) {
      this.queue.unshift({ id: id, e: element });
    } else {
      this.queue.push({ id: id, e: element });
    }
    return id;
  }
  dequeue() {
    const rt = this.queue.shift();
    return rt !== undefined ? [rt.e, rt.id] : [undefined, undefined];
  }
  del(id) {
    this.queue = this.queue.filter((e) => {
      return e.id !== id;
    });
  }
  clear() {
    this.queue = [];
  }
  size() {
    return this.queue.length;
  }
  has(id) {
    return (
      -1 !==
      this.queue.findIndex((e) => {
        return e.id === id;
      })
    );
  }
}

module.exports = FIFO;
