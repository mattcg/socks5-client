var net = require('net');
var stream = require('stream');
//var sprintf = require('sprintf').sprintf;
var inherits = require('util').inherits;

exports.createConnection = function(options) {
	var socksSocket = new Socks5ClientSocket(options.host, options.port);
	
	return socksSocket.connect(options.port, options.host);
};

function Socks5ClientSocket(socksHost, socksPort) {
	stream.Stream.call(this);

	this._socket = new net.Socket();
	this._socksHost = socksHost;
	this._socksPort = socksPort;
}

//inherits(Socks5ClientSocket, net.Socket);
inherits(Socks5ClientSocket, stream.Stream);

Socks5ClientSocket.prototype.setTimeout = function(msecs, callback) {
	this._socket.setTimeout(msecs, callback);
};

Socks5ClientSocket.prototype.setNoDelay = function() {
	this._socket.setNoDelay();
};

Socks5ClientSocket.prototype.setKeepAlive = function(setting, msecs) {
	this._socket.setKeepAlive(setting, msecs);
};

Socks5ClientSocket.prototype.address = function() {
	return this._socket.address();
};

Socks5ClientSocket.prototype.pause = function() {
	this._socket.pause();
};

Socks5ClientSocket.prototype.resume = function() {
	this._socket.resume();
};

Socks5ClientSocket.prototype.end = function(data, encoding) {
	return this._socket.end(data, encoding);
};

Socks5ClientSocket.prototype.destroy = function(exception) {
	this._socket.destroy(exception);
};

Socks5ClientSocket.prototype.destroySoon = function() {
	this._socket.destroySoon();
	this.writable = false; // node's http library asserts writable to be false after destroySoon
};

Socks5ClientSocket.prototype.setEncoding = function(encoding) {
	this._socket.setEncoding(encoding);
};

Socks5ClientSocket.prototype.write = function(data, arg1, arg2) {
	return this._socket.write(data, arg1, arg2);
};

Socks5ClientSocket.prototype.connect = function(port, host) {
	var self = this;
	self._socket.connect(self._socksPort, self._socksHost, function() {
		self.establishSocksConnection(host, port);
	});

	return self;
};

Socks5ClientSocket.prototype.establishSocksConnection = function(host, port) {
  var self = this;

  self.authenticate(function() {
	self.connectSocksToHost(host, port, function() {
	  self._socket.on('data', function(data) {
		self.emit('data', data);
	  });

	  self._socket.on('close', function(had_error) {
		self.emit('close', had_error);
	  });

	  self._socket.on('end', function() {
		self.emit('end');
	  });

	  self._socket.on('error', function(error) {
		self.emit('error', error);
	  });

	  self._socket._httpMessage = self._httpMessage;
	  self._socket.parser = self.parser;
	  self._socket.ondata = self.ondata;
	  self.writable = true;
	  self.emit('connect');
	});
  });
};

Socks5ClientSocket.prototype.authenticate = function(cb) {
  var self = this;
  self._socket.ondata = function(d, start, end) {
	if(end - start != 2) {
	  throw new Error('SOCKS authentication failed. Unexpected number of bytes received');
	}

	if(d[start] != 0x05) {
	  throw new Error('SOCKS authentication failed. Unexpected SOCKS version number: ' + d[start]);
	}

	if(d[start + 1] != 0x00) {
	  throw new Error('SOCKS authentication failed. Unexpected SOCKS authentication method: ' + d[start+1]);
	}

	if (cb) cb();
  };

  var request = new Buffer(3);
  request[0] = 0x05;  // SOCKS version
  request[1] = 0x01;  // number of authentication methods
  request[2] = 0x00;  // no authentication
  self._socket.write(request);
};

Socks5ClientSocket.prototype.connectSocksToHost = function(host, port, cb) {
  this._socket.ondata = function(d, start, end) {
	if(d[start] != 0x05) {
	  throw new Error('SOCKS connection failed. Unexpected SOCKS version number: ' + d[start]);
	}

	if(d[start+1] != 0x00) {
	  var msg = get_error_message(d[start+1]);
	  throw new Error('SOCKS connection failed. ' + msg);
	}

	if(d[start+2] != 0x00) {
	  throw new Error('SOCKS connection failed. The reserved byte must be 0x00');
	}

	var address = '';
	var address_length = 0;

	switch(d[start+3]) {
	  case 1:
		address = d[start+4] + '.' + d[start+5] + '.' + d[start+6] + '.' + d[start+7];
		address_length = 4;
		break;
	  case 3:
		address_length = d[start+4] + 1;
		for(var i = start + 5; i < start + address_length; i++) {
			address += String.fromCharCode(d[i]);
		}
		break;
	  case 4:
		address_length = 16;
		break;
	  default:
		throw new Error('SOCKS connection failed. Unknown addres type: ' + d[start+3]);
	}

	var portIndex = start + 4 + address_length;
	var port = d[portIndex] * 256 + d[portIndex+1];

	var boundAddress = {
	  'address':  address,
	  'port':		 port
	};

	if(cb) cb();
  };

  var buffer = [];
  buffer.push(0x05);  // SOCKS version
  buffer.push(0x01);  // command code: establish a TCP/IP stream connection
  buffer.push(0x00);  // reserved - myst be 0x00

  switch(net.isIP(host)) {
	case 0:
	  buffer.push(0x03);
	  parseDomainName(host, buffer);
	  break;
	case 4:
	  buffer.push(0x01);
	  parseIPv4(host, buffer);
	  break;
	case 6:
	  buffer.push(0x04);
	  parseIPv6(host, buffer);
	  break;
  }

  parsePort(port, buffer);

  var request = new Buffer(buffer);
  this._socket.write(request);
}

function parseIPv4(host, buffer) {
  var groups = host.split('.');
  for(var i=0; i < groups.length; i++) {
	var ip = parseInt(groups[i]);
	buffer.push(ip);
  }
}

function parseIPv6(host, buffer) {
  var address = new ipv6.Address(host).canonical_form();
  var groups = address.split(':');
  for(var i=0; i < groups.length; i++) {
	var part1 = groups[i].substr(0,2);
	var part2 = groups[i].substr(2,2);

	var b1 = parseInt(part1, 16);
	var b2 = parseInt(part2, 16);

	buffer.push(b1);
	buffer.push(b2);
  }
}

function parseDomainName(host, buffer) {
  buffer.push(host.length);
  for(var i=0; i < host.length; i++) {
	var c = host.charCodeAt(i);
	buffer.push(c);
  }
}

function parsePort(port, buffer) {
	//var portStr = sprintf("%04d", port);
	var byte1, byte2;
	var portStr = number.toString();

	while (portStr.length < 4) {
		portStr = '0' + portStr;
	}

	byte1 = parseInt(portStr.substr(0,2));
	byte2 = parseInt(portStr.substr(2,2));

	buffer.push(byte1);
	buffer.push(byte2);
}

function get_error_message(code) {
  switch(code) {
	case 1:
	  return 'General SOCKS server failure';
	case 2:
	  return 'Connection not allowed by ruleset';
	case 3:
	  return 'Network unreachable';
	case 4:
	  return 'Host unreachable';
	case 5:
	  return 'Connection refused';
	case 6:
	  return 'TTL expired';
	case 7:
	  return 'Command not supported';
	case 8:
	  return 'Address type not supported';
	default:
	  return 'Unknown status code ' + code;
  }
}
