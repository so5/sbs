const uuidv1 = require("uuid");

class FIFO {
  constructor() {
    this.queue = [];
  }
  enqueue(element, urgent, id) {
    if (id === undefined) id = uuidv1();
    if (urgent) {
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
    const target = this.queue.findIndex((e) => {
      return e.id === id;
    });
    if (target !== -1) {
      this.queue.splice(target, 1);
      return true;
    } else {
      return false;
    }
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
