const https = require('https')
//const http = require('http');
const Koa = require('koa');
const { default: koaBody } = require('koa-body');
const fs = require('fs');
const path = require('path');
const Router = require('koa-router');
const WS = require('ws');
const url = require('url');

const app = new Koa();

const users = new Set();
const clients = {};
const messages =[];

app.use(koaBody({
    urlencoded: true,
    multipart: true
}))

app.use(async (ctx, next) => {

    const headers = {'Access-Control-Allow-Origin': '*'}
    if(ctx.request.method !== 'OPTIONS') {
        ctx.response.set({...headers});
        return await next();
    }
    
    if(ctx.request.get('Access-Control-Request-Method')) {
        ctx.response.set({...headers, 'Access-Control-Allow-Methods': 'DELETE, PUT, PATCH, GET, POST'});

    }

    if (ctx.request.get('Access-Control-Request-Headers')) {
        ctx.response.set('Access-Control-Allow-Headers', ctx.request.get('Access-Control-Request-Headers'));
      }
    
    ctx.response.status = 204;
});

const router = new Router();

router.post('/login', async ctx => {
    const {username} = ctx.request.body;
    if(!users.has(username)) {
        users.add(username);
        ctx.response.body = JSON.stringify({status: 0});

        setTimeout((uName) => {
            if(!clients.hasOwnProperty(uName)) users.delete(uName);
            
        }, 1500, username);
        return;
    }
    ctx.response.body = JSON.stringify({status: 1});
});

app.use(router.routes()).use(router.allowedMethods());

const options = {
    key: fs.readFileSync(path.resolve(process.cwd(), 'certs/privkey.pem'), 'utf8'),
    cert: fs.readFileSync(path.resolve(process.cwd(), 'certs/cert.pem'), 'utf8'),
    
}
const server =https.createServer(options, app.callback());
//const server = http.createServer(app.callback());

const wsServer = new WS.Server({server});


wsServer.on('connection', (ws, req) => {

    const date = new Date();
    const timeStamp = date.getDate() + '.' + (date.getMonth() + 1) + '.' + date.getFullYear() + ' '
                            + date.getHours() + ':' + date.getMinutes();
    const username = String(url.parse(req.url, true).query.username);
    ws.id = username;
    
    const welcomeMessage =  {type: 'newUser', newUser: username, user: 'Server:', 
                                timestamp: timeStamp, message: `Пользователь ${username} онлайн.` };
      
    for(let key in clients) {
        if(clients[key].readyState === 1 ) {
            clients[key].send(JSON.stringify(welcomeMessage));
        }
    }

    clients[username] = ws;
    
    ws.send(JSON.stringify({type: 'init', onlineUsers:Array.from(users), fullChat: messages}))
        
    ws.on('message', msg => {
       
        const message = JSON.parse(msg.toString());
        messages.push(message);
        for(let key in clients) {
            if(clients[key].readyState === 1 ) {
                clients[key].send(JSON.stringify(message));
            }
        }
        return;
    });

    ws.on('close', msg => {
        const date = new Date();
        const timeStamp = date.getDate() + '.' + (date.getMonth() + 1) + '.' + date.getFullYear() + ' '
                            + date.getHours() + ':' + date.getMinutes();
        
        const removeMessage = {type: 'delUser', delUser: ws.id, user: 'Server',
                                    timestamp: timeStamp, message: `Пользователь: ${ws.id} покинул чат.`}
        
        users.delete(ws.id);
        delete clients[ws.id];

        for(let key in clients) {
            if(clients[key].readyState === 1 ) {
                clients[key].send(JSON.stringify(removeMessage));
            }
        }
        return;
    });

    ws.on('error', msg => {
        return msg = false;
    })
    return;
})

server.listen(7070, (err) => {
    if(err) {
        console.log(err);
        return;
    }
});
