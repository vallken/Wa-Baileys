const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston that you want to link the colors 
winston.addColors(colors);

// Custom format function to handle JSON logs
const formatJson = winston.format((info) => {
  if (typeof info.message === 'string') {
    try {
      const jsonObj = JSON.parse(info.message);
      info.message = JSON.stringify(jsonObj, null, 2);
    } catch (e) {
      // If it's not valid JSON, leave the message as is
    }
  }
  return info;
});

// Define the format of the logs
const format = winston.format.combine(
  formatJson(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...rest } = info;
    let logMessage = `${timestamp} ${level}: ${message}`;
    
    // Add any additional properties
    if (Object.keys(rest).length > 0) {
      logMessage += `\nAdditional Info: ${JSON.stringify(rest, null, 2)}`;
    }
    
    return logMessage;
  }),
);

// Define which transports the logger must use
const transports = [
  // Console transport
  new winston.transports.Console(),
  
  // File transport for error logs
  new winston.transports.File({
    filename: path.join(__dirname, '../logs/error.log'),
    level: 'error',
    format: winston.format.combine(
      winston.format.uncolorize(),
      winston.format.json()
    )
  }),
];

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  levels,
  format,
  transports,
});

module.exports = logger;