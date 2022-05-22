const fs = require('fs-extra');
const turbo = require('./http/index');
const process = require('process');
const port = +process.argv[2] || 3000;
const client = require('redis').createClient();

let START;
let END;
const cards = fs.readJsonSync('./cards.json').map((card) =>
    Buffer.from(`{"id": "${card.id}", "name": "${card.name}"}`)
);
const cardsDone = Buffer.from(`{"id": "ALL CARDS"}`);
const users = {};

const prepareServer = async () => {
    const cardsAssignmentCount = cards.length / 2;

    const servicesKey = 'SERVICES';
    const identifier = process.pid.toString();
    await client.RPUSH(servicesKey, identifier);
    const servicesList = await client.LRANGE(servicesKey, 0, -1);
    const index = servicesList.indexOf(identifier);

    console.log(`Process #${process.pid} was assigned to index #${index}`);
    if (index === 0) {
        END = cards.length;
        START = END - cardsAssignmentCount + 1;
    } else {
        END = cards.length - cardsAssignmentCount;
        START = END - cardsAssignmentCount + 1;
    }
}

const onRequest = async (req, res) => {
    let user = users[req.url] ++;
    if (user) {
        const card = user < END ? cards[user] : cardsDone
        res.setHeader('Content-Length', card.length)
        res.write(card)
    } else {
        users[req.url] = START;
        const card = cards[START - 1]
        res.setHeader('Content-Length', card.length)
        res.write(card)
    }
}

const onRedisReady = async () => {
    await prepareServer();
    const server = turbo.createServer(onRequest);
    server.listen(port);
}

const onRedisError = (error) => {
    console.log(`Process #${process.pid} Redis Client Error`, error);
}

client.on('error', onRedisError).on('ready', onRedisReady);
client.connect();
