const Todo = require("../lib/db/todo");
const config = require('../config');

class TodoManager {
  constructor(sock) {
    this.sock = sock;
  }

  // Method untuk menambahkan tugas baru
  async addTodo(userId, task) {
    try {
      const status = "pending";
      const newTodo = new Todo({ userId, task, status });
      await newTodo.save();
      return `Tugas "${newTodo.task}" berhasil ditambahkan`;
    } catch (err) {
      console.error("Error menambahkan todo:", err);
      throw err;
    }
  }

  // Method untuk mendapatkan daftar tugas
  async getTodos(userId) {
    try {
      const todos = await Todo.find({ userId });
      return todos;
    } catch (err) {
      console.error("Error mendapatkan todos:", err);
      throw err;
    }
  }

  // Method untuk menampilkan daftar tugas
  async listTodos(userId) {
    const todos = await this.getTodos(userId);
    
    if (todos.length === 0) {
      return "Belum ada tugas yang terdaftar";
    }

    let text = "Daftar Tugas:\n";
    todos.forEach((todo, index) => {
      const emote = todo.status === "pending" ? '⏳' : '✅';
      text += `${index + 1}. ${todo.task} [${emote}]\n`;
    });
    
    return text;
  }

  // Method untuk menghapus tugas
  async removeTodo(userId, taskIndex) {
    try {
      const todos = await this.getTodos(userId);
      
      if (taskIndex >= todos.length || taskIndex < 0) {
        throw new Error("Nomor tugas tidak valid");
      }
      
      const taskId = todos[taskIndex]._id;
      await Todo.findOneAndDelete({ _id: taskId });
      
      return "Tugas berhasil dihapus";
    } catch (err) {
      console.error("Error menghapus todo:", err);
      throw err;
    }
  }

  // Method untuk mengupdate status tugas
  async updateTodo(userId, taskIndex, newStatus) {
    try {
      const todos = await this.getTodos(userId);
      
      if (taskIndex >= todos.length || taskIndex < 0) {
        throw new Error("Nomor tugas tidak valid");
      }
      
      const taskId = todos[taskIndex]._id;
      const updatedTodo = await Todo.findOneAndUpdate(
        { _id: taskId },
        { status: newStatus, updatedAt: new Date() },
        { new: true }
      );
      
      if (!updatedTodo) {
        throw new Error("Tugas tidak ditemukan");
      }
      
      return "Tugas berhasil diupdate";
    } catch (err) {
      console.error("Error update todo:", err);
      throw err;
    }
  }

  // Method untuk menangani berbagai perintah todo
  async handleCommand(userId, args) {
    if (!args[0]) {
      return await this.listTodos(userId);
    } else if (args[0] === "add") {
      if (!args[1]) {
        return "Masukkan tugas yang ingin ditambahkan";
      }
      const task = args.slice(1).join(" ");
      return await this.addTodo(userId, task);
    } else if (args[0] === "delete") {
      if (!args[1]) {
        return "Masukkan nomor tugas yang ingin dihapus";
      }
      const taskIndex = parseInt(args[1], 10) - 1;
      return await this.removeTodo(userId, taskIndex);
    } else if (args[0] === "update") {
      if (!args[1] || !args[2]) {
        return "Masukkan nomor tugas dan status baru (pending/completed)";
      }
      
      const taskIndex = parseInt(args[1], 10) - 1;
      const newStatus = args[2];
      
      if (!["pending", "completed"].includes(newStatus)) {
        return "Status tidak valid. Gunakan 'pending' atau 'completed'";
      }
      
      return await this.updateTodo(userId, taskIndex, newStatus);
    } else {
      return "Perintah ini belum terdaftar. Gunakan !todo <add|delete|update> [tugas]";
    }
  }

  // Method untuk mengirim pesan
  async sendMessage(userId, message) {
    this.sock.sendMessage(userId, { text: message });
  }
}

// Fungsi execute yang menggunakan class TodoManager
const execute = async (sock, msg, args) => {
  const userId = msg.key.remoteJid;
  const todoManager = new TodoManager(sock);

  try {
    const response = await todoManager.handleCommand(userId, args);
    todoManager.sendMessage(userId, response);
  } catch (error) {
    todoManager.sendMessage(userId, error.message);
  }
};

module.exports = {
  name: "Todo List",
  description: "Daftar tugas sederhana",
  command: `${config.prefix[1]}todo`,
  commandType: "Utility",
  isDependent: false,
  help: `Gunakan ${config.prefix[1]}todo <add|delete|update> [tugas]`,
  execute,
};