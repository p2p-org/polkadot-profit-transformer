const dotenv = require('dotenv');
const path = require('path');

dotenv.config({path: path.resolve(__dirname, '.env')});
/*
let envPath;

const NODE_ENV = process.env.NODE_ENV;
switch (NODE_ENV) {
    case 'production':
        envPath = path.resolve(__dirname, '.env.prod');
        break;
    default:
        envPath = path.resolve(__dirname, '.env.dev');
        break;
}

dotenv.config({path: envPath});
*/

const environment = {

    // Api
    API_PORT: process.env.API_PORT || 8080,

    // Polkadot
    SUBSTRATE_URI: process.env.SUBSTRATE_URI,

    // Kafka
    KAFKA_URI: process.env.KAFKA_URI,

    // Postgres
    DB_HOST: process.env.DB_HOST,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME,
    DB_PORT: process.env.DB_PORT
};

module.exports = environment;