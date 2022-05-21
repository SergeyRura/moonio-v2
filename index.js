const fs = require('fs-extra');
const turbo = require('turbo-http')
const process = require('process')
const port = +process.argv[2] || 3000
const client = require('redis').createClient()

const ASSIGNED_CARDS_SETUP = {
    start: null, end: null,
}
const cards = fs.readJsonSync('./cards.json').map((card) =>
    Buffer.from(`{"id": "${card.id}", "name": "${card.name}"}`)
);
const cardsDone = Buffer.from(`{"id": "ALL CARDS"}`)
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
        ASSIGNED_CARDS_SETUP.end = cards.length - 1;
        ASSIGNED_CARDS_SETUP.start = ASSIGNED_CARDS_SETUP.end - cardsAssignmentCount;
    } else {
        ASSIGNED_CARDS_SETUP.end = cards.length - cardsAssignmentCount - 1;
        ASSIGNED_CARDS_SETUP.start = ASSIGNED_CARDS_SETUP.end - cardsAssignmentCount;
    }
}

const onRequest = async (req, res) => {
    res.statusCode = 200;
    let user = users[req.url]
    if (user) {
        res.end(getCard(req.url, user))
    } else {
        user = users[req.url] = {
            current: ASSIGNED_CARDS_SETUP.start,
            target: ASSIGNED_CARDS_SETUP.end
        }
        res.end(cards[user.current += 1])
    }
}

const onRedisReady = async () => {
    await prepareServer();
    const server = turbo.createServer(onRequest)
    server.listen(port)
}

const onRedisError = (error) => {
    console.log(`Process #${process.pid} Redis Client Error`, error);
}

const getCard = (user_id, user) => {
    if (user.current < user.target) {
        return cards[user.current += 1];
    } else {
        return cardsDone
    }
}

client.on('error', onRedisError).on('ready', onRedisReady);
client.connect();
