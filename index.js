/*jshint node:true*/
'use strict';

var Socket = require('./lib/Socket');

exports.Socket = Socket;

exports.createConnection = function(options) {
	return new Socket(options).connect(options.port, options.host);
};
