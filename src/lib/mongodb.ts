// /src/lib/mongodb.ts - 确保连接正确
import mongoose from 'mongoose';

let isConnected = false;

export const connectToMongoDB = async () => {
  if (isConnected) {
    console.log('MongoDB 已连接');
    return true;
  }

  try {
    const MONGODB_URI =
      process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chat-app';
    console.log(`正在连接 MongoDB... URI: ${MONGODB_URI}`);

    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
    });

    isConnected = true;
    console.log(
      'MongoDB 连接成功，数据库:',
      mongoose.connection.db?.databaseName,
    );
    return true;
  } catch (error) {
    console.error('MongoDB 连接失败:', error);
    return false;
  }
};

// 检查当前连接状态
export const checkMongoDBConnection = () => {
  const states = ['断开', '已连接', '连接中', '断开中'];
  console.log(`MongoDB 连接状态: ${states[mongoose.connection.readyState]}`);
  return mongoose.connection.readyState === 1;
};
