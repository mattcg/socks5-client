'use strict';

/*jshint node:true*/

var Socket = require('./lib/Socket');

exports.Socket = Socket;

exports.createConnection = function(options) {
	var socksSocket, socksHost, socksPort;

	socksHost = options.socksHost || 'localhost';
	socksPort = options.socksPort || 1080;

	socksSocket = new Socket(socksHost, socksPort);

	return socksSocket.connect(options.port, options.host);
};
