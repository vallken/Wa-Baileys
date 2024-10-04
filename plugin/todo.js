const Todo = require("../lib/db/todo");

const setTodo = async (userId, task, status) => {
  try {
    const todo = new Todo({ userId, task, status });
    await todo.save();
    return todo;
  } catch (err) {
    console.error("Error setting todo:", err);
    throw err;
  }
};

const getTodos = async (userId) => {
  try {
    const todos = await Todo.find({ userId });
    return todos;
  } catch (err) {
    console.error("Error getting todos:", err);
    throw err;
  }
};

const removeTodos = async (userId, taskIndex) => {
  try {
    const todos = await getTodos(userId);
    if (taskIndex >= todos.length || taskIndex < 0) {
      throw new Error("Nomor tugas tidak valid");
    }
    const taskId = todos[taskIndex]._id;
    await Todo.findOneAndDelete({ _id: taskId });
    return "Tugas berhasil dihapus";
  } catch (err) {
    console.error("Error removing todos:", err);
    throw err;
  }
};

const updateTodos = async (userId, taskIndex, newStatus) => {
  try {
    const todos = await getTodos(userId);
    if (taskIndex >= todos.length || taskIndex < 0) {
      throw new Error("Nomor tugas tidak valid");
    }
    const taskId = todos[taskIndex]._id;
    const updatedTodo = await Todo.findOneAndUpdate(
      { _id: taskId },
      { status: newStatus, updatedAt: new Date() },
      { new: true } // Option to return the updated document
    );
    if (!updatedTodo) {
      throw new Error("Tugas tidak ditemukan");
    }
    return "Tugas berhasil diupdate";
  } catch (err) {
    console.error("Error updating todos:", err);
    throw err;
  }
};

const execute = async (sock, msg, args) => {
  const userId = msg.key.remoteJid;
  if (!args[0]) {
    const todos = await getTodos(userId);
    if (todos.length === 0) {
      return sock.sendMessage(userId, {
        text: "Belum ada tugas yang terdaftar",
      });
    }
    let text = "Daftar Tugas:\n";
    todos.forEach((todo, index) => {
        const emote = todo.status === "pending" ? '⏳' : '✅'
        text += `${index + 1}. ${todo.task} [${emote}]\n`;
    });
    sock.sendMessage(userId, { text });
  } else if (args[0] === "add") {
    if (!args[1]) {
      return sock.sendMessage(userId, {
        text: "Masukkan tugas yang ingin ditambahkan",
      });
    }
    const task = args.slice(1).join(" ");
    const status = "pending";
    const newTodo = await setTodo(userId, task, status);
    sock.sendMessage(userId, {
      text: `Tugas "${newTodo.task}" berhasil ditambahkan`,
    });
  } else if (args[0] === "delete") {
    if (!args[1]) {
      return sock.sendMessage(userId, {
        text: "Masukkan nomor tugas yang ingin dihapus",
      });
    }
    const taskIndex = parseInt(args[1], 10) - 1;
    try {
      const response = await removeTodos(userId, taskIndex);
      sock.sendMessage(userId, { text: response });
    } catch (error) {
      sock.sendMessage(userId, { text: error.message });
    }
  } else if (args[0] === "update") {
    if (!args[1] || !args[2]) {
      return sock.sendMessage(userId, {
        text: "Masukkan nomor tugas dan status baru (pending/completed)",
      });
    }
    const taskIndex = parseInt(args[1], 10) - 1;
    const newStatus = args[2];
    if (!["pending", "completed"].includes(newStatus)) {
      return sock.sendMessage(userId, {
        text: "Status tidak valid. Gunakan 'pending' atau 'completed'",
      });
    }
    try {
      const response = await updateTodos(userId, taskIndex, newStatus);
      sock.sendMessage(userId, { text: response });
    } catch (error) {
      sock.sendMessage(userId, { text: error.message });
    }
  } else {
    return sock.sendMessage(userId, {
      text: "Perintah ini belum terdaftar. Gunakan!todo <add|delete> [tugas]",
    });
  }
};

module.exports = {
  name: "Todo List",
  description: "Daftar tugas sederhana",
  command: `${global.prefix[1]}todo`,
  commandType: "Utility",
  isDependent: false,
  help: `Gunakan ${global.prefix[1]}todo <add|delete|update> [tugas]`,
  execute,
};
