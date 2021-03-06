const WebSocket = require('ws')
const urljoin = require('url-join')
const config = require('config')
const request = require('request')

let url = 'https://stats.tomochain.com/primus'
let ws = new WebSocket(url)
let blockNumber = 0
let chunk = {
    count: 0,
    timestamp: 0
}

ws.on('close', () => { 
    console.log('WS closed!')
    process.exit()
})

ws.on('open', function connection() {
    console.log('WS connected!')
    ws.ping()
})
ws.on('message', connection)
function connection(data) {
    let d = JSON.parse(data)
    if (d.action === 'block') {
        ws.ping()
        if (parseInt(d.data.block.number) > blockNumber) {
            chunk.count = chunk.count + d.data.block.transactions.length
            console.log(d.data.block.number, d.data.block.hash, chunk.count, d.data.block.timestamp, d.data.block.timestamp - chunk.timestamp)
            if ((d.data.block.timestamp - chunk.timestamp) > 60) {
                if (chunk.timestamp && chunk.count) {
                    console.log('Tps =', chunk.count / 60)
                    stats(chunk.count / 60).catch(e => console.log())
                }
                chunk.count = 0
                chunk.timestamp = d.data.block.timestamp
            }
            blockNumber = parseInt(d.data.block.number)
        }
    }
}

const stats = (value) => {
    return new Promise((resolve, reject) => {
        let url = urljoin(config.get('stats.uri'), 'write', '?db=tomochain')
        let username = process.env.STATS_USERNAME || config.get('stats.username')
        let password = process.env.STATS_PASSWORD || config.get('stats.password')
        let auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64')
        let data = `
            tps,env=mainnet value=${value}
            `
        let options = {
            method: 'POST',
            url: url,
            encoding: null,
            headers: {
                Authorization: auth
            },
            body: Buffer.from(data, 'utf-8')
        }
        request(options, (error, response, body) => {
            if (error) {
                return reject(error)
            }
            console.log(`Stats ${response.statusCode} tps,env=mainnet value=${value}`)
            if (response.statusCode !== 200 && response.statusCode !== 201 && response.statusCode !== 204) {
                return reject(error)
            }

            return resolve(body)
        })
    })
}
