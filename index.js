/*jshint node:true*/
'use strict';

var Socket = require('./lib/Socket');

exports.Socket = Socket;

exports.createConnection = function(options) {
	var host = options.hostname || (options.host && options.host.split(":")[0])
	return new Socket(options).connect(options.port, host);
};
