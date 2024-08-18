class MessageCollector {
    constructor(client, filter, time) {
        this.client = client;
        this.filter = filter;
        this.time = time;
        this.collected = [];
        this.listening = false;
        this.timeout = null;
        this.eventHandlers = {};
    }
  
    handleMessage(msg) {
        if (this.listening && this.filter(msg)) {
            this.collected.push(msg);
            this.triggerEvent('message', msg);
        }
    }
  
    stopCollecting() {
        this.listening = false;
        clearTimeout(this.timeout);
        this.client.removeListener('message', this.handleMessage.bind(this));
        this.triggerEvent('end', this.collected, 'manual');
    }
  
    startCollecting(chat, message) {
        this.listening = true;
        this.client.on('message', this.handleMessage.bind(this));
        chat.sendMessage(message).catch(console.error);
        this.timeout = setTimeout(this.stopCollecting.bind(this), this.time);
    }
  
    on(event, callback) {
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }
        this.eventHandlers[event].push(callback);
    }
  
    triggerEvent(event, ...args) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].forEach(callback => callback(...args));
        }
    }
  }


  module.exports = MessageCollector;