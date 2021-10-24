const http = require('http');
const fs = require('fs');

const server = http.createServer((req, res) => {
    let { url } = req;
    let contentType = ['text/html', 'text/css', 'text/javascript'];
    let index = 0;

    if ( url.indexOf('.css') !== -1 ) {
        index = 1;
    } else if ( url.indexOf('.js') !== -1 ) {
        index = 2;
    } else if ( url.indexOf('.html') !== -1 ) {
        fs.readFile(__dirname + url, 'utf-8', (err, content) => {
            res.end(content);
        });
    }
    
    res.writeHead(200, { 'Content-Type': contentType[index] });

    if (index > 0) {
        fs.readFile(__dirname + url, (err, content) => {
            res.end(content);
        });
    } else {
        fs.readFile(__dirname + '/index.html', 'utf-8', (err, content) => {
            res.end(content);
        });
    }

});

server.listen(9091);
