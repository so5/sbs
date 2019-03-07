const uuidv1 = require("uuid");

class FIFO {
  constructor() {
    this.queue = [];
  }

  enqueue(element, urgent, id) {
    if (id === undefined) {
      id = uuidv1();
    }
    if (urgent) {
      this.queue.unshift({ id, e: element });
    } else {
      this.queue.push({ id, e: element });
    }
    return id;
  }

  dequeue() {
    const rt = this.queue.shift();
    return rt !== undefined ? [rt.e, rt.id] : [undefined, undefined];
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
}

module.exports = FIFO;
