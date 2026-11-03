import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const config = {
  port: parseInt(process.env.API_PORT || '4000', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev_jwt_super_secret_key_change_in_production',
  jwtExpiresIn: '15m',
  refreshSecret: process.env.REFRESH_SECRET || 'dev_refresh_super_secret_key_change_in_production',
  refreshExpiresIn: '7d',
  nodeEnv: process.env.NODE_ENV || 'development',
};

