const fs = require('fs-extra');
const turbo = require('./http/index');
const process = require('process');
const port = +process.argv[2] || 3000;
const client = require('redis').createClient();

const cards = fs.readJsonSync('./cards.json').map((card) =>
    Buffer.from(`{"id": "${card.id}", "name": "${card.name}"}`, 'ascii')
);

const cardsDone = Buffer.from('{"id":"ALL CARDS"}', 'ascii');
const users = {};
let START;
let END;

const wait = async (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

const prepareServer = async () => {
    const servicesKey = 'SERVICES';
    const identifier = process.pid.toString();
    await client.RPUSH(servicesKey, identifier);

    await wait(1000);
    const cardsCount = cards.length;
    const services = await client.LRANGE(servicesKey, 0, -1);
    const index = services.indexOf(identifier);

    const amount = Math.floor(cardsCount / services.length)
    const remainder = (cardsCount) % services.length
    const offset = remainder ? (remainder < index ? remainder : index) : 0
    const hasRemainder = remainder > index

    START = amount * index + offset
    END = amount * (index + 1) + (hasRemainder ? 1 : 0) + offset
    //
    // console.log(`
    //     Process #${process.pid}
    //     Index: ${index}
    //     Assignment: ${amount};
    //     Cards count: ${cardsCount};
    //     Remainder: ${remainder};
    //     Remainder offset: ${offset};
    //     Should add remainder: ${hasRemainder};
    //     Start ${START};
    //     End ${END}`
    // );
}
const onRequest = async (req, res) => {
    let user;
    if (users[req.url] === undefined) {
        user = users[req.url] = START;
    } else {
        user = ++users[req.url]
    }

    if (user < END) {
        const card = cards[user];
        res.setHeader('Content-Length', card.length)
        return res.write(card)
    }
    res.setHeader('Content-Length', cardsDone.length);
    return res.write(cardsDone);
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
