'use strict';

/*jshint node:true*/

var Socks5ClientSocket = require('./lib/Socks5ClientSocket');

exports.createConnection = function(options) {
	var socksSocket, socksHost, socksPort;

	socksHost = options.socksHost || 'localhost';
	socksPort = options.socksPort || 1080;

	socksSocket = new Socks5ClientSocket(socksHost, socksPort);

	return socksSocket.connect(options.port, options.host);
};
