
module.exports.index = function(req, res, next, args) {
  res.end('Dns Server Control');
};

module.exports.sd = function(req, res, next, args) {
  var zonefile = require('dns-zonefile');
  var text = require('fs').readFileSync(global.path('/rpc_modules/win_dns_server/dns_out.txt', 'utf8'));
  output = zonefile.parse(text.toString());
  res.json(output);
};